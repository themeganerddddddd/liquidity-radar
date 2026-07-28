"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import snapshotJson from "../public/data/public-signals.json";
import type { PublicDataSnapshot } from "../lib/public-data";
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

const initialSnapshot = snapshotJson as PublicDataSnapshot;

type WorkspaceView =
  | "dashboard"
  | "map"
  | "people"
  | "profile"
  | "filings"
  | "advisers"
  | "foundations"
  | "sources";

const navigation: Array<{
  label: string;
  items: Array<{ view: WorkspaceView; label: string; icon: string }>;
}> = [
  {
    label: "Workspace",
    items: [
      { view: "dashboard", label: "Dashboard", icon: "DB" },
      { view: "map", label: "State map", icon: "US" },
    ],
  },
  {
    label: "Official records",
    items: [
      { view: "people", label: "People", icon: "PPL" },
      { view: "filings", label: "SEC filings", icon: "4" },
      { view: "advisers", label: "Registered advisers", icon: "ADV" },
      { view: "foundations", label: "Foundations", icon: "PF" },
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
    eyebrow: "Evidence-backed personal liquidity",
    title: "Good afternoon.",
    detail:
      "Track when public records show people receiving cash, how much may remain deployable, and which evidence supports each estimate.",
  },
  map: {
    eyebrow: "Regional intelligence",
    title: "State signal map",
    detail:
      "Compare official state-level business formation, adviser, asset, and economic-growth records.",
  },
  people: {
    eyebrow: "Personal liquidity search",
    title: "People with attributable capital events",
    detail:
      "Rank real reporting parties by completed gross proceeds and estimated remaining liquidity, then inspect every model input.",
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
  advisers: {
    eyebrow: "SEC Form ADV",
    title: "Registered investment advisers",
    detail:
      "Inspect firm-reported regulatory assets. These values describe adviser books, not personal wealth.",
  },
  foundations: {
    eyebrow: "IRS Form 990-PF",
    title: "Private-foundation returns",
    detail:
      "Browse attributable foundation filings from the IRS electronic filing index.",
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
  onNavigate,
  onClose,
}: {
  view: WorkspaceView;
  open: boolean;
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
          <strong>Public Records</strong>
          <small>Test workspace</small>
        </div>
        <b aria-hidden="true">●</b>
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
          <span>Visible records</span>
          <strong>100% real</strong>
          <i>
            <b />
          </i>
          <small>SEC + IRS + Census + BEA only</small>
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
            [person.name, ...person.issuers, ...person.forms]
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
                ? "Filter SEC filings or find a reporting person…"
                : view === "advisers"
                  ? "Filter advisers or find a reporting person…"
                  : view === "foundations"
                    ? "Filter foundations or find a reporting person…"
                    : "Search real people, firms, or issuers…"
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
            <p>People and reporting parties</p>
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
        <span className="real-only-pill">
          <i />
          Real records only
        </span>
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
            onClick={() => onNavigate("sources")}
          >
            Review sources
          </button>
        }
      />
      <div className="real-workspace-status">
        <span>
          <i />
          {data.sec.mode === "live"
            ? "Live source refresh"
            : "Verified snapshot"}
        </span>
        <p>
          Every profile is tied to transaction-level public evidence. Completed
          proceeds are separated from proposed sales, and every remaining-cash
          range exposes its model assumptions.
        </p>
        <button type="button" onClick={() => onNavigate("sources")}>
          Evidence policy →
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
          <span>People with completed-sale evidence</span>
          <strong>{liquidPeople.length.toLocaleString()}</strong>
          <small>Ranked by modeled remaining liquidity</small>
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
        {data.sources.map((source) => (
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

function AdvisersView({
  data,
  query,
}: {
  data: PublicDataSnapshot;
  query: string;
}) {
  const firms = data.advisers.topFirms.filter((firm) =>
    [firm.name, firm.legalName, firm.city, firm.state, firm.crd, firm.secNumber]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <>
      <PageIntro
        view="advisers"
        action={
          <span className="real-count-pill">
            {data.advisers.firmCount.toLocaleString()} firms in source roster
          </span>
        }
      />
      <section className="real-directory-card">
        <div className="real-directory-head real-adviser-row">
          <span>Firm</span>
          <span>Location</span>
          <span>Regulatory assets</span>
          <span>Latest filing</span>
          <span>Identifiers</span>
        </div>
        {firms.map((firm) => (
          <div
            className="real-directory-row real-adviser-row"
            key={`${firm.crd}-${firm.secNumber}`}
          >
            <strong>{firm.name}</strong>
            <span>
              {firm.city}, {firm.state}
            </span>
            <b>{compactCurrency(firm.regulatoryAssets)}</b>
            <span>{displayDate(firm.filingDate)}</span>
            <small>
              CRD {firm.crd} · {firm.secNumber}
            </small>
          </div>
        ))}
        {!firms.length && (
          <p className="real-empty">No adviser records match “{query}”.</p>
        )}
      </section>
      <p className="real-workspace-footnote">
        Regulatory assets under management are firm-reported adviser values.
        They are not an individual investor’s assets or available liquidity.
      </p>
    </>
  );
}

function FoundationsView({
  data,
  query,
}: {
  data: PublicDataSnapshot;
  query: string;
}) {
  const filings = data.foundations.recentFilings.filter((filing) =>
    [filing.name, filing.ein, filing.taxPeriod, filing.objectId]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <>
      <PageIntro
        view="foundations"
        action={
          <span className="real-count-pill">
            {data.foundations.filingCount.toLocaleString()} indexed filings
          </span>
        }
      />
      <section className="real-foundation-grid">
        {filings.map((filing) => (
          <article key={filing.objectId}>
            <span>IRS 990-PF</span>
            <h2>{filing.name}</h2>
            <dl>
              <div>
                <dt>Tax period</dt>
                <dd>{filing.taxPeriod}</dd>
              </div>
              <div>
                <dt>EIN</dt>
                <dd>••-•••{filing.ein.slice(-4)}</dd>
              </div>
              <div>
                <dt>IRS object ID</dt>
                <dd>{filing.objectId}</dd>
              </div>
            </dl>
          </article>
        ))}
        {!filings.length && (
          <p className="real-empty">No foundation records match “{query}”.</p>
        )}
      </section>
      <p className="real-workspace-footnote">
        Foundation returns provide organizational filing context. They do not
        establish a donor’s current personal capital or willingness to invest.
      </p>
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
              <b>{source.freshness}</b>
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
  const [data, setData] = useState(initialSnapshot);
  const people = useMemo(() => buildRealPeople(data), [data]);
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

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/public-data", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Public-data refresh failed.");
        return response.json() as Promise<{ data: PublicDataSnapshot }>;
      })
      .then((body) => setData(body.data))
      .catch(() => {
        // Preserve the checked-in official snapshot when a publisher is down.
      });
    return () => controller.abort();
  }, []);

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
    content = <PublicStateMap />;
  } else if (view === "people") {
    content = (
      <>
        <PageIntro
          view="people"
          action={
            <span className="real-count-pill">
              {people.length} real liquidity profiles
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
  } else if (view === "advisers") {
    content = <AdvisersView data={data} query={query} />;
  } else if (view === "foundations") {
    content = <FoundationsView data={data} query={query} />;
  } else {
    content = <SourcesView data={data} />;
  }

  return (
    <div className="app-shell real-workspace-shell">
      <WorkspaceSidebar
        view={view}
        open={mobileNav}
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
