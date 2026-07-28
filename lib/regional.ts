import { z } from "zod";

export type GeographicRelationshipType =
  | "primary_economic_location"
  | "current_company"
  | "liquidity_event"
  | "investment_activity"
  | "family_office"
  | "former_company"
  | "philanthropic_activity"
  | "board_affiliation"
  | "education"
  | "other";

export type GeographicRelationship = {
  type: GeographicRelationshipType;
  regionSlug: string;
  label: string;
  evidenceId: string;
  occurredAt: string;
};

export type RegionalRecord = {
  slug: string;
  name: string;
  type: "country" | "state" | "metro" | "county" | "subregion";
  hierarchy: string[];
};

export type AffinityPerson = {
  geographicRelationships: GeographicRelationship[];
};

export type SearchableEvent = {
  person: string;
  organization: string;
  regionName: string;
  city: string;
  county: string;
  metro: string;
  state: string;
  industry: string;
  naics: string;
  type: string;
  source: string;
  description: string;
};

export type AffinityComponent = {
  type: GeographicRelationshipType;
  label: string;
  points: number;
  evidenceCount: number;
  reasons: string[];
};

export type AffinityResult = {
  regionSlug: string;
  regionName: string;
  score: number;
  calculatedAt: string;
  evidenceCount: number;
  components: AffinityComponent[];
  mainReasons: string[];
};

export const AFFINITY_WEIGHTS: Record<GeographicRelationshipType, number> = {
  primary_economic_location: 35,
  current_company: 20,
  liquidity_event: 15,
  investment_activity: 15,
  family_office: 10,
  former_company: 8,
  philanthropic_activity: 8,
  board_affiliation: 5,
  education: 4,
  other: 5,
};

export const affinityLabels: Record<GeographicRelationshipType, string> = {
  primary_economic_location: "Primary economic location",
  current_company: "Current company",
  liquidity_event: "Liquidity event",
  investment_activity: "Known investment",
  family_office: "Family office or investment vehicle",
  former_company: "Former company",
  philanthropic_activity: "Philanthropic activity",
  board_affiliation: "Board affiliation",
  education: "Education connection",
  other: "Other documented affinity",
};

export function normalizeSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function matchesTokenizedText(haystack: string, query: string) {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return true;
  const normalizedHaystack = normalizeSearch(haystack);
  return normalizedQuery
    .split(" ")
    .every((token) => normalizedHaystack.includes(token));
}

export function eventMatchesSearch(event: SearchableEvent, query: string) {
  return matchesTokenizedText(
    [
      event.person,
      event.organization,
      event.regionName,
      event.city,
      event.county,
      event.metro,
      event.state,
      event.industry,
      event.naics,
      event.type,
      event.source,
      event.description,
    ].join(" "),
    query,
  );
}

export function regionHierarchyMatches(
  recordRegionSlug: string,
  targetRegionSlug: string,
  regions: RegionalRecord[],
) {
  if (!targetRegionSlug || targetRegionSlug === "national") return true;
  const recordRegion = regions.find(
    (region) => region.slug === recordRegionSlug,
  );
  return (
    recordRegionSlug === targetRegionSlug ||
    Boolean(recordRegion?.hierarchy.includes(targetRegionSlug))
  );
}

function diminishingMultiplier(index: number) {
  return 0.5 ** index;
}

export function calculateAffinity(
  person: AffinityPerson,
  targetRegion: RegionalRecord,
  regions: RegionalRecord[],
): AffinityResult {
  const matches = person.geographicRelationships.filter((relationship) =>
    regionHierarchyMatches(relationship.regionSlug, targetRegion.slug, regions),
  );
  const grouped = new Map<
    GeographicRelationshipType,
    GeographicRelationship[]
  >();
  for (const relationship of matches) {
    const records = grouped.get(relationship.type) ?? [];
    records.push(relationship);
    grouped.set(relationship.type, records);
  }
  const components = [...grouped.entries()]
    .map(([type, relationships]) => {
      const baseWeight = AFFINITY_WEIGHTS[type];
      const points = Math.min(
        baseWeight * 1.75,
        relationships.reduce(
          (total, _relationship, index) =>
            total + baseWeight * diminishingMultiplier(index),
          0,
        ),
      );
      return {
        type,
        label: affinityLabels[type],
        points: Math.round(points),
        evidenceCount: new Set(
          relationships.map((relationship) => relationship.evidenceId),
        ).size,
        reasons: relationships.map((relationship) => relationship.label),
      };
    })
    .sort((a, b) => b.points - a.points);
  const score = Math.min(
    100,
    Math.round(
      components.reduce((total, component) => total + component.points, 0),
    ),
  );
  return {
    regionSlug: targetRegion.slug,
    regionName: targetRegion.name,
    score,
    calculatedAt: "2026-07-27",
    evidenceCount: components.reduce(
      (total, component) => total + component.evidenceCount,
      0,
    ),
    components,
    mainReasons: components
      .flatMap((component) => component.reasons)
      .slice(0, 3),
  };
}

