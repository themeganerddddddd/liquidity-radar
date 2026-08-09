"use client";

import { useMemo, useState } from "react";
import type {
  MoneyMotionRecord,
  MoneyMotionSnapshot,
} from "../lib/money-in-motion";

type SortKey = "name" | "proceeds" | "location" | "date" | "type" | "event";
type SortDirection = "asc" | "desc";

function compactMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function dateLabel(value: string) {
  if (!value) return "Not established";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Not established";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function eventLabel(value: string) {
  return (
    {
      SECONDARY_SALE: "Stock sale",
      BUSINESS_SALE: "Business sale",
      BUSINESS_FOR_SALE: "Business listed for sale",
      MERGER: "Merger",
      ACQUISITION: "Acquisition",
      DIVESTITURE: "Divestiture",
      RECAPITALIZATION: "Recapitalization",
      TENDER_OFFER: "Tender offer",
      ASSET_SALE: "Asset sale",
      COMMERCIAL_REAL_ESTATE_SALE: "Real estate sale",
      PATENT_ASSIGNMENT: "Patent sale or transfer",
      TRADEMARK_ASSIGNMENT: "Trademark sale or transfer",
      LICENSE_TRANSFER: "License transfer",
      CHANGE_OF_CONTROL: "Change of control",
      HEALTHCARE_CHOW: "Healthcare ownership sale",
      ENERGY_ASSET_TRANSFER: "Energy asset sale",
      TRANSPORT_ASSET_TRANSFER: "Transportation asset sale",
      DISSOLUTION_AFTER_TRANSACTION: "Post-sale dissolution",
      OTHER: "Other capital event",
    }[value] || titleCase(value)
  );
}

function stageLabel(value: string) {
  return (
    {
      WATCHING: "Watching",
      PRE_SALE: "Proposed",
      ANNOUNCED: "Announced",
      PENDING_REGULATORY: "Pending regulatory review",
      CLOSED: "Completed",
      POST_LIQUIDITY: "Completed",
      UNKNOWN: "Status not established",
    }[value] || titleCase(value)
  );
}

function recordName(record: MoneyMotionRecord) {
  return (
    record.person ||
    record.company ||
    record.seller ||
    record.buyer ||
    record.title ||
    "Name not established"
  );
}

function place(record: MoneyMotionRecord) {
  return (
    [record.location.country, record.location.state, record.location.city]
      .filter(Boolean)
      .join(" · ") || "Location not established"
  );
}

function amountValue(record: MoneyMotionRecord) {
  return (
    record.estimate.potentiallyDeployableHigh ?? record.reportedTransactionValue
  );
}

function undisclosedReason(record: MoneyMotionRecord) {
  const sourceIds = new Set(
    record.evidence.map((evidence) => evidence.sourceId),
  );
  if (record.eventType === "PATENT_ASSIGNMENT") {
    return "USPTO assignment record does not state consideration";
  }
  if (record.eventType === "TRANSPORT_ASSET_TRANSFER") {
    return "STB docket does not state consideration";
  }
  if (
    ["MERGER", "ACQUISITION", "CHANGE_OF_CONTROL"].includes(record.eventType) &&
    sourceIds.has("ftc_hsr")
  ) {
    return "Regulatory notice does not state deal value";
  }
  return "No public amount in the source record";
}

function proceeds(record: MoneyMotionRecord) {
  const low = record.estimate.potentiallyDeployableLow;
  const high = record.estimate.potentiallyDeployableHigh;
  if (low !== null && high !== null) {
    return {
      amount:
        low === high
          ? compactMoney(low, record.currency)
          : `${compactMoney(low, record.currency)}–${compactMoney(high, record.currency)}`,
      basis: "Estimated proceeds",
    };
  }
  if (record.reportedTransactionValue !== null) {
    return {
      amount: compactMoney(record.reportedTransactionValue, record.currency),
      basis: "Reported deal value",
    };
  }
  return { amount: "Not disclosed", basis: undisclosedReason(record) };
}

