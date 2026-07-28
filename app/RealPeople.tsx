"use client";

import { useMemo, useState } from "react";
import type {
  PublicDataSnapshot,
  PublicHoldingPosition,
  PublicLiquidityEvent,
  SecFiling,
} from "../lib/public-data";

export type LiquidityRange = {
  low: number;
  median: number;
  high: number;
};

export type RealPersonRecord = {
  id: string;
  name: string;
  kind: "Person" | "Entity";
  initials: string;
  issuers: string[];
  forms: string[];
  filings: SecFiling[];
  liquidityEvents: PublicLiquidityEvent[];
  holdings: PublicHoldingPosition[];
  grossCompletedSales: number;
  grossPurchases: number;
  proposedSaleValue: number;
  estimatedNetProceeds: LiquidityRange;
  estimatedUnobservedDeployment: LiquidityRange;
  estimatedRemainingLiquidity: LiquidityRange;
  estimatedPortfolioValue: number;
  confidence: number;
  relationship: string;
  location: string;
  lastLiquidityDate: string;
  lastFiledAt: string;
  archiveEntityId: string;
};

const netRetention = { low: 0.48, median: 0.63, high: 0.78 };
const annualUnobservedRetention = { low: 0.72, median: 0.86, high: 0.96 };

function daysBetween(from: string, to: string) {
  const fromDate = new Date(`${from.slice(0, 10)}T00:00:00Z`).getTime();
  const toDate = new Date(`${to.slice(0, 10)}T00:00:00Z`).getTime();
  if (!Number.isFinite(fromDate) || !Number.isFinite(toDate)) return 0;
  return Math.max(0, (toDate - fromDate) / 86_400_000);
}

export function estimateLiquidity(
  events: PublicLiquidityEvent[],
  asOfDate: string,
) {
  const sales = events.filter(
    (event) => event.eventType === "completed_public_share_sale",
  );
  const purchases = events.filter(
    (event) => event.eventType === "completed_public_share_purchase",
  );
  const grossCompletedSales = sales.reduce(
    (sum, event) => sum + event.grossAmount,
    0,
  );
  const grossPurchases = purchases.reduce(
    (sum, event) => sum + event.grossAmount,
    0,
  );
  const estimatedNetProceeds: LiquidityRange = {
    low: grossCompletedSales * netRetention.low,
    median: grossCompletedSales * netRetention.median,
    high: grossCompletedSales * netRetention.high,
  };
  const retainedBeforePurchases = sales.reduce<LiquidityRange>(
    (range, event) => {
      const years = daysBetween(event.transactionDate, asOfDate) / 365.25;
      range.low +=
        event.grossAmount *
        netRetention.low *
        annualUnobservedRetention.low ** years;
      range.median +=
        event.grossAmount *
        netRetention.median *
        annualUnobservedRetention.median ** years;
      range.high +=
        event.grossAmount *
        netRetention.high *
        annualUnobservedRetention.high ** years;
      return range;
    },
    { low: 0, median: 0, high: 0 },
  );
  const estimatedRemainingLiquidity: LiquidityRange = {
    low: Math.max(0, retainedBeforePurchases.low - grossPurchases),
    median: Math.max(0, retainedBeforePurchases.median - grossPurchases),
    high: Math.max(0, retainedBeforePurchases.high - grossPurchases),
  };
  const estimatedUnobservedDeployment: LiquidityRange = {
    low: Math.max(0, estimatedNetProceeds.low - retainedBeforePurchases.low),
    median: Math.max(
      0,
      estimatedNetProceeds.median - retainedBeforePurchases.median,
    ),
    high: Math.max(0, estimatedNetProceeds.high - retainedBeforePurchases.high),
  };

  return {
    grossCompletedSales,
    grossPurchases,
    estimatedNetProceeds,
    estimatedUnobservedDeployment,
    estimatedRemainingLiquidity,
  };
}

