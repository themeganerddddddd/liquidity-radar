import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { strFromU8, unzipSync } from "fflate";
import type { PublicDataSnapshot } from "../lib/public-data";
import type { ChicagoPropertySnapshot } from "../lib/chicago-property";
import {
  courtListenerSaleEvents,
  officialTransactionNewsEvents,
  parseFccDailyAssignments,
  parseOfficialRss,
  type CourtListenerSearchResult,
} from "../lib/free-source-signals";
import {
  SOURCE_ADAPTERS,
  aggregatePeopleInMotion,
  calculateLeadTime,
  classifyNewsTransaction,
  dedupeSourceEvents,
  estimatePotentialLiquidity,
  eventClusterKey,
  isQualifiedTransportationRecord,
  normalizeEntityName,
  scoreActionability,
  scoreConfidence,
  sourceValueMetrics,
  stableId,
  type EvidenceClassification,
  type MoneyMotionRecord,
  type MoneyMotionSnapshot,
  type MotionEvidence,
  type NormalizedSourceEvent,
  type SourceHealth,
} from "../lib/money-in-motion";
import {
  emptyGdeltState,
  matchesGdeltHeadline,
  runGdeltIncremental,
  type GdeltArticle,
  type GdeltPersistentState,
} from "../lib/gdelt-client";
import {
  emptyUsptoOdpState,
  runUsptoOdpSync,
  type UsptoOdpState,
} from "../lib/uspto-odp";
import { writeClientMotionSnapshot } from "./write-client-motion-snapshot";

const root = process.cwd();
const publicDataPath = path.join(root, "public", "data", "public-signals.json");
const outputPath = path.join(root, "public", "data", "money-in-motion.json");
const clientOutputPath = path.join(
  root,
  "public",
  "data",
  "money-in-motion-client.json.gz",
);
const chicagoPropertyPath = path.join(
  root,
  "public",
  "data",
  "chicago-property.json",
);
const chicagoPropertyEventsPath = path.join(
  root,
  "public",
  "data",
  "chicago-property-motion-events.json",
);
const gdeltStatePath = path.join(
  root,
  "public",
  "data",
  "gdelt-sync-state.json",
);
const cmsOwnerCachePath = path.join(
  root,
  "public",
  "data",
  "cms-owner-cache.json.gz",
);
const stbStatePath = path.join(root, "public", "data", "stb-sync-state.json");
const usptoStatePath = path.join(
  root,
  "public",
  "data",
  "uspto-sync-state.json.gz",
);
const generatedAt = new Date().toISOString();

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const bytes = await fs.readFile(filePath);
    const text = filePath.endsWith(".gz")
      ? gunzipSync(bytes).toString("utf8")
      : bytes.toString("utf8");
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function writeGzipJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, gzipSync(JSON.stringify(value), { level: 9 }));
}

const stateNames: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

function location(input?: {
  city?: string;
  state?: string;
  country?: string;
  basis?: string;
}) {
  const state = (input?.state || "").trim();
  return {
    country: input?.country || (stateNames[state] ? "United States" : ""),
    state: stateNames[state] || state,
    city: (input?.city || "").replace(/\s+METRO$/i, "").trim(),
    basis: input?.basis || "not_established",
  };
}

function sourceEvent(input: Omit<NormalizedSourceEvent, "raw_payload_hash">) {
  return {
    ...input,
    raw_payload_hash: stableId(
      input.source_id,
      input.external_record_id,
      JSON.stringify(input.metadata),
    ),
  };
}

function secEvents(data: PublicDataSnapshot): NormalizedSourceEvent[] {
  const events: NormalizedSourceEvent[] = data.liquidity.events.map((event) =>
    sourceEvent({
      source_id: "sec",
      source_type: event.form,
      external_record_id: event.id,
      source_url: event.sourceUrl,
      retrieved_at: data.generatedAt,
      published_at: event.filingDate,
      event_date: event.transactionDate || event.filingDate,
      event_type: "SECONDARY_SALE",
      event_stage: event.status === "completed" ? "POST_LIQUIDITY" : "PRE_SALE",
      raw_title: `${event.reportingParty} — ${event.status === "completed" ? "reported sale" : "proposed sale"} of ${event.issuer}`,
      raw_text: event.note,
      seller_entity: event.reportingParty,
      buyer_entity: "",
      subject_person: event.reportingParty,
      subject_company: event.issuer,
      asset: event.securityTitle,
      location: location({ ...event.location, basis: event.locationBasis }),
      reported_transaction_value: event.grossAmount || null,
      currency: "USD",
      ownership_percentage_low:
        event.attributionBasis === "joint_filing_unallocated" ? null : 1,
      ownership_percentage_high:
        event.attributionBasis === "joint_filing_unallocated" ? null : 1,
      status: event.status,
      metadata: {
        accession: event.accession,
        form: event.form,
        relationship: event.relationship,
        shares: event.shares,
        pricePerShare: event.pricePerShare,
        valueClassification:
          event.amountClassification === "observed" ? "KNOWN" : "REPORTED",
        marketClass: "PUBLIC",
        subjectKind: "PERSON",
        attributionBasis: event.attributionBasis || "single_reporting_owner",
        publisher: "U.S. Securities and Exchange Commission",
      },
    }),
  );

  for (const exit of data.completedExits?.records ?? []) {
    if (exit.ownerAttributions.length) {
      for (const owner of exit.ownerAttributions) {
        events.push(
          sourceEvent({
            source_id: "sec",
            source_type: "Form 8-K Item 2.01 + ownership filing",
            external_record_id: `${exit.id}:${owner.name}`,
            source_url: exit.sourceUrl,
            retrieved_at: data.generatedAt,
            published_at: exit.filedAt,
            event_date: exit.completedAt,
            event_type:
              exit.transactionType === "merger" ? "MERGER" : "BUSINESS_SALE",
            event_stage: "POST_LIQUIDITY",
            raw_title: `${exit.subjectBusiness} transaction completed`,
            raw_text: `${exit.consideration.summary} ${owner.note}`,
            seller_entity: exit.sellerOrTarget,
            buyer_entity: exit.buyer,
            subject_person: owner.kind === "person" ? owner.name : "",
            subject_company: exit.subjectBusiness,
            asset: exit.subjectBusiness,
            location: location({
              ...owner.location,
              basis: exit.location.basis,
            }),
            reported_transaction_value: owner.attributedCash,
            currency: exit.consideration.currency,
            ownership_percentage_low: owner.attributedCash ? 1 : null,
            ownership_percentage_high: owner.attributedCash ? 1 : null,
            status: "completed",
            metadata: {
              accession: exit.accession,
              relationship: owner.relationship,
              valueClassification:
                owner.amountClassification === "observed"
                  ? "KNOWN"
                  : "REPORTED",
              marketClass: "PUBLIC",
              subjectKind: owner.kind === "person" ? "PERSON" : "ORGANIZATION",
              publisher: "U.S. Securities and Exchange Commission",
              ownershipSourceUrl: owner.sourceUrl,
              considerationSummary: exit.consideration.summary,
            },
          }),
        );
      }
    } else {
      events.push(
        sourceEvent({
          source_id: "sec",
          source_type: "Form 8-K Item 2.01",
          external_record_id: exit.id,
          source_url: exit.sourceUrl,
          retrieved_at: data.generatedAt,
          published_at: exit.filedAt,
          event_date: exit.completedAt,
          event_type:
            exit.transactionType === "merger" ? "MERGER" : "BUSINESS_SALE",
          event_stage: "CLOSED",
          raw_title: `${exit.subjectBusiness} transaction completed`,
          raw_text: `${exit.consideration.summary} ${exit.note}`,
          seller_entity: exit.sellerOrTarget,
          buyer_entity: exit.buyer,
          subject_person: "",
          subject_company: exit.subjectBusiness,
          asset: exit.subjectBusiness,
          location: location({ ...exit.location, basis: exit.location.basis }),
          reported_transaction_value:
            exit.consideration.totalAmount || exit.consideration.cashAmount,
          currency: exit.consideration.currency,
          ownership_percentage_low: null,
          ownership_percentage_high: null,
          status: "completed",
          metadata: {
            accession: exit.accession,
            valueClassification:
              exit.consideration.classification === "observed"
                ? "KNOWN"
                : exit.consideration.classification === "partially_disclosed"
                  ? "REPORTED"
                  : "UNKNOWN",
            marketClass: "PUBLIC",
            subjectKind: "ORGANIZATION",
            publisher: "U.S. Securities and Exchange Commission",
            considerationSummary: exit.consideration.summary,
          },
        }),
      );
    }
  }
  return events;
}

