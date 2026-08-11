import {
  classifyNewsTransaction,
  normalizeEntityName,
  stableId,
  type NormalizedSourceEvent,
} from "./money-in-motion";

function normalizedDate(value: string, fallback: string) {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? new Date(parsed).toISOString().slice(0, 10)
    : fallback;
}

function sourceEvent(
  event: Omit<NormalizedSourceEvent, "raw_payload_hash">,
): NormalizedSourceEvent {
  return {
    ...event,
    raw_payload_hash: stableId(
      event.source_id,
      event.external_record_id,
      event.raw_title,
      event.event_date,
    ),
  };
}

export function parseFccDailyAssignments(input: {
  en: string;
  hd: string;
  retrievedAt: string;
  sourceUrl: string;
}) {
  const fallbackDate = input.retrievedAt.slice(0, 10);
  const dates = new Map<string, string>();
  for (const line of input.hd.split(/\r?\n/)) {
    const fields = line.split("|");
    if (fields[0] !== "HD" || !fields[1] || !fields[2]) continue;
    dates.set(
      `${fields[1]}:${fields[2]}`,
      normalizedDate(fields[43] || "", fallbackDate),
    );
  }
  const groups = new Map<
    string,
    {
      fileNumber: string;
      seller: string;
      buyer: string;
      sellerCity: string;
      sellerState: string;
    }
  >();
  for (const line of input.en.split(/\r?\n/)) {
    const fields = line.split("|");
    if (fields[0] !== "EN" || !fields[1] || !fields[2]) continue;
    const key = `${fields[1]}:${fields[2]}`;
    const current = groups.get(key) || {
      fileNumber: fields[2],
      seller: "",
      buyer: "",
      sellerCity: "",
      sellerState: "",
    };
    if (fields[5] === "R") {
      current.seller = fields[7]?.trim() || "";
      current.sellerCity = fields[17]?.trim() || "";
      current.sellerState = fields[18]?.trim() || "";
    } else if (fields[5] === "E") {
      current.buyer = fields[7]?.trim() || "";
    }
    groups.set(key, current);
  }
  return [...groups.entries()].flatMap(([key, group]) => {
    if (
      !group.seller ||
      !group.buyer ||
      normalizeEntityName(group.seller) === normalizeEntityName(group.buyer)
    )
      return [];
    const eventDate = dates.get(key) || fallbackDate;
    return [
      sourceEvent({
        source_id: "fcc_uls",
        source_type: "FCC ULS assignment/transfer application",
        external_record_id: group.fileNumber,
        source_url: input.sourceUrl,
        retrieved_at: input.retrievedAt,
        published_at: eventDate,
        event_date: eventDate,
        event_type: "LICENSE_TRANSFER",
        event_stage: "ANNOUNCED",
        raw_title: `${group.seller} to ${group.buyer} — FCC license assignment filing`,
        raw_text:
          "Official FCC daily assignment/transfer application. Filing does not by itself establish consummation or monetary consideration.",
        seller_entity: group.seller,
        buyer_entity: group.buyer,
        subject_person: "",
        subject_company: group.seller,
        asset: `FCC assignment file ${group.fileNumber}`,
        location: {
          country: "United States",
          state: group.sellerState,
          city: group.sellerCity,
          basis: "FCC-reported assignor application address",
        },
        reported_transaction_value: null,
        currency: "USD",
        ownership_percentage_low: null,
        ownership_percentage_high: null,
        status: "assignment application filed",
        metadata: {
          valueClassification: "UNKNOWN",
          marketClass: "PRIVATE",
          subjectKind: "ORGANIZATION",
          publisher: "Federal Communications Commission",
          industry: "Communications",
          completionConfirmed: false,
        },
      }),
    ];
  });
}

