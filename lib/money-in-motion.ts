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

export type SourceMode =
  | "LIVE"
  | "DEGRADED"
  | "CONFIGURATION_REQUIRED"
  | "IMPORT_ONLY"
  | "DISABLED"
  | "ERROR";

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

export type LeadTimeMetrics = {
  firstSignalAt: string;
  firstPreSaleSignalAt: string;
  announcedAt: string;
  regulatoryFilingAt: string;
  closedAt: string;
  leadDaysToAnnouncement: number | null;
  leadDaysToClose: number | null;
};

export type ActionabilityBreakdown = {
  magnitude: number;
  recency: number;
  preCloseTiming: number;
  ownershipCertainty: number;
  privateMarket: number;
  sourceCorroboration: number;
  total: number;
  explanation: string[];
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
  personRole: string;
  subjectKind: "PERSON" | "ORGANIZATION" | "UNKNOWN";
  marketClass: "PUBLIC" | "PRIVATE" | "UNKNOWN";
  reportedTransactionValue: number | null;
  transactionValueClassification: EvidenceClassification;
  currency: string;
  estimate: PotentialLiquidityEstimate;
  confidence: ConfidenceBreakdown;
  actionability: ActionabilityBreakdown;
  leadTime: LeadTimeMetrics;
  independentSourceCount: number;
  firstReportedAt: string;
  latestReportedAt: string;
  ownershipEvidence: boolean;
  evidence: MotionEvidence[];
  sourceEventIds: string[];
  corroboratingRecordIds?: string[];
};

export type SourceValueMetrics = {
  recordsIngested: number;
  uniqueTransactionClusters: number;
  privateCompanyTransactions: number;
  namedPeopleResolved: number;
  eventsWithOwnershipEvidence: number;
  eventsWithReportedValuation: number;
  liquidityEstimatesGenerated: number;
  highConfidenceEstimates: number;
  preLiquiditySignals: number;
  closedTransactions: number;
  medianLeadDays: number | null;
  duplicateRate: number;
  rejectionRate: number;
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
  errorType: string;
  watermark: string;
  nextRetryAt: string;
  requests: number;
  cacheHits: number;
  rateLimitCount: number;
  successfulQueries: number;
  reason: string;
  sourceUrl: string;
  value: SourceValueMetrics;
  details?: {
    currentFile?: string;
    filesProcessed?: string[];
    bytesDownloaded?: number;
    bytesProcessed?: number;
    recordsProcessed?: number;
    currentCheckpoint?: string;
    classificationCounts?: Record<string, number>;
    transactionMatches?: number;
    peakMemoryBytes?: number | null;
    httpStatusDistribution?: Record<string, number>;
    failedRequests?: number;
    networkFailures?: number;
    queryFamilies?: Record<
      string,
      {
        watermark: string;
        lastErrorType: string;
        lastErrorSummary: string;
      }
    >;
  };
};

export type PersonLiquiditySummary = {
  personId: string;
  name: string;
  role: string;
  company: string;
  location: MotionLocation;
  industry: string;
  marketClass: "PUBLIC" | "PRIVATE" | "UNKNOWN";
  latestEventId: string;
  latestEventTitle: string;
  latestStage: EventStage;
  eventCount: number;
  firstSignalAt: string;
  latestSignalAt: string;
  latestCloseAt: string;
  estimatedLiquidityLow: number | null;
  estimatedLiquidityHigh: number | null;
  currency: string;
  highestConfidence: number;
  actionability: ActionabilityBreakdown;
  sourceCount: number;
  openPreLiquidityCount: number;
  closedEventCount: number;
  leadDaysToClose: number | null;
  evidence: MotionEvidence[];
  uncertainties: string[];
};

export type MoneyMotionSnapshot = {
  schemaVersion: 2;
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
    privateCompanyEvents: number;
    preCloseSignals: number;
    highConfidenceEstimates: number;
    secEstimateShare: number;
  };
  records: MoneyMotionRecord[];
  peopleInMotion: PersonLiquiditySummary[];
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

