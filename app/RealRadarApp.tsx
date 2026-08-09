"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type {
  PublicDataSnapshot,
  PublicLiquidityChunk,
} from "../lib/public-data";
import type {
  MoneyMotionRecord,
  MoneyMotionSnapshot,
} from "../lib/money-in-motion";
import { getExitBusinessProfiles } from "../lib/exit-signals";
import { normalizePublicLocation } from "../lib/public-locations";
import { uniqueCompletedSaleGross } from "../lib/valuation-safety";
import {
  buildRealPeople,
  RealPersonProfile,
  type RealPersonRecord,
} from "./RealPeople";
import { PublicStateMap } from "./PublicStateMap";
import { MoneyInMotionView } from "./MoneyInMotion";
import { MotionRecordProfile, PeopleInMotionView } from "./PeopleInMotion";
import { TerritoriesView } from "./TerritoriesView";
import {
  clearTestSession,
  readTestSession,
  TestAuth,
  type TestSession,
} from "./TestAuth";

type WorkspaceView =
  | "dashboard"
  | "map"
  | "people"
  | "profile"
  | "event_profile"
  | "territories"
  | "filings"
  | "exits"
  | "money"
  | "people_motion"
  | "pre"
  | "closed"
  | "monitor"
  | "sources";

const liveMotionSnapshotUrl =
  "https://raw.githubusercontent.com/themeganerddddddd/liquidity-radar/main/public/data/money-in-motion-client.json.gz";

async function decodeMotionSnapshot(response: Response) {
  if (!response.ok) throw new Error("Money-in-motion refresh failed.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let contents: string;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const decompressed = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    contents = await new Response(decompressed).text();
  } else {
    contents = new TextDecoder().decode(bytes);
  }
  return JSON.parse(contents) as MoneyMotionSnapshot;
}

function profileNameKey(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/\b(jr|sr|ii|iii|iv)\b/g, " ")
      .match(/[a-z0-9]+/g)
      ?.sort()
      .join(" ") || ""
  );
}

const navigation: Array<{
  label: string;
  items: Array<{ view: WorkspaceView; label: string; icon: string }>;
}> = [
  {
    label: "Workspace",
    items: [
      { view: "dashboard", label: "Dashboard", icon: "DB" },
      { view: "people", label: "Search directory", icon: "DIR" },
      { view: "territories", label: "Territories & alerts", icon: "AL" },
      { view: "map", label: "State map", icon: "US" },
    ],
  },
  {
    label: "Records",
    items: [{ view: "exits", label: "Business sales", icon: "M&A" }],
  },
  {
    label: "Sources",
    items: [
      { view: "monitor", label: "Source status", icon: "MON" },
      { view: "sources", label: "Methodology", icon: "SRC" },
    ],
  },
];

const viewCopy: Record<
  WorkspaceView,
  { eyebrow: string; title: string; detail: string }
> = {
  dashboard: {
    eyebrow: "Capital intelligence workspace",
    title: "Liquidity Radar",
    detail:
      "Find people with attributable cash-creation events, review estimated deployable capital, and follow emerging business-exit signals.",
  },
  map: {
    eyebrow: "Regional intelligence",
    title: "State signal map",
    detail:
      "Compare official business-formation and economic-growth records as market context, without treating them as personal liquidity.",
  },
  people: {
    eyebrow: "Unified public-record directory",
    title: "Capital directory",
    detail:
      "Search every capital event from SEC, CMS, USPTO, FTC, STB, and other active public sources in one simple, evidence-linked directory.",
  },
  territories: {
    eyebrow: "Local business development",
    title: "Saved territories and alerts",
    detail:
      "Build city/metro-radius searches around public business locations, save territory rules, and surface matching capital events.",
  },
  profile: {
    eyebrow: "SEC reporting-party profile",
    title: "Evidence-linked profile",
    detail:
      "Review the public records and issuer relationships attached to this reporting party.",
  },
  event_profile: {
    eyebrow: "Evidence-linked capital profile",
    title: "Capital event profile",
    detail:
      "Review the public transaction, value coverage, related events, location, and source evidence attached to this record.",
  },
  filings: {
    eyebrow: "SEC EDGAR",
    title: "Current public filings",
    detail:
      "Review recently indexed ownership and transaction filings directly from the SEC public record.",
  },
  exits: {
    eyebrow: "Confirmed and emerging transactions",
    title: "Completed exits and deal watch",
    detail:
      "Separate consummated SEC Item 2.01 transactions from pre-close FTC signals, then inspect consideration and supported owner attribution.",
  },
  money: {
    eyebrow: "All public transaction records",
    title: "Capital events",
    detail:
      "Search business sales, acquisitions, ownership changes, share sales, patent transfers, and other evidence-linked events in one directory.",
  },
  people_motion: {
    eyebrow: "Unified public-record directory",
    title: "Capital directory",
    detail:
      "Search named people across every active public source, with unsupported amounts left undisclosed.",
  },
  pre: {
    eyebrow: "Upcoming public records",
    title: "Upcoming events",
    detail:
      "Review watching, pre-sale, announced, and regulatory-pending events without presenting them as completed proceeds.",
  },
  closed: {
    eyebrow: "Completed public records",
    title: "Completed events",
    detail:
      "Review closed and post-liquidity events, with transaction, ownership, valuation, and uncertainty evidence kept separate.",
  },
  monitor: {
    eyebrow: "Ingestion operations",
    title: "Source status",
    detail:
      "See which public sources are live, degraded, import-only, or intentionally disabled, plus freshness and record counts.",
  },
  sources: {
    eyebrow: "Evidence policy",
    title: "Sources and methodology",
    detail:
      "See exactly what is collected, how fresh it is, and what each public record can and cannot establish.",
  },
};

function compactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
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

function liquidityCoverage(data: PublicDataSnapshot) {
  const dates = data.liquidity.events
    .map((event) => event.transactionDate)
    .filter(Boolean)
    .sort();
  const startDate = data.liquidity.coverage?.startDate || dates.at(0) || "";
  const endDate = data.liquidity.coverage?.endDate || dates.at(-1) || "";
  const start = startDate ? new Date(`${startDate}T00:00:00Z`).getTime() : 0;
  const end = endDate ? new Date(`${endDate}T00:00:00Z`).getTime() : 0;
  const days = start && end ? Math.round((end - start) / 86_400_000) + 1 : 0;
  const label =
    startDate && endDate
      ? startDate === endDate
        ? displayDate(startDate)
        : `${displayDate(startDate)} – ${displayDate(endDate)}`
      : "Coverage date unavailable";
  return { startDate, endDate, days, label };
}

function filingName(filing: PublicDataSnapshot["sec"]["filings"][number]) {
  return filing.reportingParty
    ? `${filing.reportingParty} · ${filing.issuer}`
    : filing.issuer;
}

function subscribeToHydration() {
  return () => {};
}

function PageIntro({
  view,
  action,
}: {
  view: WorkspaceView;
  action?: React.ReactNode;
}) {
  const copy = viewCopy[view];
  return (
    <div className="page-intro real-page-intro">
      <div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.detail}</p>
      </div>
      {action && <div className="page-actions">{action}</div>}
    </div>
  );
}

