import type {
  ChicagoPropertyRecord,
  ChicagoPropertySnapshot,
} from "./chicago-property";
import type {
  MoneyMotionRecord,
  MoneyMotionSnapshot,
  PersonLiquiditySummary,
} from "./money-in-motion";

export const TOP_CONTACT_GEOGRAPHIES = [
  "CHICAGO_METRO",
  "COOK",
  "DUPAGE",
] as const;
export type TopContactGeography = (typeof TOP_CONTACT_GEOGRAPHIES)[number];

export const CONTACT_WORKFLOW_STATUSES = [
  "NOT_REVIEWED",
  "RESEARCHING",
  "READY",
  "CONTACTED",
  "RESPONDED",
  "MEETING",
  "OPPORTUNITY_CREATED",
  "NOT_RELEVANT",
  "DO_NOT_CONTACT",
] as const;
export type ContactWorkflowStatus = (typeof CONTACT_WORKFLOW_STATUSES)[number];
export type RecommendationStatus = "ACTIVE" | "SAVED" | "SKIPPED";
export type ContactabilityLevel = "DIRECT" | "COMPANY" | "PROFILE" | "NONE";
export type ContactVerificationStatus =
  | "VERIFIED_PUBLIC"
  | "COMPANY_ROUTE"
  | "PROFESSIONAL_PROFILE"
  | "UNVERIFIED"
  | "NOT_FOUND";

export type ProfessionalContact = {
  id: string;
  personId: string;
  company: string;
  type:
    | "BUSINESS_EMAIL"
    | "WORK_PHONE"
    | "COMPANY_WEBSITE"
    | "CONTACT_PAGE"
    | "PROFESSIONAL_PROFILE";
  value: string;
  sourceUrl: string;
  sourceName: string;
  retrievedAt: string;
  verificationStatus: ContactVerificationStatus;
  notes: string;
};

export type PersistedRecommendationState = {
  weekStart: string;
  geographyId: TopContactGeography;
  personId: string;
  workflowStatus: ContactWorkflowStatus;
  recommendationStatus: RecommendationStatus;
  skipReason: string;
  lastMaterialEventAt: string;
  lastUpdatedAt: string;
};

export type ContactPriorityBreakdown = {
  liquidity: number;
  recency: number;
  exitConvergence: number;
  ownership: number;
  contactability: number;
  evidence: number;
  boosts: number;
  penalties: number;
  total: number;
};

export type TopContactRecommendation = {
  rank: number;
  weekStart: string;
  geographyId: TopContactGeography;
  personId: string;
  name: string;
  company: string;
  role: string;
  location: string;
  county: "Cook" | "DuPage" | "Cook + DuPage";
  estimatedProceedsLow: number | null;
  estimatedProceedsHigh: number | null;
  currency: string;
  contactPriorityScore: number;
  score: ContactPriorityBreakdown;
  whyNow: string;
  contactability: ContactabilityLevel;
  contacts: ProfessionalContact[];
  primaryEvent: MoneyMotionRecord;
  relevantEventIds: string[];
  workflowStatus: ContactWorkflowStatus;
  recommendationStatus: RecommendationStatus;
  isPreLiquidity: boolean;
  isCrossCounty: boolean;
  residentialOnly: boolean;
  latestMaterialEventAt: string;
};

export type TopContactsSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  weekStart: string;
  geographyId: TopContactGeography;
  recommendations: TopContactRecommendation[];
  stats: {
    eligiblePeople: number;
    visibleRecommendations: number;
    estimatedProceedsLow: number;
    estimatedProceedsHigh: number;
    directContacts: number;
    companyRoutes: number;
    professionalProfiles: number;
    noContactFound: number;
    cookCandidates: number;
    dupageCandidates: number;
    crossCountyCandidates: number;
    preLiquidityCandidates: number;
    recentlyClosedCandidates: number;
    newThisWeek: number;
    topTenReviewed: number;
    contactsAttempted: number;
    responses: number;
    meetings: number;
    opportunities: number;
    notRelevant: number;
    responseRate: number;
    meetingRate: number;
    notRelevantRate: number;
    residentialOnlyDownranked: number;
    previouslyContactedSuppressed: number;
  };
  disclaimer: string;
};

type ContactRoute = {
  companyPattern: RegExp;
  url: string;
  sourceName: string;
};

