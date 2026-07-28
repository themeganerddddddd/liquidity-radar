"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type {
  PublicDataSnapshot,
  PublicLiquidityChunk,
} from "../lib/public-data";
import { getExitBusinessProfiles } from "../lib/exit-signals";
import {
  buildRealPeople,
  RealPeopleDirectory,
  RealPersonProfile,
  type RealPersonRecord,
} from "./RealPeople";
import { PublicStateMap } from "./PublicStateMap";
import {
  clearTestSession,
  readTestSession,
  TestAuth,
  type TestSession,
} from "./TestAuth";

type WorkspaceView =
  "dashboard" | "map" | "people" | "profile" | "filings" | "exits" | "sources";

const navigation: Array<{
  label: string;
  items: Array<{ view: WorkspaceView; label: string; icon: string }>;
}> = [
  {
    label: "Workspace",
    items: [
      { view: "dashboard", label: "Dashboard", icon: "DB" },
      { view: "people", label: "Search directory", icon: "DIR" },
      { view: "map", label: "State signals", icon: "US" },
    ],
  },
  {
    label: "Capital signals",
    items: [
      { view: "exits", label: "Business exit watch", icon: "M&A" },
      { view: "filings", label: "SEC filings", icon: "4" },
    ],
  },
  {
    label: "Documentation",
    items: [{ view: "sources", label: "Sources & methodology", icon: "SRC" }],
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
    eyebrow: "Searchable capital database",
    title: "Capital directory",
    detail:
      "Search people, firms, issuers, completed sales, proposed sales, and reported holdings from one directory.",
  },
  profile: {
    eyebrow: "SEC reporting-party profile",
    title: "Evidence-linked profile",
    detail:
      "Review the public records and issuer relationships attached to this reporting party.",
  },
  filings: {
    eyebrow: "SEC EDGAR",
    title: "Current public filings",
    detail:
      "Review recently indexed ownership and transaction filings directly from the SEC public record.",
  },
  exits: {
    eyebrow: "Transaction intelligence",
    title: "Business exit watch",
    detail:
      "Monitor public M&A signals, named acquired parties, and acquired businesses without treating a deal notice as personal cash.",
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
  query,
  onQuery,
  onPerson,
  onMenu,
  onLogout,
}: {
  view: WorkspaceView;
  session: TestSession;
  people: RealPersonRecord[];
  query: string;
  onQuery: (query: string) => void;
  onPerson: (person: RealPersonRecord) => void;
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
            aria-controls={
              peopleResults.length ? "global-people-results" : undefined
            }
          />
          <kbd>/</kbd>
        </label>
        {peopleResults.length > 0 && (
          <div
            className="real-global-search-results"
            id="global-people-results"
            role="listbox"
            aria-label="Matching SEC reporting parties"
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
  onNavigate,
  onPerson,
}: {
  data: PublicDataSnapshot;
  people: RealPersonRecord[];
  onNavigate: (view: WorkspaceView) => void;
  onPerson: (person: RealPersonRecord) => void;
}) {
  const coverage = liquidityCoverage(data);
  const liquidPeople = people.filter(
    (person) => person.kind === "Person" && person.grossCompletedSales > 0,
  );
  const completedGross = liquidPeople.reduce(
    (sum, person) => sum + person.grossCompletedSales,
    0,
  );
  const remainingMedian = liquidPeople.reduce(
    (sum, person) => sum + person.estimatedRemainingLiquidity.median,
    0,
  );
  const proposedGross = people
    .filter((person) => person.kind === "Person")
    .reduce((sum, person) => sum + person.proposedSaleValue, 0);
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
          sale evidence with proposed-sale and holdings signals. Proposed deals
          and Form 144 notices do not enter estimated cash.
        </p>
        <button type="button" onClick={() => onNavigate("sources")}>
          Methodology →
        </button>
      </div>

      <section className="real-workspace-kpis" aria-label="Public data summary">
        <article>
          <span>Completed gross proceeds</span>
          <strong>{compactCurrency(completedGross)}</strong>
          <small>Shares sold × reported transaction price</small>
          <b>SEC</b>
        </article>
        <article>
          <span>Profiles in capital directory</span>
          <strong>{people.length.toLocaleString()}</strong>
          <small>
            {liquidPeople.length.toLocaleString()} people with completed-sale
            evidence
          </small>
          <b>SEC</b>
        </article>
        <article>
          <span>Estimated remaining liquidity</span>
          <strong>{compactCurrency(remainingMedian)}</strong>
          <small>Median across completed-sale profiles</small>
          <b>Modeled</b>
        </article>
        <article>
          <span>Proposed sale pipeline</span>
          <strong>{compactCurrency(proposedGross)}</strong>
          <small>Form 144 values excluded until completed</small>
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
                  (person.grossCompletedSales > 0 ||
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
                      {person.grossCompletedSales > 0
                        ? `${compactCurrency(person.grossCompletedSales)} gross · ${compactCurrency(person.estimatedRemainingLiquidity.median)} median remaining`
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

function ExitSignalsView({
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
        record.businessProfiles.map((profile) => profile.headquarters.display),
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
        profile.headquarters.display,
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
              (profile) => profile.headquarters.display === location,
            );
    return searchText.includes(combinedQuery) && matchesLocation;
  });
  const locatedCount = allRecords.filter(
    (record) => record.businessProfiles.length,
  ).length;

  return (
    <>
      <PageIntro
        view="exits"
        action={
          <span className="real-count-pill">
            {records.length.toLocaleString()} of{" "}
            {allRecords.length.toLocaleString()} deal signals
          </span>
        }
      />
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
                    {profile?.headquarters.display ??
                      "Location not established"}
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
            The next high-value feed is completed acquisition or disposition
            evidence from SEC Form 8-K Item 2.01, followed by disclosed
            consideration and owner attribution.
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

function SourcesView({ data }: { data: PublicDataSnapshot }) {
  return (
    <>
      <PageIntro view="sources" />
      <div className="real-methodology-note">
        <strong>Evidence first. Estimates second.</strong>
        <p>
          Liquidity Radar treats Form 4 sale transactions and completed
          prior-sale disclosures as cash-creation evidence when shares and
          proceeds are available. Form 144 proposals remain proposed. Taxes,
          fees, private deployment, and remaining liquidity are modeled as
          ranges and never presented as observed bank balances.
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
  const [data, setData] = useState<PublicDataSnapshot | null>(null);
  const people = useMemo(() => (data ? buildRealPeople(data) : []), [data]);
  const coverage = data
    ? liquidityCoverage(data)
    : { startDate: "", endDate: "", days: 0, label: "Loading coverage…" };
  const selectedPerson =
    people.find((person) => person.id === selectedPersonId) ?? people[0];
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
    void fetch("/data/public-signals.json", { signal: controller.signal })
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
              {people.length.toLocaleString()} searchable profiles
            </span>
          }
        />
        <RealPeopleDirectory
          people={people}
          query={query}
          onQuery={setQuery}
          onPerson={openPerson}
        />
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
  } else if (view === "filings") {
    content = <FilingsView data={data} query={query} />;
  } else if (view === "exits") {
    content = <ExitSignalsView data={data} query={query} />;
  } else {
    content = <SourcesView data={data} />;
  }

  return (
    <div className="app-shell real-workspace-shell">
      <WorkspaceSidebar
        view={view}
        open={mobileNav}
        profileCount={people.length}
        coverageLabel={coverage.label}
        onNavigate={navigate}
        onClose={() => setMobileNav(false)}
      />
      <WorkspaceHeader
        view={view}
        session={effectiveSession}
        people={people}
        query={query}
        onQuery={setQuery}
        onPerson={openPerson}
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
