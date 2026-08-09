"use client";

import { useMemo, useState } from "react";
import type {
  MoneyMotionSnapshot,
  PersonLiquiditySummary,
} from "../lib/money-in-motion";

function compactMoney(value: number | null, currency = "USD") {
  if (value === null) return "Amount not established";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function dateLabel(value: string) {
  if (!value) return "Not established";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const sourceLabels: Record<string, string> = {
  sec: "SEC transactions",
  cms_chow: "CMS ownership changes",
  uspto_assignments: "USPTO patent transfers",
  ftc_hsr: "FTC deal notices",
  stb: "STB transportation deals",
  gdelt: "Transaction news",
};

function sourceLabel(value: string) {
  return sourceLabels[value] || titleCase(value);
}

function stageLabel(value: string) {
  return (
    {
      WATCHING: "Watching",
      PRE_SALE: "Proposed",
      ANNOUNCED: "Announced",
      PENDING_REGULATORY: "Pending review",
      CLOSED: "Completed",
      POST_LIQUIDITY: "Completed",
      UNKNOWN: "Unclear",
    }[value] || titleCase(value)
  );
}

function eventLabel(value: string) {
  return (
    {
      SECONDARY_SALE: "Share sale",
      BUSINESS_SALE: "Business sale",
      BUSINESS_FOR_SALE: "Business listed for sale",
      MERGER: "Merger",
      ACQUISITION: "Acquisition",
      PATENT_ASSIGNMENT: "Patent transfer",
      OWNERSHIP_CHANGE: "Ownership change",
      LICENSE_TRANSFER: "License transfer",
      TRANSPORT_ASSET_TRANSFER: "Transportation asset transfer",
      ENERGY_ASSET_TRANSFER: "Energy asset transfer",
    }[value] || titleCase(value)
  );
}

function place(person: PersonLiquiditySummary) {
  return (
    [person.location.country, person.location.state, person.location.city]
      .filter(Boolean)
      .join(" · ") || "Location not established"
  );
}

function PersonDrawer({
  person,
  snapshot,
  onClose,
}: {
  person: PersonLiquiditySummary;
  snapshot: MoneyMotionSnapshot;
  onClose: () => void;
}) {
  const events = snapshot.records.filter(
    (record) => record.person.toLowerCase() === person.name.toLowerCase(),
  );
  return (
    <div
      className="motion-drawer-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <aside
        className="motion-drawer people-motion-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Public liquidity evidence for ${person.name}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>Directory profile</span>
            <h2>{person.name}</h2>
            <p>{[person.role, person.company].filter(Boolean).join(" · ")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close profile">
            ×
          </button>
        </header>

        <section className="motion-drawer-section">
          <h3>Profile summary</h3>
          <dl className="motion-facts">
            <div>
              <dt>Estimated proceeds</dt>
              <dd>
                {person.estimatedLiquidityLow === null
                  ? "Not established"
                  : `${compactMoney(person.estimatedLiquidityLow, person.currency)}–${compactMoney(person.estimatedLiquidityHigh, person.currency)}`}
              </dd>
            </div>
            <div>
              <dt>Priority score</dt>
              <dd>{person.actionability.total}/100</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{person.highestConfidence}/100</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{place(person)}</dd>
            </div>
            <div>
              <dt>Open / closed signals</dt>
              <dd>
                {person.openPreLiquidityCount} / {person.closedEventCount}
              </dd>
            </div>
            <div>
              <dt>Observed lead time</dt>
              <dd>
                {person.leadDaysToClose === null
                  ? "Not yet measurable"
                  : `${person.leadDaysToClose} days to close`}
              </dd>
            </div>
          </dl>
          <p className="motion-location-basis">{person.location.basis}</p>
        </section>

        <section className="motion-drawer-section">
          <h3>How the score works</h3>
          <div className="motion-confidence-grid">
            <span>
              Magnitude <b>{person.actionability.magnitude}/30</b>
            </span>
            <span>
              Recency <b>{person.actionability.recency}/20</b>
            </span>
            <span>
              Pre-close timing <b>{person.actionability.preCloseTiming}/15</b>
            </span>
            <span>
              Ownership <b>{person.actionability.ownershipCertainty}/15</b>
            </span>
            <span>
              Private market <b>{person.actionability.privateMarket}/10</b>
            </span>
            <span>
              Corroboration <b>{person.actionability.sourceCorroboration}/10</b>
            </span>
          </div>
          <p>
            Priority measures timing and relevance. Confidence measures how
            strongly the identity, transaction, ownership, and value are
            supported by public records.
          </p>
        </section>

        <section className="motion-drawer-section">
          <h3>Associated public events</h3>
          <div className="people-motion-event-list">
            {events.map((event) => (
              <article key={event.id}>
                <span>
                  {stageLabel(event.stage)} · {dateLabel(event.eventDate)} ·{" "}
                  {event.actionability.total} priority
                </span>
                <strong>{event.title}</strong>
                <p>{event.summary}</p>
                <small>
                  {event.independentSourceCount} independent source
                  {event.independentSourceCount === 1 ? "" : "s"} ·{" "}
                  {event.ownershipEvidence
                    ? "Ownership evidence present"
                    : "No ownership attribution"}
                </small>
              </article>
            ))}
          </div>
        </section>

        <section className="motion-drawer-section">
          <h3>Evidence</h3>
          <div className="motion-evidence-list">
            {person.evidence.map((evidence) => (
              <a
                key={evidence.id}
                href={evidence.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span>
                  {evidence.publisher} · {dateLabel(evidence.publishedAt)}
                </span>
                <strong>{evidence.title}</strong>
                <small>{evidence.classification} · Open evidence ↗</small>
              </a>
            ))}
          </div>
        </section>

        <section className="motion-drawer-section motion-caution">
          <h3>Uncertainty</h3>
          <ul>
            {person.uncertainties.map((uncertainty) => (
              <li key={uncertainty}>{uncertainty}</li>
            ))}
          </ul>
          <p>
            These are public-event estimates, not bank balances, current cash,
            net worth, or proof that proceeds remain available.
          </p>
        </section>
      </aside>
    </div>
  );
}

export function PeopleInMotionView({
  snapshot,
  query: controlledQuery,
  onQuery,
}: {
  snapshot: MoneyMotionSnapshot;
  query?: string;
  onQuery?: (value: string) => void;
}) {
  const [localQuery, setLocalQuery] = useState("");
  const [marketClass, setMarketClass] = useState("");
  const [location, setLocation] = useState("");
  const [industry, setIndustry] = useState("");
  const [stage, setStage] = useState("");
  const [eventType, setEventType] = useState("");
  const [dateWindow, setDateWindow] = useState("");
  const [minimum, setMinimum] = useState("");
  const [confidence, setConfidence] = useState("0");
  const [source, setSource] = useState("");
  const [ownershipOnly, setOwnershipOnly] = useState(false);
  const [sort, setSort] = useState("actionability");
  const [selected, setSelected] = useState<PersonLiquiditySummary | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const query = controlledQuery ?? localQuery;
  const setQuery = (value: string) => {
    setVisibleCount(50);
    if (onQuery) onQuery(value);
    else setLocalQuery(value);
  };

  const recordsById = useMemo(
    () => new Map(snapshot.records.map((record) => [record.id, record])),
    [snapshot.records],
  );
  const options = useMemo(
    () => ({
      locations: [
        ...new Set(
          snapshot.peopleInMotion
            .map((person) => person.location.state || person.location.country)
            .filter(Boolean),
        ),
      ].sort(),
      industries: [
        ...new Set(
          snapshot.peopleInMotion
            .map((person) => person.industry)
            .filter(Boolean),
        ),
      ].sort(),
      sources: [
        ...new Set(
          snapshot.peopleInMotion.flatMap((person) =>
            person.evidence.map((evidence) => evidence.sourceId),
          ),
        ),
      ].sort(),
      eventTypes: [
        ...new Set(
          snapshot.peopleInMotion
            .map((person) => recordsById.get(person.latestEventId)?.eventType)
            .filter(Boolean),
        ),
      ].sort(),
    }),
    [snapshot.peopleInMotion, recordsById],
  );

  const people = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const threshold = dateWindow
      ? Date.parse(snapshot.generatedAt) - Number(dateWindow) * 86_400_000
      : 0;
    return snapshot.peopleInMotion
      .filter((person) => {
        const record = recordsById.get(person.latestEventId);
        const latestTime = Date.parse(
          `${person.latestSignalAt.slice(0, 10)}T00:00:00Z`,
        );
        if (
          normalizedQuery &&
          ![
            person.name,
            person.company,
            person.role,
            person.industry,
            person.latestEventTitle,
            place(person),
            ...person.evidence.flatMap((evidence) => [
              evidence.publisher,
              evidence.sourceId,
              evidence.title,
            ]),
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)
        )
          return false;
        if (marketClass && person.marketClass !== marketClass) return false;
        if (
          location &&
          ![person.location.state, person.location.country].includes(location)
        )
          return false;
        if (industry && person.industry !== industry) return false;
        if (stage && person.latestStage !== stage) return false;
        if (eventType && record?.eventType !== eventType) return false;
        if (
          threshold &&
          (!Number.isFinite(latestTime) || latestTime < threshold)
        )
          return false;
        if (
          minimum &&
          (person.estimatedLiquidityHigh === null ||
            person.estimatedLiquidityHigh < Number(minimum))
        )
          return false;
        if (person.highestConfidence < Number(confidence)) return false;
        if (
          source &&
          !person.evidence.some((evidence) => evidence.sourceId === source)
        )
          return false;
        if (ownershipOnly && !record?.ownershipEvidence) return false;
        return true;
      })
      .sort((left, right) => {
        if (sort === "amount")
          return (
            (right.estimatedLiquidityHigh || 0) -
            (left.estimatedLiquidityHigh || 0)
          );
        if (sort === "recent")
          return right.latestSignalAt.localeCompare(left.latestSignalAt);
        if (sort === "confidence")
          return right.highestConfidence - left.highestConfidence;
        if (sort === "lead")
          return (right.leadDaysToClose || -1) - (left.leadDaysToClose || -1);
        return right.actionability.total - left.actionability.total;
      });
  }, [
    snapshot,
    recordsById,
    query,
    marketClass,
    location,
    industry,
    stage,
    eventType,
    dateWindow,
    minimum,
    confidence,
    source,
    ownershipOnly,
    sort,
  ]);
  const visiblePeople = people.slice(0, visibleCount);

  return (
    <>
      <section
        className="people-motion-summary"
        aria-label="Capital directory summary"
      >
        <div>
          <span>Directory profiles</span>
          <strong>{snapshot.peopleInMotion.length.toLocaleString()}</strong>
        </div>
        <div>
          <span>SEC profiles</span>
          <strong>
            {snapshot.peopleInMotion
              .filter((person) =>
                person.evidence.some((evidence) => evidence.sourceId === "sec"),
              )
              .length.toLocaleString()}
          </strong>
        </div>
        <div>
          <span>Private-market profiles</span>
          <strong>
            {snapshot.peopleInMotion
              .filter((person) => person.marketClass === "PRIVATE")
              .length.toLocaleString()}
          </strong>
        </div>
        <div>
          <span>With estimated proceeds</span>
          <strong>
            {snapshot.peopleInMotion
              .filter((person) => person.estimatedLiquidityHigh !== null)
              .length.toLocaleString()}
          </strong>
        </div>
      </section>

      <section
        className="people-motion-controls real-people-controls unified-directory-controls"
        aria-label="Capital directory filters"
      >
        <label className="people-motion-search">
          <span>Search names, companies, locations, events, or sources</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a person, company, city, event, or public source…"
            aria-label="Search people and reporting parties"
          />
        </label>
        <label>
          <span>Market</span>
          <select
            aria-label="Market"
            value={marketClass}
            onChange={(event) => setMarketClass(event.target.value)}
          >
            <option value="">All markets</option>
            <option value="PRIVATE">Private</option>
            <option value="PUBLIC">Public</option>
            <option value="UNKNOWN">Unresolved</option>
          </select>
        </label>
        <label>
          <span>Location</span>
          <select
            aria-label="Location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          >
            <option value="">All locations</option>
            {options.locations.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Industry</span>
          <select
            aria-label="Industry"
            value={industry}
            onChange={(event) => setIndustry(event.target.value)}
          >
            <option value="">All industries</option>
            {options.industries.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            aria-label="Status"
            value={stage}
            onChange={(event) => setStage(event.target.value)}
          >
            <option value="">All stages</option>
            {[
              "WATCHING",
              "PRE_SALE",
              "ANNOUNCED",
              "PENDING_REGULATORY",
              "CLOSED",
              "POST_LIQUIDITY",
            ].map((item) => (
              <option key={item} value={item}>
                {stageLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Event</span>
          <select
            aria-label="Event"
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
          >
            <option value="">All event types</option>
            {options.eventTypes.map((item) => (
              <option key={item} value={item}>
                {eventLabel(item!)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Date</span>
          <select
            aria-label="Date"
            value={dateWindow}
            onChange={(event) => setDateWindow(event.target.value)}
          >
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
            <option value="1095">Last 3 years</option>
            <option value="">All dates</option>
          </select>
        </label>
        <label>
          <span>Amount</span>
          <select
            aria-label="Amount"
            value={minimum}
            onChange={(event) => setMinimum(event.target.value)}
          >
            <option value="">Any or undisclosed</option>
            <option value="1000000">$1M+</option>
            <option value="5000000">$5M+</option>
            <option value="25000000">$25M+</option>
            <option value="100000000">$100M+</option>
          </select>
        </label>
        <label>
          <span>Confidence</span>
          <select
            aria-label="Confidence"
            value={confidence}
            onChange={(event) => setConfidence(event.target.value)}
          >
            <option value="0">Any confidence</option>
            <option value="60">60+</option>
            <option value="75">75+</option>
            <option value="90">90+</option>
          </select>
        </label>
        <label>
          <span>Source</span>
          <select
            aria-label="Source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            <option value="">All sources</option>
            {options.sources.map((item) => (
              <option key={item} value={item}>
                {sourceLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Sort by</span>
          <select
            aria-label="Sort by"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="actionability">Priority</option>
            <option value="amount">Estimated proceeds</option>
            <option value="recent">Most recent</option>
            <option value="confidence">Confidence</option>
            <option value="lead">Observed lead time</option>
          </select>
        </label>
        <label className="people-motion-check">
          <input
            type="checkbox"
            checked={ownershipOnly}
            onChange={(event) => setOwnershipOnly(event.target.checked)}
          />
          <span>Ownership evidence</span>
        </label>
      </section>

      <div className="people-motion-result-bar unified-result-bar">
        <strong>{people.length.toLocaleString()} directory matches</strong>
        <span>
          All public sources use the same filters, rows, and evidence profile.
        </span>
      </div>

      <section
        className="people-motion-table real-people-directory unified-directory-table"
        aria-label="Capital directory results"
      >
        <div className="people-motion-row real-people-row heading unified-directory-row">
          <span>Person and company</span>
          <span>Latest event</span>
          <span>Estimated proceeds</span>
          <span>Priority</span>
          <span>Source and confidence</span>
        </div>
        {visiblePeople.map((person) => (
          <button
            className="people-motion-row real-people-row unified-directory-row"
            type="button"
            key={person.personId}
            onClick={() => setSelected(person)}
            aria-label={`Open profile for ${person.name}`}
          >
            <span>
              <strong>{person.name}</strong>
              <small>
                {[person.role, person.company].filter(Boolean).join(" · ") ||
                  "Role not established"}
              </small>
              <small>{place(person)}</small>
            </span>
            <span>
              <b>{stageLabel(person.latestStage)}</b>
              <small>{dateLabel(person.latestSignalAt)}</small>
              <small>{person.latestEventTitle}</small>
            </span>
            <span>
              <strong>
                {person.estimatedLiquidityLow === null
                  ? "Amount not disclosed"
                  : `${compactMoney(person.estimatedLiquidityLow, person.currency)}–${compactMoney(person.estimatedLiquidityHigh, person.currency)}`}
              </strong>
              <small>
                {person.eventCount} deduplicated event
                {person.eventCount === 1 ? "" : "s"}
              </small>
            </span>
            <span>
              <strong>{person.actionability.total}/100 priority</strong>
              <small>
                {person.leadDaysToClose === null
                  ? "Lead time not yet measurable"
                  : `${person.leadDaysToClose} days observed`}
              </small>
            </span>
            <span>
              <strong>
                {[
                  ...new Set(
                    person.evidence.map((evidence) => evidence.sourceId),
                  ),
                ]
                  .slice(0, 2)
                  .map(sourceLabel)
                  .join(" + ") || "Public record"}
              </strong>
              <small>
                {person.highestConfidence}/100 confidence · {person.sourceCount}{" "}
                source
                {person.sourceCount === 1 ? "" : "s"}
              </small>
              <small>View profile →</small>
            </span>
          </button>
        ))}
        {!people.length && (
          <div className="people-motion-empty">
            <strong>No people match these evidence filters.</strong>
            <p>
              Clear a threshold or expand the date window. No synthetic records
              are inserted to fill the result set.
            </p>
          </div>
        )}
      </section>

      {visiblePeople.length < people.length && (
        <button
          type="button"
          className="real-directory-more"
          onClick={() => setVisibleCount((current) => current + 50)}
        >
          Load 50 more profiles
          <span>
            Showing {visiblePeople.length.toLocaleString()} of{" "}
            {people.length.toLocaleString()}
          </span>
        </button>
      )}

      <p className="real-workspace-footnote">
        Records come from public sources. Amounts appear only when supported;
        patent transfers and ownership changes do not become cash estimates
        unless consideration and personal attribution are established.
      </p>

      {selected && (
        <PersonDrawer
          person={selected}
          snapshot={snapshot}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