function searchableText(record: MoneyMotionRecord) {
  return [
    recordName(record),
    record.company,
    record.person,
    record.seller,
    record.buyer,
    record.asset,
    record.title,
    record.summary,
    record.industry,
    eventLabel(record.eventType),
    place(record),
    ...record.evidence.flatMap((evidence) => [
      evidence.publisher,
      evidence.title,
    ]),
  ]
    .join(" ")
    .toLowerCase();
}

function compareNullable(
  left: string | number | null,
  right: string | number | null,
  direction: SortDirection,
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  const comparison =
    typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right));
  return direction === "asc" ? comparison : -comparison;
}

function sortValue(record: MoneyMotionRecord, key: SortKey) {
  if (key === "name") return recordName(record).toLowerCase();
  if (key === "proceeds") return amountValue(record);
  if (key === "location") return place(record).toLowerCase();
  if (key === "date") return record.eventDate || record.publishedAt || null;
  if (key === "type") return eventLabel(record.eventType).toLowerCase();
  return (record.summary || record.title).toLowerCase();
}

export function PeopleInMotionView({
  snapshot,
  query: controlledQuery,
  onQuery,
  onOpenRecord,
}: {
  snapshot: MoneyMotionSnapshot;
  query?: string;
  onQuery?: (value: string) => void;
  onOpenRecord: (record: MoneyMotionRecord) => void;
}) {
  const [localQuery, setLocalQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [eventType, setEventType] = useState("");
  const [dateWindow, setDateWindow] = useState("");
  const [minimum, setMinimum] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "date",
    direction: "desc",
  });
  const [visibleCount, setVisibleCount] = useState(50);
  const query = controlledQuery ?? localQuery;

  const resetVisibleCount = () => setVisibleCount(50);
  const setQuery = (value: string) => {
    resetVisibleCount();
    if (onQuery) onQuery(value);
    else setLocalQuery(value);
  };

  const eventTypes = useMemo(
    () =>
      [...new Set(snapshot.records.map((record) => record.eventType))].sort(
        (left, right) => eventLabel(left).localeCompare(eventLabel(right)),
      ),
    [snapshot.records],
  );

  const records = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedLocation = locationQuery.trim().toLowerCase();
    const threshold = dateWindow
      ? Date.parse(snapshot.generatedAt) - Number(dateWindow) * 86_400_000
      : 0;
    return snapshot.records
      .filter((record) => {
        const recordDate = Date.parse(
          `${(record.eventDate || record.publishedAt).slice(0, 10)}T00:00:00Z`,
        );
        if (eventType && record.eventType !== eventType) return false;
        if (
          normalizedQuery &&
          !searchableText(record).includes(normalizedQuery)
        )
          return false;
        if (
          normalizedLocation &&
          !place(record).toLowerCase().includes(normalizedLocation)
        )
          return false;
        if (
          threshold &&
          (!Number.isFinite(recordDate) || recordDate < threshold)
        )
          return false;
        if (
          minimum &&
          (amountValue(record) === null ||
            amountValue(record)! < Number(minimum))
        )
          return false;
        return true;
      })
      .sort((left, right) => {
        const comparison = compareNullable(
          sortValue(left, sort.key),
          sortValue(right, sort.key),
          sort.direction,
        );
        return comparison || left.id.localeCompare(right.id);
      });
  }, [snapshot, query, locationQuery, eventType, dateWindow, minimum, sort]);

  const visibleRecords = records.slice(0, visibleCount);
  const recordsWithAmounts = records.filter(
    (record) => amountValue(record) !== null,
  ).length;

  const toggleSort = (key: SortKey) => {
    resetVisibleCount();
    setSort((current) => ({
      key,
      direction:
        current.key === key
          ? current.direction === "asc"
            ? "desc"
            : "asc"
          : key === "date" || key === "proceeds"
            ? "desc"
            : "asc",
    }));
  };

  const sortHeading = (key: SortKey, label: string) => (
    <button
      type="button"
      className={sort.key === key ? "active" : ""}
      onClick={() => toggleSort(key)}
      aria-label={`Sort by ${label} ${
        sort.key === key && sort.direction === "asc"
          ? "descending"
          : "ascending"
      }`}
    >
      {label}
      <b aria-hidden="true">
        {sort.key === key ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
      </b>
    </button>
  );

  return (
    <>
      <section
        className="people-motion-controls real-people-controls unified-directory-controls sales-directory-controls"
        aria-label="Capital directory filters"
      >
        <label className="people-motion-search">
          <span>Name, company, or event</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search names, companies, descriptions, or sources…"
            aria-label="Search capital events"
          />
        </label>
        <label>
          <span>Location</span>
          <input
            value={locationQuery}
            onChange={(event) => {
              setLocationQuery(event.target.value);
              resetVisibleCount();
            }}
            placeholder="City, state, or country"
            aria-label="Search event locations"
          />
        </label>
        <label>
          <span>Type</span>
          <select
            aria-label="Type"
            value={eventType}
            onChange={(event) => {
              setEventType(event.target.value);
              resetVisibleCount();
            }}
          >
            <option value="">All event types</option>
            {eventTypes.map((item) => (
              <option key={item} value={item}>
                {eventLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Date</span>
          <select
            aria-label="Date range"
            value={dateWindow}
            onChange={(event) => {
              setDateWindow(event.target.value);
              resetVisibleCount();
            }}
          >
            <option value="">All dates</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
            <option value="1095">Last 3 years</option>
          </select>
        </label>
        <label>
          <span>Proceeds</span>
          <select
            aria-label="Minimum proceeds"
            value={minimum}
            onChange={(event) => {
              setMinimum(event.target.value);
              resetVisibleCount();
            }}
          >
            <option value="">Any or undisclosed</option>
            <option value="1000000">$1M+</option>
            <option value="5000000">$5M+</option>
            <option value="25000000">$25M+</option>
            <option value="100000000">$100M+</option>
          </select>
        </label>
      </section>

      <div className="people-motion-result-bar unified-result-bar">
        <strong>{records.length.toLocaleString()} capital events</strong>
        <span>
          {recordsWithAmounts.toLocaleString()} with a public or estimated value
          · sorted by {sort.key}{" "}
          {sort.direction === "asc" ? "ascending" : "descending"}
        </span>
      </div>

      <section
        className="people-motion-table real-people-directory unified-directory-table sales-directory-table"
        aria-label="Capital directory results"
      >
        <div className="people-motion-row real-people-row heading sales-directory-row">
          <span>{sortHeading("name", "Name")}</span>
          <span>{sortHeading("proceeds", "Proceeds")}</span>
          <span>{sortHeading("location", "Location")}</span>
          <span>{sortHeading("date", "Date")}</span>
          <span>{sortHeading("type", "Type")}</span>
          <span>{sortHeading("event", "Event description")}</span>
        </div>
        {visibleRecords.map((record) => {
          const amount = proceeds(record);
          const name = recordName(record);
          return (
            <div
              className="people-motion-row real-people-row sales-directory-row"
              key={record.id}
              data-event-date={record.eventDate || record.publishedAt}
              data-proceeds={amountValue(record) ?? ""}
            >
              <span>
                <button
                  className="sales-directory-name-button"
                  type="button"
                  onClick={() => onOpenRecord(record)}
                  aria-label={`Open profile for ${name}`}
                >
                  <strong>{name}</strong>
                  <small>View full profile →</small>
                </button>
              </span>
              <span>
                <strong>{amount.amount}</strong>
                <small>{amount.basis}</small>
              </span>
              <span>
                <strong>{place(record)}</strong>
              </span>
              <span>
                <strong>
                  {dateLabel(record.eventDate || record.publishedAt)}
                </strong>
              </span>
              <span>
                <strong>{eventLabel(record.eventType)}</strong>
              </span>
              <span>
                <button
                  className="sales-directory-event-button"
                  type="button"
                  onClick={() => onOpenRecord(record)}
                  aria-label={`Open event details for ${record.title}`}
                >
                  <strong>{record.title}</strong>
                  {record.summary && record.summary !== record.title && (
                    <small>{record.summary}</small>
                  )}
                </button>
              </span>
            </div>
          );
        })}
        {!records.length && (
          <div className="people-motion-empty">
            <strong>No capital events match these filters.</strong>
            <p>
              Try another name, location, date range, amount, or event type.
            </p>
          </div>
        )}
      </section>

      {visibleRecords.length < records.length && (
        <button
          className="motion-load-more"
          type="button"
          onClick={() => setVisibleCount((count) => count + 50)}
        >
          Load 50 more
        </button>
      )}
    </>
  );
}

export function MotionRecordProfile({
  snapshot,
  record,
  onBack,
}: {
  snapshot: MoneyMotionSnapshot;
  record: MoneyMotionRecord;
  onBack: () => void;
}) {
  const name = recordName(record);
  const related = snapshot.records
    .filter((candidate) => {
      if (record.person) {
        return candidate.person.toLowerCase() === record.person.toLowerCase();
      }
      const company = record.company || record.seller;
      return Boolean(
        company &&
        [candidate.company, candidate.seller, candidate.buyer]
          .map((value) => value.toLowerCase())
          .includes(company.toLowerCase()),
      );
    })
    .sort((left, right) =>
      (right.eventDate || right.publishedAt).localeCompare(
        left.eventDate || left.publishedAt,
      ),
    );
  const evidence = [
    ...new Map(
      related
        .flatMap((candidate) => candidate.evidence)
        .map((item) => [item.sourceUrl, item]),
    ).values(),
  ];
  const amount = proceeds(record);
  const estimatedEvents = related.filter(
    (candidate) => candidate.estimate.potentiallyDeployableHigh !== null,
  );
  const completedEvents = related.filter((candidate) =>
    ["CLOSED", "POST_LIQUIDITY"].includes(candidate.stage),
  );
  const sources = [...new Set(evidence.map((item) => item.publisher))];

  return (
    <>
      <button type="button" className="real-profile-back" onClick={onBack}>
        ← Capital directory
      </button>

      <div className="real-profile-top-stack">
        <section className="real-person-profile-hero">
          <div className="real-person-profile-identity">
            <span>
              {name
                .split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase() || "PR"}
            </span>
            <div>
              <p className="eyebrow">Evidence-linked capital profile</p>
              <div>
                <h1>{name}</h1>
                <b>{record.confidence.total}% confidence</b>
              </div>
              <p>
                {eventLabel(record.eventType)} ·{" "}
                {record.company || record.seller || "Company not established"} ·{" "}
                {place(record)}. Latest public event{" "}
                {dateLabel(record.eventDate || record.publishedAt)}.
              </p>
            </div>
          </div>
          <div className="real-person-profile-summary">
            <span>{amount.basis}</span>
            <strong>{amount.amount}</strong>
            <small>
              {stageLabel(record.stage)} · {record.estimate.classification}
            </small>
            {record.evidence[0] && (
              <a
                href={record.evidence[0].sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open supporting record ↗
              </a>
            )}
          </div>
        </section>

        <div className="real-profile-disclosure">
          <strong>Public-event evidence, not a bank balance</strong>
          <p>
            Values appear only when a public source reports consideration or the
            record supports an attributable estimate. Patent assignments,
            transportation dockets, and regulatory notices often confirm a
            transfer without disclosing price.
          </p>
        </div>

        <section
          className="real-profile-kpis"
          aria-label="Capital profile summary"
        >
          <article>
            <span>Selected event value</span>
            <strong>{amount.amount}</strong>
            <small>{amount.basis}</small>
          </article>
          <article>
            <span>Public events</span>
            <strong>{related.length.toLocaleString()}</strong>
            <small>{completedEvents.length} completed</small>
          </article>
          <article>
            <span>Events with estimates</span>
            <strong>{estimatedEvents.length.toLocaleString()}</strong>
            <small>Unsupported values remain undisclosed</small>
          </article>
          <article>
            <span>Public sources</span>
            <strong>{sources.length.toLocaleString()}</strong>
            <small>
              {sources.slice(0, 2).join(" · ") || "Not established"}
            </small>
          </article>
        </section>
      </div>

      <section className="real-profile-layout motion-record-profile-layout">
        <div className="real-profile-primary">
          <article className="real-profile-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Capital-event ledger</p>
                <h2>Public capital events</h2>
              </div>
              <span>{related.length} records</span>
            </div>
            <div className="real-liquidity-ledger motion-record-ledger">
              <div className="real-liquidity-ledger-row heading">
                <span>Event and date</span>
                <span>Public value</span>
                <span>Description</span>
                <span>Evidence</span>
              </div>
              {related.map((candidate) => {
                const candidateAmount = proceeds(candidate);
                return (
                  <a
                    className="real-liquidity-ledger-row"
                    key={candidate.id}
                    href={candidate.evidence[0]?.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>
                      <strong>{eventLabel(candidate.eventType)}</strong>
                      <small>
                        {dateLabel(
                          candidate.eventDate || candidate.publishedAt,
                        )}{" "}
                        · {stageLabel(candidate.stage)}
                      </small>
                    </span>
                    <span>
                      <strong>{candidateAmount.amount}</strong>
                      <small>{candidateAmount.basis}</small>
                    </span>
                    <span>
                      <strong>{candidate.title}</strong>
                      <small>{candidate.summary}</small>
                    </span>
                    <b>
                      {candidate.evidence[0]?.publisher || "Public record"} ↗
                    </b>
                  </a>
                );
              })}
            </div>
          </article>

          <article className="real-profile-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Source record</p>
                <h2>Evidence links</h2>
              </div>
              <span>{evidence.length} records</span>
            </div>
            <div className="motion-evidence-list">
              {evidence.map((item) => (
                <a
                  key={item.sourceUrl}
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>
                    {item.publisher} · {dateLabel(item.publishedAt)}
                  </span>
                  <strong>{item.title}</strong>
                  <small>{item.classification} · Open evidence ↗</small>
                </a>
              ))}
            </div>
          </article>
        </div>

        <aside className="real-profile-secondary">
          <article className="real-profile-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Profile facts</p>
                <h2>Observed event details</h2>
              </div>
            </div>
            <dl className="real-profile-facts">
              <div>
                <dt>Name</dt>
                <dd>{name}</dd>
              </div>
              <div>
                <dt>Company</dt>
                <dd>{record.company || "Not established"}</dd>
              </div>
              <div>
                <dt>Seller / target</dt>
                <dd>{record.seller || "Not established"}</dd>
              </div>
              <div>
                <dt>Buyer</dt>
                <dd>{record.buyer || "Not established"}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>
                  {place(record)}
                  <small>{record.location.basis}</small>
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{stageLabel(record.stage)}</dd>
              </div>
            </dl>
          </article>

          <article className="real-profile-panel real-profile-limit">
            <p className="eyebrow">Value coverage</p>
            <h2>Why an amount may be missing</h2>
            <ul>
              <li>USPTO assignment records usually omit consideration</li>
              <li>STB dockets often describe control or review, not price</li>
              <li>FTC regulatory notices generally omit transaction value</li>
              <li>No synthetic value is inserted when a source is silent</li>
            </ul>
          </article>
        </aside>
      </section>
    </>
  );
}