function parseDate(value: string) {
  const timestamp = Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function daysBetween(start: string, end: string) {
  const startTime = parseDate(start);
  const endTime = parseDate(end);
  if (startTime === null || endTime === null || endTime < startTime)
    return null;
  return Math.round((endTime - startTime) / 86_400_000);
}

export function calculateLeadTime(input: {
  firstSignalAt?: string;
  firstPreSaleSignalAt?: string;
  announcedAt?: string;
  regulatoryFilingAt?: string;
  closedAt?: string;
}): LeadTimeMetrics {
  const firstSignalAt = input.firstSignalAt || "";
  const firstPreSaleSignalAt = input.firstPreSaleSignalAt || "";
  const announcedAt = input.announcedAt || "";
  const regulatoryFilingAt = input.regulatoryFilingAt || "";
  const closedAt = input.closedAt || "";
  const leadStart = firstPreSaleSignalAt || firstSignalAt;
  return {
    firstSignalAt,
    firstPreSaleSignalAt,
    announcedAt,
    regulatoryFilingAt,
    closedAt,
    leadDaysToAnnouncement:
      leadStart && announcedAt ? daysBetween(leadStart, announcedAt) : null,
    leadDaysToClose:
      leadStart && closedAt ? daysBetween(leadStart, closedAt) : null,
  };
}

export function scoreActionability(input: {
  potentialLiquidityHigh: number | null;
  eventDate: string;
  asOfDate: string;
  stage: EventStage;
  ownershipEvidence: boolean;
  privateCompany: boolean;
  independentSourceCount: number;
}): ActionabilityBreakdown {
  const amount = input.potentialLiquidityHigh || 0;
  const magnitude =
    amount >= 100_000_000
      ? 30
      : amount >= 50_000_000
        ? 26
        : amount >= 25_000_000
          ? 22
          : amount >= 10_000_000
            ? 18
            : amount >= 5_000_000
              ? 14
              : amount >= 1_000_000
                ? 10
                : 2;
  const age = daysBetween(input.eventDate, input.asOfDate);
  const recency =
    age === null ? 2 : age <= 30 ? 20 : age <= 90 ? 15 : age <= 365 ? 9 : 3;
  const preCloseTiming = [
    "PRE_SALE",
    "ANNOUNCED",
    "PENDING_REGULATORY",
  ].includes(input.stage)
    ? 15
    : input.stage === "CLOSED" || input.stage === "POST_LIQUIDITY"
      ? 8
      : 3;
  const ownershipCertainty = input.ownershipEvidence ? 15 : 0;
  const privateMarket = input.privateCompany ? 10 : 2;
  const sourceCorroboration = Math.min(
    10,
    input.independentSourceCount <= 1
      ? 2
      : 4 + input.independentSourceCount * 2,
  );
  const values = {
    magnitude,
    recency,
    preCloseTiming,
    ownershipCertainty,
    privateMarket,
    sourceCorroboration,
  };
  return {
    ...values,
    total: Object.values(values).reduce((sum, value) => sum + value, 0),
    explanation: [
      amount
        ? "Potential-liquidity magnitude"
        : "No person-level amount established",
      age === null ? "Event recency unavailable" : `${age} days since event`,
      input.privateCompany
        ? "Private-company signal"
        : "Public or unresolved market",
      `${input.independentSourceCount} independent source${input.independentSourceCount === 1 ? "" : "s"}`,
    ],
  };
}

export function estimatePrivateCompanyValue(input: {
  revenue?: number | null;
  ebitda?: number | null;
  employeeCount?: number | null;
  knownValuation?: number | null;
  revenueMultipleLow?: number | null;
  revenueMultipleHigh?: number | null;
  ebitdaMultipleLow?: number | null;
  ebitdaMultipleHigh?: number | null;
}) {
  if (input.knownValuation && input.knownValuation > 0) {
    return {
      low: input.knownValuation,
      high: input.knownValuation,
      classification: "REPORTED" as const,
      method: "Known financing or valuation evidence",
      assumptions: [`Reported valuation ${input.knownValuation}`],
    };
  }
  if (
    input.ebitda &&
    input.ebitda > 0 &&
    input.ebitdaMultipleLow &&
    input.ebitdaMultipleHigh
  ) {
    return {
      low: Math.round(input.ebitda * input.ebitdaMultipleLow),
      high: Math.round(input.ebitda * input.ebitdaMultipleHigh),
      classification: "ESTIMATED" as const,
      method: "EBITDA multiple model",
      assumptions: [
        `Reported EBITDA ${input.ebitda}`,
        `${input.ebitdaMultipleLow}x–${input.ebitdaMultipleHigh}x comparable range`,
      ],
    };
  }
  if (
    input.revenue &&
    input.revenue > 0 &&
    input.revenueMultipleLow &&
    input.revenueMultipleHigh
  ) {
    return {
      low: Math.round(input.revenue * input.revenueMultipleLow),
      high: Math.round(input.revenue * input.revenueMultipleHigh),
      classification: "ESTIMATED" as const,
      method: "Revenue multiple model",
      assumptions: [
        `Reported revenue ${input.revenue}`,
        `${input.revenueMultipleLow}x–${input.revenueMultipleHigh}x comparable range`,
      ],
    };
  }
  return {
    low: null,
    high: null,
    classification: "UNKNOWN" as const,
    method: "No defensible private-company valuation",
    assumptions: input.employeeCount
      ? ["Employee count alone was rejected as insufficient valuation evidence"]
      : ["No supported operating or valuation inputs"],
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

/**
 * Rail dockets are useful here only when the official record identifies a
 * subject and reports consideration. Status-only proceedings are operational
 * regulatory data, not evidence of attributable liquidity.
 */
export function isQualifiedTransportationRecord(record: MoneyMotionRecord) {
  if (record.eventType !== "TRANSPORT_ASSET_TRANSFER") return true;
  return (
    record.reportedTransactionValue !== null &&
    record.reportedTransactionValue > 0 &&
    record.subjectKind !== "UNKNOWN" &&
    Boolean(record.person || record.company || record.seller)
  );
}

export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function aggregatePeopleInMotion(
  records: MoneyMotionRecord[],
): PersonLiquiditySummary[] {
  const groups = new Map<string, MoneyMotionRecord[]>();
  for (const record of records) {
    if (!record.person) continue;
    const key = normalizeEntityName(record.person);
    const existing = groups.get(key) || [];
    if (!existing.some((item) => item.clusterKey === record.clusterKey)) {
      existing.push(record);
    }
    groups.set(key, existing);
  }
  return [...groups.entries()]
    .map(([key, events]) => {
      const ordered = [...events].sort((left, right) =>
        right.eventDate.localeCompare(left.eventDate),
      );
      const latest = ordered[0];
      const valued = ordered
        .filter((event) => event.estimate.potentiallyDeployableHigh !== null)
        .sort(
          (left, right) =>
            (right.estimate.potentiallyDeployableHigh || 0) -
            (left.estimate.potentiallyDeployableHigh || 0),
        )[0];
      const evidence = new Map(
        ordered
          .flatMap((event) => event.evidence)
          .map((item) => [item.id, item]),
      );
      const actionability = [...ordered].sort(
        (left, right) => right.actionability.total - left.actionability.total,
      )[0].actionability;
      const signals = ordered
        .map((event) => event.leadTime.firstSignalAt || event.firstReportedAt)
        .filter(Boolean)
        .sort();
      const closes = ordered
        .map((event) => event.leadTime.closedAt)
        .filter(Boolean)
        .sort();
      return {
        personId: `person-motion-${stableId(key)}`,
        name: latest.person,
        role: latest.personRole,
        company: latest.company,
        location: latest.location,
        industry: latest.industry,
        marketClass: latest.marketClass,
        latestEventId: latest.id,
        latestEventTitle: latest.title,
        latestStage: latest.stage,
        eventCount: ordered.length,
        firstSignalAt: signals.at(0) || "",
        latestSignalAt: signals.at(-1) || "",
        latestCloseAt: closes.at(-1) || "",
        estimatedLiquidityLow:
          valued?.estimate.potentiallyDeployableLow ?? null,
        estimatedLiquidityHigh:
          valued?.estimate.potentiallyDeployableHigh ?? null,
        currency: valued?.currency || latest.currency,
        highestConfidence: Math.max(
          ...ordered.map((event) => event.confidence.total),
        ),
        actionability,
        sourceCount: new Set(
          [...evidence.values()].map((item) => item.sourceId),
        ).size,
        openPreLiquidityCount: ordered.filter((event) =>
          ["WATCHING", "PRE_SALE", "ANNOUNCED", "PENDING_REGULATORY"].includes(
            event.stage,
          ),
        ).length,
        closedEventCount: ordered.filter((event) =>
          ["CLOSED", "POST_LIQUIDITY"].includes(event.stage),
        ).length,
        leadDaysToClose: median(
          ordered
            .map((event) => event.leadTime.leadDaysToClose)
            .filter((value): value is number => value !== null),
        ),
        evidence: [...evidence.values()],
        uncertainties:
          valued?.estimate.uncertainty || latest.estimate.uncertainty,
      };
    })
    .sort(
      (left, right) =>
        right.actionability.total - left.actionability.total ||
        right.highestConfidence - left.highestConfidence,
    );
}

export function sourceValueMetrics(
  sourceId: string,
  records: MoneyMotionRecord[],
  ingested: number,
  rejected: number,
): SourceValueMetrics {
  const represented = records.filter((record) =>
    record.evidence.some((item) => item.sourceId === sourceId),
  );
  const leads = represented
    .map((record) => record.leadTime.leadDaysToClose)
    .filter((value): value is number => value !== null);
  return {
    recordsIngested: ingested,
    uniqueTransactionClusters: represented.length,
    privateCompanyTransactions: represented.filter(
      (record) => record.marketClass === "PRIVATE",
    ).length,
    namedPeopleResolved: new Set(
      represented.map((record) => record.person).filter(Boolean),
    ).size,
    eventsWithOwnershipEvidence: represented.filter(
      (record) => record.ownershipEvidence,
    ).length,
    eventsWithReportedValuation: represented.filter(
      (record) => record.reportedTransactionValue !== null,
    ).length,
    liquidityEstimatesGenerated: represented.filter(
      (record) => record.estimate.potentiallyDeployableHigh !== null,
    ).length,
    highConfidenceEstimates: represented.filter(
      (record) =>
        record.estimate.potentiallyDeployableHigh !== null &&
        record.confidence.total >= 75,
    ).length,
    preLiquiditySignals: represented.filter((record) =>
      ["WATCHING", "PRE_SALE", "ANNOUNCED", "PENDING_REGULATORY"].includes(
        record.stage,
      ),
    ).length,
    closedTransactions: represented.filter((record) =>
      ["CLOSED", "POST_LIQUIDITY"].includes(record.stage),
    ).length,
    medianLeadDays: median(leads),
    duplicateRate: ingested
      ? Number(((ingested - represented.length) / ingested).toFixed(4))
      : 0,
    rejectionRate:
      ingested + rejected
        ? Number((rejected / (ingested + rejected)).toFixed(4))
        : 0,
  };
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
  /\b(?:majority|minority) stake\b/i,
  /\bsecondary (?:sale|transaction)\b/i,
  /\b(?:founder exit|management buyout)\b/i,
  /\b(?:asset|portfolio) sale\b/i,
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
        : /secondary|minority stake|majority stake/i.test(haystack)
          ? "SECONDARY_SALE"
          : /management buyout|founder exit/i.test(haystack)
            ? "BUSINESS_SALE"
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

const usptoConfigured =
  typeof process !== "undefined" && Boolean(process.env?.USPTO_API_KEY);

const chicagoPropertySources = [
  [
    "chicago_property",
    "Chicago Property transactions",
    "Cook County and Illinois public records",
    "https://datacatalog.cookcountyil.gov/d/wvhk-k5uv",
  ],
  [
    "cook_property_sales",
    "Cook County parcel sales",
    "Cook County Assessor's Office",
    "https://datacatalog.cookcountyil.gov/d/wvhk-k5uv",
  ],
  [
    "illinois_ptax",
    "Illinois PTAX-203 transfer declarations",
    "Illinois Department of Revenue",
    "https://data.illinois.gov/d/it54-y4c6",
  ],
  [
    "cook_transfer_forms",
    "Cook County and Chicago transfer forms",
    "Illinois Department of Revenue",
    "https://data.illinois.gov/d/vbnw-q5s8",
  ],
  [
    "cook_parcel_addresses",
    "Cook County parcel situs addresses",
    "Cook County Assessor's Office",
    "https://datacatalog.cookcountyil.gov/d/3723-97qp",
  ],
  [
    "cook_commercial_valuation",
    "Cook County commercial valuation",
    "Cook County Assessor's Office",
    "https://datacatalog.cookcountyil.gov/d/csik-bsws",
  ],
  [
    "cook_parcel_universe",
    "Cook County parcel geography",
    "Cook County Assessor's Office",
    "https://datacatalog.cookcountyil.gov/d/nj4t-kc8j",
  ],
  [
    "chicago_business_licenses",
    "Chicago business licenses",
    "City of Chicago",
    "https://data.cityofchicago.org/d/r5kz-chrr",
  ],
  [
    "chicago_business_owners",
    "Chicago business owners",
    "City of Chicago",
    "https://data.cityofchicago.org/d/ezma-pppn",
  ],
] as const;

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
    mode: "LIVE",
    cadence: "Daily",
    sourceUrl:
      "https://www.fcc.gov/wireless/data/public-access-files-database-downloads",
    reason:
      "Official bounded daily assignment/transfer files are downloaded and retained as filing-stage signals without inferred consideration.",
    normalize: () => [],
  },
  {
    id: "uspto_assignments",
    name: "USPTO patent assignments",
    publisher: "U.S. Patent and Trademark Office",
    mode: usptoConfigured ? "LIVE" : "CONFIGURATION_REQUIRED",
    cadence: "Daily",
    sourceUrl: "https://data.uspto.gov/apis/bulk-data/search",
    reason: usptoConfigured
      ? "Current Open Data Portal PASDL daily XML is active with bounded retention and conveyance classification."
      : "Add USPTO_API_KEY for the current Open Data Portal. Retired Developer Hub endpoints are not used.",
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
    mode: "LIVE",
    cadence: "Every 4 hours",
    sourceUrl:
      "https://www.stb.gov/proceedings-actions/dockets-and-service-lists/",
    reason:
      "Official STB proceedings are retained only when the record identifies a subject and reports transaction consideration; status-only dockets are excluded.",
    normalize: () => [],
  },
  {
    id: "bankruptcy_recap",
    name: "Bankruptcy asset-sale dockets",
    publisher: "Free Law Project CourtListener / RECAP",
    mode: "LIVE",
    cadence: "Every 4 hours",
    sourceUrl: "https://www.courtlistener.com/recap/",
    reason:
      "Public federal bankruptcy docket search; records are accepted only when the indexed text explicitly discloses purchase or sale consideration.",
    normalize: () => [],
  },
  {
    id: "official_transaction_news",
    name: "DOJ and FTC transaction notices",
    publisher: "U.S. Department of Justice / Federal Trade Commission",
    mode: "LIVE",
    cadence: "Every 4 hours",
    sourceUrl: "https://www.justice.gov/atr/press-releases",
    reason:
      "Official public press-release feeds are filtered for transaction language and treated as regulatory signals unless completion is explicit.",
    normalize: () => [],
  },
  ...chicagoPropertySources.map(
    ([id, name, publisher, sourceUrl]): SourceAdapter => ({
      id,
      name,
      publisher,
      mode: "LIVE",
      cadence: "Daily",
      sourceUrl,
      reason:
        id === "chicago_property"
          ? "Significant recorded property dispositions are clustered and quality-filtered before directory promotion."
          : "Official enrichment source for the Chicago Property workspace.",
      normalize: () => [],
    }),
  ),
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
