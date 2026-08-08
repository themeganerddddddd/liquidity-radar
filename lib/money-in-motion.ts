export const EVENT_STAGES = [
  "WATCHING",
  "PRE_SALE",
  "ANNOUNCED",
  "PENDING_REGULATORY",
  "CLOSED",
  "POST_LIQUIDITY",
  "UNKNOWN",
] as const;

export type EventStage = (typeof EVENT_STAGES)[number];

export const EVENT_TYPES = [
  "BUSINESS_SALE",
  "BUSINESS_FOR_SALE",
  "MERGER",
  "ACQUISITION",
  "DIVESTITURE",
  "RECAPITALIZATION",
  "SECONDARY_SALE",
  "TENDER_OFFER",
  "ASSET_SALE",
  "COMMERCIAL_REAL_ESTATE_SALE",
  "PATENT_ASSIGNMENT",
  "TRADEMARK_ASSIGNMENT",
  "LICENSE_TRANSFER",
  "CHANGE_OF_CONTROL",
  "HEALTHCARE_CHOW",
  "ENERGY_ASSET_TRANSFER",
  "TRANSPORT_ASSET_TRANSFER",
  "DISSOLUTION_AFTER_TRANSACTION",
  "OTHER",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export type EvidenceClassification =
  "KNOWN" | "REPORTED" | "ESTIMATED" | "UNKNOWN";

export type SourceMode = "LIVE" | "IMPORT_ONLY" | "DISABLED";

export type MotionLocation = {
  country: string;
  state: string;
  city: string;
  basis: string;
};

/** The lossless boundary returned by every source adapter. */
export type NormalizedSourceEvent = {
  source_id: string;
  source_type: string;
  external_record_id: string;
  source_url: string;
  retrieved_at: string;
  published_at: string;
  event_date: string;
  event_type: EventType;
  event_stage: EventStage;
  raw_title: string;
  raw_text: string;
  seller_entity: string;
  buyer_entity: string;
  subject_person: string;
  subject_company: string;
  asset: string;
  location: MotionLocation;
  reported_transaction_value: number | null;
  currency: string;
  ownership_percentage_low: number | null;
  ownership_percentage_high: number | null;
  status: string;
  metadata: Record<string, unknown>;
  raw_payload_hash: string;
};

export type ConfidenceBreakdown = {
  sourceReliability: number;
  transactionCertainty: number;
  identityMatch: number;
  ownershipCertainty: number;
  valuationCertainty: number;
  total: number;
  explanation: string[];
};

export type MotionEvidence = {
  id: string;
  sourceId: string;
  publisher: string;
  title: string;
  sourceUrl: string;
  publishedAt: string;
  retrievedAt: string;
  classification: EvidenceClassification;
  excerpt: string;
};

export type PotentialLiquidityEstimate = {
  grossAttributableLow: number | null;
  grossAttributableHigh: number | null;
  potentiallyDeployableLow: number | null;
  potentiallyDeployableHigh: number | null;
  currency: string;
  classification: EvidenceClassification;
  methodology: string;
  calculation: string;
  uncertainty: string[];
};

export type MoneyMotionRecord = {
  id: string;
  clusterKey: string;
  person: string;
  company: string;
  seller: string;
  buyer: string;
  asset: string;
  title: string;
  summary: string;
  whyHere: string;
  eventType: EventType;
  stage: EventStage;
  eventDate: string;
  publishedAt: string;
  location: MotionLocation;
  industry: string;
  subjectKind: "PERSON" | "ORGANIZATION" | "UNKNOWN";
  marketClass: "PUBLIC" | "PRIVATE" | "UNKNOWN";
  reportedTransactionValue: number | null;
  transactionValueClassification: EvidenceClassification;
  currency: string;
  estimate: PotentialLiquidityEstimate;
  confidence: ConfidenceBreakdown;
  evidence: MotionEvidence[];
  sourceEventIds: string[];
};

export type SourceHealth = {
  id: string;
  name: string;
  publisher: string;
  mode: SourceMode;
  cadence: string;
  lastAttemptAt: string;
  lastSuccessAt: string;
  recordsSeen: number;
  recordsAccepted: number;
  recordsRejected: number;
  latencyMs: number | null;
  error: string;
  reason: string;
  sourceUrl: string;
};

export type MoneyMotionSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  disclaimer: string;
  stats: {
    records: number;
    people: number;
    organizations: number;
    sources: number;
    liveSources: number;
    knownOrReportedValues: number;
    estimates: number;
  };
  records: MoneyMotionRecord[];
  sourceHealth: SourceHealth[];
};