export function selectActiveRegion({
  urlRegion,
  recentRegion,
  homeRegion,
}: {
  urlRegion?: string | null;
  recentRegion?: string | null;
  homeRegion?: string | null;
}) {
  return urlRegion || recentRegion || homeRegion || "national";
}

export function markerSize(
  value: number,
  values: number[],
  minimum = 18,
  maximum = 48,
) {
  const valid = values.filter((item) => Number.isFinite(item) && item >= 0);
  if (!valid.length) return minimum;
  const low = Math.sqrt(Math.min(...valid));
  const high = Math.sqrt(Math.max(...valid));
  if (high === low) return Math.round((minimum + maximum) / 2);
  const ratio = Math.max(
    0,
    Math.min(1, (Math.sqrt(Math.max(0, value)) - low) / (high - low)),
  );
  return Math.round(minimum + ratio * (maximum - minimum));
}

export type MapUrlState = {
  metric: "created" | "controlled" | "deployed" | "momentum";
  period: "30d" | "90d" | "12m" | "3y";
  region: string;
  zoom: number;
  center: [number, number];
  industry: string;
};

export function parseMapState(params: URLSearchParams): MapUrlState {
  const metricValues = ["created", "controlled", "deployed", "momentum"];
  const periodValues = ["30d", "90d", "12m", "3y"];
  const metric = params.get("metric") || "controlled";
  const period = params.get("period") || "90d";
  const center = (params.get("center") || "-96.5,38.4").split(",").map(Number);
  return {
    metric: metricValues.includes(metric)
      ? (metric as MapUrlState["metric"])
      : "controlled",
    period: periodValues.includes(period)
      ? (period as MapUrlState["period"])
      : "90d",
    region: params.get("region") || "",
    zoom: Math.min(10, Math.max(2.5, Number(params.get("zoom") || 3.2))),
    center:
      center.length === 2 && center.every(Number.isFinite)
        ? [center[0], center[1]]
        : [-96.5, 38.4],
    industry: params.get("industry") || "",
  };
}

export function serializeMapState(state: MapUrlState) {
  const params = new URLSearchParams();
  params.set("metric", state.metric);
  params.set("period", state.period);
  if (state.region) params.set("region", state.region);
  params.set("zoom", state.zoom.toFixed(2));
  params.set(
    "center",
    `${state.center[0].toFixed(3)},${state.center[1].toFixed(3)}`,
  );
  if (state.industry) params.set("industry", state.industry);
  return params;
}

const optionalText = z.string().trim().max(120).optional().default("");
const optionalNumber = (minimum = 0, maximum = Number.MAX_SAFE_INTEGER) =>
  z.preprocess(
    (value) => (value === "" || value == null ? undefined : Number(value)),
    z.number().finite().min(minimum).max(maximum).optional(),
  );

export const eventQuerySchema = z.object({
  q: optionalText,
  region: optionalText,
  state: optionalText,
  metro: optionalText,
  county: optionalText,
  city: optionalText,
  industry: optionalText,
  naics: optionalText,
  eventType: optionalText,
  status: optionalText,
  dateFrom: optionalText,
  dateTo: optionalText,
  minAmount: optionalNumber(),
  maxAmount: optionalNumber(),
  minConfidence: optionalNumber(0, 100),
  personRole: optionalText,
  organizationClass: optionalText,
  completion: optionalText,
  category: optionalText,
  sort: optionalText,
  cursor: optionalText,
  limit: optionalNumber(1, 100),
});

export const peopleQuerySchema = z.object({
  q: optionalText,
  region: optionalText,
  relationshipType: optionalText,
  industry: optionalText,
  minLiquidity: optionalNumber(),
  minConfidence: optionalNumber(0, 100),
  affinityRegion: optionalText,
  minAffinity: optionalNumber(0, 100),
  sort: optionalText,
  cursor: optionalText,
  limit: optionalNumber(1, 100),
});

export function queryObject(params: URLSearchParams) {
  return Object.fromEntries(params.entries());
}