function monetaryAmount(rawAmount: string, rawUnit: string) {
  const amount = Number(rawAmount.replaceAll(",", ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = rawUnit.toLowerCase();
  const multiplier = /billion|bn|b/.test(unit)
    ? 1_000_000_000
    : /million|mm|m/.test(unit)
      ? 1_000_000
      : /thousand|k/.test(unit)
        ? 1_000
        : 1;
  return Math.round(amount * multiplier);
}

export function extractDisclosedConsideration(text: string) {
  const patterns = [
    /(?:purchase price|cash consideration|sale consideration|aggregate consideration|cash purchase price)[^$]{0,100}\$\s*([\d,.]+)\s*(billion|million|thousand|bn|mm|m|b|k)?/i,
    /\$\s*([\d,.]+)\s*(billion|million|thousand|bn|mm|m|b|k)?[^.]{0,80}(?:purchase price|cash consideration|sale consideration|aggregate consideration)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const amount = monetaryAmount(match[1], match[2] || "");
    if (amount !== null && amount >= 10_000) return amount;
  }
  return null;
}

export type CourtListenerSearchResult = {
  caseName?: string;
  court?: string;
  docketNumber?: string;
  docket_id?: number;
  dateFiled?: string;
  recap_documents?: Array<{
    id?: number;
    absolute_url?: string;
    description?: string;
    short_description?: string;
    snippet?: string;
    entry_date_filed?: string;
  }>;
};

export function courtListenerSaleEvents(
  results: CourtListenerSearchResult[],
  retrievedAt: string,
) {
  const events: NormalizedSourceEvent[] = [];
  for (const result of results) {
    for (const document of result.recap_documents || []) {
      const description =
        `${document.short_description || ""} ${document.description || ""}`.trim();
      const searchText = `${description} ${document.snippet || ""}`;
      if (!/\b(?:363|sale|sell)\b/i.test(searchText)) continue;
      const value = extractDisclosedConsideration(searchText);
      if (value === null) continue;
      const closed =
        /\border\b/i.test(description) &&
        /\b(?:approv(?:e|ed|ing)|authoriz(?:e|ed|ing)).{0,80}\bsale\b|\bsale\b.{0,80}\b(?:approv(?:e|ed|ing)|authoriz(?:e|ed|ing))\b/i.test(
          description,
        ) &&
        !/proposed order/i.test(description);
      const eventDate = normalizedDate(
        document.entry_date_filed || result.dateFiled || "",
        retrievedAt.slice(0, 10),
      );
      const documentId = String(
        document.id || stableId(description, eventDate),
      );
      const caseName = (result.caseName || "Bankruptcy estate").trim();
      events.push(
        sourceEvent({
          source_id: "bankruptcy_recap",
          source_type: closed
            ? "Bankruptcy sale order with disclosed consideration"
            : "Proposed bankruptcy asset sale with disclosed consideration",
          external_record_id: documentId,
          source_url: document.absolute_url
            ? `https://www.courtlistener.com${document.absolute_url}`
            : `https://www.courtlistener.com/docket/${result.docket_id || ""}/`,
          retrieved_at: retrievedAt,
          published_at: eventDate,
          event_date: eventDate,
          event_type: "ASSET_SALE",
          event_stage: closed ? "CLOSED" : "PRE_SALE",
          raw_title: `${caseName} — ${closed ? "court-authorized" : "proposed"} asset sale`,
          raw_text: `${description}. Reported consideration was extracted only where the docket text explicitly labels a purchase price or cash/sale consideration.`,
          seller_entity: caseName,
          buyer_entity: "",
          subject_person: "",
          subject_company: caseName,
          asset: `Bankruptcy case ${result.docketNumber || result.docket_id || ""}`,
          location: {
            country: "United States",
            state: "",
            city: "",
            basis: result.court || "Federal bankruptcy court",
          },
          reported_transaction_value: value,
          currency: "USD",
          ownership_percentage_low: null,
          ownership_percentage_high: null,
          status: closed ? "sale order entered" : "sale proposed",
          metadata: {
            valueClassification: "REPORTED",
            marketClass: "PRIVATE",
            subjectKind: "ORGANIZATION",
            publisher: "Free Law Project CourtListener / RECAP",
            industry: "Bankruptcy",
            court: result.court || "",
            docketNumber: result.docketNumber || "",
            completionConfirmed: closed,
          },
        }),
      );
    }
  }
  return [
    ...new Map(
      events.map((event) => [event.external_record_id, event]),
    ).values(),
  ];
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function xmlField(item: string, field: string) {
  return decodeXml(
    item.match(
      new RegExp(`<${field}[^>]*>([\\s\\S]*?)<\\/${field}>`, "i"),
    )?.[1] || "",
  )
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type OfficialFeedEntry = {
  title: string;
  link: string;
  description: string;
  publishedAt: string;
};

export function parseOfficialRss(xml: string) {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].flatMap((match) => {
    const title = xmlField(match[0], "title");
    const link = xmlField(match[0], "link");
    if (!title || !/^https:\/\//.test(link)) return [];
    return [
      {
        title,
        link,
        description: xmlField(match[0], "description"),
        publishedAt: xmlField(match[0], "pubDate"),
      } satisfies OfficialFeedEntry,
    ];
  });
}

export function officialTransactionNewsEvents(input: {
  entries: OfficialFeedEntry[];
  publisher: string;
  retrievedAt: string;
}) {
  return input.entries.slice(0, 100).flatMap((entry) => {
    const classification = classifyNewsTransaction(
      entry.title,
      entry.description,
    );
    if (!classification) return [];
    const eventDate = normalizedDate(
      entry.publishedAt,
      input.retrievedAt.slice(0, 10),
    );
    const value = extractDisclosedConsideration(
      `${entry.title} ${entry.description}`,
    );
    return [
      sourceEvent({
        source_id: "official_transaction_news",
        source_type: `${input.publisher} transaction press release`,
        external_record_id: stableId(entry.link),
        source_url: entry.link,
        retrieved_at: input.retrievedAt,
        published_at: eventDate,
        event_date: eventDate,
        event_type: classification.eventType,
        event_stage:
          classification.stage === "CLOSED" &&
          /\b(?:completed|consummated|closed)\b/i.test(
            `${entry.title} ${entry.description}`,
          )
            ? "CLOSED"
            : "PENDING_REGULATORY",
        raw_title: entry.title,
        raw_text:
          entry.description || "Official government transaction notice.",
        seller_entity: "",
        buyer_entity: "",
        subject_person: "",
        subject_company: "",
        asset: "",
        location: {
          country: "United States",
          state: "",
          city: "",
          basis: "Federal agency press release; party location not inferred",
        },
        reported_transaction_value: value,
        currency: "USD",
        ownership_percentage_low: null,
        ownership_percentage_high: null,
        status: "official regulatory transaction notice",
        metadata: {
          valueClassification: value ? "REPORTED" : "UNKNOWN",
          marketClass: "PRIVATE",
          subjectKind: "UNKNOWN",
          publisher: input.publisher,
          industry: "",
        },
      }),
    ];
  });
}