const verifiedCompanyRoutes: ContactRoute[] = [
  {
    companyPattern: /\bdover\b/i,
    url: "https://www.dovercorporation.com/contact-us",
    sourceName: "Dover Corporation",
  },
  {
    companyPattern: /\benova\b/i,
    url: "https://www.enova.com/",
    sourceName: "Enova International",
  },
  {
    companyPattern: /\bhyatt\b/i,
    url: "https://newsroom.hyatt.com/contacts",
    sourceName: "Hyatt Hotels Corporation",
  },
  {
    companyPattern: /rush street/i,
    url: "https://www.rushstreetinteractive.com/",
    sourceName: "Rush Street Interactive",
  },
  {
    companyPattern: /illinois tool works|\bitw\b/i,
    url: "https://www.itw.com/contact-us/",
    sourceName: "Illinois Tool Works",
  },
  {
    companyPattern: /cf industries/i,
    url: "https://www.cfindustries.com/contact",
    sourceName: "CF Industries",
  },
  {
    companyPattern: /motorola solutions/i,
    url: "https://www.motorolasolutions.com/investors/contact-us.html",
    sourceName: "Motorola Solutions",
  },
  {
    companyPattern: /tempus ai/i,
    url: "https://www.tempus.com/contact-us/",
    sourceName: "Tempus AI",
  },
  {
    companyPattern: /morningstar/i,
    url: "https://www.morningstar.com/company/contact",
    sourceName: "Morningstar",
  },
  {
    companyPattern: /united airlines/i,
    url: "https://www.united.com/en/us/fly/help/contact-reservations.html",
    sourceName: "United Airlines",
  },
  {
    companyPattern: /allstate/i,
    url: "https://www.allstate.com/help-support/contact",
    sourceName: "Allstate",
  },
  {
    companyPattern: /^aar\b/i,
    url: "https://www.aarcorp.com/contact/",
    sourceName: "AAR Corporation",
  },
];

const entityNamePattern =
  /\b(LLC|L\.L\.C\.|INC|INCORPORATED|CORP|CORPORATION|COMPANY|CO\.|LTD|LIMITED|LP|L\.P\.|LLP|TRUST|FUND|CAPITAL|PARTNERS|HOLDINGS|FOUNDATION|BANK|ASSOCIATION|VILLAGE|CITY|COUNTY|TOWNSHIP|DISTRICT|DEPARTMENT|AUTHORITY|S\.A\.)\b/i;
const excludedRolePattern =
  /registered agent|attorney|property manager|patent assignor/i;
export const TOP_CONTACT_LOOKBACK_DAYS = 14;
const preLiquidityStages = new Set([
  "WATCHING",
  "PRE_SALE",
  "ANNOUNCED",
  "PENDING_REGULATORY",
]);

