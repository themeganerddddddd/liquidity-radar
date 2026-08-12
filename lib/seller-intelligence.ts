import type {
  ChicagoPropertyEvidence,
  ChicagoPropertyRecord,
  ChicagoPropertySnapshot,
  ExitConvergenceComponent,
  PropertyCategory,
} from "./chicago-property";
import { normalizeEntityName, stableId } from "./money-in-motion";

export const SELLER_RELATIONSHIP_TYPES = [
  "CONFIRMED_OWNER",
  "REPORTED_OWNER",
  "MANAGER",
  "PRESIDENT",
  "EXECUTIVE",
  "REGISTERED_AGENT",
  "ATTORNEY",
  "UNKNOWN",
] as const;

export type SellerRelationshipType = (typeof SELLER_RELATIONSHIP_TYPES)[number];

export type SellerRelationship = {
  name: string;
  type: SellerRelationshipType;
  supportsOwnership: boolean;
  source: string;
};

export type SellerEntityRelationship = {
  name: string;
  type:
    | "OPERATING_ENTITY"
    | "PROPERTY_HOLDING_ENTITY"
    | "PARENT"
    | "SUBSIDIARY"
    | "AFFILIATE"
    | "COMMON_OWNER"
    | "COMMON_MANAGER"
    | "COMMON_ADDRESS"
    | "DBA"
    | "SAME_BUSINESS"
    | "UNKNOWN_ASSOCIATION";
  source: string;
};

export type SellerManualRecord = {
  id: string;
  sellerKey: string;
  entityLegalName: string;
  illinoisFileNumber: string;
  entityType: string;
  entityStatus: string;
  formationDate: string;
  president: string;
  secretary: string;
  managers: string[];
  registeredAgent: string;
  sourceUrl: string;
  lookupDate: string;
  checkedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type SellerIntelligenceProfile = {
  id: string;
  sellerKey: string;
  seller: string;
  normalizedName: string;
  location: { city: string; state: string; display: string };
  counties: string[];
  entityType: string;
  status:
    | "Unresolved"
    | "Owner Found"
    | "Business Exit Candidate"
    | "Strong Exit Signals";
  priorityScore: number;
  dispositionCount: number;
  totalRecordedConsideration: number;
  largestDisposition: number;
  mostRecentDisposition: string;
  oldestDisposition: string;
  dispositionWindowDays: number;
  propertyTypes: PropertyCategory[];
  commercialDisposition: boolean;
  ownerFound: boolean;
  multipleDispositions: boolean;
  businessExitCandidate: boolean;
  relatedPeople: SellerRelationship[];
  relatedEntities: SellerEntityRelationship[];
  exitConvergence: {
    score: number;
    label: string;
    components: ExitConvergenceComponent[];
  };
  evidence: ChicagoPropertyEvidence[];
  dispositions: ChicagoPropertyRecord[];
  latestUpdate: string;
  freshness: string;
  manualRecords: SellerManualRecord[];
  needsManualReview: boolean;
};

export type SellerIntelligenceSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  disclaimer: string;
  stats: {
    totalSellerEntities: number;
    unresolvedSellers: number;
    resolvedSellerEntities: number;
    confirmedOrReportedOwners: number;
    managersOrOfficers: number;
    unresolved5m: number;
    unresolved10m: number;
    unresolved25m: number;
    unresolved50m: number;
    unresolved100m: number;
    multipleDispositionSellers: number;
    businessExitCandidates: number;
    possibleExitActivity: number;
    strongExitSignals: number;
    highExitConvergence: number;
    recordedDispositions: number;
  };
  profiles: SellerIntelligenceProfile[];
};

export type SellerProfileSort =
  "priority" | "seller" | "value" | "location" | "status" | "date";

export type ChicagoPropertySort = "seller" | "value" | "location" | "date";

function daysBetween(left: string, right: string) {
  if (!left || !right) return 0;
  return Math.max(
    0,
    Math.round(Math.abs(Date.parse(left) - Date.parse(right)) / 86_400_000),
  );
}

function uniqueBy<T>(values: T[], key: (value: T) => string) {
  return [...new Map(values.map((value) => [key(value), value])).values()];
}

function sellerName(record: ChicagoPropertyRecord) {
  return record.sellerEntity || record.sellerOriginal || record.sellerPerson;
}

export function sellerKey(record: ChicagoPropertyRecord) {
  return normalizeEntityName(sellerName(record));
}