export type SourceAdapter = {
  id: string;
  name: string;
  publisher: string;
  mode: SourceMode;
  cadence: string;
  sourceUrl: string;
  reason: string;
  normalize(payload: unknown, retrievedAt: string): NormalizedSourceEvent[];
};

function bounded(value: number, maximum: number) {
  return Math.max(0, Math.min(maximum, Math.round(value)));
}

export function scoreConfidence(input: {
  sourceReliability: number;
  transactionCertainty: number;
  identityMatch: number;
  ownershipCertainty: number;
  valuationCertainty: number;
  explanation?: string[];
}): ConfidenceBreakdown {
  const result = {
    sourceReliability: bounded(input.sourceReliability, 25),
    transactionCertainty: bounded(input.transactionCertainty, 25),
    identityMatch: bounded(input.identityMatch, 20),
    ownershipCertainty: bounded(input.ownershipCertainty, 15),
    valuationCertainty: bounded(input.valuationCertainty, 15),
  };
  return {
    ...result,
    total: Object.values(result).reduce((sum, value) => sum + value, 0),
    explanation: input.explanation ?? [],
  };
}

export function estimatePotentialLiquidity(input: {
  transactionValue: number | null;
  currency?: string;
  valueClassification: EvidenceClassification;
  ownershipLow: number | null;
  ownershipHigh: number | null;
  directlyAttributedGross?: boolean;
}): PotentialLiquidityEstimate {
  const currency = input.currency || "USD";
  const unknown = (
    methodology: string,
    uncertainty: string[],
  ): PotentialLiquidityEstimate => ({
    grossAttributableLow: null,
    grossAttributableHigh: null,
    potentiallyDeployableLow: null,
    potentiallyDeployableHigh: null,
    currency,
    classification: "UNKNOWN",
    methodology,
    calculation: "No calculation performed.",
    uncertainty,
  });

  if (
    input.transactionValue === null ||
    !Number.isFinite(input.transactionValue) ||
    input.transactionValue <= 0
  ) {
    return unknown("No defensible monetary estimate.", [
      "The source does not report a usable transaction value.",
    ]);
  }

  let ownershipLow = input.ownershipLow;
  let ownershipHigh = input.ownershipHigh;
  if (input.directlyAttributedGross) {
    ownershipLow = 1;
    ownershipHigh = 1;
  }
  if (
    ownershipLow === null ||
    ownershipHigh === null ||
    ownershipLow < 0 ||
    ownershipHigh <= 0
  ) {
    return unknown("Transaction value retained without personal attribution.", [
      "Ownership is not established; a personal share was not invented.",
    ]);
  }

  const lowShare = Math.min(1, Math.min(ownershipLow, ownershipHigh));
  const highShare = Math.min(1, Math.max(ownershipLow, ownershipHigh));
  const grossLow = Math.round(input.transactionValue * lowShare);
  const grossHigh = Math.round(input.transactionValue * highShare);
  const deployableLow = Math.round(grossLow * 0.55);
  const deployableHigh = Math.round(grossHigh * 0.85);
  return {
    grossAttributableLow: grossLow,
    grossAttributableHigh: grossHigh,
    potentiallyDeployableLow: deployableLow,
    potentiallyDeployableHigh: deployableHigh,
    currency,
    classification:
      input.valueClassification === "KNOWN" && lowShare === highShare
        ? "REPORTED"
        : "ESTIMATED",
    methodology:
      "Gross attributable value equals reported transaction value multiplied by the supported ownership range. Potentially deployable proceeds apply a 55%–85% planning range for taxes, fees, debt, retention, and other unobserved uses.",
    calculation: `${currency} ${input.transactionValue.toLocaleString("en-US")} × ${(lowShare * 100).toFixed(2)}%–${(highShare * 100).toFixed(2)}%; then 55%–85% of gross attributable value.`,
    uncertainty: [
      "This is an evidence-linked estimate, not a bank balance, net-worth figure, or claim of disposable wealth.",
      "Taxes, transaction expenses, debt repayment, rollover equity, and subsequent deployment are generally not observed.",
    ],
  };
}