function normalizedIdentity(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function titleCase(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function daysBetween(from: string, to: string) {
  const start = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Infinity;
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

function isWithinLookback(from: string, to: string, lookbackDays: number) {
  const start = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  const age = Math.floor((end - start) / 86_400_000);
  return age >= 0 && age <= lookbackDays;
}

export function weekStart(value: string | Date) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  const utc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() - (day === 0 ? 6 : day - 1));
  return utc.toISOString().slice(0, 10);
}

function liquidityScore(high: number | null) {
  if (high === null) return 2;
  if (high >= 50_000_000) return 30;
  if (high >= 25_000_000) return 27;
  if (high >= 10_000_000) return 24;
  if (high >= 5_000_000) return 20;
  if (high >= 1_000_000) return 15;
  if (high >= 500_000) return 10;
  return 5;
}

function recencyScore(days: number) {
  if (days <= 30) return 20;
  if (days <= 90) return 16;
  if (days <= 180) return 12;
  if (days <= 365) return 6;
  return 0;
}

function displayEventType(record: MoneyMotionRecord) {
  if (record.eventType === "SECONDARY_SALE") return "public-share sale";
  if (record.eventType === "BUSINESS_SALE") return "business sale";
  if (record.eventType === "BUSINESS_FOR_SALE") return "business-sale signal";
  if (record.eventType === "COMMERCIAL_REAL_ESTATE_SALE")
    return "commercial-property disposition";
  if (record.eventType === "ACQUISITION") return "acquisition";
  if (record.eventType === "MERGER") return "merger";
  return record.eventType.toLowerCase().replaceAll("_", " ");
}

function compactAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function contactForPerson(
  person: PersonLiquiditySummary,
  retrievedAt: string,
): ProfessionalContact[] {
  const route = verifiedCompanyRoutes.find((candidate) =>
    candidate.companyPattern.test(person.company),
  );
  if (route) {
    return [
      {
        id: `company-${normalizedIdentity(person.company)}`,
        personId: person.personId,
        company: person.company,
        type: route.url.includes("contact")
          ? "CONTACT_PAGE"
          : "COMPANY_WEBSITE",
        value: route.url,
        sourceUrl: route.url,
        sourceName: route.sourceName,
        retrievedAt,
        verificationStatus: "COMPANY_ROUTE",
        notes: "Official public company route; not a personal contact method.",
      },
    ];
  }
  const professionalEvidence = person.evidence.find(
    (evidence) =>
      /^https:\/\//i.test(evidence.sourceUrl) &&
      /\/contact|\/team|\/leadership|\/about/i.test(evidence.sourceUrl),
  );
  if (!professionalEvidence) return [];
  return [
    {
      id: `profile-${normalizedIdentity(person.personId)}-${normalizedIdentity(professionalEvidence.sourceUrl)}`,
      personId: person.personId,
      company: person.company,
      type: "PROFESSIONAL_PROFILE",
      value: professionalEvidence.sourceUrl,
      sourceUrl: professionalEvidence.sourceUrl,
      sourceName: professionalEvidence.publisher,
      retrievedAt,
      verificationStatus: "PROFESSIONAL_PROFILE",
      notes: "Public professional source; no direct email or phone inferred.",
    },
  ];
}

function contactability(contacts: ProfessionalContact[]): ContactabilityLevel {
  if (
    contacts.some(
      (contact) =>
        contact.verificationStatus === "VERIFIED_PUBLIC" &&
        ["BUSINESS_EMAIL", "WORK_PHONE"].includes(contact.type),
    )
  )
    return "DIRECT";
  if (
    contacts.some((contact) => contact.verificationStatus === "COMPANY_ROUTE")
  )
    return "COMPANY";
  if (contacts.length) return "PROFILE";
  return "NONE";
}

function countiesForCandidate(
  person: PersonLiquiditySummary,
  propertyRecords: ChicagoPropertyRecord[],
  cityCounties: Map<string, Set<"Cook" | "DuPage">>,
) {
  const exact = new Set<"Cook" | "DuPage">();
  const identity = normalizedIdentity(person.name);
  for (const record of propertyRecords) {
    if (normalizedIdentity(record.sellerPerson) === identity) {
      exact.add(record.property.county);
    }
  }
  if (exact.size) return exact;
  const state = person.location.state.trim().toLowerCase();
  const country = person.location.country.trim().toLowerCase();
  if (
    !["illinois", "il"].includes(state) ||
    (country &&
      !["united states", "united states of america", "us", "usa"].includes(
        country,
      ))
  ) {
    return new Set<"Cook" | "DuPage">();
  }
  return (
    cityCounties.get(person.location.city.trim().toLowerCase()) || new Set()
  );
}

function matchesGeography(
  counties: Set<"Cook" | "DuPage">,
  geography: TopContactGeography,
) {
  if (geography === "COOK") return counties.has("Cook");
  if (geography === "DUPAGE") return counties.has("DuPage");
  return counties.size > 0;
}

function latestStateForPerson(
  states: PersistedRecommendationState[],
  personId: string,
) {
  return states
    .filter((state) => state.personId === personId)
    .sort((left, right) =>
      right.lastUpdatedAt.localeCompare(left.lastUpdatedAt),
    )[0];
}

function isSuppressed(
  state: PersistedRecommendationState | undefined,
  latestEventAt: string,
  generatedAt: string,
) {
  if (!state) return false;
  if (state.workflowStatus === "DO_NOT_CONTACT") return true;
  if (
    !["CONTACTED", "RESPONDED", "MEETING", "OPPORTUNITY_CREATED"].includes(
      state.workflowStatus,
    )
  )
    return false;
  return (
    daysBetween(state.lastUpdatedAt, generatedAt) <= 90 &&
    latestEventAt <= state.lastMaterialEventAt
  );
}

export function buildTopContacts(
  motion: MoneyMotionSnapshot,
  property: ChicagoPropertySnapshot,
  options: {
    geography?: TopContactGeography;
    limit?: number;
    minimumProceeds?: number;
    maximumProceeds?: number;
    minimumPriority?: number;
    workflowStatus?: ContactWorkflowStatus | "";
    includeContacted?: boolean;
    states?: PersistedRecommendationState[];
    manualContacts?: ProfessionalContact[];
  } = {},
): TopContactsSnapshot {
  const geography = options.geography ?? "CHICAGO_METRO";
  const limit = clamp(options.limit ?? 10, 1, 50);
  const states = options.states ?? [];
  const recordsById = new Map(
    motion.records.map((record) => [record.id, record]),
  );
  const recordsByPerson = new Map<string, MoneyMotionRecord[]>();
  for (const record of motion.records) {
    if (!record.person) continue;
    const key = normalizedIdentity(record.person);
    recordsByPerson.set(key, [...(recordsByPerson.get(key) || []), record]);
  }
  const propertyByPerson = new Map<string, ChicagoPropertyRecord[]>();
  const cityCounties = new Map<string, Set<"Cook" | "DuPage">>();
  for (const record of property.records) {
    const city = record.property.city.trim().toLowerCase();
    const counties = cityCounties.get(city) || new Set<"Cook" | "DuPage">();
    counties.add(record.property.county);
    cityCounties.set(city, counties);
    if (!record.sellerPerson) continue;
    const key = normalizedIdentity(record.sellerPerson);
    propertyByPerson.set(key, [...(propertyByPerson.get(key) || []), record]);
  }

  let residentialOnlyDownranked = 0;
  let previouslyContactedSuppressed = 0;
  const candidates: TopContactRecommendation[] = [];
  for (const person of motion.peopleInMotion) {
    const primaryEvent = recordsById.get(person.latestEventId);
    if (!primaryEvent || entityNamePattern.test(person.name)) continue;
    if (excludedRolePattern.test(person.role)) continue;
    const datedAt = primaryEvent.eventDate || primaryEvent.publishedAt;
    if (
      !isWithinLookback(datedAt, motion.generatedAt, TOP_CONTACT_LOOKBACK_DAYS)
    )
      continue;
    const age = daysBetween(datedAt, motion.generatedAt);
    if (person.highestConfidence < 65) continue;
    const counties = countiesForCandidate(
      person,
      property.records,
      cityCounties,
    );
    if (!matchesGeography(counties, geography)) continue;
    const identity = normalizedIdentity(person.name);
    const propertyEvents = propertyByPerson.get(identity) || [];
    const commercialProperties = propertyEvents.filter(
      (record) => record.property.commercial,
    );
    const residentialOnly =
      propertyEvents.length > 0 &&
      propertyEvents.every((record) => record.property.largeResidential);
    const hasDefensibleAmount = person.estimatedLiquidityHigh !== null;
    const directCommercialSeller = commercialProperties.some(
      (record) => record.resolutionConfidence >= 0.75,
    );
    if (!hasDefensibleAmount && !directCommercialSeller) {
      if (residentialOnly) residentialOnlyDownranked += 1;
      continue;
    }
    if (!primaryEvent.ownershipEvidence && !directCommercialSeller) continue;

    const latestState = latestStateForPerson(states, person.personId);
    if (
      !options.includeContacted &&
      isSuppressed(latestState, person.latestSignalAt, motion.generatedAt)
    ) {
      previouslyContactedSuppressed += 1;
      continue;
    }
    const currentState = states.find(
      (state) =>
        state.personId === person.personId &&
        state.weekStart === weekStart(motion.generatedAt) &&
        state.geographyId === geography,
    );
    if (currentState?.recommendationStatus === "SKIPPED") continue;
    const workflowStatus = currentState?.workflowStatus ?? "NOT_REVIEWED";
    if (options.workflowStatus && workflowStatus !== options.workflowStatus)
      continue;
    if (
      options.minimumProceeds &&
      (person.estimatedLiquidityHigh === null ||
        person.estimatedLiquidityHigh < options.minimumProceeds)
    )
      continue;
    if (
      options.maximumProceeds &&
      (person.estimatedLiquidityHigh === null ||
        person.estimatedLiquidityHigh > options.maximumProceeds)
    )
      continue;

    const automaticContacts = contactForPerson(person, motion.generatedAt);
    const manualContacts = (options.manualContacts || []).filter(
      (contact) => contact.personId === person.personId,
    );
    const contacts = [...manualContacts, ...automaticContacts].filter(
      (contact, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.type === contact.type &&
            candidate.value === contact.value,
        ) === index,
    );
    const contactLevel = contactability(contacts);
    const contactPoints =
      contactLevel === "DIRECT"
        ? 10
        : contactLevel === "COMPANY"
          ? 8
          : contactLevel === "PROFILE"
            ? 5
            : 0;
    const highestExit = Math.max(
      0,
      ...propertyEvents.map((record) => record.exitConvergence.score),
    );
    const exitConvergence = clamp(
      Math.round(highestExit * 0.2) +
        (commercialProperties.length > 1 ? 4 : 0) +
        (counties.size > 1 ? 2 : 0),
      0,
      20,
    );
    const roleOwns = /owner|founder|seller/i.test(person.role);
    const ownership = primaryEvent.ownershipEvidence
      ? roleOwns || directCommercialSeller
        ? 10
        : 8
      : directCommercialSeller
        ? 8
        : 0;
    const evidence = clamp(
      Math.round(person.highestConfidence / 12.5) +
        (person.sourceCount > 1 ? 2 : 0),
      0,
      10,
    );
    const isPreLiquidity = preLiquidityStages.has(person.latestStage);
    const boost = clamp(
      (isPreLiquidity ? 2 : 0) +
        (commercialProperties.length > 1 ? 2 : 0) +
        (counties.size > 1 ? 2 : 0) +
        (["BUSINESS_SALE", "ACQUISITION"].includes(primaryEvent.eventType)
          ? 3
          : 0),
      0,
      8,
    );
    const penalties =
      (residentialOnly ? 35 : 0) +
      (person.estimatedLiquidityHigh === null ? 8 : 0) +
      (person.estimatedLiquidityHigh !== null &&
      person.estimatedLiquidityHigh < 500_000
        ? 20
        : person.estimatedLiquidityHigh !== null &&
            person.estimatedLiquidityHigh < 1_000_000
          ? 4
          : 0) +
      (contactLevel === "NONE" ? 5 : 0) +
      (age > 180 ? 4 : 0);
    if (residentialOnly) residentialOnlyDownranked += 1;
    const score: ContactPriorityBreakdown = {
      liquidity: liquidityScore(person.estimatedLiquidityHigh),
      recency: recencyScore(age),
      exitConvergence,
      ownership,
      contactability: contactPoints,
      evidence,
      boosts: boost,
      penalties,
      total: 0,
    };
    score.total = clamp(
      score.liquidity +
        score.recency +
        score.exitConvergence +
        score.ownership +
        score.contactability +
        score.evidence +
        score.boosts -
        score.penalties,
      0,
      100,
    );
    if (score.total < (options.minimumPriority || 0)) continue;

    const allEvents = (recordsByPerson.get(identity) || []).sort(
      (left, right) => right.eventDate.localeCompare(left.eventDate),
    );
    const amountSentence =
      person.estimatedLiquidityLow !== null &&
      person.estimatedLiquidityHigh !== null
        ? `Public transaction evidence supports estimated potential proceeds of ${compactAmount(person.estimatedLiquidityLow)}–${compactAmount(person.estimatedLiquidityHigh)}.`
        : "The transaction value is public, but personal proceeds remain unknown.";
    const propertySentence =
      commercialProperties.length > 1
        ? ` ${commercialProperties.length} commercial-property dispositions add an independent repeat-sale signal.`
        : counties.size > 1
          ? " Activity spans Cook and DuPage Counties."
          : "";
    const whyNow = `${person.role || "Reporting party"} at ${person.company || "the linked business"}. A ${displayEventType(primaryEvent)} was documented ${age} day${age === 1 ? "" : "s"} before the latest data refresh. ${amountSentence}${propertySentence}`;
    candidates.push({
      rank: 0,
      weekStart: weekStart(motion.generatedAt),
      geographyId: geography,
      personId: person.personId,
      name: titleCase(person.name),
      company: person.company,
      role: person.role,
      location: `${titleCase(person.location.city)}, IL`,
      county:
        counties.size > 1
          ? "Cook + DuPage"
          : counties.has("DuPage")
            ? "DuPage"
            : "Cook",
      estimatedProceedsLow: person.estimatedLiquidityLow,
      estimatedProceedsHigh: person.estimatedLiquidityHigh,
      currency: person.currency,
      contactPriorityScore: score.total,
      score,
      whyNow,
      contactability: contactLevel,
      contacts,
      primaryEvent,
      relevantEventIds: allEvents.map((record) => record.id),
      workflowStatus,
      recommendationStatus: currentState?.recommendationStatus ?? "ACTIVE",
      isPreLiquidity,
      isCrossCounty: counties.size > 1,
      residentialOnly,
      latestMaterialEventAt: person.latestSignalAt,
    });
  }

  candidates.sort(
    (left, right) =>
      right.contactPriorityScore - left.contactPriorityScore ||
      (right.estimatedProceedsHigh || 0) - (left.estimatedProceedsHigh || 0) ||
      right.latestMaterialEventAt.localeCompare(left.latestMaterialEventAt) ||
      left.name.localeCompare(right.name),
  );
  const recommendations = candidates
    .slice(0, limit)
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
    }));
  const stats = {
    eligiblePeople: candidates.length,
    visibleRecommendations: recommendations.length,
    estimatedProceedsLow: recommendations.reduce(
      (sum, recommendation) => sum + (recommendation.estimatedProceedsLow || 0),
      0,
    ),
    estimatedProceedsHigh: recommendations.reduce(
      (sum, recommendation) =>
        sum + (recommendation.estimatedProceedsHigh || 0),
      0,
    ),
    directContacts: candidates.filter(
      (candidate) => candidate.contactability === "DIRECT",
    ).length,
    companyRoutes: candidates.filter(
      (candidate) => candidate.contactability === "COMPANY",
    ).length,
    professionalProfiles: candidates.filter(
      (candidate) => candidate.contactability === "PROFILE",
    ).length,
    noContactFound: candidates.filter(
      (candidate) => candidate.contactability === "NONE",
    ).length,
    cookCandidates: candidates.filter((candidate) =>
      candidate.county.includes("Cook"),
    ).length,
    dupageCandidates: candidates.filter((candidate) =>
      candidate.county.includes("DuPage"),
    ).length,
    crossCountyCandidates: candidates.filter(
      (candidate) => candidate.isCrossCounty,
    ).length,
    preLiquidityCandidates: candidates.filter(
      (candidate) => candidate.isPreLiquidity,
    ).length,
    recentlyClosedCandidates: candidates.filter(
      (candidate) =>
        !candidate.isPreLiquidity &&
        daysBetween(candidate.latestMaterialEventAt, motion.generatedAt) <= 90,
    ).length,
    newThisWeek: recommendations.filter(
      (candidate) =>
        candidate.latestMaterialEventAt >= weekStart(motion.generatedAt),
    ).length,
    topTenReviewed: recommendations.filter(
      (candidate) => candidate.workflowStatus !== "NOT_REVIEWED",
    ).length,
    contactsAttempted: recommendations.filter((candidate) =>
      ["CONTACTED", "RESPONDED", "MEETING", "OPPORTUNITY_CREATED"].includes(
        candidate.workflowStatus,
      ),
    ).length,
    responses: recommendations.filter((candidate) =>
      ["RESPONDED", "MEETING", "OPPORTUNITY_CREATED"].includes(
        candidate.workflowStatus,
      ),
    ).length,
    meetings: recommendations.filter((candidate) =>
      ["MEETING", "OPPORTUNITY_CREATED"].includes(candidate.workflowStatus),
    ).length,
    opportunities: recommendations.filter(
      (candidate) => candidate.workflowStatus === "OPPORTUNITY_CREATED",
    ).length,
    notRelevant: recommendations.filter(
      (candidate) => candidate.workflowStatus === "NOT_RELEVANT",
    ).length,
    responseRate: 0,
    meetingRate: 0,
    notRelevantRate: 0,
    residentialOnlyDownranked,
    previouslyContactedSuppressed,
  };
  stats.responseRate = stats.contactsAttempted
    ? Math.round((stats.responses / stats.contactsAttempted) * 1_000) / 10
    : 0;
  stats.meetingRate = stats.contactsAttempted
    ? Math.round((stats.meetings / stats.contactsAttempted) * 1_000) / 10
    : 0;
  stats.notRelevantRate = stats.topTenReviewed
    ? Math.round((stats.notRelevant / stats.topTenReviewed) * 1_000) / 10
    : 0;
  return {
    schemaVersion: 1,
    generatedAt: motion.generatedAt,
    weekStart: weekStart(motion.generatedAt),
    geographyId: geography,
    recommendations,
    stats,
    disclaimer:
      "Estimated potential proceeds are associated with publicly documented transactions. They are not a bank balance or confirmed net cash received. Only public professional contact routes are shown; residential addresses are excluded.",
  };
}