export function chicagoProfileKey(record: ChicagoPropertyRecord) {
  return record.sellerEntity
    ? `entity:${sellerKey(record)}`
    : record.sellerPerson
      ? `person:${normalizeEntityName(record.sellerPerson)}`
      : `entity:${sellerKey(record)}`;
}

export function chicagoProfileRecords(
  records: ChicagoPropertyRecord[],
  selected: ChicagoPropertyRecord,
) {
  const key = chicagoProfileKey(selected);
  return records
    .filter((record) => chicagoProfileKey(record) === key)
    .sort((left, right) =>
      right.transaction.saleDate.localeCompare(left.transaction.saleDate),
    );
}

function relationshipFromOwnerRole(role: string): SellerRelationshipType {
  if (role === "OWNER") return "REPORTED_OWNER";
  if (role === "MANAGER") return "MANAGER";
  if (role === "OFFICER") return "EXECUTIVE";
  return "UNKNOWN";
}

export function relationshipSupportsOwnership(type: SellerRelationshipType) {
  return type === "CONFIRMED_OWNER" || type === "REPORTED_OWNER";
}

export function manualRecordRelationships(record: SellerManualRecord) {
  return [
    ...(record.president
      ? [
          {
            name: record.president,
            type: "PRESIDENT" as const,
            supportsOwnership: false,
            source: "Illinois Secretary of State manual record",
          },
        ]
      : []),
    ...(record.secretary
      ? [
          {
            name: record.secretary,
            type: "EXECUTIVE" as const,
            supportsOwnership: false,
            source: "Illinois Secretary of State manual record",
          },
        ]
      : []),
    ...record.managers.map((name) => ({
      name,
      type: "MANAGER" as const,
      supportsOwnership: false,
      source: "Illinois Secretary of State manual record",
    })),
    ...(record.registeredAgent
      ? [
          {
            name: record.registeredAgent,
            type: "REGISTERED_AGENT" as const,
            supportsOwnership: false,
            source: "Illinois Secretary of State manual record",
          },
        ]
      : []),
  ];
}

export function manualRecordNeedsRefresh(
  record: SellerManualRecord,
  totalRecordedConsideration: number,
  asOf: string,
) {
  const refreshDays =
    totalRecordedConsideration >= 25_000_000
      ? 30
      : totalRecordedConsideration >= 10_000_000
        ? 60
        : 90;
  return daysBetween(record.lookupDate, asOf) > refreshDays;
}

function inferEntityType(name: string) {
  if (/\bL\.?L\.?C\.?\b/i.test(name)) return "Limited liability company";
  if (/\bL\.?P\.?\b/i.test(name)) return "Limited partnership";
  if (/\b(inc|incorporated|corp|corporation)\.?\b/i.test(name))
    return "Corporation";
  if (/\btrust\b/i.test(name)) return "Trust";
  return "Entity type not established";
}

function exitLabel(score: number) {
  if (score >= 75) return "High Exit Convergence";
  if (score >= 50) return "Strong Exit Signals";
  if (score >= 25) return "Possible Exit Activity";
  return "Asset Sale Only";
}

function sellerExitConvergence(
  records: ChicagoPropertyRecord[],
  ownerFound: boolean,
) {
  const components = uniqueBy(
    records.flatMap((record) => record.exitConvergence.components),
    (component) => component.id,
  ).filter(
    (component) =>
      ![
        "commercial_disposition",
        "large_residential",
        "business_owner_resolution",
      ].includes(component.id),
  );
  if (records.some((record) => record.property.commercial)) {
    components.push({
      id: "commercial_disposition",
      label: "Commercial property disposition",
      points: 20,
      sourceRecordId: records[0].id,
    });
  } else if (records.some((record) => record.property.largeResidential)) {
    components.push({
      id: "large_residential",
      label: "Large residential property disposition",
      points: 5,
      sourceRecordId: records[0].id,
    });
  }
  if (ownerFound) {
    components.push({
      id: "seller_owner_resolution",
      label: "Confirmed or reported owner found",
      points: 20,
      sourceRecordId: records[0].businessMatch?.accountNumber || records[0].id,
    });
  }
  if (records.length > 1) {
    components.push({
      id: "multiple_asset_disposition",
      label: "Multiple asset dispositions",
      points: 15,
      sourceRecordId: records.map((record) => record.id).join(","),
    });
  }
  const deduped = uniqueBy(components, (component) => component.id);
  const score = Math.min(
    100,
    deduped.reduce((sum, component) => sum + component.points, 0),
  );
  return { score, label: exitLabel(score), components: deduped };
}

