"use client";

import { useEffect, useMemo, useState } from "react";
import {
  events,
  people,
  regions,
  type LiquidityEvent,
  type Person,
  type Region,
} from "./data";
import {
  filterLiquidityEvents,
  filterRegionalPeople,
  getRegion,
  organizationsConnectedToRegion,
  relationshipToRegion,
  type EventFilters,
} from "../lib/data-query";
import {
  affinityLabels,
  type GeographicRelationshipType,
} from "../lib/regional";
import { dateLabel, money, rangeMoney } from "../lib/format";

type EventFilterState = {
  q: string;
  region: string;
  state: string;
  metro: string;
  county: string;
  city: string;
  industry: string;
  naics: string;
  eventType: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
  minConfidence: string;
  personRole: string;
  organizationClass: string;
  completion: string;
  category: string;
  sort: string;
  page: string;
};

const emptyEventFilters: EventFilterState = {
  q: "",
  region: "",
  state: "",
  metro: "",
  county: "",
  city: "",
  industry: "",
  naics: "",
  eventType: "",
  status: "",
  dateFrom: "",
  dateTo: "",
  minAmount: "",
  maxAmount: "",
  minConfidence: "65",
  personRole: "",
  organizationClass: "",
  completion: "",
  category: "",
  sort: "newest",
  page: "1",
};

function eventFiltersFromQuery(queryString: string): EventFilterState {
  const params = new URLSearchParams(queryString);
  return Object.fromEntries(
    Object.entries(emptyEventFilters).map(([key, fallback]) => [
      key,
      params.get(key) ?? fallback,
    ]),
  ) as EventFilterState;
}

function eventFilterInput(filters: EventFilterState): EventFilters {
  return {
    ...filters,
    minAmount: filters.minAmount ? Number(filters.minAmount) : undefined,
    maxAmount: filters.maxAmount ? Number(filters.maxAmount) : undefined,
    minConfidence: filters.minConfidence
      ? Number(filters.minConfidence)
      : undefined,
  };
}

function EventCard({
  event,
  onPerson,
  onRegion,
  onOrganization,
  onEvidence,
}: {
  event: LiquidityEvent;
  onPerson: (person: Person) => void;
  onRegion: (slug: string) => void;
  onOrganization: (slug: string) => void;
  onEvidence: (event: LiquidityEvent) => void;
}) {
  const person = people.find((record) => record.id === event.personId)!;
  return (
    <article className="feed-card regional-event-card">
      <div className="feed-status">
        <span className={`event-icon ${event.status.toLowerCase()}`}>
          {event.category === "deployment" ? "DP" : "LQ"}
        </span>
        <span className={`status ${event.status.toLowerCase()}`}>
          {event.status}
        </span>
      </div>
      <div className="feed-content">
        <div>
          <p className="eyebrow">
            {event.type} · {dateLabel(event.date)}
          </p>
          <button onClick={() => onPerson(person)}>{event.person}</button>
          <button
            className="inline-entity-link"
            onClick={() => onOrganization(event.organizationSlug)}
          >
            {event.organization}
          </button>
        </div>
        <p>{event.description}</p>
        <div className="event-link-row">
          <button onClick={() => onRegion(event.regionSlug)}>
            {event.regionName}
          </button>
          <span>{event.industry}</span>
          <span>NAICS {event.naics}</span>
          <span>{event.city}</span>
        </div>
        <div className="feed-source">
          <span className={`classification ${event.classification}`}>
            {event.classification}
          </span>
          <span>{event.source}</span>
          <button onClick={() => onEvidence(event)}>Open event evidence</button>
        </div>
      </div>
      <div className="feed-values">
        <span>Estimated range</span>
        <strong>{rangeMoney(event.net)}</strong>
        <span>Confidence</span>
        <b>{event.confidence}/100</b>
      </div>
    </article>
  );
}

