import {
  classifyPatentAssignment,
  stableId,
  type EventStage,
  type EventType,
  type MotionLocation,
  type NormalizedSourceEvent,
} from "./money-in-motion";

export type ImportSourceId =
  | "fcc_uls"
  | "uspto_assignments"
  | "ferc"
  | "stb"
  | "registry_maryland"
  | "registry_district_of_columbia"
  | "registry_virginia"
  | "commercial_property"
  | "broker_feeds";

export type ImportRow = Record<string, unknown>;

function text(row: ImportRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function amount(row: ImportRow, ...keys: string[]) {
  const value = text(row, ...keys).replace(/[$,\s]/g, "");
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function percentage(row: ImportRow, ...keys: string[]) {
  const value = text(row, ...keys).replace(/[%\s]/g, "");
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed > 1 ? parsed / 100 : parsed;
}

function publicUrl(row: ImportRow) {
  const value = text(row, "source_url", "url", "document_url");
  if (!/^https:\/\//i.test(value)) return "";
  return value;
}

function location(row: ImportRow): MotionLocation {
  return {
    country: text(row, "country") || "United States",
    state: text(row, "state", "state_name"),
    city: text(row, "city"),
    basis:
      text(row, "location_basis") ||
      "source-reported business or asset location",
  };
}

function normalized(
  sourceId: ImportSourceId,
  row: ImportRow,
  retrievedAt: string,
  input: {
    eventType: EventType;
    eventStage: EventStage;
    title: string;
    seller?: string;
    buyer?: string;
    company?: string;
    asset?: string;
    status?: string;
  },
): NormalizedSourceEvent | null {
  const sourceUrl = publicUrl(row);
  const eventDate = text(
    row,
    "event_date",
    "effective_date",
    "recorded_date",
    "date",
  );
  if (!sourceUrl || !eventDate || !input.title) return null;
  const externalId =
    text(row, "external_record_id", "id", "docket_number", "file_number") ||
    stableId(sourceUrl, eventDate, input.title);
  const transactionValue = amount(
    row,
    "reported_transaction_value",
    "consideration",
    "sale_price",
  );
  return {
    source_id: sourceId,
    source_type: text(row, "source_type", "record_type") || sourceId,
    external_record_id: externalId,
    source_url: sourceUrl,
    retrieved_at: retrievedAt,
    published_at: text(row, "published_at", "filed_date") || eventDate,
    event_date: eventDate,
    event_type: input.eventType,
    event_stage: input.eventStage,
    raw_title: input.title,
    raw_text: text(row, "raw_text", "description", "summary"),
    seller_entity: input.seller || "",
    buyer_entity: input.buyer || "",
    subject_person: text(row, "subject_person"),
    subject_company: input.company || "",
    asset: input.asset || "",
    location: location(row),
    reported_transaction_value: transactionValue,
    currency: text(row, "currency") || "USD",
    ownership_percentage_low: percentage(
      row,
      "ownership_percentage_low",
      "ownership_low",
    ),
    ownership_percentage_high: percentage(
      row,
      "ownership_percentage_high",
      "ownership_high",
    ),
    status: input.status || text(row, "status") || input.eventStage,
    metadata: {
      imported: true,
      valueClassification: transactionValue === null ? "UNKNOWN" : "REPORTED",
      marketClass: text(row, "market_class") || "PRIVATE",
      subjectKind: text(row, "subject_person") ? "PERSON" : "ORGANIZATION",
      publisher: text(row, "publisher") || sourceId,
      original: row,
    },
    raw_payload_hash: stableId(sourceId, externalId, JSON.stringify(row)),
  };
}

function normalizeFcc(row: ImportRow, retrievedAt: string) {
  const action = text(row, "action", "purpose", "description", "record_type");
  if (!/assign|transfer|change of control/i.test(action)) return null;
  return normalized("fcc_uls", row, retrievedAt, {
    eventType: "LICENSE_TRANSFER",
    eventStage: /consummat|granted|complete/i.test(action)
      ? "CLOSED"
      : "ANNOUNCED",
    title:
      text(row, "title") ||
      `FCC license transfer ${text(row, "call_sign", "file_number")}`,
    seller: text(row, "assignor", "seller"),
    buyer: text(row, "assignee", "buyer"),
    company: text(row, "licensee", "subject_company"),
    asset: text(row, "call_sign", "license_id"),
  });
}

function normalizeUspto(row: ImportRow, retrievedAt: string) {
  const conveyance = text(row, "conveyance_text", "conveyance", "description");
  const classification = classifyPatentAssignment(conveyance);
  if (!classification) return null;
  return normalized("uspto_assignments", row, retrievedAt, {
    eventType: classification.eventType,
    eventStage: classification.stage,
    title:
      text(row, "title") ||
      `Patent assignment ${text(row, "reel_frame", "id")}`,
    seller: text(row, "assignor", "seller"),
    buyer: text(row, "assignee", "buyer"),
    company: text(row, "subject_company"),
    asset: text(row, "patent_number", "application_number", "reel_frame"),
  });
}

function normalizeDocket(
  sourceId: "ferc" | "stb",
  row: ImportRow,
  retrievedAt: string,
) {
  const description = text(row, "title", "description", "summary");
  if (!/acqui|sale|transfer|control|merger|disposition/i.test(description))
    return null;
  return normalized(sourceId, row, retrievedAt, {
    eventType:
      sourceId === "ferc"
        ? "ENERGY_ASSET_TRANSFER"
        : "TRANSPORT_ASSET_TRANSFER",
    eventStage: /approved|granted|effective|consummated/i.test(description)
      ? "CLOSED"
      : /application|petition|request/i.test(description)
        ? "PENDING_REGULATORY"
        : "ANNOUNCED",
    title: description,
    seller: text(row, "seller", "transferor"),
    buyer: text(row, "buyer", "transferee"),
    company: text(row, "subject_company", "applicant"),
    asset: text(row, "asset", "facility", "route"),
  });
}

function normalizeRegistry(
  sourceId: Extract<ImportSourceId, `registry_${string}`>,
  row: ImportRow,
  retrievedAt: string,
) {
  const status = text(row, "status", "filing_type", "description");
  const relatedTransaction = text(row, "related_transaction_url");
  if (
    !/dissol|merger|conversion/i.test(status) ||
    !/^https:\/\//i.test(relatedTransaction)
  ) {
    return null;
  }
  return normalized(sourceId, row, retrievedAt, {
    eventType: "DISSOLUTION_AFTER_TRANSACTION",
    eventStage: "POST_LIQUIDITY",
    title: text(row, "title") || `${text(row, "entity_name")} ${status}`,
    company: text(row, "entity_name", "subject_company"),
    status,
  });
}

function normalizeProperty(row: ImportRow, retrievedAt: string) {
  const status = text(row, "status", "record_type");
  if (!/closed|recorded|deed|sale/i.test(status)) return null;
  return normalized("commercial_property", row, retrievedAt, {
    eventType: "COMMERCIAL_REAL_ESTATE_SALE",
    eventStage: "CLOSED",
    title:
      text(row, "title") ||
      `Commercial property sale — ${text(row, "property_name", "address")}`,
    seller: text(row, "seller", "grantor"),
    buyer: text(row, "buyer", "grantee"),
    company: text(row, "subject_company"),
    asset: text(row, "property_name", "asset", "address"),
    status,
  });
}

function normalizeBroker(row: ImportRow, retrievedAt: string) {
  const status = text(row, "status", "record_type", "description");
  if (!/for sale|listing|asking price|seeking buyer/i.test(status)) return null;
  const sellerIsPublic = /^true|yes|1$/i.test(
    text(row, "seller_publicly_named"),
  );
  return normalized("broker_feeds", row, retrievedAt, {
    eventType: "BUSINESS_FOR_SALE",
    eventStage: "PRE_SALE",
    title: text(row, "title") || "Business-for-sale listing",
    seller: sellerIsPublic ? text(row, "seller") : "",
    company: text(row, "business_name"),
    asset: text(row, "asset", "listing_category"),
    status,
  });
}

export function normalizeImportedRows(
  sourceId: ImportSourceId,
  rows: ImportRow[],
  retrievedAt = new Date().toISOString(),
) {
  const events = rows.flatMap((row) => {
    const event =
      sourceId === "fcc_uls"
        ? normalizeFcc(row, retrievedAt)
        : sourceId === "uspto_assignments"
          ? normalizeUspto(row, retrievedAt)
          : sourceId === "ferc" || sourceId === "stb"
            ? normalizeDocket(sourceId, row, retrievedAt)
            : sourceId.startsWith("registry_")
              ? normalizeRegistry(
                  sourceId as Extract<ImportSourceId, `registry_${string}`>,
                  row,
                  retrievedAt,
                )
              : sourceId === "commercial_property"
                ? normalizeProperty(row, retrievedAt)
                : normalizeBroker(row, retrievedAt);
    return event ? [event] : [];
  });
  return {
    sourceId,
    recordsSeen: rows.length,
    recordsAccepted: events.length,
    recordsRejected: rows.length - events.length,
    events,
  };
}