function priorityScore(input: {
  value: number;
  transactionCount: number;
  latestDate: string;
  generatedAt: string;
  commercial: boolean;
  ownerFound: boolean;
  businessEvidence: boolean;
  licenseChange: boolean;
}) {
  const valuePoints =
    input.value >= 100_000_000
      ? 40
      : input.value >= 50_000_000
        ? 35
        : input.value >= 25_000_000
          ? 30
          : input.value >= 10_000_000
            ? 25
            : input.value >= 5_000_000
              ? 20
              : 10;
  const age = daysBetween(input.latestDate, input.generatedAt);
  const recencyPoints = age <= 30 ? 15 : age <= 90 ? 12 : age <= 365 ? 8 : 2;
  return Math.min(
    100,
    valuePoints +
      Math.min(15, Math.max(0, input.transactionCount - 1) * 8) +
      recencyPoints +
      (input.commercial ? 10 : 0) +
      (input.ownerFound ? 10 : 0) +
      (input.businessEvidence ? 7 : 0) +
      (input.licenseChange ? 3 : 0),
  );
}

function profileFreshness(
  generatedAt: string,
  latestUpdate: string,
  needsManualReview: boolean,
) {
  if (needsManualReview) return "Needs manual review";
  const days = daysBetween(latestUpdate, generatedAt);
  if (days === 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  return `Updated ${days} days ago`;
}

function buildProfile(
  records: ChicagoPropertyRecord[],
  generatedAt: string,
  manualRecords: SellerManualRecord[],
): SellerIntelligenceProfile {
  const dispositions = uniqueBy(
    records,
    (record) => record.transactionKey,
  ).sort((left, right) =>
    right.transaction.saleDate.localeCompare(left.transaction.saleDate),
  );
  const seller = sellerName(dispositions[0]);
  const normalizedName = normalizeEntityName(seller);
  const values = dispositions.map(
    (record) =>
      record.proceeds.recordedSaleConsideration ||
      record.transaction.displayValueHigh ||
      0,
  );
  const totalRecordedConsideration = values.reduce(
    (sum, value) => sum + value,
    0,
  );
  const relatedPeople: SellerRelationship[] = [];
  for (const record of dispositions) {
    if (record.sellerPerson) {
      const type = record.sellerEntity ? "REPORTED_OWNER" : "CONFIRMED_OWNER";
      relatedPeople.push({
        name: record.sellerPerson,
        type,
        supportsOwnership: true,
        source: record.sellerEntity
          ? "Chicago Business Owners"
          : "Recorded seller title",
      });
    }
    for (const owner of record.businessMatch?.owners || []) {
      if (owner.role === "LEGAL_ENTITY_OWNER") continue;
      const type = relationshipFromOwnerRole(owner.role);
      relatedPeople.push({
        name: owner.name,
        type,
        supportsOwnership: relationshipSupportsOwnership(type),
        source: owner.sourceTitle,
      });
    }
  }
  relatedPeople.push(...manualRecords.flatMap(manualRecordRelationships));
  const people = uniqueBy(
    relatedPeople,
    (relationship) =>
      `${normalizeEntityName(relationship.name)}:${relationship.type}`,
  );
  const ownerFound = people.some((person) => person.supportsOwnership);
  const relatedEntities = uniqueBy(
    [
      {
        name: seller,
        type: "PROPERTY_HOLDING_ENTITY" as const,
        source: "Chicago Metro / Illinois property transfer record",
      },
      ...dispositions.flatMap((record) => {
        const business = record.businessMatch;
        if (!business) return [];
        return [
          ...(normalizeEntityName(business.legalName) !== normalizedName
            ? [
                {
                  name: business.legalName,
                  type: "SAME_BUSINESS" as const,
                  source: "Chicago Business Licenses",
                },
              ]
            : []),
          ...(business.dba
            ? [
                {
                  name: business.dba,
                  type: "DBA" as const,
                  source: "Chicago Business Licenses",
                },
              ]
            : []),
        ];
      }),
    ],
    (relationship) =>
      `${normalizeEntityName(relationship.name)}:${relationship.type}`,
  );
  const exitConvergence = sellerExitConvergence(dispositions, ownerFound);
  const commercialDisposition = dispositions.some(
    (record) => record.property.commercial,
  );
  const multipleDispositions = dispositions.length > 1;
  const independentBusinessSignal = dispositions.some(
    (record) =>
      record.exitConvergence.hasBusinessExitEvidence ||
      record.exitConvergence.hasLicenseCancellation,
  );
  const businessExitCandidate =
    commercialDisposition &&
    (ownerFound || independentBusinessSignal || multipleDispositions);
  const cityCounts = new Map<string, number>();
  for (const record of dispositions) {
    if (record.property.city)
      cityCounts.set(
        record.property.city,
        (cityCounts.get(record.property.city) || 0) + 1,
      );
  }
  const city =
    [...cityCounts.entries()].sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )[0]?.[0] || "Chicago Metro";
  const counties = [
    ...new Set(dispositions.map((record) => record.property.county)),
  ].sort();
  const needsManualReview =
    !ownerFound &&
    totalRecordedConsideration >= 10_000_000 &&
    (!manualRecords.length ||
      manualRecords.some((record) =>
        manualRecordNeedsRefresh(
          record,
          totalRecordedConsideration,
          generatedAt,
        ),
      ));
  const status =
    exitConvergence.score >= 50
      ? "Strong Exit Signals"
      : businessExitCandidate
        ? "Business Exit Candidate"
        : ownerFound
          ? "Owner Found"
          : "Unresolved";
  const evidence = uniqueBy(
    dispositions.flatMap((record) => record.evidence),
    (item) => item.id,
  );
  const latestUpdate = [
    generatedAt,
    ...evidence.map((item) => item.retrievedAt),
    ...manualRecords.map((record) => record.updatedAt),
  ]
    .filter(Boolean)
    .sort()
    .at(-1)!;
  return {
    id: stableId("seller-intelligence", normalizedName),
    sellerKey: normalizedName,
    seller,
    normalizedName,
    location: { city, state: "Illinois", display: `${city}, Illinois` },
    counties,
    entityType: inferEntityType(seller),
    status,
    priorityScore: priorityScore({
      value: totalRecordedConsideration,
      transactionCount: dispositions.length,
      latestDate: dispositions[0].transaction.saleDate,
      generatedAt,
      commercial: commercialDisposition,
      ownerFound,
      businessEvidence: independentBusinessSignal,
      licenseChange: dispositions.some(
        (record) => record.exitConvergence.hasLicenseCancellation,
      ),
    }),
    dispositionCount: dispositions.length,
    totalRecordedConsideration,
    largestDisposition: Math.max(...values),
    mostRecentDisposition: dispositions[0].transaction.saleDate,
    oldestDisposition: dispositions.at(-1)!.transaction.saleDate,
    dispositionWindowDays: daysBetween(
      dispositions[0].transaction.saleDate,
      dispositions.at(-1)!.transaction.saleDate,
    ),
    propertyTypes: [
      ...new Set(dispositions.map((record) => record.property.category)),
    ],
    commercialDisposition,
    ownerFound,
    multipleDispositions,
    businessExitCandidate,
    relatedPeople: people,
    relatedEntities,
    exitConvergence,
    evidence,
    dispositions,
    latestUpdate,
    freshness: profileFreshness(generatedAt, latestUpdate, needsManualReview),
    manualRecords,
    needsManualReview,
  };
}