export function normalizeEntityName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(
      /\b(incorporated|inc|corp(?:oration)?|company|co|llc|ltd|lp)\b/g,
      "",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function stableId(...parts: string[]) {
  const value = parts.join("|");
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function eventClusterKey(event: NormalizedSourceEvent) {
  const parties = [
    event.seller_entity,
    event.buyer_entity,
    event.subject_company,
    event.subject_person,
  ]
    .map(normalizeEntityName)
    .filter(Boolean)
    .sort()
    .join("+");
  const date = new Date(`${event.event_date.slice(0, 10)}T00:00:00Z`);
  const tenDayBucket = Number.isNaN(date.getTime())
    ? event.event_date.slice(0, 7)
    : Math.floor(date.getTime() / (10 * 86_400_000)).toString();
  return `${event.event_type}:${parties || normalizeEntityName(event.raw_title)}:${tenDayBucket}`;
}

export function dedupeSourceEvents(events: NormalizedSourceEvent[]) {
  const exact = new Map<string, NormalizedSourceEvent>();
  for (const event of events) {
    const key = `${event.source_id}:${event.external_record_id}`;
    const current = exact.get(key);
    if (!current || event.retrieved_at > current.retrieved_at)
      exact.set(key, event);
  }
  return [...exact.values()].sort(
    (left, right) =>
      right.event_date.localeCompare(left.event_date) ||
      left.source_id.localeCompare(right.source_id),
  );
}

const transactionPhrases = [
  /\b(?:acquir(?:e[ds]?|ing)|acquisition)\b/i,
  /\bmerg(?:e[ds]?|er|ing)\b/i,
  /\bbought\b|\bpurchased\b/i,
  /\bsold\b|\bsale of\b/i,
  /\bdivest(?:ed|iture|ing)?\b/i,
  /\brecapitaliz(?:ed|ation)\b/i,
  /\btender offer\b/i,
  /\bchange of (?:ownership|control)\b/i,
];

const nonTransactionPhrases = [
  /\bmay acquire\b/i,
  /\bconsidering (?:a )?sale\b/i,
  /\bmarket (?:share|value)\b/i,
  /\bsales (?:rose|fell|growth|decline)\b/i,
  /\bjob cuts?\b/i,
];

export function classifyNewsTransaction(title: string, text = "") {
  const haystack = `${title} ${text}`;
  const accepted =
    transactionPhrases.some((pattern) => pattern.test(haystack)) &&
    !nonTransactionPhrases.some((pattern) => pattern.test(haystack));
  if (!accepted) return null;
  const stage: EventStage =
    /complete[ds]?|closed|consummated|bought|sold/i.test(haystack)
      ? "CLOSED"
      : /regulatory|approval|clearance|pending/i.test(haystack)
        ? "PENDING_REGULATORY"
        : "ANNOUNCED";
  const eventType: EventType = /merger/i.test(haystack)
    ? "MERGER"
    : /divest/i.test(haystack)
      ? "DIVESTITURE"
      : /recapital/i.test(haystack)
        ? "RECAPITALIZATION"
        : /tender offer/i.test(haystack)
          ? "TENDER_OFFER"
          : /asset/i.test(haystack)
            ? "ASSET_SALE"
            : "ACQUISITION";
  return { stage, eventType };
}

export function classifyPatentAssignment(conveyance: string) {
  if (
    /name change|change of name|corrective|security interest|collateral|internal reorg|merger of assignor/i.test(
      conveyance,
    )
  ) {
    return null;
  }
  return /assignment|sale|purchase|transfer/i.test(conveyance)
    ? ({ eventType: "PATENT_ASSIGNMENT", stage: "CLOSED" } as const)
    : null;
}

export const SOURCE_ADAPTERS: SourceAdapter[] = [
  {
    id: "sec",
    name: "SEC EDGAR transactions",
    publisher: "U.S. Securities and Exchange Commission",
    mode: "LIVE",
    cadence: "Daily",
    sourceUrl: "https://www.sec.gov/edgar/search/",
    reason: "Existing official SEC ingestion is active.",
    normalize: () => [],
  },
  {
    id: "ftc_hsr",
    name: "HSR early-termination notices",
    publisher: "Federal Trade Commission",
    mode: "LIVE",
    cadence: "Daily",
    sourceUrl:
      "https://www.ftc.gov/legal-library/browse/early-termination-notices",
    reason:
      "Existing official FTC ingestion is active; records are pre-close signals only.",
    normalize: () => [],
  },
  {
    id: "gdelt",
    name: "GDELT transaction news",
    publisher: "GDELT Project",
    mode: "LIVE",
    cadence: "Every 4 hours",
    sourceUrl: "https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/",
    reason:
      "Public DOC 2.0 news discovery with strict transaction-language filtering.",
    normalize: () => [],
  },
  {
    id: "cms_chow",
    name: "CMS change of ownership",
    publisher: "Centers for Medicare & Medicaid Services",
    mode: "LIVE",
    cadence: "Daily",
    sourceUrl:
      "https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities",
    reason: "Official CMS CHOW and public ownership datasets.",
    normalize: () => [],
  },
  {
    id: "fcc_uls",
    name: "FCC Universal Licensing System",
    publisher: "Federal Communications Commission",
    mode: "IMPORT_ONLY",
    cadence: "Daily file adapter",
    sourceUrl:
      "https://www.fcc.gov/wireless/data/public-access-files-database-downloads",
    reason:
      "Parser is available for official ULS assignment files; automated bulk download is held until a bounded transfer feed is configured.",
    normalize: () => [],
  },
  {
    id: "uspto_assignments",
    name: "Patent and trademark assignments",
    publisher: "U.S. Patent and Trademark Office",
    mode: "IMPORT_ONLY",
    cadence: "Daily import",
    sourceUrl: "https://assignmentcenter.uspto.gov/",
    reason:
      "Official Assignment Center export/API credentials must be configured; name changes, security interests, and corrective filings are excluded.",
    normalize: () => [],
  },
  {
    id: "ferc",
    name: "FERC transaction dockets",
    publisher: "Federal Energy Regulatory Commission",
    mode: "IMPORT_ONLY",
    cadence: "Daily URL/CSV import",
    sourceUrl: "https://elibrary.ferc.gov/eLibrary/search",
    reason:
      "No stable, documented public machine feed is configured. Official docket URL and CSV intake is supported.",
    normalize: () => [],
  },
  {
    id: "stb",
    name: "STB rail transaction dockets",
    publisher: "Surface Transportation Board",
    mode: "IMPORT_ONLY",
    cadence: "Daily URL/CSV import",
    sourceUrl:
      "https://www.stb.gov/proceedings-actions/dockets-and-service-lists/",
    reason:
      "Official docket import is supported; automated discovery remains off without a stable combined machine feed.",
    normalize: () => [],
  },
  ...["Maryland", "District of Columbia", "Virginia"].map(
    (jurisdiction): SourceAdapter => ({
      id: `registry_${jurisdiction.toLowerCase().replace(/\W+/g, "_")}`,
      name: `${jurisdiction} business registry`,
      publisher: `${jurisdiction} public registry`,
      mode: "IMPORT_ONLY",
      cadence: "Weekly URL/CSV import",
      sourceUrl:
        jurisdiction === "Maryland"
          ? "https://egov.maryland.gov/BusinessExpress/EntitySearch"
          : jurisdiction === "Virginia"
            ? "https://cis.scc.virginia.gov/"
            : "https://corponline.dcp.dc.gov/",
      reason:
        "Public search is available, but no documented bulk API is configured; no access controls are bypassed.",
      normalize: () => [],
    }),
  ),
  {
    id: "commercial_property",
    name: "Commercial-property closings",
    publisher: "Licensed/user-provided property feeds",
    mode: "IMPORT_ONLY",
    cadence: "Daily import",
    sourceUrl: "",
    reason:
      "Requires a licensed feed or user-provided file. No paywall or access control is bypassed.",
    normalize: () => [],
  },
  {
    id: "broker_feeds",
    name: "Broker and business-for-sale feeds",
    publisher: "Configured public RSS or licensed feeds",
    mode: "IMPORT_ONLY",
    cadence: "Every 6 hours",
    sourceUrl: "",
    reason:
      "Only configured public/licensed feeds are accepted; anonymous sellers remain anonymous.",
    normalize: () => [],
  },
];
