import fs from "node:fs/promises";
import path from "node:path";
import type { PublicDataSnapshot } from "../lib/public-data";
import {
  SOURCE_ADAPTERS,
  classifyNewsTransaction,
  dedupeSourceEvents,
  estimatePotentialLiquidity,
  eventClusterKey,
  scoreConfidence,
  stableId,
  type EvidenceClassification,
  type MoneyMotionRecord,
  type MoneyMotionSnapshot,
  type MotionEvidence,
  type NormalizedSourceEvent,
  type SourceHealth,
} from "../lib/money-in-motion";

const root = process.cwd();
const publicDataPath = path.join(root, "public", "data", "public-signals.json");
const outputPath = path.join(root, "public", "data", "money-in-motion.json");
const generatedAt = new Date().toISOString();

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

async function fetchCmsChow(): Promise<{
  events: NormalizedSourceEvent[];
  health: Partial<SourceHealth>;
}> {
  const started = Date.now();
  const datasetId = "1022caeb-1af9-4420-8bb1-e2cc355bc5b5";
  const apiUrl = `https://data.cms.gov/data-api/v1/dataset/${datasetId}/data?size=5000&offset=0`;
  const sourceUrl =
    "https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/skilled-nursing-facility-change-of-ownership";
  try {
    const response = await fetch(apiUrl, {
      headers: { "User-Agent": "LiquidityRadar/0.1 public-record-sync" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`CMS API returned ${response.status}`);
    const rows = (await response.json()) as CmsChowRow[];
    const accepted = rows
      .filter((row) => row["EFFECTIVE DATE"])
      .sort((left, right) =>
        right["EFFECTIVE DATE"].localeCompare(left["EFFECTIVE DATE"]),
      )
      .slice(0, 500);
    return {
      events: accepted.map((row) => {
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
          source_type: row["CHOW TYPE TEXT"] || "CHANGE OF OWNERSHIP",
          external_record_id: externalId,
          source_url: sourceUrl,
          retrieved_at: generatedAt,
          published_at: generatedAt.slice(0, 10),
          event_date: eventDate,
          event_type: "HEALTHCARE_CHOW",
          event_stage: "CLOSED",
          raw_title: `${row["DOING BUSINESS AS NAME - BUYER"] || buyer} — CMS change of ownership`,
          raw_text: `${seller} to ${buyer}; ${row["PROVIDER TYPE TEXT - BUYER"] || "CMS-enrolled provider"}.`,
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
      health: {
        lastSuccessAt: generatedAt,
        recordsSeen: rows.length,
        recordsAccepted: accepted.length,
        recordsRejected: rows.length - accepted.length,
        latencyMs: Date.now() - started,
      },
    };
  } catch (error) {
    return {
      events: [],
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

type GdeltArticle = {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
};

function gdeltDate(value = "") {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})/);
  return match
    ? `${match[1]}-${match[2]}-${match[3]}`
    : generatedAt.slice(0, 10);
}

async function fetchGdelt(): Promise<{
  events: NormalizedSourceEvent[];
  health: Partial<SourceHealth>;
}> {
  const started = Date.now();
  const query =
    '(acquired OR merger OR "sale of" OR divestiture OR recapitalization)';
  const apiUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=75&format=json&timespan=24h`;
  try {
    const response = await fetch(apiUrl, {
      headers: { "User-Agent": "LiquidityRadar/0.1 public-record-sync" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`GDELT API returned ${response.status}`);
    const payload = (await response.json()) as { articles?: GdeltArticle[] };
    const articles = payload.articles ?? [];
    const events = articles.flatMap((article) => {
      const classification = classifyNewsTransaction(article.title || "");
      if (!classification || !article.url || !article.title) return [];
      const date = gdeltDate(article.seendate);
      return [
        sourceEvent({
          source_id: "gdelt",
          source_type: "transaction-news discovery",
          external_record_id: stableId(article.url),
          source_url: article.url,
          retrieved_at: generatedAt,
          published_at: date,
          event_date: date,
          event_type: classification.eventType,
          event_stage: classification.stage,
          raw_title: article.title,
          raw_text:
            "News-discovery signal. Open the linked publisher story for transaction context.",
          seller_entity: "",
          buyer_entity: "",
          subject_person: "",
          subject_company: "",
          asset: "",
          location: location({
            country: article.sourcecountry || "",
            basis: "publisher country only",
          }),
          reported_transaction_value: null,
          currency: "USD",
          ownership_percentage_low: null,
          ownership_percentage_high: null,
          status: classification.stage,
          metadata: {
            domain: article.domain || "",
            language: article.language || "",
            valueClassification: "UNKNOWN",
            marketClass: "UNKNOWN",
            subjectKind: "UNKNOWN",
            publisher: article.domain || "GDELT-indexed publisher",
          },
        }),
      ];
    });
    return {
      events,
      health: {
        lastSuccessAt: generatedAt,
        recordsSeen: articles.length,
        recordsAccepted: events.length,
        recordsRejected: articles.length - events.length,
        latencyMs: Date.now() - started,
      },
    };
  } catch (error) {
    return {
      events: [],
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
  const official = ["sec", "ftc_hsr", "cms_chow"].includes(event.source_id);
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
    evidence: [evidenceFor(event)],
    sourceEventIds: [`${event.source_id}:${event.external_record_id}`],
  };
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
    clustered.set(record.clusterKey, {
      ...primary,
      evidence: [...evidence.values()],
      sourceEventIds: [
        ...new Set([...current.sourceEventIds, ...record.sourceEventIds]),
      ],
      whyHere: `${primary.whyHere} ${evidence.size} source record${evidence.size === 1 ? "" : "s"} retained in this cluster.`,
    });
  }
  return [...clustered.values()].sort(
    (left, right) =>
      right.eventDate.localeCompare(left.eventDate) ||
      right.confidence.total - left.confidence.total,
  );
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
    reason: adapter.reason,
    sourceUrl: adapter.sourceUrl,
    ...overrides,
  };
}

async function main() {
  const publicData = JSON.parse(
    await fs.readFile(publicDataPath, "utf8"),
  ) as PublicDataSnapshot;
  const sec = secEvents(publicData);
  const ftc = ftcEvents(publicData);
  const [cms, gdelt] = await Promise.all([fetchCmsChow(), fetchGdelt()]);
  const allEvents = dedupeSourceEvents([
    ...sec,
    ...ftc,
    ...cms.events,
    ...gdelt.events,
  ]);
  const records = mergeClusters(allEvents.map(recordFor));
  const activeCounts = new Map<string, number>();
  for (const event of allEvents) {
    activeCounts.set(
      event.source_id,
      (activeCounts.get(event.source_id) || 0) + 1,
    );
  }

  const sourceHealth = SOURCE_ADAPTERS.map((adapter) => {
    if (adapter.id === "sec") {
      return baseHealth(adapter.id, {
        lastSuccessAt: publicData.generatedAt,
        recordsSeen: sec.length,
        recordsAccepted: sec.length,
      });
    }
    if (adapter.id === "ftc_hsr") {
      return baseHealth(adapter.id, {
        lastSuccessAt: publicData.generatedAt,
        recordsSeen: ftc.length,
        recordsAccepted: ftc.length,
      });
    }
    if (adapter.id === "cms_chow") return baseHealth(adapter.id, cms.health);
    if (adapter.id === "gdelt") return baseHealth(adapter.id, gdelt.health);
    return baseHealth(adapter.id);
  });

  const snapshot: MoneyMotionSnapshot = {
    schemaVersion: 1,
    generatedAt,
    disclaimer:
      "Money in Motion presents public transaction signals and evidence-linked estimates. It does not claim cash on hand, bank balances, net worth, or disposable wealth, and it must not be used for eligibility, employment, housing, credit, insurance, or other restricted decisions.",
    stats: {
      records: records.length,
      people: new Set(records.map((record) => record.person).filter(Boolean))
        .size,
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
    },
    records,
    sourceHealth,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(snapshot)}\n`, "utf8");
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