export function buildSellerIntelligence(
  snapshot: ChicagoPropertySnapshot,
  manualRecords: SellerManualRecord[] = [],
): SellerIntelligenceSnapshot {
  const grouped = new Map<string, ChicagoPropertyRecord[]>();
  for (const record of snapshot.records) {
    const key = sellerKey(record);
    if (!key) continue;
    const group = grouped.get(key) || [];
    group.push(record);
    grouped.set(key, group);
  }
  const manualBySeller = new Map<string, SellerManualRecord[]>();
  for (const record of manualRecords) {
    const group = manualBySeller.get(record.sellerKey) || [];
    group.push(record);
    manualBySeller.set(record.sellerKey, group);
  }
  const profiles = [...grouped.entries()]
    .map(([key, records]) =>
      buildProfile(
        records,
        snapshot.generatedAt,
        manualBySeller.get(key) || [],
      ),
    )
    .sort(
      (left, right) =>
        right.priorityScore - left.priorityScore ||
        right.totalRecordedConsideration - left.totalRecordedConsideration ||
        right.mostRecentDisposition.localeCompare(left.mostRecentDisposition),
    );
  const unresolved = profiles.filter((profile) => !profile.ownerFound);
  return {
    schemaVersion: 1,
    generatedAt: snapshot.generatedAt,
    disclaimer:
      "Recorded property consideration is not net cash received. Ownership percentages, debt, liens, taxes, transaction costs, exchanges, and reinvestment may be unknown.",
    stats: {
      totalSellerEntities: profiles.length,
      unresolvedSellers: unresolved.length,
      resolvedSellerEntities: profiles.length - unresolved.length,
      confirmedOrReportedOwners: profiles.reduce(
        (sum, profile) =>
          sum +
          profile.relatedPeople.filter((person) => person.supportsOwnership)
            .length,
        0,
      ),
      managersOrOfficers: profiles.reduce(
        (sum, profile) =>
          sum +
          profile.relatedPeople.filter((person) =>
            ["MANAGER", "PRESIDENT", "EXECUTIVE"].includes(person.type),
          ).length,
        0,
      ),
      unresolved5m: unresolved.filter(
        (profile) => profile.totalRecordedConsideration >= 5_000_000,
      ).length,
      unresolved10m: unresolved.filter(
        (profile) => profile.totalRecordedConsideration >= 10_000_000,
      ).length,
      unresolved25m: unresolved.filter(
        (profile) => profile.totalRecordedConsideration >= 25_000_000,
      ).length,
      unresolved50m: unresolved.filter(
        (profile) => profile.totalRecordedConsideration >= 50_000_000,
      ).length,
      unresolved100m: unresolved.filter(
        (profile) => profile.totalRecordedConsideration >= 100_000_000,
      ).length,
      multipleDispositionSellers: profiles.filter(
        (profile) => profile.multipleDispositions,
      ).length,
      businessExitCandidates: profiles.filter(
        (profile) => profile.businessExitCandidate,
      ).length,
      possibleExitActivity: profiles.filter(
        (profile) =>
          profile.exitConvergence.score >= 25 &&
          profile.exitConvergence.score < 50,
      ).length,
      strongExitSignals: profiles.filter(
        (profile) =>
          profile.exitConvergence.score >= 50 &&
          profile.exitConvergence.score < 75,
      ).length,
      highExitConvergence: profiles.filter(
        (profile) => profile.exitConvergence.score >= 75,
      ).length,
      recordedDispositions: profiles.reduce(
        (sum, profile) => sum + profile.totalRecordedConsideration,
        0,
      ),
    },
    profiles,
  };
}

