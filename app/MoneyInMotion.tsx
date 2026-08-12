"use client";

import { useMemo, useState } from "react";
import {
  EVENT_STAGES,
  EVENT_TYPES,
  type MoneyMotionRecord,
  type MoneyMotionSnapshot,
} from "../lib/money-in-motion";

type MotionView = "money" | "pre" | "closed" | "monitor";
type Mode = "high" | "all" | "pre" | "confirmed";

const stageLabels: Record<MoneyMotionRecord["stage"], string> = {
  WATCHING: "Watching",
  PRE_SALE: "Proposed",
  ANNOUNCED: "Announced",
  PENDING_REGULATORY: "Pending review",
  CLOSED: "Completed",
  POST_LIQUIDITY: "Completed",
  UNKNOWN: "Unclear",
};

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

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function fullMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function bytesLabel(value: number) {
  if (value < 1_000_000) return `${Math.round(value / 1_000)} KB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
}

function dateLabel(value: string) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function place(record: MoneyMotionRecord) {
  return (
    [record.location.country, record.location.state, record.location.city]
      .filter(Boolean)
      .join(" · ") || "Location not established"
  );
}

function amountLabel(record: MoneyMotionRecord) {
  const low = record.estimate.potentiallyDeployableLow;
  const high = record.estimate.potentiallyDeployableHigh;
  if (low !== null && high !== null) {
    return {
      eyebrow: "Estimated proceeds",
      amount:
        low === high
          ? money(low, record.currency)
          : `${money(low, record.currency)}–${money(high, record.currency)}`,
      kind: record.estimate.classification,
    };
  }
  if (record.reportedTransactionValue !== null) {
    return {
      eyebrow: "Reported value",
      amount: money(record.reportedTransactionValue, record.currency),
      kind: record.transactionValueClassification,
    };
  }
  return {
    eyebrow: "Amount",
    amount: "Not disclosed",
    kind: "UNKNOWN",
  };
}

export function EvidenceDrawer({
  record,
  onClose,
}: {
  record: MoneyMotionRecord;
  onClose: () => void;
}) {
  const estimate = record.estimate;
  return (
    <div
      className="motion-drawer-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <aside
        className="motion-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Evidence for ${record.title}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>
              {stageLabels[record.stage]} · {titleCase(record.eventType)}
            </span>
            <h2>{record.person || record.company || record.title}</h2>
            <p>{record.title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close evidence">
            ×
          </button>
        </header>

        <section className="motion-drawer-section">
          <h3>Transaction</h3>
          <dl className="motion-facts">
            <div>
              <dt>Seller / target</dt>
              <dd>{record.seller || "Not identified"}</dd>
            </div>
            <div>
              <dt>Buyer</dt>
              <dd>{record.buyer || "Not identified"}</dd>
            </div>
            <div>
              <dt>Event date</dt>
              <dd>{dateLabel(record.eventDate)}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{place(record)}</dd>
            </div>
            <div>
              <dt>Transaction value</dt>
              <dd>
                {record.reportedTransactionValue === null
                  ? "Not disclosed"
                  : fullMoney(
                      record.reportedTransactionValue,
                      record.currency,
                    )}{" "}
                <small>{record.transactionValueClassification}</small>
              </dd>
            </div>
          </dl>
        </section>

        <section className="motion-drawer-section">
          <h3>Ownership and valuation</h3>
          {estimate.grossAttributableLow === null ? (
            <div className="motion-unknown-box">
              <strong>No personal amount calculated</strong>
              <p>{estimate.methodology}</p>
            </div>
          ) : (
            <dl className="motion-facts">
              <div>
                <dt>Gross attributable value</dt>
                <dd>
                  {fullMoney(estimate.grossAttributableLow, record.currency)}–
                  {fullMoney(estimate.grossAttributableHigh!, record.currency)}
                </dd>
              </div>
              <div>
                <dt>Potentially deployable proceeds</dt>
                <dd>
                  {fullMoney(
                    estimate.potentiallyDeployableLow!,
                    record.currency,
                  )}
                  –
                  {fullMoney(
                    estimate.potentiallyDeployableHigh!,
                    record.currency,
                  )}{" "}
                  <small>{estimate.classification}</small>
                </dd>
              </div>
            </dl>
          )}
          <p>{estimate.methodology}</p>
          <code>{estimate.calculation}</code>
        </section>

        <section className="motion-drawer-section">
          <h3>Confidence · {record.confidence.total}/100</h3>
          <div className="motion-confidence-grid">
            <span>
              Source <b>{record.confidence.sourceReliability}/25</b>
            </span>
            <span>
              Transaction <b>{record.confidence.transactionCertainty}/25</b>
            </span>
            <span>
              Identity <b>{record.confidence.identityMatch}/20</b>
            </span>
            <span>
              Ownership <b>{record.confidence.ownershipCertainty}/15</b>
            </span>
            <span>
              Valuation <b>{record.confidence.valuationCertainty}/15</b>
            </span>
          </div>
          <ul>
            {record.confidence.explanation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="motion-drawer-section">
          <h3>Actionability · {record.actionability.total}/100</h3>
          <p>
            Actionability ranks timing and outreach relevance. It is separate
            from evidence confidence.
          </p>
          <div className="motion-confidence-grid">
            <span>
              Magnitude <b>{record.actionability.magnitude}/30</b>
            </span>
            <span>
              Recency <b>{record.actionability.recency}/20</b>
            </span>
            <span>
              Pre-close timing <b>{record.actionability.preCloseTiming}/15</b>
            </span>
            <span>
              Ownership <b>{record.actionability.ownershipCertainty}/15</b>
            </span>
            <span>
              Private market <b>{record.actionability.privateMarket}/10</b>
            </span>
            <span>
              Corroboration <b>{record.actionability.sourceCorroboration}/10</b>
            </span>
          </div>
          <dl className="motion-facts">
            <div>
              <dt>First signal</dt>
              <dd>{dateLabel(record.leadTime.firstSignalAt)}</dd>
            </div>
            <div>
              <dt>First pre-sale signal</dt>
              <dd>{dateLabel(record.leadTime.firstPreSaleSignalAt)}</dd>
            </div>
            <div>
              <dt>Regulatory filing</dt>
              <dd>{dateLabel(record.leadTime.regulatoryFilingAt)}</dd>
            </div>
            <div>
              <dt>Closed</dt>
              <dd>{dateLabel(record.leadTime.closedAt)}</dd>
            </div>
            <div>
              <dt>Observed lead time</dt>
              <dd>
                {record.leadTime.leadDaysToClose === null
                  ? "Not yet measurable"
                  : `${record.leadTime.leadDaysToClose} days`}
              </dd>
            </div>
            <div>
              <dt>Independent sources</dt>
              <dd>{record.independentSourceCount}</dd>
            </div>
          </dl>
        </section>

        <section className="motion-drawer-section">
          <h3>Source timeline</h3>
          <div className="motion-evidence-list">
            {record.evidence.map((evidence) => (
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
                {evidence.excerpt && <p>{evidence.excerpt}</p>}
                <small>{evidence.classification} · Open evidence ↗</small>
              </a>
            ))}
          </div>
        </section>

        <section className="motion-drawer-section motion-caution">
          <h3>Uncertainties and permitted use</h3>
          <ul>
            {estimate.uncertainty.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>
            No home-address lead generation, protected-trait inference, or
            eligibility use. Public business and filing locations may be care-of
            addresses.
          </p>
          <a href="mailto:corrections@liquidityradar.example?subject=Liquidity%20Radar%20record%20correction">
            Request correction, suppression, or source removal
          </a>
        </section>
      </aside>
    </div>
  );
}

function SourceMonitor({ snapshot }: { snapshot: MoneyMotionSnapshot }) {
  const healthy = snapshot.sourceHealth.filter(
    (source) => source.mode === "LIVE" && !source.error,
  ).length;
  return (
    <>
      <section className="motion-monitor-summary">
        <div>
          <span>Live and healthy</span>
          <strong>{healthy}</strong>
        </div>
        <div>
          <span>Needs configuration / import</span>
          <strong>
            {
              snapshot.sourceHealth.filter(
                (source) =>
                  source.mode === "IMPORT_ONLY" ||
                  source.mode === "CONFIGURATION_REQUIRED",
              ).length
            }
          </strong>
        </div>
        <div>
          <span>Private-company events</span>
          <strong>
            {snapshot.stats.privateCompanyEvents.toLocaleString()}
          </strong>
        </div>
        <div>
          <span>Last snapshot</span>
          <strong>{dateLabel(snapshot.generatedAt)}</strong>
        </div>
      </section>
      <div className="motion-policy-note">
        <strong>Source boundaries are intentional.</strong>
        <p>
          “Import only” means an official export, licensed feed, or
          user-provided file is required. Liquidity Radar does not bypass
          paywalls, logins, rate limits, robots controls, or registry access
          controls.
        </p>
      </div>
      <section className="motion-source-table" aria-label="Source health">
        <div className="motion-source-row heading">
          <span>Source</span>
          <span>Mode / cadence</span>
          <span>Last success</span>
          <span>Accepted</span>
          <span>Status</span>
        </div>
        {snapshot.sourceHealth.map((source) => (
          <div className="motion-source-row" key={source.id}>
            <span>
              <strong>{source.name}</strong>
              <small>{source.publisher}</small>
            </span>
            <span>
              <b className={`motion-mode ${source.mode.toLowerCase()}`}>
                {source.mode.replaceAll("_", " ")}
              </b>
              <small>{source.cadence}</small>
            </span>
            <span>
              {source.lastSuccessAt
                ? dateLabel(source.lastSuccessAt)
                : "Not run"}
              <small>
                {source.latencyMs === null
                  ? ""
                  : `${source.latencyMs.toLocaleString()} ms`}
              </small>
            </span>
            <span>
              {source.recordsAccepted.toLocaleString()}
              <small>{source.recordsRejected.toLocaleString()} rejected</small>
              <small>
                {source.value.uniqueTransactionClusters.toLocaleString()}{" "}
                clusters
              </small>
            </span>
            <span className={source.error ? "has-error" : ""}>
              {source.error ||
                (source.mode === "LIVE" ? "Healthy" : source.reason)}
              <small className="motion-source-value">
                {source.value.namedPeopleResolved.toLocaleString()} people ·{" "}
                {source.value.eventsWithOwnershipEvidence.toLocaleString()}{" "}
                ownership ·{" "}
                {source.value.eventsWithReportedValuation.toLocaleString()}{" "}
                values · {source.value.preLiquiditySignals.toLocaleString()}{" "}
                pre-close
              </small>
              {source.details?.currentFile && (
                <small>
                  {source.details.currentFile}
                  {typeof source.details.bytesDownloaded === "number" &&
                  source.details.bytesDownloaded > 0
                    ? ` · ${bytesLabel(source.details.bytesDownloaded)} downloaded`
                    : ""}
                  {typeof source.details.recordsProcessed === "number" &&
                  source.details.recordsProcessed > 0
                    ? ` · ${source.details.recordsProcessed.toLocaleString()} processed`
                    : ""}
                  {source.details.currentCheckpoint
                    ? ` · ${source.details.currentCheckpoint.toLowerCase()}`
                    : ""}
                </small>
              )}
              {source.nextRetryAt && (
                <small>Next retry {dateLabel(source.nextRetryAt)}</small>
              )}
              {source.sourceUrl && (
                <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                  Official source ↗
                </a>
              )}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}

export function MoneyInMotionView({
  snapshot,
  view,
}: {
  snapshot: MoneyMotionSnapshot;
  view: MotionView;
}) {
  const defaultMode: Mode =
    view === "pre" ? "pre" : view === "closed" ? "confirmed" : "all";
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [eventType, setEventType] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [industry, setIndustry] = useState("");
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const [dateWindow, setDateWindow] = useState("365");
  const [confidence, setConfidence] = useState("0");
  const [source, setSource] = useState("");
  const [subjectKind, setSubjectKind] = useState("");
  const [marketClass, setMarketClass] = useState("");
  const [selected, setSelected] = useState<MoneyMotionRecord | null>(null);

  const options = useMemo(() => {
    const locations = new Set<string>();
    const industries = new Set<string>();
    const sources = new Set<string>();
    for (const record of snapshot.records) {
      if (record.location.state) locations.add(record.location.state);
      else if (record.location.country) locations.add(record.location.country);
      if (record.industry) industries.add(record.industry);
      record.evidence.forEach((item) => sources.add(item.sourceId));
    }
    return {
      locations: [...locations].sort(),
      industries: [...industries].sort(),
      sources: [...sources].sort(),
    };
  }, [snapshot.records]);

  const records = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const thresholdDate = dateWindow
      ? Date.parse(snapshot.generatedAt) - Number(dateWindow) * 86_400_000
      : 0;
    return snapshot.records.filter((record) => {
      const value =
        record.estimate.potentiallyDeployableHigh ??
        record.reportedTransactionValue ??
        0;
      const eventTime = new Date(
        `${record.eventDate.slice(0, 10)}T00:00:00Z`,
      ).getTime();
      if (mode === "high" && record.confidence.total < 75) return false;
      if (
        mode === "pre" &&
        !["WATCHING", "PRE_SALE", "ANNOUNCED", "PENDING_REGULATORY"].includes(
          record.stage,
        )
      )
        return false;
      if (
        mode === "confirmed" &&
        !["CLOSED", "POST_LIQUIDITY"].includes(record.stage)
      )
        return false;
      if (
        normalizedQuery &&
        ![
          record.person,
          record.company,
          record.seller,
          record.buyer,
          record.title,
          record.summary,
          record.asset,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      )
        return false;
      if (stage && record.stage !== stage) return false;
      if (eventType && record.eventType !== eventType) return false;
      if (
        locationFilter &&
        ![record.location.state, record.location.country].includes(
          locationFilter,
        )
      )
        return false;
      if (industry && record.industry !== industry) return false;
      if (minimum && value < Number(minimum)) return false;
      if (maximum && value > Number(maximum)) return false;
      if (
        thresholdDate &&
        (!Number.isFinite(eventTime) || eventTime < thresholdDate)
      )
        return false;
      if (record.confidence.total < Number(confidence)) return false;
      if (source && !record.evidence.some((item) => item.sourceId === source))
        return false;
      if (subjectKind && record.subjectKind !== subjectKind) return false;
      if (marketClass && record.marketClass !== marketClass) return false;
      return true;
    });
  }, [
    snapshot.records,
    snapshot.generatedAt,
    mode,
    query,
    stage,
    eventType,
    locationFilter,
    industry,
    minimum,
    maximum,
    dateWindow,
    confidence,
    source,
    subjectKind,
    marketClass,
  ]);

  if (view === "monitor") return <SourceMonitor snapshot={snapshot} />;

  return (
    <>
      <div className="motion-disclaimer">
        <strong>Estimate, not a bank balance.</strong> {snapshot.disclaimer}
      </div>
      <div
        className="motion-modes"
        role="tablist"
        aria-label="Signal confidence mode"
      >
        {(
          [
            ["high", "Best matches", "75+ confidence"],
            [
              "all",
              "All events",
              `${snapshot.stats.records.toLocaleString()} records`,
            ],
            ["pre", "Upcoming", "Watching through pending"],
            ["confirmed", "Completed", "Closed public records"],
          ] as Array<[Mode, string, string]>
        ).map(([value, label, detail]) => (
          <button
            key={value}
            type="button"
            className={mode === value ? "active" : ""}
            onClick={() => setMode(value)}
          >
            {label}
            <span>{detail}</span>
          </button>
        ))}
      </div>

      <section
        className="motion-filter-panel real-people-controls unified-directory-controls unified-event-controls"
        aria-label="Capital event filters"
      >
        <label className="motion-search">
          <span>Search people, companies, buyers, sellers, or assets</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search all capital events…"
          />
        </label>
        <label>
          <span>Stage</span>
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value)}
          >
            <option value="">All stages</option>
            {EVENT_STAGES.map((value) => (
              <option key={value} value={value}>
                {stageLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Type</span>
          <select
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
          >
            <option value="">All types</option>
            {EVENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {eventLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Location</span>
          <select
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
          >
            <option value="">All locations</option>
            {options.locations.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Industry</span>
          <select
            value={industry}
            onChange={(event) => setIndustry(event.target.value)}
          >
            <option value="">All industries</option>
            {options.industries.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <div className="value-range-filter">
          <span>Value range</span>
          <label>
            <span className="sr-only">Minimum value</span>
            <input
              type="number"
              min="0"
              step="100000"
              inputMode="numeric"
              aria-label="Minimum event value"
              placeholder="Min $"
              value={minimum}
              onChange={(event) => setMinimum(event.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">Maximum value</span>
            <input
              type="number"
              min="0"
              step="100000"
              inputMode="numeric"
              aria-label="Maximum event value"
              placeholder="Max $"
              value={maximum}
              onChange={(event) => setMaximum(event.target.value)}
            />
          </label>
        </div>
        <label>
          <span>Date</span>
          <select
            value={dateWindow}
            onChange={(event) => setDateWindow(event.target.value)}
          >
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
            <option value="">All dates</option>
          </select>
        </label>
        <label>
          <span>Confidence</span>
          <select
            value={confidence}
            onChange={(event) => setConfidence(event.target.value)}
          >
            <option value="0">Any confidence</option>
            <option value="50">50+</option>
            <option value="75">75+</option>
            <option value="90">90+</option>
          </select>
        </label>
        <label>
          <span>Source</span>
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            <option value="">All live sources</option>
            {options.sources.map((value) => (
              <option key={value} value={value}>
                {sourceLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Record type</span>
          <select
            value={subjectKind}
            onChange={(event) => setSubjectKind(event.target.value)}
          >
            <option value="">People and organizations</option>
            <option value="PERSON">Individuals</option>
            <option value="ORGANIZATION">Organizations</option>
            <option value="UNKNOWN">Unresolved</option>
          </select>
        </label>
        <label>
          <span>Market</span>
          <select
            value={marketClass}
            onChange={(event) => setMarketClass(event.target.value)}
          >
            <option value="">Private and public</option>
            <option value="PRIVATE">Private</option>
            <option value="PUBLIC">Public</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </label>
      </section>

      <div className="motion-results-heading unified-result-bar">
        <strong>{records.length.toLocaleString()} event matches</strong>
        <span>Same directory layout · public evidence retained</span>
      </div>
      <section className="motion-card-grid real-people-directory unified-event-directory">
        <div className="real-people-row heading unified-event-heading">
          <span>Person or company</span>
          <span>Status</span>
          <span>Event</span>
          <span>Amount</span>
          <span>Location</span>
          <span>Evidence</span>
        </div>
        {records.slice(0, 300).map((record) => {
          const amount = amountLabel(record);
          return (
            <article className="motion-card unified-event-row" key={record.id}>
              <div className="motion-card-top">
                <span className={`motion-stage ${record.stage.toLowerCase()}`}>
                  {stageLabels[record.stage]}
                </span>
                <span>{eventLabel(record.eventType)}</span>
              </div>
              <h2>
                {record.person ||
                  record.company ||
                  record.seller ||
                  record.title}
              </h2>
              {record.person && record.company && (
                <p className="motion-company">{record.company}</p>
              )}
              <p className="motion-title">{record.title}</p>
              <div className="motion-amount">
                <span>{amount.eyebrow}</span>
                <strong>{amount.amount}</strong>
                <small>{amount.kind}</small>
              </div>
              <div className="motion-card-facts">
                <span>{dateLabel(record.eventDate)}</span>
                <span>{place(record)}</span>
                <span>
                  {record.evidence.length} source record
                  {record.evidence.length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="motion-why">
                <strong>Why it’s here</strong>
                {record.whyHere}
              </p>
              <footer>
                <span>
                  <b>{record.confidence.total}</b>/100 confidence
                </span>
                <button type="button" onClick={() => setSelected(record)}>
                  View profile →
                </button>
              </footer>
            </article>
          );
        })}
      </section>
      {records.length > 300 && (
        <p className="motion-result-cap">
          Showing the first 300 results. Narrow the filters to inspect the
          remaining {records.length - 300} records.
        </p>
      )}
      {!records.length && (
        <div className="motion-empty">
          <strong>No records match these filters.</strong>
          <p>
            Widen the stage, date, or confidence criteria. Unknown values remain
            searchable when the minimum-value filter is unset.
          </p>
        </div>
      )}
      {selected && (
        <EvidenceDrawer record={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
