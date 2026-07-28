import {
  events,
  organizationProfiles,
  people,
  regions,
  type LiquidityEvent,
  type Person,
} from "../app/data";
import {
  calculateAffinity,
  eventMatchesSearch,
  matchesTokenizedText,
  regionHierarchyMatches,
  type GeographicRelationshipType,
} from "./regional";

export type EventFilters = {
  q?: string;
  region?: string;
  state?: string;
  metro?: string;
  county?: string;
  city?: string;
  industry?: string;
  naics?: string;
  eventType?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  minConfidence?: number;
  personRole?: string;
  organizationClass?: string;
  completion?: string;
  category?: string;
  sort?: string;
};

export type PeopleFilters = {
  q?: string;
  region?: string;
  relationshipType?: string;
  industry?: string;
  minLiquidity?: number;
  minConfidence?: number;
  affinityRegion?: string;
  minAffinity?: number;
  sort?: string;
};

export function getRegion(slug: string) {
  return regions.find((region) => region.slug === slug);
}

export function filterLiquidityEvents(filters: EventFilters) {
  const minimumConfidence = filters.minConfidence ?? 0;
  const output = events
    .filter((event) => eventMatchesSearch(event, filters.q || ""))
    .filter(
      (event) =>
        !filters.region ||
        regionHierarchyMatches(event.regionSlug, filters.region, regions),
    )
    .filter(
      (event) =>
        !filters.state || matchesTokenizedText(event.state, filters.state),
    )
    .filter(
      (event) =>
        !filters.metro || matchesTokenizedText(event.metro, filters.metro),
    )
    .filter(
      (event) =>
        !filters.county || matchesTokenizedText(event.county, filters.county),
    )
    .filter(
      (event) =>
        !filters.city || matchesTokenizedText(event.city, filters.city),
    )
    .filter((event) => !filters.industry || event.industry === filters.industry)
    .filter((event) => !filters.naics || event.naics.startsWith(filters.naics))
    .filter((event) => !filters.eventType || event.type === filters.eventType)
    .filter((event) => !filters.status || event.status === filters.status)
    .filter((event) => !filters.dateFrom || event.date >= filters.dateFrom)
    .filter((event) => !filters.dateTo || event.date <= filters.dateTo)
    .filter(
      (event) =>
        filters.minAmount == null || event.net.median >= filters.minAmount,
    )
    .filter(
      (event) =>
        filters.maxAmount == null || event.net.median <= filters.maxAmount,
    )
    .filter((event) => event.confidence >= minimumConfidence)
    .filter(
      (event) => !filters.personRole || event.personRole === filters.personRole,
    )
    .filter(
      (event) =>
        !filters.organizationClass ||
        event.organizationClass === filters.organizationClass,
    )
    .filter((event) => {
      if (!filters.completion) return true;
      return filters.completion === "completed"
        ? event.status === "Completed"
        : event.status !== "Completed";
    })
    .filter(
      (event) => !filters.category || event.category === filters.category,
    );

  return output.sort((a, b) => {
    if (filters.sort === "largest") return b.net.median - a.net.median;
    if (filters.sort === "confidence") return b.confidence - a.confidence;
    if (filters.sort === "oldest") return a.date.localeCompare(b.date);
    return b.date.localeCompare(a.date);
  });
}

export function peopleConnectedToRegion(regionSlug: string) {
  return people.filter(
    (person) =>
      person.status !== "Pending review" &&
      person.geographicRelationships.some((relationship) =>
        regionHierarchyMatches(relationship.regionSlug, regionSlug, regions),
      ),
  );
}

export function relationshipToRegion(person: Person, regionSlug: string) {
  return person.geographicRelationships.find((relationship) =>
    regionHierarchyMatches(relationship.regionSlug, regionSlug, regions),
  );
}

export function filterRegionalPeople(filters: PeopleFilters) {
  const affinityRegion = getRegion(
    filters.affinityRegion || filters.region || "maryland",
  );
  const base = filters.region
    ? peopleConnectedToRegion(filters.region)
    : people;
  return base
    .filter((person) => person.status !== "Pending review")
    .filter((person) =>
      matchesTokenizedText(
        `${person.name} ${person.organization} ${person.location} ${person.industry}`,
        filters.q || "",
      ),
    )
    .filter(
      (person) => !filters.industry || person.industry === filters.industry,
    )
    .filter(
      (person) =>
        person.remaining.median >= (filters.minLiquidity ?? 0) &&
        person.confidence >= (filters.minConfidence ?? 0),
    )
    .filter((person) => {
      if (!filters.relationshipType || !filters.region) return true;
      return person.geographicRelationships.some(
        (relationship) =>
          relationship.type ===
            (filters.relationshipType as GeographicRelationshipType) &&
          regionHierarchyMatches(
            relationship.regionSlug,
            filters.region!,
            regions,
          ),
      );
    })
    .map((person) => ({
      person,
      affinity: affinityRegion
        ? calculateAffinity(person, affinityRegion, regions)
        : null,
    }))
    .filter(
      (record) =>
        !filters.minAffinity ||
        (record.affinity?.score ?? 0) >= filters.minAffinity,
    )
    .sort((a, b) => {
      if (filters.sort === "confidence")
        return b.person.confidence - a.person.confidence;
      if (filters.sort === "affinity")
        return (b.affinity?.score ?? 0) - (a.affinity?.score ?? 0);
      if (filters.sort === "recent")
        return b.person.eventDate.localeCompare(a.person.eventDate);
      if (filters.sort === "radar") return b.person.radar - a.person.radar;
      return b.person.remaining.median - a.person.remaining.median;
    });
}

export function organizationsConnectedToRegion(regionSlug: string) {
  const eventOrganizationSlugs = new Set(
    filterLiquidityEvents({ region: regionSlug }).map(
      (event) => event.organizationSlug,
    ),
  );
  return organizationProfiles.filter(
    (organization) =>
      organization.regionSlugs.some((slug) =>
        regionHierarchyMatches(slug, regionSlug, regions),
      ) || eventOrganizationSlugs.has(organization.slug),
  );
}

export function publicEvent(event: LiquidityEvent) {
  return {
    id: event.id,
    person: {
      id: event.personId,
      slug: event.personSlug,
      display_name: event.person,
      role: event.personRole,
    },
    organization: {
      slug: event.organizationSlug,
      display_name: event.organization,
      classification: event.organizationClass,
    },
    event_type: event.type,
    event_category: event.category,
    event_date: event.date,
    status: event.status.toLowerCase(),
    location: {
      region_slug: event.regionSlug,
      region_name: event.regionName,
      city: event.city,
      county: event.county,
      metro: event.metro,
      state: event.state,
    },
    industry: event.industry,
    naics: event.naics,
    gross_amount: { ...event.gross, currency: "USD" },
    estimated_net_amount: { ...event.net, currency: "USD" },
    confidence: event.confidence,
    classification: event.classification,
    primary_source: event.source,
    description: event.description,
  };
}