function ftcEvents(data: PublicDataSnapshot): NormalizedSourceEvent[] {
  return (data.exitSignals?.records ?? []).map((event) =>
    sourceEvent({
      source_id: "ftc_hsr",
      source_type: "HSR early-termination notice",
      external_record_id: event.id,
      source_url: event.sourceUrl,
      retrieved_at: data.generatedAt,
      published_at: event.date,
      event_date: event.date,
      event_type: "ACQUISITION",
      event_stage: "PENDING_REGULATORY",
      raw_title: `${event.acquiringParty} / ${event.acquiredParty}`,
      raw_text: event.note,
      seller_entity: event.acquiredParty,
      buyer_entity: event.acquiringParty,
      subject_person: "",
      subject_company: event.acquiredEntities[0] || event.acquiredParty,
      asset: event.acquiredEntities.join(", "),
      location: location({
        city: event.businessProfiles?.[0]?.headquarters.city,
        state: event.businessProfiles?.[0]?.headquarters.state,
        country: event.businessProfiles?.[0]?.headquarters.country,
        basis: event.businessProfiles?.[0]?.locationBasis,
      }),
      reported_transaction_value: null,
      currency: "USD",
      ownership_percentage_low: null,
      ownership_percentage_high: null,
      status: event.status,
      metadata: {
        valueClassification: "UNKNOWN",
        marketClass: "PRIVATE",
        subjectKind: "ORGANIZATION",
        publisher: "Federal Trade Commission",
        industry: event.businessProfiles?.[0]?.industry || "",
      },
    }),
  );
}

type CmsChowRow = Record<string, string>;
type CmsOwnerRow = Record<string, string>;
type CmsOwnerCache = {
  version: 1;
  updatedAt: string;
  ownersByEnrollment: Record<string, CmsOwnerRow[]>;
};