export function sortSellerProfiles(
  profiles: SellerIntelligenceProfile[],
  key: SellerProfileSort,
  direction: "asc" | "desc",
) {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...profiles].sort((left, right) => {
    const comparison =
      key === "priority"
        ? left.priorityScore - right.priorityScore
        : key === "value"
          ? left.totalRecordedConsideration - right.totalRecordedConsideration
          : key === "date"
            ? left.mostRecentDisposition.localeCompare(
                right.mostRecentDisposition,
              )
            : key === "location"
              ? left.location.display.localeCompare(right.location.display)
              : key === "status"
                ? left.status.localeCompare(right.status)
                : left.seller.localeCompare(right.seller);
    return comparison * multiplier || left.seller.localeCompare(right.seller);
  });
}

export function sortChicagoPropertyRecords(
  records: ChicagoPropertyRecord[],
  key: ChicagoPropertySort,
  direction: "asc" | "desc",
) {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...records].sort((left, right) => {
    const comparison =
      key === "value"
        ? (left.transaction.displayValueHigh || 0) -
          (right.transaction.displayValueHigh || 0)
        : key === "date"
          ? left.transaction.saleDate.localeCompare(right.transaction.saleDate)
          : key === "location"
            ? `${left.property.city} ${left.property.address}`.localeCompare(
                `${right.property.city} ${right.property.address}`,
              )
            : sellerName(left).localeCompare(sellerName(right));
    return (
      comparison * multiplier ||
      right.transaction.saleDate.localeCompare(left.transaction.saleDate)
    );
  });
}

export function detectSameAddressBusinessChange(input: {
  propertyAddress: string;
  saleDate: string;
  licenses: Array<{
    address: string;
    status: string;
    statusChangeDate: string;
    legalName: string;
  }>;
}) {
  const address = normalizeEntityName(input.propertyAddress);
  const matches = input.licenses.filter(
    (license) =>
      normalizeEntityName(license.address) === address &&
      daysBetween(license.statusChangeDate, input.saleDate) <= 180,
  );
  const closed = matches.some((license) =>
    /AAC|CANCEL|REV|REVOK|CLOSED/i.test(license.status),
  );
  const active = matches.some((license) =>
    /AAI|ISSUED|ACTIVE/i.test(license.status),
  );
  return {
    matchedLicenses: matches,
    possibleOperatingBusinessChange: closed && active,
    classification:
      closed && active ? "POSSIBLE_OPERATING_BUSINESS_CHANGE" : "NONE",
  } as const;
}