function entityKind(name: string): RealPersonRecord["kind"] {
  return /\b(LLC|L\.L\.C\.|INC|CORP|LTD|LP|L\.P\.|TRUST|GRAT|IRREVOCABLE|FOUNDATION|FUND|CAPITAL|PARTNERS|HOLDINGS)\b/i.test(
    name,
  )
    ? "Entity"
    : "Person";
}

function initials(name: string) {
  return name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function recordId(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function archiveEntityId(url: string) {
  return url.match(/\/data\/(\d+)\//)?.[1] ?? "Not available";
}

export function buildRealPeople(data: PublicDataSnapshot): RealPersonRecord[] {
  const names = new Map<string, string>();

  for (const filing of data.sec.filings) {
    const name = filing.reportingParty.trim();
    if (!name) continue;
    names.set(name.toLocaleLowerCase(), name);
  }
  for (const event of data.liquidity?.events ?? []) {
    if (event.reportingParty.trim())
      names.set(event.reportingParty.toLocaleLowerCase(), event.reportingParty);
  }
  for (const holding of data.liquidity?.holdings ?? []) {
    if (holding.reportingParty.trim())
      names.set(
        holding.reportingParty.toLocaleLowerCase(),
        holding.reportingParty,
      );
  }

  return [...names.entries()]
    .map(([key, name]) => {
      const filings = data.sec.filings.filter(
        (filing) => filing.reportingParty.toLocaleLowerCase() === key,
      );
      const ordered = [...filings].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
      const liquidityEvents = (data.liquidity?.events ?? []).filter(
        (event) => event.reportingParty.toLocaleLowerCase() === key,
      );
      const holdings = (data.liquidity?.holdings ?? []).filter(
        (holding) => holding.reportingParty.toLocaleLowerCase() === key,
      );
      const estimate = estimateLiquidity(liquidityEvents, data.generatedAt);
      const proposedSaleValue = liquidityEvents
        .filter((event) => event.eventType === "proposed_public_share_sale")
        .reduce((sum, event) => sum + event.grossAmount, 0);
      const issuers = [
        ...new Set([
          ...ordered.map((filing) => filing.issuer),
          ...liquidityEvents.map((event) => event.issuer),
          ...holdings.map((holding) => holding.issuer),
        ]),
      ].filter(Boolean);
      const forms = [
        ...new Set([
          ...ordered.map((filing) => filing.form),
          ...liquidityEvents.map((event) => event.form),
        ]),
      ];
      const latestEvidence = [...liquidityEvents].sort((left, right) =>
        right.transactionDate.localeCompare(left.transactionDate),
      )[0];
      const latestLocation = liquidityEvents.find(
        (event) => event.location.city || event.location.state,
      )?.location;
      const estimatedPortfolioValue = holdings.reduce(
        (sum, holding) => sum + (holding.estimatedValue ?? 0),
        0,
      );
      const completedSaleCount = liquidityEvents.filter(
        (event) => event.eventType === "completed_public_share_sale",
      ).length;
      const confidence =
        completedSaleCount > 0
          ? Math.min(96, 86 + completedSaleCount * 2)
          : proposedSaleValue > 0
            ? 38
            : holdings.length
              ? 24
              : 15;
      return {
        id: `${recordId(name)}-${key.length}`,
        name,
        kind: entityKind(name),
        initials: initials(name),
        issuers,
        forms,
        filings: ordered,
        liquidityEvents,
        holdings,
        grossCompletedSales: estimate.grossCompletedSales,
        grossPurchases: estimate.grossPurchases,
        proposedSaleValue,
        estimatedNetProceeds: estimate.estimatedNetProceeds,
        estimatedUnobservedDeployment: estimate.estimatedUnobservedDeployment,
        estimatedRemainingLiquidity: estimate.estimatedRemainingLiquidity,
        estimatedPortfolioValue,
        confidence,
        relationship: latestEvidence?.relationship || "SEC reporting party",
        location: latestLocation
          ? [latestLocation.city, latestLocation.state, latestLocation.country]
              .filter(Boolean)
              .join(", ")
          : "Location not established",
        lastLiquidityDate:
          latestEvidence?.transactionDate || ordered[0]?.filedAt || "",
        lastFiledAt: ordered[0]?.filedAt || latestEvidence?.filingDate || "",
        archiveEntityId:
          latestEvidence?.reportingPartyCik ||
          holdings[0]?.reportingPartyCik ||
          (ordered[0] ? archiveEntityId(ordered[0].url) : "Not available"),
      };
    })
    .sort(
      (left, right) =>
        right.estimatedRemainingLiquidity.median -
          left.estimatedRemainingLiquidity.median ||
        right.proposedSaleValue - left.proposedSaleValue ||
        right.lastFiledAt.localeCompare(left.lastFiledAt),
    );
}

function displayDate(value: string) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function nameSort(value: string) {
  return value.toLocaleLowerCase();
}

function compactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function moneyRange(range: LiquidityRange) {
  return `${compactCurrency(range.low)}–${compactCurrency(range.high)}`;
}

export function RealPeopleDirectory({
  people,
  query,
  onQuery,
  onPerson,
}: {
  people: RealPersonRecord[];
  query: string;
  onQuery: (query: string) => void;
  onPerson: (person: RealPersonRecord) => void;
}) {
  const [evidence, setEvidence] = useState("All liquidity evidence");
  const [kind, setKind] = useState("People only");
  const [sort, setSort] = useState("Estimated liquidity");

  const filtered = useMemo(
    () =>
      people
        .filter((person) =>
          [person.name, ...person.issuers, ...person.forms]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
        )
        .filter((person) =>
          kind === "All reporting parties"
            ? true
            : kind === "People only"
              ? person.kind === "Person"
              : person.kind === "Entity",
        )
        .filter((person) => {
          if (evidence === "Completed sales")
            return person.grossCompletedSales > 0;
          if (evidence === "Proposed sales")
            return person.proposedSaleValue > 0;
          if (evidence === "Reported holdings")
            return person.holdings.length > 0;
          return true;
        })
        .sort((left, right) => {
          if (sort === "Estimated liquidity")
            return (
              right.estimatedRemainingLiquidity.median -
              left.estimatedRemainingLiquidity.median
            );
          if (sort === "Gross proceeds")
            return right.grossCompletedSales - left.grossCompletedSales;
          if (sort === "Most recent")
            return right.lastLiquidityDate.localeCompare(
              left.lastLiquidityDate,
            );
          return nameSort(left.name).localeCompare(nameSort(right.name));
        }),
    [evidence, kind, people, query, sort],
  );

  return (
    <>
      <section className="real-people-controls" aria-label="People filters">
        <label className="real-people-search">
          <span>Search real names and linked issuers</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search a person, reporting party, or company…"
            aria-label="Search people and reporting parties"
          />
        </label>
        <label>
          <span>Liquidity evidence</span>
          <select
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            aria-label="Filter people by liquidity evidence"
          >
            <option>All liquidity evidence</option>
            <option>Completed sales</option>
            <option>Proposed sales</option>
            <option>Reported holdings</option>
          </select>
        </label>
        <label>
          <span>Party type</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            aria-label="Filter by reporting party type"
          >
            <option>People only</option>
            <option>All reporting parties</option>
            <option>Entities only</option>
          </select>
        </label>
        <label>
          <span>Sort by</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label="Sort people"
          >
            <option>Estimated liquidity</option>
            <option>Gross proceeds</option>
            <option>Most recent</option>
            <option>Name</option>
          </select>
        </label>
        <div className="real-people-result-count">
          <strong>{filtered.length}</strong>
          <span>attributable result{filtered.length === 1 ? "" : "s"}</span>
        </div>
      </section>

      <section
        className="real-people-directory"
        aria-label="Real SEC reporting parties"
      >
        <div className="real-people-row heading">
          <span>Reporting party</span>
          <span>Linked issuer</span>
          <span>Completed gross proceeds</span>
          <span>Estimated remaining liquidity</span>
          <span>Latest evidence</span>
        </div>
        {filtered.map((person) => (
          <button
            type="button"
            className="real-people-row"
            key={person.id}
            onClick={() => onPerson(person)}
            aria-label={`Open profile for ${person.name}`}
          >
            <span className="real-person-cell">
              <i>{person.initials || "SEC"}</i>
              <span>
                <strong>{person.name}</strong>
                <small>{person.kind} · SEC reporting party</small>
              </span>
            </span>
            <span>
              <strong>{person.issuers[0]}</strong>
              <small>
                {person.issuers.length > 1
                  ? `+${person.issuers.length - 1} additional issuer`
                  : "Observed filing relationship"}
              </small>
            </span>
            <span>
              <strong>
                {person.grossCompletedSales > 0
                  ? compactCurrency(person.grossCompletedSales)
                  : "No completed sale"}
              </strong>
              <small>
                {person.proposedSaleValue > 0
                  ? `${compactCurrency(person.proposedSaleValue)} proposed`
                  : `${person.liquidityEvents.length} qualifying events`}
              </small>
            </span>
            <span>
              <strong>
                {person.grossCompletedSales > 0
                  ? moneyRange(person.estimatedRemainingLiquidity)
                  : "Not yet estimated"}
              </strong>
              <small>{person.confidence}% confidence</small>
            </span>
            <span>
              <strong>{displayDate(person.lastLiquidityDate)}</strong>
              <small>View profile →</small>
            </span>
          </button>
        ))}
        {!filtered.length && (
          <div className="real-people-empty">
            <strong>No reporting parties match this search.</strong>
            <span>Try a different name, issuer, or SEC form.</span>
          </div>
        )}
      </section>

      <p className="real-workspace-footnote">
        Completed gross proceeds are calculated from reported shares sold and
        transaction prices. Remaining liquidity is an estimated range after
        configurable tax, fee, known-purchase, and unobserved-deployment
        assumptions; it is not a bank balance.
      </p>
    </>
  );
}

function eventLabel(event: PublicLiquidityEvent) {
  if (event.eventType === "completed_public_share_sale")
    return "Completed public-share sale";
  if (event.eventType === "completed_public_share_purchase")
    return "Completed public-share purchase";
  return "Proposed public-share sale";
}

function eventRange(event: PublicLiquidityEvent) {
  return {
    low: event.grossAmount * netRetention.low,
    median: event.grossAmount * netRetention.median,
    high: event.grossAmount * netRetention.high,
  };
}

export function RealPersonProfile({
  person,
  people,
  onBack,
  onPerson,
}: {
  person: RealPersonRecord;
  people: RealPersonRecord[];
  onBack: () => void;
  onPerson: (person: RealPersonRecord) => void;
}) {
  const related = people
    .filter(
      (candidate) =>
        candidate.id !== person.id &&
        candidate.issuers.some((issuer) => person.issuers.includes(issuer)),
    )
    .slice(0, 8);
  const latestSource =
    person.liquidityEvents[0]?.sourceUrl || person.filings[0]?.url;

  return (
    <>
      <button type="button" className="real-profile-back" onClick={onBack}>
        ← People directory
      </button>

      <section className="real-person-profile-hero">
        <div className="real-person-profile-identity">
          <span>{person.initials || "SEC"}</span>
          <div>
            <p className="eyebrow">Evidence-linked liquidity profile</p>
            <div>
              <h1>{person.name}</h1>
              <b>{person.confidence}% confidence</b>
            </div>
            <p>
              {person.relationship} at {person.issuers.join(", ")} ·{" "}
              {person.location}. Latest liquidity evidence{" "}
              {displayDate(person.lastLiquidityDate)}.
            </p>
          </div>
        </div>
        <div className="real-person-profile-summary">
          <span>Estimated remaining liquidity</span>
          <strong>
            {person.grossCompletedSales > 0
              ? moneyRange(person.estimatedRemainingLiquidity)
              : "Not yet estimated"}
          </strong>
          <small>
            Median {compactCurrency(person.estimatedRemainingLiquidity.median)}{" "}
            · calculated from completed public sales
          </small>
          {latestSource && (
            <a href={latestSource} target="_blank" rel="noreferrer">
              Open latest supporting record ↗
            </a>
          )}
        </div>
      </section>

      <div className="real-profile-disclosure">
        <strong>Estimate, not bank balance</strong>
        <p>
          Gross sale proceeds are observed or calculated from SEC records.
          Estimated net and remaining liquidity apply visible tax, fee,
          completed-purchase, and time-based unobserved-deployment assumptions.
          Actual cash on hand can differ materially.
        </p>
      </div>

      <section className="real-profile-kpis" aria-label="Liquidity summary">
        <article>
          <span>Completed gross proceeds</span>
          <strong>{compactCurrency(person.grossCompletedSales)}</strong>
          <small>
            {
              person.liquidityEvents.filter(
                (event) => event.eventType === "completed_public_share_sale",
              ).length
            }{" "}
            completed sale events
          </small>
        </article>
        <article>
          <span>Estimated net proceeds</span>
          <strong>{moneyRange(person.estimatedNetProceeds)}</strong>
          <small>After modeled tax and transaction-cost ranges</small>
        </article>
        <article>
          <span>Known public purchases</span>
          <strong>{compactCurrency(person.grossPurchases)}</strong>
          <small>Subtracted as documented cash deployment</small>
        </article>
        <article>
          <span>Estimated remaining liquidity</span>
          <strong>{moneyRange(person.estimatedRemainingLiquidity)}</strong>
          <small>
            Median {compactCurrency(person.estimatedRemainingLiquidity.median)}
          </small>
        </article>
      </section>

      <section className="real-profile-layout">
        <div className="real-profile-primary">
          <article className="real-profile-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Cash-creation ledger</p>
                <h2>When liquidity was received or proposed</h2>
              </div>
              <span>{person.liquidityEvents.length} qualifying events</span>
            </div>
            {person.liquidityEvents.length ? (
              <div className="real-liquidity-ledger">
                <div className="real-liquidity-ledger-row heading">
                  <span>Event and date</span>
                  <span>Reported calculation</span>
                  <span>Estimated net effect</span>
                  <span>Evidence</span>
                </div>
                {person.liquidityEvents.map((event) => (
                  <a
                    className={`real-liquidity-ledger-row ${event.status}`}
                    key={event.id}
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>
                      <strong>{eventLabel(event)}</strong>
                      <small>
                        {displayDate(event.transactionDate)} · {event.issuer}
                      </small>
                    </span>
                    <span>
                      <strong>
                        {event.eventType === "completed_public_share_purchase"
                          ? "−"
                          : event.status === "completed"
                            ? "+"
                            : ""}
                        {compactCurrency(event.grossAmount)}
                      </strong>
                      <small>
                        {event.shares.toLocaleString()} shares ×{" "}
                        {compactCurrency(event.pricePerShare)}
                      </small>
                    </span>
                    <span>
                      <strong>
                        {event.status === "completed" &&
                        event.eventType === "completed_public_share_sale"
                          ? moneyRange(eventRange(event))
                          : event.status === "proposed"
                            ? "Not counted until completed"
                            : `−${compactCurrency(event.grossAmount)}`}
                      </strong>
                      <small>
                        {event.status === "completed"
                          ? event.amountClassification
                          : "proposed only"}
                      </small>
                    </span>
                    <b>{event.form} · SEC ↗</b>
                  </a>
                ))}
              </div>
            ) : (
              <p className="real-profile-empty">
                No completed or proposed cash-generating transaction was
                extracted from this party’s currently indexed filings.
              </p>
            )}
          </article>

          <article className="real-profile-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Observed portfolio</p>
                <h2>Reported securities positions</h2>
              </div>
              <span>
                {person.holdings.length} positions ·{" "}
                {compactCurrency(person.estimatedPortfolioValue)} valued
              </span>
            </div>
            {person.holdings.length ? (
              <div className="real-holdings-table">
                <div className="real-holdings-row heading">
                  <span>Issuer / security</span>
                  <span>Shares reported</span>
                  <span>Reference price</span>
                  <span>Estimated value</span>
                </div>
                {person.holdings.map((holding) => (
                  <a
                    className="real-holdings-row"
                    href={holding.sourceUrl}
                    key={holding.id}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>
                      <strong>{holding.issuer}</strong>
                      <small>
                        {holding.securityTitle} ·{" "}
                        {holding.directOrIndirect === "D"
                          ? "Direct"
                          : holding.directOrIndirect === "I"
                            ? "Indirect"
                            : holding.directOrIndirect}
                      </small>
                    </span>
                    <strong>{holding.shares.toLocaleString()}</strong>
                    <span>
                      {holding.referencePrice === null
                        ? "Not reported"
                        : compactCurrency(holding.referencePrice)}
                    </span>
                    <b>
                      {holding.estimatedValue === null
                        ? "Not valued"
                        : compactCurrency(holding.estimatedValue)}
                    </b>
                  </a>
                ))}
              </div>
            ) : (
              <p className="real-profile-empty">
                No post-transaction position was available in the currently
                indexed ownership filings.
              </p>
            )}
            <p className="real-profile-panel-note">
              Portfolio coverage is limited to securities disclosed in indexed
              SEC ownership forms. Values use a filing transaction price only
              when one is reported; this is not a complete personal portfolio.
            </p>
          </article>

          <article className="real-profile-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Issuer network</p>
                <h2>Other observed reporting parties</h2>
              </div>
              <span>{related.length} linked</span>
            </div>
            {related.length ? (
              <div className="real-related-people">
                {related.map((candidate) => (
                  <button
                    type="button"
                    key={candidate.id}
                    onClick={() => onPerson(candidate)}
                  >
                    <i>{candidate.initials || "SEC"}</i>
                    <span>
                      <strong>{candidate.name}</strong>
                      <small>
                        {candidate.issuers.join(", ")} ·{" "}
                        {moneyRange(candidate.estimatedRemainingLiquidity)}
                      </small>
                    </span>
                    <b>→</b>
                  </button>
                ))}
              </div>
            ) : (
              <p className="real-profile-empty">
                No additional reporting parties for this issuer appear in the
                current indexed window.
              </p>
            )}
          </article>
        </div>

        <aside className="real-profile-secondary">
          <article className="real-profile-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Profile facts</p>
                <h2>Observed identity and role</h2>
              </div>
            </div>
            <dl className="real-profile-facts">
              <div>
                <dt>Filed name</dt>
                <dd>{person.name}</dd>
              </div>
              <div>
                <dt>Relationship</dt>
                <dd>{person.relationship}</dd>
              </div>
              <div>
                <dt>Issuer relationship</dt>
                <dd>{person.issuers.join(", ")}</dd>
              </div>
              <div>
                <dt>Public location</dt>
                <dd>{person.location}</dd>
              </div>
              <div>
                <dt>Reporting-owner CIK</dt>
                <dd>{person.archiveEntityId}</dd>
              </div>
              <div>
                <dt>Proposed sale value</dt>
                <dd>{compactCurrency(person.proposedSaleValue)}</dd>
              </div>
            </dl>
          </article>

          <article className="real-profile-panel real-model-card">
            <p className="eyebrow">Current model assumptions</p>
            <h2>How remaining liquidity is estimated</h2>
            <dl>
              <div>
                <dt>Net proceeds retained</dt>
                <dd>48% low · 63% median · 78% high</dd>
              </div>
              <div>
                <dt>Annual unobserved retention</dt>
                <dd>72% low · 86% median · 96% high</dd>
              </div>
              <div>
                <dt>Known public purchases</dt>
                <dd>Subtracted at reported gross cost</dd>
              </div>
              <div>
                <dt>Form 144 proposals</dt>
                <dd>Excluded until completion evidence appears</dd>
              </div>
            </dl>
          </article>

          <article className="real-profile-panel real-profile-limit">
            <p className="eyebrow">Known limitations</p>
            <ul>
              <li>Private spending and investments are not fully observable</li>
              <li>Tax basis and actual tax treatment are not known</li>
              <li>Holdings outside SEC ownership reports are excluded</li>
              <li>The estimate is not an actual bank-account balance</li>
            </ul>
          </article>
        </aside>
      </section>
    </>
  );
}