async function fetchCmsChow(): Promise<{
  events: NormalizedSourceEvent[];
  rows: CmsChowRow[];
  health: Partial<SourceHealth>;
}> {
  const started = Date.now();
  const feeds = [
    {
      datasetId: "f557a6ed-95b3-4a22-8433-4175db2dec1c",
      ownerDatasetId: "afe44b85-cc6d-40d7-b5df-00ae8910d1d2",
      label: "Skilled nursing facility",
      sourceUrl:
        "https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/skilled-nursing-facility-change-of-ownership",
    },
    {
      datasetId: "c04031db-54ce-461c-85d1-d2613d71f167",
      ownerDatasetId: "029c119f-f79c-49be-9100-344d31d10344",
      label: "Hospital",
      sourceUrl:
        "https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/hospital-change-of-ownership",
    },
  ];
  try {
    const payloads = await Promise.all(
      feeds.map(async (feed) => {
        const response = await fetch(
          `https://data.cms.gov/data-api/v1/dataset/${feed.datasetId}/data?size=5000&offset=0`,
          {
            headers: { "User-Agent": "LiquidityRadar/0.3 public-record-sync" },
            signal: AbortSignal.timeout(30_000),
          },
        );
        if (!response.ok)
          throw new Error(`${feed.label} CMS API returned ${response.status}`);
        return ((await response.json()) as CmsChowRow[]).map(
          (row): CmsChowRow => ({
            ...row,
            __DATASET_ID: feed.datasetId,
            __OWNER_DATASET_ID: feed.ownerDatasetId,
            __PROVIDER_FAMILY: feed.label,
            __SOURCE_URL: feed.sourceUrl,
          }),
        );
      }),
    );
    const rows: CmsChowRow[] = payloads.flat();
    const eligible = rows.filter((row) => row["EFFECTIVE DATE"]);
    const accepted = eligible
      .sort((left, right) =>
        right["EFFECTIVE DATE"].localeCompare(left["EFFECTIVE DATE"]),
      )
      .slice(0, 500);
    return {
      events: accepted.map((row) => {
        const datasetId = row.__DATASET_ID;
        const sourceUrl = row.__SOURCE_URL;
        const buyer =
          row["ORGANIZATION NAME - BUYER"] ||
          row["DOING BUSINESS AS NAME - BUYER"] ||
          "Undisclosed buyer";
        const seller =
          row["ORGANIZATION NAME - SELLER"] ||
          row["DOING BUSINESS AS NAME - SELLER"] ||
          "Undisclosed seller";
        const eventDate = row["EFFECTIVE DATE"];
        const externalId = [
          row["ENROLLMENT ID - BUYER"],
          row["ENROLLMENT ID - SELLER"],
          eventDate,
        ].join(":");
        return sourceEvent({
          source_id: "cms_chow",
          source_type: `${row.__PROVIDER_FAMILY || "CMS provider"}: ${row["CHOW TYPE TEXT"] || "CHANGE OF OWNERSHIP"}`,
          external_record_id: externalId,
          source_url: sourceUrl,
          retrieved_at: generatedAt,
          published_at: generatedAt.slice(0, 10),
          event_date: eventDate,
          event_type: "HEALTHCARE_CHOW",
          event_stage: "CLOSED",
          raw_title: `${row["DOING BUSINESS AS NAME - BUYER"] || buyer} — CMS change of ownership`,
          raw_text: `${seller} to ${buyer}; ${row["PROVIDER TYPE TEXT - BUYER"] || row.__PROVIDER_FAMILY || "CMS-enrolled provider"}.`,
          seller_entity: seller,
          buyer_entity: buyer,
          subject_person: "",
          subject_company:
            row["DOING BUSINESS AS NAME - BUYER"] ||
            row["DOING BUSINESS AS NAME - SELLER"] ||
            buyer,
          asset: row["CCN - BUYER"] ? `CMS CCN ${row["CCN - BUYER"]}` : "",
          location: location({
            state:
              row["ENROLLMENT STATE - BUYER"] ||
              row["ENROLLMENT STATE - SELLER"],
            basis: "CMS provider enrollment state",
          }),
          reported_transaction_value: null,
          currency: "USD",
          ownership_percentage_low: null,
          ownership_percentage_high: null,
          status: row["CHOW TYPE TEXT"] || "CHANGE OF OWNERSHIP",
          metadata: {
            datasetId,
            buyerNpi: row["NPI - BUYER"],
            sellerNpi: row["NPI - SELLER"],
            valueClassification: "UNKNOWN",
            marketClass: "PRIVATE",
            subjectKind: "ORGANIZATION",
            publisher: "Centers for Medicare & Medicaid Services",
            industry: "Healthcare",
          },
        });
      }),
      rows: accepted,
      health: {
        lastSuccessAt: generatedAt,
        recordsSeen: rows.length,
        recordsAccepted: accepted.length,
        recordsRejected: rows.length - eligible.length,
        latencyMs: Date.now() - started,
        requests: feeds.length,
        successfulQueries: feeds.length,
      },
    };
  } catch (error) {
    return {
      events: [],
      rows: [],
      health: {
        recordsSeen: 0,
        recordsAccepted: 0,
        recordsRejected: 0,
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

async function enrichCmsOwners(rows: CmsChowRow[]) {
  const cache = await readJson<CmsOwnerCache>(cmsOwnerCachePath, {
    version: 1,
    updatedAt: "",
    ownersByEnrollment: {},
  });
  const enrollmentKeys = [
    ...new Set(
      rows
        .filter((row) => row["ENROLLMENT ID - BUYER"])
        .map(
          (row) => `${row.__OWNER_DATASET_ID}:${row["ENROLLMENT ID - BUYER"]}`,
        ),
    ),
  ];
  const missing = enrollmentKeys
    .filter((key) => !(key in cache.ownersByEnrollment))
    .slice(0, 25);
  let requests = 0;
  let errors = 0;
  for (const key of missing) {
    const separator = key.indexOf(":");
    const datasetId = key.slice(0, separator);
    const enrollmentId = key.slice(separator + 1);
    const parameters = new URLSearchParams({
      size: "500",
      offset: "0",
      "filter[ENROLLMENT ID]": enrollmentId,
    });
    requests += 1;
    try {
      const response = await fetch(
        `https://data.cms.gov/data-api/v1/dataset/${datasetId}/data?${parameters}`,
        {
          headers: { "User-Agent": "LiquidityRadar/0.2 public-record-sync" },
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      cache.ownersByEnrollment[key] = (await response.json()) as CmsOwnerRow[];
    } catch {
      errors += 1;
    }
  }
  cache.updatedAt = generatedAt;
  await writeGzipJson(cmsOwnerCachePath, cache);

  const events = rows.flatMap((row) => {
    const enrollmentId = row["ENROLLMENT ID - BUYER"];
    const datasetId = row.__OWNER_DATASET_ID;
    const cacheKey = `${datasetId}:${enrollmentId}`;
    const ownerRows = cache.ownersByEnrollment[cacheKey] || [];
    return ownerRows.flatMap((owner) => {
      if (owner["TYPE - OWNER"] !== "I") return [];
      const person = [
        owner["FIRST NAME - OWNER"],
        owner["MIDDLE NAME - OWNER"],
        owner["LAST NAME - OWNER"],
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (!person) return [];
      const rawPercentage = Number(owner["PERCENTAGE OWNERSHIP"]);
      const percentage =
        Number.isFinite(rawPercentage) && rawPercentage > 0
          ? Math.min(1, rawPercentage / 100)
          : null;
      const buyer =
        row["ORGANIZATION NAME - BUYER"] ||
        row["DOING BUSINESS AS NAME - BUYER"] ||
        "CMS-enrolled provider";
      const seller =
        row["ORGANIZATION NAME - SELLER"] ||
        row["DOING BUSINESS AS NAME - SELLER"] ||
        "Undisclosed seller";
      const eventDate = row["EFFECTIVE DATE"];
      const transactionId = [
        enrollmentId,
        row["ENROLLMENT ID - SELLER"],
        eventDate,
      ].join(":");
      return [
        sourceEvent({
          source_id: "cms_chow",
          source_type: "CMS CHOW + all-owners attribution",
          external_record_id: `${transactionId}:${owner["ASSOCIATE ID - OWNER"]}`,
          source_url:
            "https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/provider-information",
          retrieved_at: generatedAt,
          published_at: generatedAt.slice(0, 10),
          event_date: eventDate,
          event_type: "HEALTHCARE_CHOW",
          event_stage: "CLOSED",
          raw_title: `${buyer} — change of ownership associated with ${person}`,
          raw_text: `${person} is listed by CMS as ${owner["ROLE TEXT - OWNER"] || "an owner"}${percentage === null ? "; no ownership percentage was reported" : ` with ${rawPercentage}% ownership`}. ${seller} transferred to ${buyer}.`,
          seller_entity: seller,
          buyer_entity: buyer,
          subject_person: person,
          subject_company: row["DOING BUSINESS AS NAME - BUYER"] || buyer,
          asset: row["CCN - BUYER"] ? `CMS CCN ${row["CCN - BUYER"]}` : "",
          location: location({
            state:
              row["ENROLLMENT STATE - BUYER"] ||
              row["ENROLLMENT STATE - SELLER"],
            basis:
              "CMS provider enrollment state; owner home addresses are excluded",
          }),
          reported_transaction_value: null,
          currency: "USD",
          ownership_percentage_low: percentage,
          ownership_percentage_high: percentage,
          status: row["CHOW TYPE TEXT"] || "CHANGE OF OWNERSHIP",
          metadata: {
            datasetId,
            transactionId,
            role: owner["ROLE TEXT - OWNER"] || "Owner",
            valueClassification: "UNKNOWN",
            marketClass: "PRIVATE",
            subjectKind: "PERSON",
            publisher: "Centers for Medicare & Medicaid Services",
            industry: "Healthcare",
            ownershipEvidence: percentage !== null,
          },
        }),
      ];
    });
  });
  const ownerRowsSeen = [
    ...new Set(
      rows
        .filter((row) => row["ENROLLMENT ID - BUYER"])
        .map(
          (row) => `${row.__OWNER_DATASET_ID}:${row["ENROLLMENT ID - BUYER"]}`,
        ),
    ),
  ].reduce((sum, key) => sum + (cache.ownersByEnrollment[key] || []).length, 0);
  return { events, requests, errors, cache, ownerRowsSeen };
}

function gdeltDate(value = "") {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})/);
  return match
    ? `${match[1]}-${match[2]}-${match[3]}`
    : generatedAt.slice(0, 10);
}

function extractMoney(value: string) {
  const match = value.match(/\$\s?([\d,.]+)\s*(billion|million|bn|mm|m|b)\b/i);
  if (!match) return null;
  const amount = Number(match[1].replaceAll(",", ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = match[2].toLowerCase();
  return Math.round(amount * (/^(billion|bn|b)$/.test(unit) ? 1e9 : 1e6));
}

function cleanNewsParty(value: string) {
  return value
    .replace(/\s+-\s+[^-]{2,80}$/, "")
    .replace(/^(?:report:|exclusive:)\s*/i, "")
    .replace(/[,:;.]$/, "")
    .trim();
}

function extractGdeltParties(title: string) {
  const withoutValue = title.replace(
    /\s+(?:in|for)\s+\$\s?[\d,.]+\s*(?:billion|million|bn|mm|m|b)\b.*$/i,
    "",
  );
  let match = withoutValue.match(
    /^(.+?)\s+(?:has been |was )?acquired by\s+(.+)$/i,
  );
  if (match)
    return {
      seller: cleanNewsParty(match[1]),
      buyer: cleanNewsParty(match[2]),
    };
  match = withoutValue.match(
    /^(.+?)\s+(?:has |will |agreed to )?acquir(?:e[sd]?|ing)\s+(.+)$/i,
  );
  if (match)
    return {
      seller: cleanNewsParty(match[2]),
      buyer: cleanNewsParty(match[1]),
    };
  match = withoutValue.match(/^(.+?)\s+(?:has )?sold\s+(.+?)\s+to\s+(.+)$/i);
  if (match)
    return {
      seller: cleanNewsParty(match[1]),
      buyer: cleanNewsParty(match[3]),
    };
  match = withoutValue.match(/^(.+?)\s+(?:has been )?sold to\s+(.+)$/i);
  if (match)
    return {
      seller: cleanNewsParty(match[1]),
      buyer: cleanNewsParty(match[2]),
    };
  return { seller: "", buyer: "" };
}

function gdeltEvent(article: GdeltArticle): NormalizedSourceEvent | null {
  if (!matchesGdeltHeadline(article.family, article.title)) return null;
  const classification =
    article.family === "pre_liquidity"
      ? ({ eventType: "BUSINESS_FOR_SALE", stage: "PRE_SALE" } as const)
      : classifyNewsTransaction(article.title);
  if (!classification) return null;
  const parties = extractGdeltParties(article.title);
  const date = gdeltDate(article.seendate);
  const value = extractMoney(article.title);
  return sourceEvent({
    source_id: "gdelt",
    source_type: `transaction-news:${article.family}`,
    external_record_id: stableId(article.url),
    source_url: article.url,
    retrieved_at: generatedAt,
    published_at: date,
    event_date: date,
    event_type: classification.eventType,
    event_stage: classification.stage,
    raw_title: article.title,
    raw_text: `Relevant publisher evidence headline: “${article.title}” GDELT supplies discovery and timing metadata only; no quoted executive, person, ownership, or proceeds are inferred from the headline.`,
    seller_entity: parties.seller,
    buyer_entity: parties.buyer,
    subject_person: "",
    subject_company: parties.seller,
    asset: parties.seller,
    location: location({
      country: article.sourcecountry || "",
      basis: "publisher country only; not a party location",
    }),
    reported_transaction_value: value,
    currency: "USD",
    ownership_percentage_low: null,
    ownership_percentage_high: null,
    status: classification.stage,
    metadata: {
      domain: article.domain,
      language: article.language,
      queryFamily: article.family,
      firstDetectedAt: date,
      latestReportedAt: date,
      canonicalUrl: article.url,
      evidenceSentence: article.title,
      transactionStage: classification.stage,
      valueClassification: value ? "REPORTED" : "UNKNOWN",
      marketClass: "PRIVATE",
      subjectKind: parties.seller ? "ORGANIZATION" : "UNKNOWN",
      publisher: article.domain || "GDELT-indexed publisher",
    },
  });
}

async function fetchGdelt(): Promise<{
  events: NormalizedSourceEvent[];
  health: Partial<SourceHealth>;
}> {
  const started = Date.now();
  const previous = await readJson<GdeltPersistentState>(
    gdeltStatePath,
    emptyGdeltState(),
  );
  const before = { ...previous.metrics };
  const result = await runGdeltIncremental({
    state: previous,
    maximumQueries: 3,
    familyOffset: Math.floor(Date.now() / (4 * 60 * 60 * 1000)),
  });
  await fs.writeFile(
    gdeltStatePath,
    `${JSON.stringify(result.state)}\n`,
    "utf8",
  );
  const events = result.articles.flatMap((article) => {
    const event = gdeltEvent(article);
    return event ? [event] : [];
  });
  const queryStates = Object.values(result.state.queries);
  const latestSuccess = queryStates
    .map((query) => query.lastSuccessAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  const nextRetry = queryStates
    .map((query) => query.nextRetryAt)
    .filter(Boolean)
    .sort()
    .at(0);
  const succeededThisRun =
    result.state.metrics.successfulQueries - before.successfulQueries > 0;
  const failedThisRun =
    result.state.metrics.failedRequests - (before.failedRequests || 0) > 0;
  const runErrors = queryStates.filter(
    (query) =>
      query.lastAttemptAt === result.state.updatedAt && query.lastErrorType,
  );
  const unhealthyStates = queryStates.filter(
    (query) => query.lastErrorType || query.nextRetryAt,
  );
  const errorState = runErrors[0] || unhealthyStates[0];
  const errorType = errorState?.lastErrorType || "";
  const effectiveNextRetry = nextRetry || "";
  return {
    events,
    health: {
      mode:
        failedThisRun || effectiveNextRetry || errorType ? "DEGRADED" : "LIVE",
      lastSuccessAt: latestSuccess || "",
      recordsSeen: result.articles.length,
      recordsAccepted: events.length,
      recordsRejected: result.articles.length - events.length,
      latencyMs: Date.now() - started,
      error: errorType
        ? `GDELT ${errorType}: ${errorState?.lastErrorSummary || "request failed"}`
        : "",
      errorType,
      watermark:
        queryStates
          .map((query) => query.watermark)
          .filter(Boolean)
          .sort()
          .at(-1) || "",
      nextRetryAt: effectiveNextRetry,
      requests: result.state.metrics.requests - before.requests,
      cacheHits: result.state.metrics.cacheHits - before.cacheHits,
      rateLimitCount:
        result.state.metrics.rateLimitCount - before.rateLimitCount,
      successfulQueries:
        result.state.metrics.successfulQueries - before.successfulQueries,
      reason:
        unhealthyStates.length && succeededThisRun
          ? "Successful GDELT query families completed; failed families retained their watermarks and entered isolated backoff."
          : "Public DOC 2.0 news discovery with strict transaction-language filtering, per-family watermarks, and persistent backoff.",
      details: {
        httpStatusDistribution: result.state.metrics.httpStatusDistribution,
        failedRequests:
          result.state.metrics.failedRequests - (before.failedRequests || 0),
        networkFailures:
          result.state.metrics.networkFailureCount -
          (before.networkFailureCount || 0),
        queryFamilies: Object.fromEntries(
          Object.entries(result.state.queries).map(([id, query]) => [
            id,
            {
              watermark: query.watermark,
              lastErrorType: query.lastErrorType,
              lastErrorSummary: query.lastErrorSummary,
            },
          ]),
        ),
      },
    },
  };
}

async function fetchFccAssignments(): Promise<{
  events: NormalizedSourceEvent[];
  health: Partial<SourceHealth>;
}> {
  const started = Date.now();
  const names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const day = names[new Date(generatedAt).getUTCDay()];
  const sourceUrl = `https://data.fcc.gov/download/pub/uls/daily/a_aa_${day}.zip`;
  try {
    const response = await fetch(sourceUrl, {
      headers: { "User-Agent": "LiquidityRadar/0.3 public-record-sync" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok)
      throw new Error(`FCC daily file returned ${response.status}`);
    const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
    const en = archive["EN.dat"] ? strFromU8(archive["EN.dat"]) : "";
    const hd = archive["HD.dat"] ? strFromU8(archive["HD.dat"]) : "";
    const events = parseFccDailyAssignments({
      en,
      hd,
      retrievedAt: generatedAt,
      sourceUrl,
    });
    return {
      events,
      health: {
        lastSuccessAt: generatedAt,
        recordsSeen: en.split(/\r?\n/).filter(Boolean).length,
        recordsAccepted: events.length,
        recordsRejected: 0,
        latencyMs: Date.now() - started,
        requests: 1,
        successfulQueries: 1,
        watermark:
          events
            .map((event) => event.event_date)
            .sort()
            .at(-1) || generatedAt.slice(0, 10),
      },
    };
  } catch (error) {
    return {
      events: [],
      health: {
        mode: "DEGRADED",
        recordsSeen: 0,
        recordsAccepted: 0,
        recordsRejected: 0,
        latencyMs: Date.now() - started,
        requests: 1,
        successfulQueries: 0,
        error: error instanceof Error ? error.message : String(error),
        errorType: "FETCH_OR_PARSE_ERROR",
      },
    };
  }
}

async function fetchBankruptcySales(): Promise<{
  events: NormalizedSourceEvent[];
  health: Partial<SourceHealth>;
}> {
  const started = Date.now();
  const searchUrl = new URL(
    "https://www.courtlistener.com/api/rest/v4/search/",
  );
  searchUrl.searchParams.set("q", '"363 sale" "purchase price"');
  searchUrl.searchParams.set("court_type", "FB");
  searchUrl.searchParams.set("type", "r");
  searchUrl.searchParams.set("order_by", "dateFiled desc");
  try {
    const response = await fetch(searchUrl, {
      headers: { "User-Agent": "LiquidityRadar/0.3 public-record-sync" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok)
      throw new Error(`CourtListener search returned ${response.status}`);
    const payload = (await response.json()) as {
      count?: number;
      results?: CourtListenerSearchResult[];
    };
    const results = payload.results || [];
    const events = courtListenerSaleEvents(results, generatedAt);
    return {
      events,
      health: {
        lastSuccessAt: generatedAt,
        recordsSeen: results.reduce(
          (sum, result) => sum + (result.recap_documents?.length || 0),
          0,
        ),
        recordsAccepted: events.length,
        recordsRejected: Math.max(0, results.length - events.length),
        latencyMs: Date.now() - started,
        requests: 1,
        successfulQueries: 1,
        watermark:
          events
            .map((event) => event.event_date)
            .sort()
            .at(-1) || "",
      },
    };
  } catch (error) {
    return {
      events: [],
      health: {
        mode: "DEGRADED",
        recordsSeen: 0,
        recordsAccepted: 0,
        recordsRejected: 0,
        latencyMs: Date.now() - started,
        requests: 1,
        successfulQueries: 0,
        error: error instanceof Error ? error.message : String(error),
        errorType: "FETCH_OR_PARSE_ERROR",
      },
    };
  }
}

async function fetchOfficialTransactionNews(): Promise<{
  events: NormalizedSourceEvent[];
  health: Partial<SourceHealth>;
}> {
  const started = Date.now();
  const feeds = [
    {
      publisher: "Federal Trade Commission",
      url: "https://www.ftc.gov/feeds/press-release.xml",
    },
    {
      publisher: "U.S. Department of Justice Antitrust Division",
      url: "https://www.justice.gov/news/rss?type=press_release&groupname=56&field_component=376&search_api_language=en&show_public_archived=0&require_all=0",
    },
  ];
  const events: NormalizedSourceEvent[] = [];
  let seen = 0;
  let successfulQueries = 0;
  const errors: string[] = [];
  await Promise.all(
    feeds.map(async (feed) => {
      try {
        const response = await fetch(feed.url, {
          headers: { "User-Agent": "LiquidityRadar/0.3 public-record-sync" },
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        const entries = parseOfficialRss(await response.text());
        seen += entries.length;
        events.push(
          ...officialTransactionNewsEvents({
            entries,
            publisher: feed.publisher,
            retrievedAt: generatedAt,
          }),
        );
        successfulQueries += 1;
      } catch (error) {
        errors.push(
          `${feed.publisher}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }),
  );
  return {
    events: [
      ...new Map(
        events.map((event) => [event.external_record_id, event]),
      ).values(),
    ],
    health: {
      mode: errors.length ? "DEGRADED" : "LIVE",
      lastSuccessAt: successfulQueries ? generatedAt : "",
      recordsSeen: seen,
      recordsAccepted: events.length,
      recordsRejected: Math.max(0, seen - events.length),
      latencyMs: Date.now() - started,
      requests: feeds.length,
      successfulQueries,
      error: errors.join("; "),
      errorType: errors.length ? "PARTIAL_FEED_ERROR" : "",
      watermark: generatedAt.slice(0, 10),
    },
  };
}

type StbState = {
  version: 1;
  updatedAt: string;
  firstDetectedAt: Record<string, string>;
};

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([\da-f]+);/gi, (_, number) =>
      String.fromCodePoint(Number.parseInt(number, 16)),
    )
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&nbsp;", " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchStb(): Promise<{
  events: NormalizedSourceEvent[];
  health: Partial<SourceHealth>;
}> {
  const started = Date.now();
  const sourceUrl = "https://www.stb.gov/proceedings-actions/case-status/";
  const state = await readJson<StbState>(stbStatePath, {
    version: 1,
    updatedAt: "",
    firstDetectedAt: {},
  });
  try {
    const response = await fetch(sourceUrl, {
      headers: { "User-Agent": "LiquidityRadar/0.2 public-record-sync" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`STB returned ${response.status}`);
    const html = await response.text();
    const table =
      html.match(
        /<table[^>]+id=["']tablepress-355["'][\s\S]*?<\/table>/i,
      )?.[0] || "";
    const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map((match) =>
        [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
          (cell) => cell[1],
        ),
      )
      .filter((cells) => cells.length >= 4);
    const relevant = rows.filter((cells) =>
      /acquisition|acquire|merger|control|sale|lease\s*(?:&|and)\s*operation|change of operator/i.test(
        decodeHtml(cells[1]),
      ),
    );
    const events = relevant.map((cells) => {
      const docket = decodeHtml(cells[0]);
      const title = decodeHtml(cells[1]);
      const nextAction = decodeHtml(cells[2]);
      const currentStatus = decodeHtml(cells[3]);
      const id = stableId(docket, title);
      const firstDetectedAt =
        state.firstDetectedAt[id] || generatedAt.slice(0, 10);
      state.firstDetectedAt[id] = firstDetectedAt;
      const href = cells[0].match(/href=["']([^"']+)/i)?.[1];
      const docketUrl = href ? new URL(href, sourceUrl).toString() : sourceUrl;
      const parts = title.split(/\s+[—–-]\s+/);
      const buyer = cleanNewsParty(parts[0] || "");
      const seller = cleanNewsParty(parts.at(-1) || "");
      return sourceEvent({
        source_id: "stb",
        source_type: "STB active case status",
        external_record_id: id,
        source_url: docketUrl,
        retrieved_at: generatedAt,
        published_at: firstDetectedAt,
        event_date: firstDetectedAt,
        event_type: "TRANSPORT_ASSET_TRANSFER",
        event_stage: "PENDING_REGULATORY",
        raw_title: title,
        raw_text: `Docket ${docket}. Current status: ${currentStatus || "not stated"}. Next action: ${nextAction || "not stated"}.`,
        seller_entity: seller === buyer ? "" : seller,
        buyer_entity: buyer,
        subject_person: "",
        subject_company: seller,
        asset: seller,
        location: location({
          basis: "No party location established in STB case-status table",
        }),
        reported_transaction_value: null,
        currency: "USD",
        ownership_percentage_low: null,
        ownership_percentage_high: null,
        status: currentStatus,
        metadata: {
          docket,
          firstDetectedAt,
          nextAction,
          valueClassification: "UNKNOWN",
          marketClass: "PRIVATE",
          subjectKind: "ORGANIZATION",
          publisher: "Surface Transportation Board",
          industry: "Transportation",
        },
      });
    });
    state.updatedAt = generatedAt;
    await fs.writeFile(stbStatePath, `${JSON.stringify(state)}\n`, "utf8");
    return {
      events,
      health: {
        lastSuccessAt: generatedAt,
        recordsSeen: rows.length,
        recordsAccepted: events.length,
        recordsRejected: rows.length - events.length,
        latencyMs: Date.now() - started,
        watermark: generatedAt,
        requests: 1,
        successfulQueries: 1,
      },
    };
  } catch (error) {
    return {
      events: [],
      health: {
        mode: "ERROR",
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
        errorType: "FETCH_OR_PARSE_ERROR",
        requests: 1,
      },
    };
  }
}

function evidenceFor(event: NormalizedSourceEvent): MotionEvidence {
  const classification =
    (event.metadata.valueClassification as
      EvidenceClassification | undefined) ||
    (event.reported_transaction_value ? "REPORTED" : "KNOWN");
  return {
    id: `${event.source_id}:${event.external_record_id}`,
    sourceId: event.source_id,
    publisher: String(event.metadata.publisher || event.source_id),
    title: event.raw_title,
    sourceUrl: event.source_url,
    publishedAt: event.published_at,
    retrievedAt: event.retrieved_at,
    classification,
    excerpt: event.raw_text,
  };
}

function confidenceFor(event: NormalizedSourceEvent) {
  const official = [
    "sec",
    "ftc_hsr",
    "cms_chow",
    "stb",
    "fcc_uls",
    "ferc",
    "uspto_assignments",
    "chicago_property",
  ].includes(event.source_id);
  const completed = ["CLOSED", "POST_LIQUIDITY"].includes(event.event_stage);
  const identity = Boolean(
    event.subject_person || event.subject_company || event.seller_entity,
  );
  const ownership =
    event.ownership_percentage_low !== null &&
    event.ownership_percentage_high !== null;
  const valuation = event.reported_transaction_value !== null;
  return scoreConfidence({
    sourceReliability: official ? 25 : event.source_id === "gdelt" ? 12 : 18,
    transactionCertainty: completed
      ? 25
      : event.event_stage === "PENDING_REGULATORY"
        ? 15
        : event.event_stage === "PRE_SALE"
          ? 12
          : 9,
    identityMatch: identity ? (event.subject_person ? 20 : 17) : 4,
    ownershipCertainty: ownership ? 15 : 0,
    valuationCertainty: valuation ? 15 : 0,
    explanation: [
      official
        ? "Official public record"
        : "Public news discovery; underlying publisher evidence required",
      completed ? "Completion or post-transaction record" : "Pre-close signal",
      ownership
        ? "Ownership or direct attribution supported"
        : "No ownership percentage inferred",
      valuation
        ? "Monetary value reported or filing-calculated"
        : "No transaction value reported",
    ],
  });
}

function recordFor(event: NormalizedSourceEvent): MoneyMotionRecord {
  const valueClassification =
    (event.metadata.valueClassification as
      EvidenceClassification | undefined) ||
    (event.reported_transaction_value ? "REPORTED" : "UNKNOWN");
  const estimate = estimatePotentialLiquidity({
    transactionValue: event.reported_transaction_value,
    currency: event.currency,
    valueClassification,
    ownershipLow: event.ownership_percentage_low,
    ownershipHigh: event.ownership_percentage_high,
    directlyAttributedGross:
      event.ownership_percentage_low === 1 &&
      event.ownership_percentage_high === 1,
  });
  const subject =
    event.subject_person || event.subject_company || event.seller_entity;
  const firstReportedAt =
    String(event.metadata.firstDetectedAt || "") ||
    event.published_at ||
    event.event_date;
  const leadTime = calculateLeadTime({
    firstSignalAt: firstReportedAt,
    firstPreSaleSignalAt: [
      "PRE_SALE",
      "ANNOUNCED",
      "PENDING_REGULATORY",
    ].includes(event.event_stage)
      ? firstReportedAt
      : "",
    announcedAt: event.event_stage === "ANNOUNCED" ? event.event_date : "",
    regulatoryFilingAt:
      event.event_stage === "PENDING_REGULATORY" ? event.event_date : "",
    closedAt: ["CLOSED", "POST_LIQUIDITY"].includes(event.event_stage)
      ? event.event_date
      : "",
  });
  const ownershipEvidence = Boolean(
    event.metadata.ownershipEvidence ||
    (event.ownership_percentage_low !== null &&
      event.ownership_percentage_high !== null),
  );
  const actionability = scoreActionability({
    potentialLiquidityHigh: estimate.potentiallyDeployableHigh,
    eventDate:
      Date.parse(event.event_date) > Date.parse(generatedAt)
        ? firstReportedAt
        : event.event_date,
    asOfDate: generatedAt,
    stage: event.event_stage,
    ownershipEvidence,
    privateCompany: event.metadata.marketClass === "PRIVATE",
    independentSourceCount: 1,
  });
  return {
    id: `motion-${stableId(event.source_id, event.external_record_id)}`,
    clusterKey: eventClusterKey(event),
    person: event.subject_person,
    company: event.subject_company,
    seller: event.seller_entity,
    buyer: event.buyer_entity,
    asset: event.asset,
    title: event.raw_title,
    summary: event.raw_text,
    whyHere: `${event.event_stage.replaceAll("_", " ").toLowerCase()} ${event.event_type.replaceAll("_", " ").toLowerCase()} from ${String(event.metadata.publisher || event.source_id)}.`,
    eventType: event.event_type,
    stage: event.event_stage,
    eventDate: event.event_date,
    publishedAt: event.published_at,
    location: event.location,
    industry: String(event.metadata.industry || ""),
    personRole: String(
      event.metadata.role || event.metadata.relationship || "",
    ),
    subjectKind:
      (event.metadata.subjectKind as MoneyMotionRecord["subjectKind"]) ||
      (event.subject_person ? "PERSON" : subject ? "ORGANIZATION" : "UNKNOWN"),
    marketClass:
      (event.metadata.marketClass as MoneyMotionRecord["marketClass"]) ||
      "UNKNOWN",
    reportedTransactionValue: event.reported_transaction_value,
    transactionValueClassification: valueClassification,
    currency: event.currency,
    estimate,
    confidence: confidenceFor(event),
    actionability,
    leadTime,
    independentSourceCount: 1,
    firstReportedAt,
    latestReportedAt: event.published_at || firstReportedAt,
    ownershipEvidence,
    evidence: [evidenceFor(event)],
    sourceEventIds: [`${event.source_id}:${event.external_record_id}`],
    corroboratingRecordIds: [],
  };
}

function earliest(...values: string[]) {
  return values.filter(Boolean).sort().at(0) || "";
}

function latest(...values: string[]) {
  return values.filter(Boolean).sort().at(-1) || "";
}

function independentSourceCount(evidence: MotionEvidence[]) {
  const keys = evidence.map((item) => {
    const normalizedTitle = normalizeEntityName(item.title);
    return item.sourceId === "gdelt"
      ? `media:${normalizedTitle}`
      : `${item.sourceId}:${normalizedTitle}`;
  });
  return Math.max(1, new Set(keys).size);
}

function mergeClusters(records: MoneyMotionRecord[]) {
  const clustered = new Map<string, MoneyMotionRecord>();
  for (const record of records) {
    const current = clustered.get(record.clusterKey);
    if (!current) {
      clustered.set(record.clusterKey, record);
      continue;
    }
    const evidence = new Map(
      [...current.evidence, ...record.evidence].map((item) => [item.id, item]),
    );
    const primary =
      record.confidence.total > current.confidence.total ? record : current;
    const independentSources = independentSourceCount([...evidence.values()]);
    const confidence = scoreConfidence({
      sourceReliability: primary.confidence.sourceReliability,
      transactionCertainty: Math.min(
        25,
        primary.confidence.transactionCertainty +
          Math.max(0, independentSources - 1) * 2,
      ),
      identityMatch: primary.confidence.identityMatch,
      ownershipCertainty: primary.confidence.ownershipCertainty,
      valuationCertainty: primary.confidence.valuationCertainty,
      explanation: [
        ...primary.confidence.explanation,
        `${independentSources} independent evidence source${independentSources === 1 ? "" : "s"}.`,
      ],
    });
    const leadTime = calculateLeadTime({
      firstSignalAt: earliest(
        current.leadTime.firstSignalAt,
        record.leadTime.firstSignalAt,
      ),
      firstPreSaleSignalAt: earliest(
        current.leadTime.firstPreSaleSignalAt,
        record.leadTime.firstPreSaleSignalAt,
      ),
      announcedAt: earliest(
        current.leadTime.announcedAt,
        record.leadTime.announcedAt,
      ),
      regulatoryFilingAt: earliest(
        current.leadTime.regulatoryFilingAt,
        record.leadTime.regulatoryFilingAt,
      ),
      closedAt: earliest(current.leadTime.closedAt, record.leadTime.closedAt),
    });
    const actionability = scoreActionability({
      potentialLiquidityHigh: primary.estimate.potentiallyDeployableHigh,
      eventDate: primary.eventDate,
      asOfDate: generatedAt,
      stage: primary.stage,
      ownershipEvidence: primary.ownershipEvidence,
      privateCompany: primary.marketClass === "PRIVATE",
      independentSourceCount: independentSources,
    });
    clustered.set(record.clusterKey, {
      ...primary,
      evidence: [...evidence.values()],
      sourceEventIds: [
        ...new Set([...current.sourceEventIds, ...record.sourceEventIds]),
      ],
      confidence,
      actionability,
      leadTime,
      independentSourceCount: independentSources,
      firstReportedAt: earliest(
        current.firstReportedAt,
        record.firstReportedAt,
      ),
      latestReportedAt: latest(
        current.latestReportedAt,
        record.latestReportedAt,
      ),
      ownershipEvidence: current.ownershipEvidence || record.ownershipEvidence,
      whyHere: `${primary.whyHere} ${evidence.size} source record${evidence.size === 1 ? "" : "s"} retained in this cluster.`,
    });
  }
  return [...clustered.values()].sort(
    (left, right) =>
      right.eventDate.localeCompare(left.eventDate) ||
      right.confidence.total - left.confidence.total,
  );
}

function corroboratePatentAssignments(records: MoneyMotionRecord[]) {
  const entityKeys = (record: MoneyMotionRecord) =>
    new Set(
      [record.person, record.company, record.seller, record.buyer]
        .map(normalizeEntityName)
        .filter((value) => value.length >= 4),
    );
  const withinOneYear = (left: string, right: string) => {
    const leftTime = Date.parse(`${left.slice(0, 10)}T00:00:00Z`);
    const rightTime = Date.parse(`${right.slice(0, 10)}T00:00:00Z`);
    return (
      Number.isFinite(leftTime) &&
      Number.isFinite(rightTime) &&
      Math.abs(leftTime - rightTime) <= 365 * 86_400_000
    );
  };
  return records.map((record) => {
    if (!record.evidence.some((item) => item.sourceId === "uspto_assignments"))
      return record;
    const keys = entityKeys(record);
    const related = records.filter((candidate) => {
      if (
        candidate.id === record.id ||
        candidate.evidence.some(
          (item) => item.sourceId === "uspto_assignments",
        ) ||
        !withinOneYear(record.eventDate, candidate.eventDate)
      )
        return false;
      return [...entityKeys(candidate)].some((key) => keys.has(key));
    });
    if (!related.length) return record;
    const independentSources = Math.max(
      record.independentSourceCount,
      new Set(
        related.flatMap((item) =>
          item.evidence.map((evidence) => evidence.sourceId),
        ),
      ).size + 1,
    );
    return {
      ...record,
      corroboratingRecordIds: related.map((item) => item.id),
      independentSourceCount: independentSources,
      confidence: scoreConfidence({
        sourceReliability: record.confidence.sourceReliability,
        transactionCertainty: Math.min(
          25,
          record.confidence.transactionCertainty +
            Math.min(4, related.length * 2),
        ),
        identityMatch: record.confidence.identityMatch,
        ownershipCertainty: record.confidence.ownershipCertainty,
        valuationCertainty: record.confidence.valuationCertainty,
        explanation: [
          ...record.confidence.explanation,
          `${related.length} entity-and-date matched transaction record${related.length === 1 ? "" : "s"} corroborate this assignment.`,
        ],
      }),
      actionability: scoreActionability({
        potentialLiquidityHigh: record.estimate.potentiallyDeployableHigh,
        eventDate: record.eventDate,
        asOfDate: generatedAt,
        stage: record.stage,
        ownershipEvidence: record.ownershipEvidence,
        privateCompany: record.marketClass === "PRIVATE",
        independentSourceCount: independentSources,
      }),
      whyHere: `${record.whyHere} Entity and date resolution linked ${related.length} corroborating transaction record${related.length === 1 ? "" : "s"}; no consideration, ownership percentage, or personal proceeds were inferred.`,
    };
  });
}

function baseHealth(
  id: string,
  overrides: Partial<SourceHealth> = {},
): SourceHealth {
  const adapter = SOURCE_ADAPTERS.find((item) => item.id === id);
  if (!adapter) throw new Error(`Unknown adapter ${id}`);
  return {
    id: adapter.id,
    name: adapter.name,
    publisher: adapter.publisher,
    mode: adapter.mode,
    cadence: adapter.cadence,
    lastAttemptAt: adapter.mode === "LIVE" ? generatedAt : "",
    lastSuccessAt: "",
    recordsSeen: 0,
    recordsAccepted: 0,
    recordsRejected: 0,
    latencyMs: null,
    error: "",
    errorType: "",
    watermark: "",
    nextRetryAt: "",
    requests: 0,
    cacheHits: 0,
    rateLimitCount: 0,
    successfulQueries: 0,
    reason: adapter.reason,
    sourceUrl: adapter.sourceUrl,
    value: sourceValueMetrics(adapter.id, [], 0, 0),
    ...overrides,
  };
}

async function main() {
  const publicData = JSON.parse(
    await fs.readFile(publicDataPath, "utf8"),
  ) as PublicDataSnapshot;
  const sec = secEvents(publicData);
  const ftc = ftcEvents(publicData);
  const chicagoProperty = await readJson<ChicagoPropertySnapshot | null>(
    chicagoPropertyPath,
    null,
  );
  const chicagoPropertyEvents = await readJson<{
    generatedAt: string;
    events: NormalizedSourceEvent[];
  }>(chicagoPropertyEventsPath, { generatedAt: "", events: [] });
  const usptoState = await readJson<UsptoOdpState>(
    usptoStatePath,
    emptyUsptoOdpState(),
  );
  const isolatedGdelt = fetchGdelt().catch((error) => ({
    events: [] as NormalizedSourceEvent[],
    health: {
      mode: "ERROR" as const,
      lastAttemptAt: generatedAt,
      error: error instanceof Error ? error.message : String(error),
      errorType: "ISOLATED_ADAPTER_FAILURE",
      reason:
        "GDELT failed outside its request boundary; other official sources continued independently.",
    } satisfies Partial<SourceHealth>,
  }));
  const isolatedUspto = runUsptoOdpSync({
    apiKey: process.env.USPTO_API_KEY?.trim() || "",
    state: usptoState,
    now: generatedAt,
  }).catch((error) => ({
    state: usptoState,
    events: usptoState.events,
    health: {
      mode: (usptoState.events.length ? "DEGRADED" : "ERROR") as
        "DEGRADED" | "ERROR",
      lastAttemptAt: generatedAt,
      lastSuccessAt: usptoState.updatedAt,
      recordsSeen: usptoState.recordsSeen,
      recordsAccepted: usptoState.events.length,
      recordsRejected: usptoState.recordsRejected,
      latencyMs: null,
      error: error instanceof Error ? error.message : String(error),
      errorType: "ISOLATED_ADAPTER_FAILURE",
      watermark: usptoState.fileReleaseDate,
      nextRetryAt: "",
      requests: 0,
      successfulQueries: 0,
      reason:
        "USPTO failed outside its streaming boundary; cached assignments and all other official sources remained available.",
      details: {
        currentFile: usptoState.fileName,
        filesProcessed: [],
        bytesDownloaded: 0,
        bytesProcessed: 0,
        recordsProcessed: 0,
        currentCheckpoint: "ISOLATED_FAILURE",
        classificationCounts: usptoState.classificationCounts,
        transactionMatches: 0,
        peakMemoryBytes: null,
      },
    },
  }));
  const [cms, gdelt, stb, uspto, fcc, bankruptcy, officialNews] =
    await Promise.all([
      fetchCmsChow(),
      isolatedGdelt,
      fetchStb(),
      isolatedUspto,
      fetchFccAssignments(),
      fetchBankruptcySales(),
      fetchOfficialTransactionNews(),
    ]);
  await writeGzipJson(usptoStatePath, uspto.state);
  const cmsOwners = await enrichCmsOwners(cms.rows);
  const qualifiedStbEvents = stb.events.filter(
    (event) =>
      event.reported_transaction_value !== null &&
      event.reported_transaction_value > 0 &&
      Boolean(event.subject_person || event.subject_company),
  );
  const rejectedStbEvents = stb.events.length - qualifiedStbEvents.length;
  const allEvents = dedupeSourceEvents([
    ...sec,
    ...ftc,
    ...cms.events,
    ...cmsOwners.events,
    ...gdelt.events,
    ...qualifiedStbEvents,
    ...uspto.events,
    ...chicagoPropertyEvents.events,
    ...fcc.events,
    ...bankruptcy.events,
    ...officialNews.events,
  ]);
  const records = corroboratePatentAssignments(
    mergeClusters(allEvents.map(recordFor)),
  ).filter(isQualifiedTransportationRecord);
  uspto.health.details.transactionMatches = records.filter(
    (record) =>
      record.evidence.some((item) => item.sourceId === "uspto_assignments") &&
      (record.corroboratingRecordIds?.length || 0) > 0,
  ).length;
  const activeCounts = new Map<string, number>();
  for (const event of allEvents) {
    activeCounts.set(
      event.source_id,
      (activeCounts.get(event.source_id) || 0) + 1,
    );
  }

  const sourceHealth = SOURCE_ADAPTERS.map((adapter) => {
    let health: SourceHealth;
    if (adapter.id === "sec") {
      health = baseHealth(adapter.id, {
        lastSuccessAt: publicData.generatedAt,
        recordsSeen: sec.length,
        recordsAccepted: sec.length,
        requests: 1,
        successfulQueries: 1,
      });
    } else if (adapter.id === "ftc_hsr") {
      health = baseHealth(adapter.id, {
        lastSuccessAt: publicData.generatedAt,
        recordsSeen: ftc.length,
        recordsAccepted: ftc.length,
        requests: 1,
        successfulQueries: 1,
      });
    } else if (adapter.id === "cms_chow") {
      health = baseHealth(adapter.id, {
        ...cms.health,
        recordsSeen: (cms.health.recordsSeen || 0) + cmsOwners.ownerRowsSeen,
        recordsAccepted: cms.events.length + cmsOwners.events.length,
        recordsRejected:
          (cms.health.recordsRejected || 0) +
          Math.max(0, cmsOwners.ownerRowsSeen - cmsOwners.events.length),
        requests: (cms.health.requests || 0) + cmsOwners.requests,
        successfulQueries:
          (cms.health.successfulQueries || 0) +
          cmsOwners.requests -
          cmsOwners.errors,
        error: cmsOwners.errors
          ? `${cmsOwners.errors} owner-enrichment request${cmsOwners.errors === 1 ? "" : "s"} failed; CHOW records remain available.`
          : cms.health.error || "",
        errorType: cmsOwners.errors ? "PARTIAL_ENRICHMENT_ERROR" : "",
        mode: cmsOwners.errors ? "DEGRADED" : "LIVE",
      });
    } else if (adapter.id === "gdelt") {
      health = baseHealth(adapter.id, gdelt.health);
    } else if (adapter.id === "stb") {
      health = baseHealth(adapter.id, {
        ...stb.health,
        recordsAccepted: qualifiedStbEvents.length,
        recordsRejected: (stb.health.recordsRejected || 0) + rejectedStbEvents,
      });
    } else if (adapter.id === "uspto_assignments") {
      health = baseHealth(adapter.id, uspto.health);
    } else if (adapter.id === "fcc_uls") {
      health = baseHealth(adapter.id, fcc.health);
    } else if (adapter.id === "bankruptcy_recap") {
      health = baseHealth(adapter.id, bankruptcy.health);
    } else if (adapter.id === "official_transaction_news") {
      health = baseHealth(adapter.id, officialNews.health);
    } else if (adapter.id === "chicago_property") {
      health = baseHealth(adapter.id, {
        lastAttemptAt: chicagoProperty?.generatedAt || "",
        lastSuccessAt: chicagoProperty?.generatedAt || "",
        recordsSeen: chicagoProperty?.stats.significantSales || 0,
        recordsAccepted: chicagoPropertyEvents.events.length,
        recordsRejected: 0,
        requests: chicagoProperty ? 1 : 0,
        successfulQueries: chicagoProperty ? 1 : 0,
        error: chicagoProperty ? "" : "Chicago Property snapshot unavailable.",
        errorType: chicagoProperty ? "" : "SNAPSHOT_UNAVAILABLE",
        mode: chicagoProperty ? "LIVE" : "DEGRADED",
        watermark: chicagoProperty?.coverage.endDate || "",
      });
    } else if (
      chicagoProperty?.sourceHealth.some((source) => source.id === adapter.id)
    ) {
      const source = chicagoProperty.sourceHealth.find(
        (item) => item.id === adapter.id,
      )!;
      health = baseHealth(adapter.id, {
        lastAttemptAt: source.lastAttemptAt,
        lastSuccessAt: source.lastSuccessAt,
        recordsSeen: source.rowsFetched,
        recordsAccepted: source.matches,
        recordsRejected: Math.max(0, source.rowsFetched - source.matches),
        requests: 1,
        successfulQueries: source.status === "ERROR" ? 0 : 1,
        error: source.errors.join("; "),
        errorType: source.errors.length ? "FETCH_OR_MATCH_ERROR" : "",
        mode: source.status === "LIVE" ? "LIVE" : "DEGRADED",
        watermark: source.watermark,
      });
    } else {
      health = baseHealth(adapter.id);
    }
    health.value = sourceValueMetrics(
      adapter.id,
      records,
      health.recordsAccepted,
      health.recordsRejected,
    );
    return health;
  });

  const peopleInMotion = aggregatePeopleInMotion(records);
  const estimatedRecords = records.filter(
    (record) => record.estimate.potentiallyDeployableHigh !== null,
  );
  const secEstimates = estimatedRecords.filter((record) =>
    record.evidence.some((evidence) => evidence.sourceId === "sec"),
  ).length;

  const snapshot: MoneyMotionSnapshot = {
    schemaVersion: 2,
    generatedAt,
    disclaimer:
      "Money in Motion presents public transaction signals and evidence-linked estimates. It does not claim cash on hand, bank balances, net worth, or disposable wealth, and it must not be used for eligibility, employment, housing, credit, insurance, or other restricted decisions.",
    stats: {
      records: records.length,
      people: peopleInMotion.length,
      organizations: new Set(
        records
          .flatMap((record) => [record.company, record.seller, record.buyer])
          .filter(Boolean),
      ).size,
      sources: sourceHealth.length,
      liveSources: sourceHealth.filter((source) => source.mode === "LIVE")
        .length,
      knownOrReportedValues: records.filter(
        (record) => record.reportedTransactionValue !== null,
      ).length,
      estimates: records.filter(
        (record) => record.estimate.potentiallyDeployableHigh !== null,
      ).length,
      privateCompanyEvents: records.filter(
        (record) => record.marketClass === "PRIVATE",
      ).length,
      preCloseSignals: records.filter((record) =>
        ["WATCHING", "PRE_SALE", "ANNOUNCED", "PENDING_REGULATORY"].includes(
          record.stage,
        ),
      ).length,
      highConfidenceEstimates: estimatedRecords.filter(
        (record) => record.confidence.total >= 75,
      ).length,
      secEstimateShare: estimatedRecords.length
        ? Number((secEstimates / estimatedRecords.length).toFixed(4))
        : 0,
    },
    records,
    peopleInMotion,
    sourceHealth,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(snapshot)}\n`, "utf8");
  await writeClientMotionSnapshot(outputPath, clientOutputPath);
  console.log(
    `Money in Motion: ${records.length} clustered records from ${activeCounts.size} active sources (${snapshot.stats.estimates} evidence-linked estimates).`,
  );
  for (const source of sourceHealth.filter((item) => item.mode === "LIVE")) {
    console.log(
      `${source.id}: ${source.recordsAccepted} accepted${source.error ? `; ${source.error}` : ""}`,
    );
  }
}

await main();