function WorkspaceSidebar({
  view,
  open,
  profileCount,
  coverageLabel,
  onNavigate,
  onClose,
}: {
  view: WorkspaceView;
  open: boolean;
  profileCount: number;
  coverageLabel: string;
  onNavigate: (view: WorkspaceView) => void;
  onClose: () => void;
}) {
  const navigate = (nextView: WorkspaceView) => {
    onNavigate(nextView);
    onClose();
  };

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <button className="brand" onClick={() => navigate("dashboard")}>
        <span className="radar-mark" aria-hidden="true">
          <i />
        </span>
        <span>Liquidity Radar</span>
      </button>
      <div className="workspace-chip">
        <span>LR</span>
        <div>
          <strong>Capital Intelligence</strong>
          <small>Research workspace</small>
        </div>
      </div>
      <nav className="side-nav" aria-label="Product navigation">
        {navigation.map((group) => (
          <div className="nav-group" key={group.label}>
            <p>{group.label}</p>
            {group.items.map((item) => (
              <button
                type="button"
                key={item.view}
                className={
                  view === item.view ||
                  (view === "profile" && item.view === "people")
                    ? "active"
                    : ""
                }
                aria-current={
                  view === item.view ||
                  (view === "profile" && item.view === "people")
                    ? "page"
                    : undefined
                }
                onClick={() => navigate(item.view)}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        <button type="button" onClick={() => navigate("sources")}>
          Methodology
        </button>
        <div className="coverage-mini">
          <span>Directory coverage</span>
          <strong>{profileCount.toLocaleString()} profiles</strong>
          <i>
            <b />
          </i>
          <small>{coverageLabel}</small>
        </div>
      </div>
    </aside>
  );
}

function WorkspaceHeader({
  view,
  session,
  people,
  motionPeople,
  query,
  onQuery,
  onPerson,
  onDirectorySearch,
  onMenu,
  onLogout,
}: {
  view: WorkspaceView;
  session: TestSession;
  people: RealPersonRecord[];
  motionPeople: MoneyMotionSnapshot["peopleInMotion"];
  query: string;
  onQuery: (query: string) => void;
  onPerson: (person: RealPersonRecord) => void;
  onDirectorySearch: (query: string) => void;
  onMenu: () => void;
  onLogout: () => void;
}) {
  const initials = session.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const peopleResults =
    query.trim().length > 1
      ? people
          .filter((person) =>
            [
              person.name,
              ...person.issuers,
              ...person.forms,
              ...person.filings.map((filing) => filing.reportingParty),
              ...person.liquidityEvents.map((event) => event.reportingParty),
              ...person.holdings.map((holding) => holding.reportingParty),
            ]
              .join(" ")
              .toLocaleLowerCase()
              .includes(query.trim().toLocaleLowerCase()),
          )
          .slice(0, 6)
      : [];
  const secNames = new Set(
    peopleResults.map((person) => person.name.toLowerCase()),
  );
  const motionResults =
    query.trim().length > 1
      ? motionPeople
          .filter(
            (person) =>
              !secNames.has(person.name.toLowerCase()) &&
              [
                person.name,
                person.company,
                person.role,
                person.industry,
                person.latestEventTitle,
                person.location.country,
                person.location.state,
                person.location.city,
                ...person.evidence.flatMap((evidence) => [
                  evidence.publisher,
                  evidence.title,
                ]),
              ]
                .join(" ")
                .toLowerCase()
                .includes(query.trim().toLowerCase()),
          )
          .slice(0, Math.max(0, 6 - peopleResults.length))
      : [];
  const resultCount = peopleResults.length + motionResults.length;

  return (
    <header className="app-header">
      <button
        type="button"
        className="mobile-menu"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        ☰
      </button>
      <div className="real-global-search-wrap">
        <label className="global-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && peopleResults[0]) {
                event.preventDefault();
                onPerson(peopleResults[0]);
              } else if (event.key === "Enter" && motionResults[0]) {
                event.preventDefault();
                onDirectorySearch(motionResults[0].name);
              } else if (event.key === "Enter" && query.trim()) {
                event.preventDefault();
                onDirectorySearch(query.trim());
              }
            }}
            placeholder={
              view === "filings"
                ? "Filter SEC filings or search the directory…"
                : view === "exits"
                  ? "Filter buyers, sellers, or acquired businesses…"
                  : "Search the directory by person, firm, or issuer…"
            }
            aria-label="Search people and public records"
            aria-controls={resultCount ? "global-people-results" : undefined}
          />
          <kbd>/</kbd>
        </label>
        {resultCount > 0 && (
          <div
            className="real-global-search-results"
            id="global-people-results"
            role="listbox"
            aria-label="Matching directory profiles"
          >
            <p>Directory profiles</p>
            {peopleResults.map((person) => (
              <button
                type="button"
                role="option"
                aria-selected="false"
                key={person.id}
                onClick={() => onPerson(person)}
              >
                <i>{person.initials || "SEC"}</i>
                <span>
                  <strong>{person.name}</strong>
                  <small>
                    {person.issuers[0]} · {person.forms.join(", ")}
                  </small>
                </span>
                <b>→</b>
              </button>
            ))}
            {motionResults.map((person) => (
              <button
                type="button"
                role="option"
                aria-selected="false"
                key={person.personId}
                onClick={() => onDirectorySearch(person.name)}
              >
                <i>
                  {person.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "PR"}
                </i>
                <span>
                  <strong>{person.name}</strong>
                  <small>
                    {person.company || "Company not established"} ·{" "}
                    {person.evidence[0]?.publisher || "Public record"}
                  </small>
                </span>
                <b>→</b>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="header-actions">
        <div className="account" aria-label={`Signed in as ${session.name}`}>
          <span>{initials || "LR"}</span>
          <div>
            <strong>{session.name}</strong>
            <small>{session.role}</small>
          </div>
        </div>
        <button type="button" className="logout" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </header>
  );
}

function Dashboard({
  data,
  people,
  directoryCount,
  onNavigate,
  onPerson,
}: {
  data: PublicDataSnapshot;
  people: RealPersonRecord[];
  directoryCount: number;
  onNavigate: (view: WorkspaceView) => void;
  onPerson: (person: RealPersonRecord) => void;
}) {
  const coverage = liquidityCoverage(data);
  const liquidPeople = people.filter(
    (person) =>
      person.kind === "Person" &&
      person.grossCompletedSales + person.grossCompletedExitCash > 0,
  );
  const attributedExitCash = (data.completedExits?.records ?? []).reduce(
    (sum, exit) =>
      sum +
      exit.ownerAttributions.reduce(
        (ownerSum, owner) =>
          ownerSum +
          (owner.kind === "person" ? (owner.attributedCash ?? 0) : 0),
        0,
      ),
    0,
  );
  const completedGross =
    uniqueCompletedSaleGross(data.liquidity.events) + attributedExitCash;
  const remainingMedian = liquidPeople.reduce(
    (sum, person) => sum + person.estimatedRemainingLiquidity.median,
    0,
  );
  const completedBusinessExits = data.completedExits?.records ?? [];
  const disclosedExitCash = completedBusinessExits.reduce(
    (sum, record) => sum + (record.consideration.cashAmount ?? 0),
    0,
  );
  const statePulse = useMemo(
    () =>
      [...data.businessFormation.states]
        .sort((a, b) => b.applications - a.applications)
        .slice(0, 7)
        .map((state) => ({
          ...state,
          economy: data.regionalEconomy.states.find(
            (record) => record.code === state.code,
          ),
        })),
    [data],
  );

  return (
    <>
      <PageIntro
        view="dashboard"
        action={
          <button
            type="button"
            className="button ghost"
            onClick={() => onNavigate("people")}
          >
            Search directory
          </button>
        }
      />
      <div className="real-workspace-status">
        <span>
          <i />
          {coverage.days > 0 && coverage.days <= 10
            ? "Current filing window"
            : "Liquidity coverage"}
        </span>
        <p>
          <strong>{coverage.label}.</strong> The dashboard combines completed
          securities sales with confirmed Item 2.01 transactions, proposed-sale
          records, and holdings signals. FTC deal notices and Form 144 proposals
          do not enter estimated cash.
        </p>
        <button type="button" onClick={() => onNavigate("sources")}>
          Methodology →
        </button>
      </div>

      <section className="real-workspace-kpis" aria-label="Public data summary">
        <article>
          <span>Completed gross proceeds</span>
          <strong>{compactCurrency(completedGross)}</strong>
          <small>Unique normalized sales + attributed personal exits</small>
          <b>SEC</b>
        </article>
        <article>
          <span>Profiles in capital directory</span>
          <strong>{directoryCount.toLocaleString()}</strong>
          <small>
            {liquidPeople.length.toLocaleString()} with supported completed-sale
            estimates; other sources remain searchable without invented amounts
          </small>
          <b>All sources</b>
        </article>
        <article>
          <span>Estimated potential liquidity</span>
          <strong>{compactCurrency(remainingMedian)}</strong>
          <small>Median across completed-sale profiles</small>
          <b>Modeled</b>
        </article>
        <article>
          <span>Confirmed business exits</span>
          <strong>{completedBusinessExits.length.toLocaleString()}</strong>
          <small>{compactCurrency(disclosedExitCash)} disclosed cash</small>
          <b>SEC</b>
        </article>
      </section>

      <section className="real-workspace-grid">
        <article className="real-workspace-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Personal liquidity ranking</p>
              <h2>People with recent capital events</h2>
            </div>
            <button type="button" onClick={() => onNavigate("people")}>
              View all
            </button>
          </div>
          <div className="real-record-list real-person-preview-list">
            {people
              .filter(
                (person) =>
                  person.kind === "Person" &&
                  (person.grossCompletedSales + person.grossCompletedExitCash >
                    0 ||
                    person.proposedSaleValue > 0),
              )
              .slice(0, 7)
              .map((person) => (
                <button
                  type="button"
                  key={person.id}
                  onClick={() => onPerson(person)}
                >
                  <span>{person.initials || "SEC"}</span>
                  <div>
                    <strong>{person.name}</strong>
                    <small>
                      {person.grossCompletedSales +
                        person.grossCompletedExitCash >
                      0
                        ? `${compactCurrency(person.grossCompletedSales + person.grossCompletedExitCash)} gross · ${compactCurrency(person.estimatedRemainingLiquidity.median)} median remaining`
                        : `${compactCurrency(person.proposedSaleValue)} proposed · not counted as completed`}
                    </small>
                  </div>
                  <b aria-hidden="true">→</b>
                </button>
              ))}
          </div>
        </article>

        <article className="real-workspace-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Census + BEA</p>
              <h2>State activity pulse</h2>
            </div>
            <button type="button" onClick={() => onNavigate("map")}>
              Open map
            </button>
          </div>
          <div className="real-pulse-table">
            <div className="real-pulse-row heading">
              <span>State</span>
              <span>Applications</span>
              <span>Projected</span>
              <span>GDP QoQ</span>
            </div>
            {statePulse.map((state) => (
              <div className="real-pulse-row" key={state.code}>
                <strong>
                  <i>{state.code}</i>
                  {state.name}
                </strong>
                <span>{state.applications.toLocaleString()}</span>
                <span>{state.projectedFormations.toLocaleString()}</span>
                <b
                  className={
                    (state.economy?.quarterlyGrowth ?? 0) >= 0
                      ? "positive"
                      : "negative"
                  }
                >
                  {(state.economy?.quarterlyGrowth ?? 0) >= 0 ? "+" : ""}
                  {state.economy?.quarterlyGrowth ?? 0}%
                </b>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="real-source-strip" aria-label="Connected sources">
        {data.sources
          .filter((source) =>
            ["sec", "ftc", "census", "bea"].includes(source.id),
          )
          .map((source) => (
            <a
              key={source.id}
              href={source.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span>{source.publisher}</span>
              <strong>{source.name}</strong>
              <small>{source.freshness}</small>
            </a>
          ))}
      </section>
    </>
  );
}

function FilingsView({
  data,
  query,
}: {
  data: PublicDataSnapshot;
  query: string;
}) {
  const records = data.sec.filings.filter((filing) =>
    [filing.form, filing.issuer, filing.reportingParty, filing.accession]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <>
      <PageIntro
        view="filings"
        action={
          <span className="real-count-pill">
            {records.length} record{records.length === 1 ? "" : "s"}
          </span>
        }
      />
      <section className="real-directory-card">
        <div className="real-directory-head real-filing-row">
          <span>Form</span>
          <span>Entity / reporting party</span>
          <span>Filed</span>
          <span>Accession</span>
          <span>Source</span>
        </div>
        {records.map((filing) => (
          <a
            className="real-directory-row real-filing-row"
            href={filing.url}
            key={`${filing.form}-${filing.accession}`}
            target="_blank"
            rel="noreferrer"
          >
            <span className="real-record-type">{filing.form}</span>
            <strong>{filingName(filing)}</strong>
            <span>{displayDate(filing.filedAt)}</span>
            <span>{filing.accession}</span>
            <b>Open SEC ↗</b>
          </a>
        ))}
        {!records.length && (
          <p className="real-empty">No SEC records match “{query}”.</p>
        )}
      </section>
      <p className="real-workspace-footnote">
        A filing is an observed regulatory record, not automatic proof of cash
        proceeds or current personal liquidity.
      </p>
    </>
  );
}

function ConfirmedExitsPanel({
  data,
  query,
}: {
  data: PublicDataSnapshot;
  query: string;
}) {
  const [completedQuery, setCompletedQuery] = useState("");
  const [location, setLocation] = useState("All locations");
  const [attribution, setAttribution] = useState("All attribution");
  const allRecords = data.completedExits?.records ?? [];
  const locationDisplay = (locationValue: {
    city: string;
    state: string;
    country: string;
  }) => normalizePublicLocation(locationValue).display;
  const locationOptions = [
    ...new Set(
      allRecords
        .flatMap((record) => [
          locationDisplay(record.location),
          ...record.ownerAttributions.map((owner) =>
            locationDisplay(owner.location),
          ),
        ])
        .filter((value) => value && value !== "Location not established"),
    ),
  ].sort();
  const combinedQuery = `${query} ${completedQuery}`.trim().toLocaleLowerCase();
  const records = allRecords.filter((record) => {
    const searchText = [
      record.filer,
      record.subjectBusiness,
      record.buyer,
      record.sellerOrTarget,
      record.accession,
      record.consideration.summary,
      locationDisplay(record.location),
      ...record.ownerAttributions.flatMap((owner) => [
        owner.name,
        owner.relationship,
        locationDisplay(owner.location),
      ]),
    ]
      .join(" ")
      .toLocaleLowerCase();
    const matchesLocation =
      location === "All locations"
        ? true
        : location === "Location not established"
          ? locationDisplay(record.location) === "Location not established" &&
            record.ownerAttributions.every(
              (owner) =>
                locationDisplay(owner.location) === "Location not established",
            )
          : locationDisplay(record.location) === location ||
            record.ownerAttributions.some(
              (owner) => locationDisplay(owner.location) === location,
            );
    const matchesAttribution =
      attribution === "All attribution"
        ? true
        : attribution === "Named people"
          ? record.ownerAttributions.some((owner) => owner.kind === "person")
          : attribution === "Named entities"
            ? record.ownerAttributions.some((owner) => owner.kind === "entity")
            : record.ownerAttributions.length === 0;
    return (
      searchText.includes(combinedQuery) &&
      matchesLocation &&
      matchesAttribution
    );
  });
  const disclosedCash = records.reduce(
    (sum, record) => sum + (record.consideration.cashAmount ?? 0),
    0,
  );
  const personAttributions = records.reduce(
    (sum, record) =>
      sum +
      record.ownerAttributions.filter((owner) => owner.kind === "person")
        .length,
    0,
  );

  return (
    <>
      <div className="real-confirmed-disclosure">
        <strong>Confirmed close</strong>
        <p>
          Every row is backed by SEC Form 8-K Item 2.01. The SEC limits this
          item to consummated significant acquisitions or dispositions.
          Consideration and named recipients remain blank unless a filing
          discloses them.
        </p>
      </div>
      <section
        className="real-exit-controls real-confirmed-controls"
        aria-label="Completed-exit filters"
      >
        <label>
          <span>Search confirmed exits</span>
          <input
            type="search"
            value={completedQuery}
            onChange={(event) => setCompletedQuery(event.target.value)}
            placeholder="Search business, buyer, seller, owner, place, or accession…"
            aria-label="Search completed exits"
          />
        </label>
        <label>
          <span>Public location</span>
          <select
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            aria-label="Filter completed exits by location"
          >
            <option>All locations</option>
            {locationOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
            <option>Location not established</option>
          </select>
        </label>
        <label>
          <span>Owner attribution</span>
          <select
            value={attribution}
            onChange={(event) => setAttribution(event.target.value)}
            aria-label="Filter completed exits by owner attribution"
          >
            <option>All attribution</option>
            <option>Named people</option>
            <option>Named entities</option>
            <option>No named owner</option>
          </select>
        </label>
        <div>
          <strong>{compactCurrency(disclosedCash)}</strong>
          <span>
            disclosed cash across results · {personAttributions} named-person
            attribution{personAttributions === 1 ? "" : "s"}
          </span>
        </div>
      </section>
      <section className="real-directory-card real-confirmed-directory">
        <div className="real-directory-head real-confirmed-row">
          <span>Completed</span>
          <span>Business / transaction</span>
          <span>Disclosed consideration</span>
          <span>Supported owner attribution</span>
          <span>Location and evidence</span>
        </div>
        {records.map((record) => (
          <article
            className="real-directory-row real-confirmed-row real-confirmed-record"
            key={record.id}
          >
            <span>
              <strong>{displayDate(record.completedAt)}</strong>
              <small>Filed {displayDate(record.filedAt)}</small>
              <i>Item 2.01</i>
            </span>
            <span>
              <strong>{record.subjectBusiness}</strong>
              <small>
                {record.buyer} · {record.sellerOrTarget}
              </small>
              <p>
                {record.transactionType} · filer was {record.filerRole}
              </p>
            </span>
            <span>
              <strong>
                {record.consideration.cashAmount !== null
                  ? `${compactCurrency(record.consideration.cashAmount)} cash`
                  : record.consideration.cashPerShare !== null
                    ? `$${record.consideration.cashPerShare.toLocaleString()} cash / share`
                    : "Amount not disclosed"}
              </strong>
              <small>{record.consideration.summary}</small>
            </span>
            <span className="real-owner-attributions">
              {record.ownerAttributions.length ? (
                record.ownerAttributions.slice(0, 3).map((owner) => (
                  <a
                    href={owner.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    key={`${record.id}-${owner.name}`}
                  >
                    <strong>{owner.name}</strong>
                    <small>
                      {owner.relationship}
                      {owner.attributedCash !== null
                        ? ` · ${compactCurrency(owner.attributedCash)} gross`
                        : " · amount not allocated"}
                    </small>
                  </a>
                ))
              ) : (
                <>
                  <strong>No supported owner attribution</strong>
                  <small>
                    No recipient inferred from the transaction alone.
                  </small>
                </>
              )}
            </span>
            <span>
              <strong>{locationDisplay(record.location)}</strong>
              <small>
                {record.location.basis === "company_headquarters"
                  ? "Company headquarters"
                  : record.location.basis === "public_business_address"
                    ? "Public business address"
                    : "No sourced location"}
              </small>
              <a href={record.sourceUrl} target="_blank" rel="noreferrer">
                Open SEC 8-K ↗
              </a>
            </span>
          </article>
        ))}
        {!records.length && (
          <p className="real-empty">
            No completed Item 2.01 records match these filters.
          </p>
        )}
      </section>
      <p className="real-workspace-footnote">
        Named-person amounts are gross filing-based calculations before taxes,
        fees, option exercise costs, or later deployment. Entity-level seller
        proceeds are never presented as personal cash.
      </p>
    </>
  );
}

function DealWatchPanel({
  data,
  query,
}: {
  data: PublicDataSnapshot;
  query: string;
}) {
  const [dealQuery, setDealQuery] = useState("");
  const [location, setLocation] = useState("All locations");
  const allRecords = (data.exitSignals?.records ?? []).map((record) => ({
    ...record,
    businessProfiles: record.businessProfiles?.length
      ? record.businessProfiles
      : getExitBusinessProfiles([
          ...record.acquiredEntities,
          record.acquiredParty,
        ]),
  }));
  const locationOptions = [
    ...new Set(
      allRecords.flatMap((record) =>
        record.businessProfiles.map(
          (profile) => normalizePublicLocation(profile.headquarters).display,
        ),
      ),
    ),
  ].sort();
  const combinedQuery = `${query} ${dealQuery}`.trim().toLocaleLowerCase();
  const records = allRecords.filter((record) => {
    const searchText = [
      record.acquiringParty,
      record.acquiredParty,
      ...record.acquiredEntities,
      ...record.businessProfiles.flatMap((profile) => [
        profile.name,
        profile.industry,
        profile.description,
        normalizePublicLocation(profile.headquarters).display,
        profile.headquarters.country,
      ]),
      record.id,
    ]
      .join(" ")
      .toLocaleLowerCase();
    const matchesLocation =
      location === "All locations"
        ? true
        : location === "Location not established"
          ? record.businessProfiles.length === 0
          : record.businessProfiles.some(
              (profile) =>
                normalizePublicLocation(profile.headquarters).display ===
                location,
            );
    return searchText.includes(combinedQuery) && matchesLocation;
  });
  const locatedCount = allRecords.filter(
    (record) => record.businessProfiles.length,
  ).length;

  return (
    <>
      <div className="real-signal-disclosure">
        <strong>Deal signal—not cash evidence</strong>
        <p>
          These are FTC HSR early-termination notices. They show that a waiting
          period ended early, but they do not prove the acquisition closed,
          disclose consideration, or establish personal proceeds.
        </p>
      </div>
      <section className="real-exit-controls" aria-label="Deal-watch filters">
        <label>
          <span>Search deal watch</span>
          <input
            type="search"
            value={dealQuery}
            onChange={(event) => setDealQuery(event.target.value)}
            placeholder="Search businesses, sellers, buyers, industries or places…"
            aria-label="Search acquired businesses and deal parties"
          />
        </label>
        <label>
          <span>Business location</span>
          <select
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            aria-label="Filter acquired businesses by location"
          >
            <option>All locations</option>
            {locationOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
            <option>Location not established</option>
          </select>
        </label>
        <div>
          <strong>{locatedCount}</strong>
          <span>signals with sourced business locations</span>
        </div>
      </section>
      <section className="real-exit-layout">
        <div className="real-directory-card">
          <div className="real-directory-head real-exit-row">
            <span>Date</span>
            <span>Acquired business</span>
            <span>Headquarters</span>
            <span>Seller / acquired party</span>
            <span>Buyer and evidence</span>
          </div>
          {records.map((record) => {
            const profile = record.businessProfiles[0];
            return (
              <article
                className="real-directory-row real-exit-row real-exit-record"
                key={record.id}
              >
                <span>
                  <strong>{displayDate(record.date)}</strong>
                  <small>HSR waiting period ended early</small>
                </span>
                <span className="real-exit-business">
                  <strong>
                    {record.acquiredEntities.join(", ") || record.acquiredParty}
                  </strong>
                  <small>
                    {profile?.industry ?? "Industry not yet established"}
                  </small>
                  {profile && <p>{profile.description}</p>}
                </span>
                <span>
                  <strong>
                    {profile
                      ? normalizePublicLocation(profile.headquarters).display
                      : "Location not established"}
                  </strong>
                  <small>
                    {profile
                      ? profile.locationBasis === "company_headquarters"
                        ? "Company headquarters"
                        : "Public business address"
                      : "No verified first-party location yet"}
                  </small>
                  {profile && (
                    <a
                      href={profile.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Company source ↗
                    </a>
                  )}
                </span>
                <span>
                  <strong>{record.acquiredParty}</strong>
                  <small>
                    Party named in FTC notice; not necessarily an individual
                    owner
                  </small>
                </span>
                <span>
                  <strong>{record.acquiringParty}</strong>
                  <a href={record.sourceUrl} target="_blank" rel="noreferrer">
                    FTC notice {record.id} ↗
                  </a>
                </span>
              </article>
            );
          })}
          {!records.length && (
            <p className="real-empty">
              No exit-watch records match the current search and location
              filters.
            </p>
          )}
        </div>
        <aside className="real-owner-transition">
          <p className="eyebrow">Owner transition lens</p>
          <h2>Aging owners are a market signal, not a named-person fact.</h2>
          <p>
            Census owner-age tables can prioritize industries and regions for
            succession research. They do not identify an individual owner or
            prove that a business is for sale.
          </p>
          <p>
            Use the Confirmed closes tab when you need consummated Item 2.01
            evidence, disclosed consideration, and supported owner attribution.
          </p>
          <a
            href="https://www.census.gov/data/tables/2024/econ/abs/2024-abs-characteristics-of-owners.html"
            target="_blank"
            rel="noreferrer"
          >
            Explore 2024 owner-age tables ↗
          </a>
          <div>
            <strong>51%</strong>
            <span>
              of responding employer-business owners were 55+ in the 2018
              reference-year ABS
            </span>
          </div>
          <a
            href="https://www.census.gov/content/dam/Census/library/visualizations/2020/comm/business-owners-ages.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Open the Census age brief ↗
          </a>
        </aside>
      </section>
    </>
  );
}

function ExitSignalsView({
  data,
  query,
}: {
  data: PublicDataSnapshot;
  query: string;
}) {
  const [mode, setMode] = useState<"confirmed" | "watch">("confirmed");
  const confirmedCount = data.completedExits?.records.length ?? 0;
  const watchCount = data.exitSignals?.records.length ?? 0;

  return (
    <>
      <PageIntro
        view="exits"
        action={
          <span className="real-count-pill">
            {confirmedCount} confirmed · {watchCount} deal signals
          </span>
        }
      />
      <div className="real-exit-mode" role="tablist" aria-label="Exit evidence">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "confirmed"}
          className={mode === "confirmed" ? "active" : ""}
          onClick={() => setMode("confirmed")}
        >
          Confirmed closes
          <span>{confirmedCount} SEC Item 2.01</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "watch"}
          className={mode === "watch" ? "active" : ""}
          onClick={() => setMode("watch")}
        >
          Deal watch
          <span>{watchCount} FTC signals</span>
        </button>
      </div>
      {mode === "confirmed" ? (
        <ConfirmedExitsPanel data={data} query={query} />
      ) : (
        <DealWatchPanel data={data} query={query} />
      )}
    </>
  );
}

function SourcesView({ data }: { data: PublicDataSnapshot }) {
  return (
    <>
      <PageIntro view="sources" />
      <div className="real-methodology-note">
        <strong>Evidence first. Estimates second.</strong>
        <p>
          Liquidity Radar treats Form 4 sale transactions and completed
          prior-sale disclosures as securities-liquidity evidence when shares
          and proceeds are available. Form 8-K Item 2.01 establishes a
          consummated significant acquisition or disposition, but a person is
          linked to proceeds only when a separate ownership filing supports the
          attribution. Form 144 proposals remain proposed. Taxes, fees, private
          deployment, and potential liquidity are modeled as ranges and never
          presented as observed bank balances.
        </p>
      </div>
      <section className="real-source-directory">
        {data.sources.map((source) => (
          <a
            key={source.id}
            href={source.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            <div>
              <span>{source.publisher}</span>
              <b>
                {source.id === "adv"
                  ? "Regional context"
                  : source.id === "irs"
                    ? "Excluded from estimates"
                    : source.freshness}
              </b>
            </div>
            <h2>{source.name}</h2>
            <p>{source.methodology}</p>
            <small>
              {source.recordCount.toLocaleString()} records represented
            </small>
            <strong>Open official source ↗</strong>
          </a>
        ))}
      </section>
    </>
  );
}

export function RealRadarApp() {
  const [session, setSession] = useState<TestSession | "signed-out" | null>(
    null,
  );
  const [view, setView] = useState<WorkspaceView>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedMotionRecordId, setSelectedMotionRecordId] = useState("");
  const [data, setData] = useState<PublicDataSnapshot | null>(null);
  const [motionData, setMotionData] = useState<MoneyMotionSnapshot | null>(
    null,
  );
  const people = useMemo(() => (data ? buildRealPeople(data) : []), [data]);
  const coverage = data
    ? liquidityCoverage(data)
    : { startDate: "", endDate: "", days: 0, label: "Loading coverage…" };
  const selectedPerson =
    people.find((person) => person.id === selectedPersonId) ?? people[0];
  const selectedMotionRecord = motionData?.records.find(
    (record) => record.id === selectedMotionRecordId,
  );
  const ready = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const effectiveSession =
    session === "signed-out"
      ? null
      : (session ?? (ready ? readTestSession() : null));
  const signedIn = Boolean(effectiveSession);

  useEffect(() => {
    if (!ready || !signedIn) return;
    const controller = new AbortController();
    void fetch("/data/public-signals.json", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) throw new Error("Public-data refresh failed.");
        return response.json() as Promise<PublicDataSnapshot>;
      })
      .then(async (snapshot) => {
        const chunkUrls = snapshot.liquidity.chunkUrls ?? [];
        if (!chunkUrls.length) return snapshot;
        try {
          const chunks = await Promise.all(
            chunkUrls.map(async (url) => {
              const response = await fetch(url, {
                signal: controller.signal,
                cache: "no-store",
              });
              if (!response.ok) throw new Error("Liquidity-data chunk failed.");
              return response.json() as Promise<PublicLiquidityChunk>;
            }),
          );
          const events = new Map(
            [
              ...snapshot.liquidity.events,
              ...chunks.flatMap((chunk) => chunk.events),
            ].map((event) => [event.id, event]),
          );
          const holdings = new Map(
            [
              ...snapshot.liquidity.holdings,
              ...chunks.flatMap((chunk) => chunk.holdings),
            ].map((holding) => [holding.id, holding]),
          );
          return {
            ...snapshot,
            liquidity: {
              ...snapshot.liquidity,
              events: [...events.values()].sort(
                (left, right) =>
                  right.transactionDate.localeCompare(left.transactionDate) ||
                  right.filingDate.localeCompare(left.filingDate),
              ),
              holdings: [...holdings.values()].sort((left, right) =>
                right.asOfDate.localeCompare(left.asOfDate),
              ),
            },
          };
        } catch {
          if (controller.signal.aborted)
            throw new Error("Public-data request aborted.");
          return snapshot;
        }
      })
      .then(setData)
      .catch(() => {
        // A reload retries the immutable checked-in public snapshot.
      });
    return () => controller.abort();
  }, [ready, signedIn]);

  useEffect(() => {
    if (!ready || !signedIn) return;
    const controller = new AbortController();
    const refreshBucket = Math.floor(Date.now() / (5 * 60 * 1000));
    const loadCandidate = async (url: string) =>
      decodeMotionSnapshot(
        await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
        }),
      );
    const loadSnapshots = async () => {
      let packaged: MoneyMotionSnapshot | null = null;
      try {
        packaged = await loadCandidate("/data/money-in-motion-client.json.gz");
        setMotionData(packaged);
      } catch {
        if (controller.signal.aborted) throw new Error("Request aborted.");
      }
      try {
        const live = await loadCandidate(
          `${liveMotionSnapshotUrl}?refresh=${refreshBucket}`,
        );
        if (!packaged || live.generatedAt > packaged.generatedAt) {
          setMotionData(live);
        }
        return;
      } catch {
        if (controller.signal.aborted) throw new Error("Request aborted.");
      }
      if (packaged) return;
      throw new Error("Money-in-motion refresh failed.");
    };
    void loadSnapshots().catch(() => {
      // A reload retries the checked-in source snapshot.
    });
    return () => controller.abort();
  }, [ready, signedIn]);

  const navigate = (nextView: WorkspaceView) => {
    setView(nextView);
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openPerson = (person: RealPersonRecord) => {
    setSelectedPersonId(person.id);
    setView("profile");
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openMotionRecord = (record: MoneyMotionRecord) => {
    const linkedSecPerson = record.evidence.some(
      (evidence) => evidence.sourceId === "sec",
    )
      ? people.find(
          (person) =>
            profileNameKey(person.name) === profileNameKey(record.person),
        )
      : undefined;
    if (linkedSecPerson) {
      openPerson(linkedSecPerson);
      return;
    }
    setSelectedMotionRecordId(record.id);
    setView("event_profile");
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openDirectorySearch = (nextQuery: string) => {
    setQuery(nextQuery);
    setView("people");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!ready) {
    return (
      <main className="test-auth-loading" aria-label="Loading test access">
        <span className="radar-mark" aria-hidden="true">
          <i />
        </span>
        <p>Loading Liquidity Radar…</p>
      </main>
    );
  }

  if (!effectiveSession) {
    return (
      <TestAuth onAuthenticated={(nextSession) => setSession(nextSession)} />
    );
  }

  if (!data) {
    return (
      <main className="test-auth-loading" aria-label="Loading public records">
        <span className="radar-mark" aria-hidden="true">
          <i />
        </span>
        <p>Loading the public-record directory…</p>
      </main>
    );
  }

  let content: React.ReactNode;
  if (view === "dashboard") {
    content = (
      <Dashboard
        data={data}
        people={people}
        directoryCount={motionData?.peopleInMotion.length || people.length}
        onNavigate={navigate}
        onPerson={openPerson}
      />
    );
  } else if (view === "map") {
    content = <PublicStateMap data={data} />;
  } else if (view === "people") {
    content = (
      <>
        <PageIntro
          view="people"
          action={
            <span className="real-count-pill">
              {(motionData?.records.length || people.length).toLocaleString()}{" "}
              capital events
            </span>
          }
        />
        {motionData ? (
          <PeopleInMotionView
            snapshot={motionData}
            query={query}
            onQuery={setQuery}
            onOpenRecord={openMotionRecord}
          />
        ) : (
          <div className="motion-inline-loading">
            Loading the unified public-record directory…
          </div>
        )}
      </>
    );
  } else if (view === "profile" && selectedPerson) {
    content = (
      <RealPersonProfile
        person={selectedPerson}
        people={people}
        onBack={() => navigate("people")}
        onPerson={openPerson}
      />
    );
  } else if (view === "event_profile" && motionData && selectedMotionRecord) {
    content = (
      <MotionRecordProfile
        snapshot={motionData}
        record={selectedMotionRecord}
        onBack={() => navigate("people")}
      />
    );
  } else if (view === "filings") {
    content = <FilingsView data={data} query={query} />;
  } else if (view === "territories") {
    content = (
      <>
        <PageIntro view="territories" />
        <TerritoriesView data={data} people={people} onPerson={openPerson} />
      </>
    );
  } else if (view === "exits") {
    content = <ExitSignalsView data={data} query={query} />;
  } else if (view === "people_motion") {
    content = (
      <>
        <PageIntro
          view="people"
          action={
            motionData ? (
              <span className="real-count-pill">
                {motionData.peopleInMotion.length.toLocaleString()} named people
              </span>
            ) : undefined
          }
        />
        {motionData ? (
          <PeopleInMotionView
            snapshot={motionData}
            query={query}
            onQuery={setQuery}
            onOpenRecord={openMotionRecord}
          />
        ) : (
          <div className="motion-inline-loading">
            Loading person-first public records…
          </div>
        )}
      </>
    );
  } else if (["money", "pre", "closed", "monitor"].includes(view)) {
    content = (
      <>
        <PageIntro
          view={view}
          action={
            motionData ? (
              <span className="real-count-pill">
                {motionData.stats.records.toLocaleString()} transaction signals
              </span>
            ) : undefined
          }
        />
        {motionData ? (
          <MoneyInMotionView
            key={view}
            snapshot={motionData}
            view={view as "money" | "pre" | "closed" | "monitor"}
          />
        ) : (
          <div className="motion-inline-loading">
            Loading normalized public-source records…
          </div>
        )}
      </>
    );
  } else {
    content = <SourcesView data={data} />;
  }

  return (
    <div className="app-shell real-workspace-shell">
      <WorkspaceSidebar
        view={view}
        open={mobileNav}
        profileCount={motionData?.peopleInMotion.length || people.length}
        coverageLabel={coverage.label}
        onNavigate={navigate}
        onClose={() => setMobileNav(false)}
      />
      <WorkspaceHeader
        view={view}
        session={effectiveSession}
        people={people}
        motionPeople={motionData?.peopleInMotion || []}
        query={query}
        onQuery={setQuery}
        onPerson={openPerson}
        onDirectorySearch={openDirectorySearch}
        onMenu={() => setMobileNav((current) => !current)}
        onLogout={() => {
          clearTestSession();
          setSession("signed-out");
        }}
      />
      {mobileNav && (
        <button
          type="button"
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <main className="app-main real-workspace-main">{content}</main>
    </div>
  );
}