export function EventsExplorer({
  queryString,
  onQueryChange,
  onPerson,
  onRegion,
  onOrganization,
  notify,
}: {
  queryString: string;
  onQueryChange: (params: URLSearchParams, replace?: boolean) => void;
  onPerson: (person: Person) => void;
  onRegion: (slug: string) => void;
  onOrganization: (slug: string) => void;
  notify: (message: string) => void;
}) {
  const [filters, setFilters] = useState(() =>
    eventFiltersFromQuery(queryString),
  );
  const [draftQuery, setDraftQuery] = useState(filters.q);
  const [loading, setLoading] = useState(false);
  const filtered = useMemo(
    () => filterLiquidityEvents(eventFilterInput(filters)),
    [filters],
  );
  const pageSize = 8;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pages, Math.max(1, Number(filters.page || 1)));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  function publish(next: EventFilterState, replace = false) {
    setFilters(next);
    const params = new URLSearchParams();
    Object.entries(next).forEach(([key, value]) => {
      if (value && value !== emptyEventFilters[key as keyof EventFilterState]) {
        params.set(key, value);
      }
    });
    if (next.minConfidence !== "") {
      params.set("minConfidence", next.minConfidence);
    }
    onQueryChange(params, replace);
  }

  function setFilter(
    key: keyof EventFilterState,
    value: string,
    replace = false,
  ) {
    publish(
      {
        ...filters,
        q: key === "q" ? value : draftQuery,
        [key]: value,
        page: "1",
      },
      replace,
    );
  }

  useEffect(() => {
    if (draftQuery === filters.q) return;
    const timeout = window.setTimeout(() => {
      publish({ ...filters, q: draftQuery, page: "1" }, true);
      setLoading(false);
    }, 280);
    return () => window.clearTimeout(timeout);
    // `filters` is intentionally captured at the start of each debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftQuery]);

  const activeFilters = Object.entries(filters).filter(
    ([key, value]) =>
      value &&
      !["sort", "page"].includes(key) &&
      value !== emptyEventFilters[key as keyof EventFilterState],
  );

  const clearAll = () => {
    setDraftQuery("");
    publish({ ...emptyEventFilters });
  };

  return (
    <>
      <div className="page-intro">
        <div>
          <p className="eyebrow">Evidence-linked activity</p>
          <h1>Events feed</h1>
          <p>
            Search liquidity creation and known deployment across people,
            organizations, industries, sources, and regional hierarchies.
          </p>
        </div>
        <div className="page-actions">
          <button
            className="button primary"
            onClick={() => notify("Event feed saved as a workspace search")}
          >
            Save this feed
          </button>
        </div>
      </div>
      <section className="event-search-panel" aria-label="Event search">
        <form
          className="event-search-row"
          onSubmit={(event) => {
            event.preventDefault();
            publish({ ...filters, q: draftQuery, page: "1" });
            setLoading(false);
          }}
        >
          <label className="search-large">
            <span>Search events</span>
            <input
              aria-label="Search events"
              value={draftQuery}
              onChange={(event) => {
                setDraftQuery(event.target.value);
                setLoading(true);
              }}
              placeholder="Search people, organizations, locations, industries, sources…"
            />
          </label>
          {draftQuery && (
            <button
              className="button ghost"
              type="button"
              onClick={() => {
                setDraftQuery("");
                setFilter("q", "");
              }}
            >
              Clear search
            </button>
          )}
          <button className="button primary" type="submit">
            Search
          </button>
        </form>
        <div className="primary-filter-grid">
          <label>
            Region
            <select
              aria-label="Event region"
              value={filters.region}
              onChange={(event) => setFilter("region", event.target.value)}
            >
              <option value="">All regions</option>
              {regions.map((region) => (
                <option key={region.slug} value={region.slug}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Industry
            <select
              aria-label="Event industry"
              value={filters.industry}
              onChange={(event) => setFilter("industry", event.target.value)}
            >
              <option value="">All industries</option>
              {Array.from(new Set(events.map((event) => event.industry))).map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Event type
            <select
              aria-label="Event type"
              value={filters.eventType}
              onChange={(event) => setFilter("eventType", event.target.value)}
            >
              <option value="">All event types</option>
              {Array.from(new Set(events.map((event) => event.type))).map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Status
            <select
              aria-label="Event status"
              value={filters.status}
              onChange={(event) => setFilter("status", event.target.value)}
            >
              <option value="">All statuses</option>
              {Array.from(new Set(events.map((event) => event.status))).map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Sort
            <select
              aria-label="Sort events"
              value={filters.sort}
              onChange={(event) => setFilter("sort", event.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="largest">Largest median</option>
              <option value="confidence">Highest confidence</option>
            </select>
          </label>
        </div>
        <details className="advanced-filters">
          <summary>More filters</summary>
          <div className="advanced-filter-grid">
            {[
              ["state", "State"],
              ["metro", "Metro"],
              ["county", "County"],
              ["city", "City"],
              ["naics", "NAICS code"],
              ["dateFrom", "Date from"],
              ["dateTo", "Date to"],
              ["minAmount", "Minimum amount"],
              ["maxAmount", "Maximum amount"],
              ["minConfidence", "Minimum confidence"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  aria-label={label}
                  type={
                    key.startsWith("date")
                      ? "date"
                      : key.includes("Amount") || key === "minConfidence"
                        ? "number"
                        : "text"
                  }
                  value={filters[key as keyof EventFilterState]}
                  onChange={(event) =>
                    setFilter(key as keyof EventFilterState, event.target.value)
                  }
                />
              </label>
            ))}
            {[
              [
                "personRole",
                "Person role",
                Array.from(new Set(events.map((event) => event.personRole))),
              ],
              ["organizationClass", "Public or private", ["public", "private"]],
              [
                "completion",
                "Proposed versus completed",
                ["completed", "proposed"],
              ],
              ["category", "Event category", ["liquidity", "deployment"]],
            ].map(([key, label, options]) => (
              <label key={String(key)}>
                {String(label)}
                <select
                  aria-label={String(label)}
                  value={filters[key as keyof EventFilterState]}
                  onChange={(event) =>
                    setFilter(key as keyof EventFilterState, event.target.value)
                  }
                >
                  <option value="">All</option>
                  {(options as string[]).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </details>
        <div className="active-filter-row">
          <strong>{filtered.length} results</strong>
          <div>
            {activeFilters.map(([key, value]) => (
              <button
                className="filter-chip"
                key={key}
                onClick={() =>
                  key === "q"
                    ? (() => {
                        setDraftQuery("");
                        setFilter("q", "");
                      })()
                    : setFilter(key as keyof EventFilterState, "")
                }
              >
                {key}: {value} ×
              </button>
            ))}
          </div>
          {activeFilters.length > 0 && (
            <button className="text-link" onClick={clearAll}>
              Clear all filters
            </button>
          )}
        </div>
      </section>
      {loading ? (
        <div className="results-loading" role="status">
          Searching evidence-linked events…
        </div>
      ) : paginated.length ? (
        <>
          <section className="feed-list" aria-live="polite">
            {paginated.map((event) => (
              <EventCard
                event={event}
                key={event.id}
                onPerson={onPerson}
                onRegion={onRegion}
                onOrganization={onOrganization}
                onEvidence={(record) =>
                  notify(`Evidence opened for ${record.person}`)
                }
              />
            ))}
          </section>
          <nav className="pagination" aria-label="Event results pages">
            <button
              disabled={page === 1}
              onClick={() => publish({ ...filters, page: String(page - 1) })}
            >
              Previous
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button
              disabled={page === pages}
              onClick={() => publish({ ...filters, page: String(page + 1) })}
            >
              Next
            </button>
          </nav>
        </>
      ) : (
        <div className="empty-state">
          <span>⌕</span>
          <h3>
            No events were found
            {filters.industry ? ` for ${filters.industry}` : ""}
            {filters.region
              ? ` in ${getRegion(filters.region)?.name ?? "this region"}`
              : ""}
            .
          </h3>
          <p>Try broader terms or remove one of the active filters.</p>
          <button className="button primary" onClick={clearAll}>
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}

export function PeopleExplorer({
  queryString,
  activeRegion,
  onQueryChange,
  onPerson,
  onExport,
  onSave,
}: {
  queryString: string;
  activeRegion: Region;
  onQueryChange: (params: URLSearchParams, replace?: boolean) => void;
  onPerson: (person: Person) => void;
  onExport: (records: Person[]) => void;
  onSave: () => void;
}) {
  const params = new URLSearchParams(queryString);
  const [q, setQ] = useState(params.get("q") || "");
  const [region, setRegion] = useState(params.get("region") || "");
  const [relationshipType, setRelationshipType] = useState(
    params.get("relationshipType") || "",
  );
  const [industry, setIndustry] = useState(params.get("industry") || "");
  const [minConfidence, setMinConfidence] = useState(
    params.get("minConfidence") || "65",
  );
  const [minLiquidity, setMinLiquidity] = useState(
    params.get("minLiquidity") || "",
  );
  const [minAffinity, setMinAffinity] = useState(
    params.get("minAffinity") || "",
  );
  const [sort, setSort] = useState(params.get("sort") || "liquidity");

  const records = useMemo(
    () =>
      filterRegionalPeople({
        q,
        region,
        relationshipType,
        industry,
        minConfidence: Number(minConfidence || 0),
        minLiquidity: Number(minLiquidity || 0),
        affinityRegion: activeRegion.slug,
        minAffinity: Number(minAffinity || 0),
        sort,
      }),
    [
      activeRegion.slug,
      industry,
      minAffinity,
      minConfidence,
      minLiquidity,
      q,
      region,
      relationshipType,
      sort,
    ],
  );

  function sync(overrides: Record<string, string>) {
    const next = {
      q,
      region,
      relationshipType,
      industry,
      minConfidence,
      minLiquidity,
      minAffinity,
      sort,
      ...overrides,
    };
    const nextParams = new URLSearchParams();
    Object.entries(next).forEach(([key, value]) => {
      if (value) nextParams.set(key, value);
    });
    nextParams.set("affinityRegion", activeRegion.slug);
    onQueryChange(nextParams, true);
  }

  const quickFilter = (type: string) => {
    if (type === "located") {
      setRegion(activeRegion.slug);
      setRelationshipType("primary_economic_location");
      sync({
        region: activeRegion.slug,
        relationshipType: "primary_economic_location",
      });
    } else if (type === "created") {
      setRegion(activeRegion.slug);
      setRelationshipType("liquidity_event");
      sync({
        region: activeRegion.slug,
        relationshipType: "liquidity_event",
      });
    } else if (type === "invested") {
      setRegion(activeRegion.slug);
      setRelationshipType("investment_activity");
      sync({
        region: activeRegion.slug,
        relationshipType: "investment_activity",
      });
    } else if (type === "strong") {
      setMinAffinity("70");
      sync({ minAffinity: "70" });
    } else {
      setRegion(activeRegion.slug);
      setRelationshipType("liquidity_event");
      setMinConfidence("80");
      sync({
        region: activeRegion.slug,
        relationshipType: "liquidity_event",
        minConfidence: "80",
        sort: "recent",
      });
    }
  };

  return (
    <>
      <div className="page-intro">
        <div>
          <p className="eyebrow">Qualified capital controllers</p>
          <h1>People search</h1>
          <p>
            Affinity scores and geographic relationships are relative to{" "}
            <strong>{activeRegion.name}</strong>.
          </p>
        </div>
        <div className="page-actions">
          <button className="button ghost" onClick={onSave}>
            Save search
          </button>
          <button
            className="button primary"
            onClick={() => onExport(records.map((record) => record.person))}
          >
            Export {records.length} results
          </button>
        </div>
      </div>
      <section className="search-panel">
        <div className="search-row">
          <label className="search-large">
            <span>Search people</span>
            <input
              aria-label="Search people"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                sync({ q: event.target.value });
              }}
              placeholder="Search by person, company, metro…"
            />
          </label>
          <select
            aria-label="Primary or related region"
            value={region}
            onChange={(event) => {
              setRegion(event.target.value);
              sync({ region: event.target.value });
            }}
          >
            <option value="">Any region</option>
            {regions.map((record) => (
              <option key={record.slug} value={record.slug}>
                {record.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Geographic relationship"
            value={relationshipType}
            onChange={(event) => {
              setRelationshipType(event.target.value);
              sync({ relationshipType: event.target.value });
            }}
          >
            <option value="">Any relationship</option>
            {Object.entries(affinityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="People industry"
            value={industry}
            onChange={(event) => {
              setIndustry(event.target.value);
              sync({ industry: event.target.value });
            }}
          >
            <option value="">All industries</option>
            {Array.from(new Set(people.map((person) => person.industry))).map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        </div>
        <div className="quick-filter-row" aria-label="People quick filters">
          <button onClick={() => quickFilter("located")}>
            Located in selected region
          </button>
          <button onClick={() => quickFilter("created")}>
            Created liquidity in selected region
          </button>
          <button onClick={() => quickFilter("invested")}>
            Invested in selected region
          </button>
          <button onClick={() => quickFilter("strong")}>
            Strong affinity to selected region
          </button>
          <button onClick={() => quickFilter("recent")}>
            Recently liquid people in selected region
          </button>
        </div>
        <div className="people-filter-grid">
          <label>
            Minimum confidence
            <input
              type="number"
              min="0"
              max="100"
              value={minConfidence}
              onChange={(event) => {
                setMinConfidence(event.target.value);
                sync({ minConfidence: event.target.value });
              }}
            />
          </label>
          <label>
            Minimum liquidity
            <input
              type="number"
              min="0"
              value={minLiquidity}
              onChange={(event) => {
                setMinLiquidity(event.target.value);
                sync({ minLiquidity: event.target.value });
              }}
            />
          </label>
          <label>
            Minimum affinity to {activeRegion.name}
            <input
              aria-label="Minimum affinity to selected region"
              type="number"
              min="0"
              max="100"
              value={minAffinity}
              onChange={(event) => {
                setMinAffinity(event.target.value);
                sync({ minAffinity: event.target.value });
              }}
            />
          </label>
          <label>
            Sort
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                sync({ sort: event.target.value });
              }}
            >
              <option value="liquidity">Estimated remaining liquidity</option>
              <option value="confidence">Confidence</option>
              <option value="affinity">Local affinity</option>
              <option value="recent">Most recent event</option>
              <option value="radar">Radar score</option>
            </select>
          </label>
        </div>
      </section>
      <section className="panel results-panel">
        <div className="results-meta">
          <strong>{records.length} qualified people</strong>
          <span>Affinity region: {activeRegion.name}</span>
        </div>
        {records.length ? (
          <div className="table-wrap">
            <table className="people-table regional-people-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Primary location</th>
                  <th>Relationship to {activeRegion.name}</th>
                  <th>Affinity</th>
                  <th>Est. remaining</th>
                  <th>Confidence</th>
                  <th>Industry</th>
                  <th>Latest event</th>
                </tr>
              </thead>
              <tbody>
                {records.map(({ person, affinity }) => {
                  const relationship = relationshipToRegion(
                    person,
                    activeRegion.slug,
                  );
                  return (
                    <tr
                      key={person.id}
                      tabIndex={0}
                      onClick={() => onPerson(person)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") onPerson(person);
                      }}
                    >
                      <td>
                        <span className="avatar">{person.initials}</span>
                        <span>
                          <strong>{person.name}</strong>
                          <small>
                            {person.role} · {person.organization}
                          </small>
                        </span>
                      </td>
                      <td>{person.location}</td>
                      <td>
                        {relationship
                          ? affinityLabels[relationship.type]
                          : "Documented regional connection"}
                      </td>
                      <td>
                        <strong>{affinity?.score ?? 0}/100</strong>
                      </td>
                      <td>{rangeMoney(person.remaining)}</td>
                      <td>{person.confidence}</td>
                      <td>{person.industry}</td>
                      <td>{dateLabel(person.eventDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h3>No people match this region and confidence threshold.</h3>
            <button
              className="button primary"
              onClick={() => {
                setRegion("");
                setRelationshipType("");
                setIndustry("");
                setMinAffinity("");
                setMinLiquidity("");
                setMinConfidence("65");
                onQueryChange(new URLSearchParams(), true);
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
    </>
  );
}

export function RegionsDirectory({
  onRegion,
  onMap,
}: {
  onRegion: (slug: string) => void;
  onMap: () => void;
}) {
  const [compare, setCompare] = useState<"created" | "controlled" | "deployed">(
    "created",
  );
  return (
    <>
      <div className="page-intro">
        <div>
          <p className="eyebrow">Regional intelligence</p>
          <h1>Regional dashboards</h1>
          <p>
            Open a region to explore its people, events, organizations,
            industries, and affinity-based capital matches.
          </p>
        </div>
        <div className="page-actions">
          <select
            aria-label="Compare regional metric"
            value={compare}
            onChange={(event) =>
              setCompare(
                event.target.value as "created" | "controlled" | "deployed",
              )
            }
          >
            <option value="created">Capital created</option>
            <option value="controlled">Estimated remaining</option>
            <option value="deployed">Known deployment</option>
          </select>
          <button className="button ghost" onClick={onMap}>
            Open national map
          </button>
        </div>
      </div>
      <section className="region-cards">
        {regions.map((region) => (
          <article key={region.slug}>
            <div>
              <span>{region.code}</span>
              <b>+{region.momentum}% momentum</b>
            </div>
            <h2>{region.name}</h2>
            <p>
              {region.type} · {region.metro}
            </p>
            <dl>
              <div>
                <dt>Selected metric</dt>
                <dd>{money(region[compare])}</dd>
              </div>
              <div>
                <dt>Relevant people</dt>
                <dd>{region.people}</dd>
              </div>
              <div>
                <dt>Events</dt>
                <dd>{region.eventCount}</dd>
              </div>
            </dl>
            <button
              className="button primary wide"
              onClick={() => onRegion(region.slug)}
            >
              Open {region.name}
            </button>
          </article>
        ))}
      </section>
    </>
  );
}

export function RegionDetail({
  regionSlug,
  activeRegion,
  onRegion,
  onPerson,
  onEvents,
  onPeople,
  onOrganization,
}: {
  regionSlug: string;
  activeRegion: Region;
  onRegion: (slug: string) => void;
  onPerson: (person: Person) => void;
  onEvents: (params: Record<string, string>) => void;
  onPeople: (params: Record<string, string>) => void;
  onOrganization: (slug: string) => void;
}) {
  const region = getRegion(regionSlug) ?? regions[0];
  const [relationshipType, setRelationshipType] = useState("");
  const [industry, setIndustry] = useState("");
  const [minConfidence, setMinConfidence] = useState("65");
  const [minLiquidity, setMinLiquidity] = useState("");
  const [sort, setSort] = useState("affinity");
  const personRecords = filterRegionalPeople({
    region: region.slug,
    relationshipType,
    industry,
    minConfidence: Number(minConfidence || 0),
    minLiquidity: Number(minLiquidity || 0),
    affinityRegion: activeRegion.slug,
    sort,
  });
  const regionalEvents = filterLiquidityEvents({
    region: region.slug,
    industry,
    minConfidence: Number(minConfidence || 0),
  });
  const organizations = organizationsConnectedToRegion(region.slug);
  const matches = personRecords.slice(0, 4);

  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <button onClick={() => onRegion("washington-arlington-alexandria")}>
          National Map
        </button>
        {region.hierarchy
          .slice()
          .reverse()
          .filter((slug) => slug !== region.slug)
          .map((slug) => (
            <span key={slug}>
              /{" "}
              <button onClick={() => onRegion(slug)}>
                {getRegion(slug)?.name ?? slug}
              </button>
            </span>
          ))}
        <span>/ {region.name}</span>
      </nav>
      <div className="page-intro region-intro">
        <div>
          <p className="eyebrow">Regional intelligence · {region.type}</p>
          <h1>{region.name}</h1>
          <p>
            Regional capital creation, control, deployment, and documented
            relationships. Affinity is currently measured against{" "}
            <strong>{activeRegion.name}</strong>.
          </p>
        </div>
        <div className="page-actions">
          <button
            className="button ghost"
            onClick={() =>
              onEvents({ region: region.slug, category: "liquidity" })
            }
          >
            View all events in this region
          </button>
        </div>
      </div>
      <section className="region-metric-grid">
        <button
          onClick={() =>
            onEvents({ region: region.slug, category: "liquidity" })
          }
        >
          <span>Liquidity created</span>
          <strong>{money(region.created)}</strong>
          <small>Open qualifying events →</small>
        </button>
        <button
          onClick={() =>
            onPeople({
              region: region.slug,
              sort: "liquidity",
              affinityRegion: activeRegion.slug,
            })
          }
        >
          <span>Est. remaining controlled locally</span>
          <strong>{money(region.controlled)}</strong>
          <small>Open relevant people →</small>
        </button>
        <button
          onClick={() =>
            onEvents({ region: region.slug, category: "deployment" })
          }
        >
          <span>Known local deployment</span>
          <strong>
            {money(region.deployed * 0.82)}–{money(region.deployed * 1.18)}
          </strong>
          <small>Open deployment events →</small>
        </button>
        <button
          onClick={() =>
            onPeople({
              region: region.slug,
              minConfidence: "80",
              affinityRegion: activeRegion.slug,
            })
          }
        >
          <span>High-confidence people</span>
          <strong>{region.highConfidencePeople}</strong>
          <small>Confidence 80+ →</small>
        </button>
        <button onClick={() => onEvents({ region: region.slug })}>
          <span>Events</span>
          <strong>{region.eventCount}</strong>
          <small>Open filtered feed →</small>
        </button>
      </section>
      <section className="region-analysis-grid">
        <article className="panel">
          <p className="eyebrow">Industry mix</p>
          <h2>Regional composition</h2>
          <div className="industry-breakdown">
            {region.industries.map((segment) => (
              <button
                className={industry === segment.name ? "active" : ""}
                key={segment.name}
                onClick={() =>
                  setIndustry(industry === segment.name ? "" : segment.name)
                }
              >
                <span>{segment.name}</span>
                <i>
                  <b style={{ width: `${segment.share * 100}%` }} />
                </i>
                <strong>{Math.round(segment.share * 100)}%</strong>
              </button>
            ))}
          </div>
        </article>
        <article className="panel">
          <p className="eyebrow">Three-year trend</p>
          <h2>Liquidity creation</h2>
          <div
            className="regional-trend"
            aria-label={`Liquidity creation trend for ${region.name}`}
          >
            {[28, 35, 31, 46, 52, 48, 61, 69, 76, 71, 84, 92].map(
              (height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ),
            )}
          </div>
          <div className="trend-axis">
            <span>2024</span>
            <span>2025</span>
            <span>2026</span>
          </div>
        </article>
      </section>
      <section className="panel region-people-section">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Connected through documented geography</p>
            <h2>Relevant people</h2>
          </div>
          <button
            className="button ghost"
            onClick={() =>
              onPeople({
                region: region.slug,
                affinityRegion: activeRegion.slug,
              })
            }
          >
            Open full people search
          </button>
        </div>
        <div className="region-table-filters">
          <select
            aria-label="Region relationship type"
            value={relationshipType}
            onChange={(event) => setRelationshipType(event.target.value)}
          >
            <option value="">All relationships</option>
            {Object.entries(affinityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Region people industry"
            value={industry}
            onChange={(event) => setIndustry(event.target.value)}
          >
            <option value="">All industries</option>
            {region.industries.map((segment) => (
              <option key={segment.name}>{segment.name}</option>
            ))}
          </select>
          <label>
            Confidence
            <input
              type="number"
              min="0"
              max="100"
              value={minConfidence}
              onChange={(event) => setMinConfidence(event.target.value)}
            />
          </label>
          <label>
            Minimum liquidity
            <input
              type="number"
              min="0"
              value={minLiquidity}
              onChange={(event) => setMinLiquidity(event.target.value)}
            />
          </label>
          <select
            aria-label="Sort regional people"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="liquidity">Estimated remaining liquidity</option>
            <option value="confidence">Confidence</option>
            <option value="affinity">Local affinity</option>
            <option value="recent">Most recent event</option>
            <option value="radar">Radar score</option>
          </select>
        </div>
        {personRecords.length ? (
          <div className="table-wrap">
            <table className="regional-detail-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Primary role</th>
                  <th>Organization</th>
                  <th>Relationship to region</th>
                  <th>Est. remaining</th>
                  <th>Confidence</th>
                  <th>Affinity to {activeRegion.name}</th>
                  <th>Most recent event</th>
                  <th>Industry</th>
                </tr>
              </thead>
              <tbody>
                {personRecords.slice(0, 12).map(({ person, affinity }) => {
                  const relationship = relationshipToRegion(
                    person,
                    region.slug,
                  );
                  return (
                    <tr
                      key={person.id}
                      tabIndex={0}
                      onClick={() => onPerson(person)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") onPerson(person);
                      }}
                    >
                      <td>
                        <strong>{person.name}</strong>
                      </td>
                      <td>{person.role}</td>
                      <td>{person.organization}</td>
                      <td>
                        {relationship
                          ? affinityLabels[
                              relationship.type as GeographicRelationshipType
                            ]
                          : "Documented affinity"}
                      </td>
                      <td>{rangeMoney(person.remaining)}</td>
                      <td>{person.confidence}</td>
                      <td>{affinity?.score ?? 0}/100</td>
                      <td>{dateLabel(person.eventDate)}</td>
                      <td>{person.industry}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h3>No people match this region and confidence threshold.</h3>
            <button
              className="button primary"
              onClick={() => {
                setRelationshipType("");
                setIndustry("");
                setMinConfidence("65");
                setMinLiquidity("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
      <section className="region-lower-grid">
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Shared event-search model</p>
              <h2>Relevant events</h2>
            </div>
            <button
              onClick={() =>
                onEvents({
                  region: region.slug,
                  ...(industry ? { industry } : {}),
                })
              }
            >
              View all events in this region
            </button>
          </div>
          <div className="compact-event-list">
            {regionalEvents.slice(0, 6).map((event) => (
              <button key={event.id} onClick={() => onRegion(event.regionSlug)}>
                <span>
                  <strong>{event.person}</strong>
                  <small>
                    {event.type} · {event.organization}
                  </small>
                </span>
                <span>
                  <b>{rangeMoney(event.net)}</b>
                  <small>{event.confidence}/100</small>
                </span>
              </button>
            ))}
          </div>
        </article>
        <article className="panel">
          <p className="eyebrow">Multi-region relationships</p>
          <h2>Relevant organizations</h2>
          <div className="compact-organization-list">
            {organizations.slice(0, 8).map((organization) => (
              <button
                key={organization.id}
                onClick={() => onOrganization(organization.slug)}
              >
                <span>
                  <strong>{organization.name}</strong>
                  <small>
                    {organization.type.replace(/_/g, " ")} ·{" "}
                    {organization.industry}
                  </small>
                </span>
                <b>{organization.regionSlugs.length} regions</b>
              </button>
            ))}
          </div>
        </article>
        <article className="panel">
          <p className="eyebrow">Affinity + capacity + confidence</p>
          <h2>Regional capital matches</h2>
          <div className="compact-match-list">
            {matches.map(({ person, affinity }, index) => (
              <button key={person.id} onClick={() => onPerson(person)}>
                <span>{index + 1}</span>
                <span>
                  <strong>{person.name}</strong>
                  <small>{affinity?.mainReasons[0] ?? person.location}</small>
                </span>
                <b>
                  {Math.round(
                    (affinity?.score ?? 0) * 0.42 + person.radar * 0.58,
                  )}
                </b>
              </button>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
