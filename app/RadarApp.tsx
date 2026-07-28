"use client";

import { FormEvent, useMemo, useState, useSyncExternalStore } from "react";
import {
  alerts as seedAlerts,
  evidence,
  events,
  jobs,
  organizationProfiles,
  people,
  regions,
  reviewQueue,
  savedSearches,
} from "./data";
import type { Person, Region } from "./data";
import { dateLabel, money, percent, rangeMoney } from "../lib/format";
import { matchScore } from "../lib/core";
import { LiquidityMap } from "./LiquidityMap";
import {
  EventsExplorer,
  PeopleExplorer,
  RegionDetail,
  RegionsDirectory,
} from "./RegionalViews";
import {
  calculateAffinity,
  parseMapState,
  selectActiveRegion,
  serializeMapState,
} from "../lib/regional";
import { getRegion } from "../lib/data-query";

type View =
  | "dashboard"
  | "map"
  | "feed"
  | "people"
  | "organizations"
  | "regions"
  | "rankings"
  | "matching"
  | "saved"
  | "alerts"
  | "reports"
  | "review"
  | "sources"
  | "identity"
  | "jobs"
  | "privacy"
  | "workspace"
  | "methodology"
  | "api"
  | "region"
  | "profile";

const subscribeToHydration = () => () => undefined;
const subscribeToLocation = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
};
const getLocationSnapshot = () => window.location.href;
const getServerLocationSnapshot = () => "http://localhost/";

function viewFromPath(pathname: string, params: URLSearchParams): View {
  if (/^\/people\/[^/]+/.test(pathname)) return "profile";
  if (/^\/regions\/[^/]+/.test(pathname)) return "region";
  if (/^\/organizations\/[^/]+/.test(pathname)) return "organizations";
  const routes: Record<string, View> = {
    "/": "dashboard",
    "/map": "map",
    "/events": "feed",
    "/people": "people",
    "/organizations": "organizations",
    "/regions": "regions",
    "/rankings": "rankings",
    "/capital-match": "matching",
    "/saved-searches": "saved",
    "/alerts": "alerts",
    "/reports": "reports",
    "/review": "review",
    "/evidence": "sources",
    "/identity": "identity",
    "/data-operations": "jobs",
    "/privacy": "privacy",
    "/workspace": "workspace",
    "/methodology": "methodology",
    "/api-docs": "api",
  };
  return routes[pathname] || (params.get("view") as View) || "dashboard";
}

function pathForView(view: View) {
  const routes: Record<View, string> = {
    dashboard: "/",
    map: "/map",
    feed: "/events",
    people: "/people",
    profile: "/people",
    organizations: "/organizations",
    regions: "/regions",
    region: "/regions",
    rankings: "/rankings",
    matching: "/capital-match",
    saved: "/saved-searches",
    alerts: "/alerts",
    reports: "/reports",
    review: "/review",
    sources: "/evidence",
    identity: "/identity",
    jobs: "/data-operations",
    privacy: "/privacy",
    workspace: "/workspace",
    methodology: "/methodology",
    api: "/api-docs",
  };
  return routes[view];
}

type UserRole = "customer" | "analyst" | "admin";
type Toast = { title: string; detail: string } | null;

const navGroups: {
  label: string;
  items: { view: View; label: string; icon: string }[];
}[] = [
  {
    label: "Monitor",
    items: [
      { view: "dashboard", label: "Overview", icon: "OV" },
      { view: "map", label: "National map", icon: "MP" },
      { view: "feed", label: "Event feed", icon: "FD" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { view: "people", label: "People", icon: "PP" },
      { view: "organizations", label: "Organizations", icon: "OR" },
      { view: "regions", label: "Regions", icon: "RG" },
      { view: "rankings", label: "Rankings", icon: "RK" },
      { view: "matching", label: "Capital match", icon: "CM" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { view: "saved", label: "Saved searches", icon: "SS" },
      { view: "alerts", label: "Alerts", icon: "AL" },
      { view: "reports", label: "Reports", icon: "RP" },
    ],
  },
  {
    label: "Operations",
    items: [
      { view: "review", label: "Analyst review", icon: "AR" },
      { view: "sources", label: "Evidence", icon: "EV" },
      { view: "identity", label: "Identity queue", icon: "ID" },
      { view: "jobs", label: "Data operations", icon: "DO" },
      { view: "privacy", label: "Privacy requests", icon: "PR" },
    ],
  },
];

const headlines: Record<
  View,
  { eyebrow: string; title: string; detail: string }
> = {
  dashboard: {
    eyebrow: "Capital intelligence",
    title: "Good afternoon, Maya.",
    detail:
      "A high-confidence view of newly created and potentially deployable private capital.",
  },
  map: {
    eyebrow: "National intelligence",
    title: "Capital geography",
    detail:
      "Compare where liquidity is created, controlled, retained, attracted, and deployed.",
  },
  feed: {
    eyebrow: "Daily signal",
    title: "Liquidity event feed",
    detail:
      "Observed events, calculated proceeds, and reviewed private-market estimates.",
  },
  people: {
    eyebrow: "Entity intelligence",
    title: "People search",
    detail:
      "Find likely capital controllers by evidence, location, industry, confidence, and timing.",
  },
  organizations: {
    eyebrow: "Entity intelligence",
    title: "Organizations",
    detail:
      "Operating companies, acquirers, investment vehicles, foundations, and advisers.",
  },
  regions: {
    eyebrow: "Regional intelligence",
    title: "Regional capital dashboards",
    detail:
      "Creation, control, deployment, retention, leakage, and attraction—without double counting.",
  },
  region: {
    eyebrow: "Regional intelligence",
    title: "Region detail",
    detail:
      "Connected people, events, organizations, industries, and capital matches.",
  },
  rankings: {
    eyebrow: "Confidence ≥ 65",
    title: "Market rankings",
    detail:
      "Sort transparent, evidence-qualified signals by the underlying metric.",
  },
  matching: {
    eyebrow: "Opportunity workflow",
    title: "Capital matching",
    detail:
      "Match a raise, acquisition, development, or initiative to plausible capital partners.",
  },
  saved: {
    eyebrow: "Workspace intelligence",
    title: "Saved searches",
    detail:
      "Shared, reproducible filters for recurring research and monitoring.",
  },
  alerts: {
    eyebrow: "Signal delivery",
    title: "Alerts",
    detail:
      "Monitor new events, threshold crossings, profile changes, and strong matches.",
  },
  reports: {
    eyebrow: "Decision support",
    title: "Reports & exports",
    detail:
      "Generate evidence-linked dossiers, regional reports, match reports, PDFs, and CSVs.",
  },
  review: {
    eyebrow: "Analyst console",
    title: "Review queue",
    detail:
      "Resolve uncertain claims before they affect estimates or publication.",
  },
  sources: {
    eyebrow: "Evidence lineage",
    title: "Sources & claims",
    detail:
      "Trace every displayed fact to its document, excerpt, classification, and review state.",
  },
  identity: {
    eyebrow: "Entity resolution",
    title: "Identity queue",
    detail:
      "Deterministic matches auto-resolve; fuzzy candidates stay auditable and human-reviewed.",
  },
  jobs: {
    eyebrow: "Data operations",
    title: "Ingestion & jobs",
    detail:
      "Observe, retry, and audit the workflows that keep the intelligence graph current.",
  },
  privacy: {
    eyebrow: "Rights operations",
    title: "Privacy & corrections",
    detail:
      "Process claims, corrections, suppression, eligible deletion, and appeals.",
  },
  workspace: {
    eyebrow: "Workspace administration",
    title: "Northstar Strategy",
    detail:
      "Manage members, plan entitlements, usage, API keys, and restricted-use acknowledgements.",
  },
  methodology: {
    eyebrow: "Public transparency",
    title: "How Liquidity Radar estimates capital",
    detail:
      "A reproducible evidence chain from source documents to range-based estimates.",
  },
  api: {
    eyebrow: "Developer platform",
    title: "Liquidity Radar API",
    detail:
      "Versioned, workspace-scoped access to published intelligence and evidence metadata.",
  },
  profile: {
    eyebrow: "Person profile",
    title: "Liquidity profile",
    detail:
      "Estimated deployable capital, evidence lineage, known deployment, and uncertainty.",
  },
};

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(href);
}

function csvForPeople(records: Person[], affinityRegion: Region) {
  const header = [
    "record_id",
    "name",
    "estimate_date",
    "low",
    "median",
    "high",
    "confidence",
    "evidence_status",
    "primary_source",
    "geography",
    "publication_status",
    "affinity_region",
    "affinity_score",
    "main_affinity_reasons",
  ];
  const rows = records.map((person) => {
    const affinity = calculateAffinity(person, affinityRegion, regions);
    return [
      person.id,
      person.name,
      "2026-07-27",
      person.remaining.low,
      person.remaining.median,
      person.remaining.high,
      person.confidence,
      "analyst-reviewed",
      `${person.sourceCount} linked sources`,
      person.location,
      person.status,
      affinityRegion.name,
      affinity.score,
      affinity.mainReasons.join("; "),
    ];
  });
  return [header, ...rows]
    .map((row) =>
      row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
}

function Classification({
  kind,
}: {
  kind: "observed" | "calculated" | "estimated" | "inferred";
}) {
  return <span className={`classification ${kind}`}>{kind}</span>;
}

function Confidence({ value }: { value: number }) {
  const label =
    value >= 90
      ? "Very high"
      : value >= 80
        ? "High"
        : value >= 65
          ? "Moderate"
          : "Low";
  return (
    <span className="confidence" title={`${label} confidence`}>
      <i style={{ "--confidence": `${value}%` } as React.CSSProperties} />
      {value}
    </span>
  );
}

function Login({ onLogin }: { onLogin: (role: UserRole) => void }) {
  const [email, setEmail] = useState("customer@liquidityradar.local");
  const [password, setPassword] = useState("RadarDemo!2026");
  const [error, setError] = useState("");
  const ready = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const accounts: Record<string, UserRole> = {
      "customer@liquidityradar.local": "customer",
      "analyst@liquidityradar.local": "analyst",
      "admin@liquidityradar.local": "admin",
    };
    const formData = new FormData(event.currentTarget);
    const submittedEmail = String(formData.get("email") ?? "");
    const submittedPassword = String(formData.get("password") ?? "");
    if (submittedPassword !== "RadarDemo!2026" || !accounts[submittedEmail]) {
      setError(
        "Use one of the demonstration accounts and the documented local password.",
      );
      return;
    }
    onLogin(accounts[submittedEmail]);
  }

  return (
    <main className="marketing-shell">
      <header className="marketing-nav">
        <div className="brand light">
          <span className="radar-mark" aria-hidden="true">
            <i />
          </span>
          <span>Liquidity Radar</span>
        </div>
        <nav aria-label="Public navigation">
          <a href="#methodology">Methodology</a>
          <a href="#coverage">Data coverage</a>
          <a href="#terms">Restricted uses</a>
        </nav>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow teal">Private capital, mapped.</p>
          <h1>See where liquidity is created—and where it may move next.</h1>
          <p className="hero-lead">
            Evidence-linked intelligence for economic developers, investment
            teams, advisers, and institutions. Built around deployable-liquidity
            ranges, never speculative bank balances.
          </p>
          <div className="hero-proof">
            <div>
              <strong>$24.8B</strong>
              <span>estimated created liquidity</span>
            </div>
            <div>
              <strong>82%</strong>
              <span>median evidence confidence</span>
            </div>
            <div>
              <strong>412</strong>
              <span>qualified capital controllers</span>
            </div>
          </div>
          <div
            className="signal-window"
            aria-label="Sample capital intelligence"
          >
            <div className="signal-top">
              <span>Capital creation · 90 days</span>
              <span className="live-dot">Evidence current</span>
            </div>
            <div className="hero-bars">
              {[28, 34, 30, 46, 42, 61, 52, 68, 64, 82, 76, 92].map(
                (height, index) => (
                  <i key={index} style={{ height: `${height}%` }} />
                ),
              )}
            </div>
            <div className="signal-bottom">
              <span>Apr</span>
              <span>May</span>
              <span>Jun</span>
              <span>Jul</span>
            </div>
          </div>
        </div>
        <form className="login-card" onSubmit={submit}>
          <div>
            <p className="eyebrow">Demonstration workspace</p>
            <h2>Enter Liquidity Radar</h2>
            <p>Explore seeded, fictional data across every product workflow.</p>
          </div>
          <label>
            <span>Email</span>
            <select
              name="email"
              value={email}
              disabled={!ready}
              onChange={(event) => setEmail(event.target.value)}
            >
              <option>customer@liquidityradar.local</option>
              <option>analyst@liquidityradar.local</option>
              <option>admin@liquidityradar.local</option>
            </select>
          </label>
          <label>
            <span>Password</span>
            <input
              name="password"
              type="password"
              value={password}
              disabled={!ready}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button
            className="button primary wide"
            type="submit"
            disabled={!ready}
          >
            Open demonstration workspace
          </button>
          <p className="login-note">
            Local-only password: <code>RadarDemo!2026</code>
          </p>
          <label className="acknowledgement">
            <input type="checkbox" defaultChecked required />
            <span>
              I acknowledge this product may not be used for credit, employment,
              insurance, housing, harassment, or automated adverse-action
              decisions.
            </span>
          </label>
        </form>
      </section>
      <section className="public-method" id="methodology">
        <div>
          <p className="eyebrow">Traceable by design</p>
          <h2>Every estimate carries its evidence chain.</h2>
        </div>
        <div className="lineage">
          {[
            "Person or region",
            "Current estimate",
            "Model run",
            "Inputs",
            "Evidence claims",
            "Source documents",
          ].map((item, index) => (
            <div key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="public-grid" id="coverage">
        <article>
          <span className="feature-index">01</span>
          <h3>Range-based estimates</h3>
          <p>
            Low, median, and high outcomes show uncertainty instead of hiding it
            behind false precision.
          </p>
        </article>
        <article>
          <span className="feature-index">02</span>
          <h3>Capital-flow geography</h3>
          <p>
            Separate creation, control, and known deployment views reveal
            regional retention and attraction.
          </p>
        </article>
        <article>
          <span className="feature-index">03</span>
          <h3>Human-reviewed evidence</h3>
          <p>
            Private transactions, low-confidence claims, and fuzzy identity
            matches remain gated for review.
          </p>
        </article>
      </section>
      <footer className="marketing-footer" id="terms">
        <span>
          © 2026 Liquidity Radar · Demonstration data is entirely fictional.
        </span>
        <span>Privacy · Corrections · Data sources · Restricted uses</span>
      </footer>
    </main>
  );
}

function Header({
  view,
  search,
  onSearch,
  role,
  onNavigate,
  activeRegion,
  onActiveRegion,
  onLogout,
  onMenu,
}: {
  view: View;
  search: string;
  onSearch: (value: string) => void;
  role: UserRole;
  onNavigate: (view: View) => void;
  activeRegion: Region;
  onActiveRegion: (slug: string) => void;
  onLogout: () => void;
  onMenu: () => void;
}) {
  return (
    <header className="app-header">
      <button
        className="mobile-menu"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        ☰
      </button>
      <div className="global-search">
        <span aria-hidden="true">⌕</span>
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          onFocus={() => view !== "people" && onNavigate("people")}
          placeholder="Search people, organizations, regions, sources…"
          aria-label="Global search"
        />
        <kbd>⌘ K</kbd>
      </div>
      <div className="header-actions">
        <label className="affinity-region-control">
          <span>Affinity region</span>
          <select
            aria-label="Affinity region"
            value={activeRegion.slug}
            onChange={(event) => onActiveRegion(event.target.value)}
          >
            {regions.map((region) => (
              <option key={region.slug} value={region.slug}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="icon-button"
          aria-label="Open notifications"
          onClick={() => onNavigate("alerts")}
        >
          <span>3</span>◌
        </button>
        <button className="account" onClick={() => onNavigate("workspace")}>
          <span>MS</span>
          <div>
            <strong>Maya Singh</strong>
            <small>
              {role === "customer"
                ? "Team plan"
                : role === "analyst"
                  ? "Analyst"
                  : "Platform admin"}
            </small>
          </div>
        </button>
        <button className="logout" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </header>
  );
}

function Sidebar({
  view,
  onNavigate,
  open,
}: {
  view: View;
  onNavigate: (view: View) => void;
  open: boolean;
}) {
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <button className="brand" onClick={() => onNavigate("dashboard")}>
        <span className="radar-mark" aria-hidden="true">
          <i />
        </span>
        <span>Liquidity Radar</span>
      </button>
      <div className="workspace-chip">
        <span>NS</span>
        <div>
          <strong>Northstar Strategy</strong>
          <small>Team workspace</small>
        </div>
        <b>⌄</b>
      </div>
      <nav className="side-nav" aria-label="Product navigation">
        {navGroups.map((group) => (
          <div className="nav-group" key={group.label}>
            <p>{group.label}</p>
            {group.items.map((item) => (
              <button
                key={item.view}
                className={
                  view === item.view ||
                  (view === "profile" && item.view === "people") ||
                  (view === "region" && item.view === "regions")
                    ? "active"
                    : ""
                }
                onClick={() => onNavigate(item.view)}
              >
                <span>{item.icon}</span>
                {item.label}
                {item.view === "review" && <b>7</b>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        <button onClick={() => onNavigate("methodology")}>Methodology</button>
        <button onClick={() => onNavigate("api")}>API documentation</button>
        <div className="coverage-mini">
          <span>Evidence coverage</span>
          <strong>84%</strong>
          <i>
            <b />
          </i>
          <small>Public SEC + reviewed private events</small>
        </div>
      </div>
    </aside>
  );
}

function PageIntro({
  view,
  actions,
}: {
  view: View;
  actions?: React.ReactNode;
}) {
  const heading = headlines[view];
  return (
    <div className="page-intro">
      <div>
        <p className="eyebrow">{heading.eyebrow}</p>
        <h1>{heading.title}</h1>
        <p>{heading.detail}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

function Dashboard({
  onNavigate,
  onPerson,
  onExport,
}: {
  onNavigate: (view: View) => void;
  onPerson: (person: Person) => void;
  onExport: () => void;
}) {
  const [period, setPeriod] = useState("90 days");
  const chartBars = [
    28, 31, 26, 39, 34, 48, 53, 46, 65, 58, 72, 68, 86, 76, 91,
  ];
  return (
    <>
      <PageIntro
        view="dashboard"
        actions={
          <>
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              aria-label="Dashboard period"
            >
              <option>30 days</option>
              <option>90 days</option>
              <option>12 months</option>
              <option>3 years</option>
            </select>
            <button className="button ghost" onClick={onExport}>
              Export snapshot
            </button>
          </>
        }
      />
      <div className="notice-bar">
        <span>Coverage note</span>
        <p>
          Demonstration values combine fictional SEC-style events and
          analyst-reviewed private transactions. Known deployment coverage is
          incomplete by design.
        </p>
        <button onClick={() => onNavigate("methodology")}>
          Read methodology →
        </button>
      </div>
      <section className="kpi-grid">
        {[
          [
            "Newly created liquidity",
            "$2.84B",
            "+18.4%",
            "Low $2.2B · High $3.7B",
          ],
          [
            "Est. remaining liquidity",
            "$6.42B",
            "+9.7%",
            "Low $4.8B · High $8.9B",
          ],
          ["High-confidence people", "184", "+23", "Confidence score ≥ 80"],
          [
            `Events · ${period}`,
            "327",
            "+14.1%",
            "264 completed · 63 proposed",
          ],
        ].map(([label, value, change, note]) => (
          <article className="kpi-card" key={label}>
            <span>{label}</span>
            <div>
              <strong>{value}</strong>
              <b>{change}</b>
            </div>
            <small>{note}</small>
          </article>
        ))}
      </section>
      <section className="dashboard-grid">
        <article className="panel capital-chart">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Confidence-adjusted</p>
              <h2>Liquidity created over time</h2>
            </div>
            <div className="legend-pills">
              <span>
                <i className="median-dot" />
                Median
              </span>
              <span>
                <i className="range-dot" />
                Estimate range
              </span>
            </div>
          </div>
          <div className="chart-y">
            <span>$800M</span>
            <span>$600M</span>
            <span>$400M</span>
            <span>$200M</span>
            <span>$0</span>
          </div>
          <div className="bar-chart" aria-label="Monthly liquidity chart">
            {chartBars.map((height, index) => (
              <div key={index}>
                <i
                  className="bar-range"
                  style={{ height: `${Math.min(100, height + 12)}%` }}
                />
                <i className="bar-median" style={{ height: `${height}%` }} />
              </div>
            ))}
          </div>
          <div className="chart-x">
            <span>Apr 7</span>
            <span>Apr 28</span>
            <span>May 19</span>
            <span>Jun 9</span>
            <span>Jun 30</span>
            <span>Jul 21</span>
          </div>
          <button className="text-link" onClick={() => onNavigate("feed")}>
            Explore all events →
          </button>
        </article>
        <article className="panel confidence-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Published estimates</p>
              <h2>Confidence distribution</h2>
            </div>
            <span className="as-of">As of Jul 24</span>
          </div>
          <div
            className="donut"
            aria-label="82 percent of published estimates have high or very high confidence"
          >
            <div>
              <strong>82%</strong>
              <span>
                High or
                <br />
                very high
              </span>
            </div>
          </div>
          <div className="confidence-legend">
            <div>
              <i className="very-high" />
              <span>Very high · 90–100</span>
              <b>74</b>
            </div>
            <div>
              <i className="high" />
              <span>High · 80–89</span>
              <b>110</b>
            </div>
            <div>
              <i className="moderate" />
              <span>Moderate · 65–79</span>
              <b>89</b>
            </div>
            <div>
              <i className="low" />
              <span>Below publication threshold</span>
              <b>54</b>
            </div>
          </div>
          <button
            className="text-link"
            onClick={() => onNavigate("methodology")}
          >
            How confidence works →
          </button>
        </article>
      </section>
      <section className="split-section">
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Largest new signals</p>
              <h2>Recent qualifying events</h2>
            </div>
            <button className="text-link" onClick={() => onNavigate("feed")}>
              View feed
            </button>
          </div>
          <div className="event-list">
            {events.slice(0, 5).map((event) => (
              <button
                className="event-row"
                key={event.id}
                onClick={() =>
                  onPerson(people.find((p) => p.name === event.person)!)
                }
              >
                <span className={`event-icon ${event.status.toLowerCase()}`}>
                  {event.type.includes("Public") ? "PS" : "EX"}
                </span>
                <span className="event-main">
                  <strong>{event.person}</strong>
                  <small>
                    {event.type} · {event.organization}
                  </small>
                </span>
                <span className="event-money">
                  <strong>{rangeMoney(event.net)}</strong>
                  <small>est. net</small>
                </span>
                <Confidence value={event.confidence} />
              </button>
            ))}
          </div>
        </article>
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Opportunity fit</p>
              <h2>Recommended matches</h2>
            </div>
            <button
              className="text-link"
              onClick={() => onNavigate("matching")}
            >
              Open matcher
            </button>
          </div>
          <div className="match-list">
            {people.slice(2, 6).map((person, index) => (
              <button key={person.id} onClick={() => onPerson(person)}>
                <span className="avatar">{person.initials}</span>
                <span>
                  <strong>{person.name}</strong>
                  <small>
                    {person.industry} · {person.location}
                  </small>
                </span>
                <b>{91 - index * 4}</b>
              </button>
            ))}
          </div>
          <div className="mini-opportunity">
            <span>Active opportunity</span>
            <strong>Southeast Health Innovation Fund</strong>
            <small>$35M target · 18 qualified matches</small>
          </div>
        </article>
      </section>
      <section className="region-strip">
        <div>
          <p className="eyebrow">Regional momentum</p>
          <h2>Markets accelerating now</h2>
        </div>
        {regions
          .slice()
          .sort((a, b) => b.momentum - a.momentum)
          .slice(0, 4)
          .map((region, index) => (
            <button key={region.slug} onClick={() => onNavigate("regions")}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{region.metro}</strong>
                <small>{money(region.created)} created</small>
              </div>
              <b>+{region.momentum}%</b>
            </button>
          ))}
      </section>
    </>
  );
}

export function SearchView({
  search,
  onSearch,
  onPerson,
  onSave,
  onExport,
}: {
  search: string;
  onSearch: (value: string) => void;
  onPerson: (person: Person) => void;
  onSave: () => void;
  onExport: (records: Person[]) => void;
}) {
  const [industry, setIndustry] = useState("All industries");
  const [location, setLocation] = useState("All locations");
  const [confidence, setConfidence] = useState("65+");
  const [sort, setSort] = useState("Remaining liquidity");
  const filtered = useMemo(
    () =>
      people
        .filter((person) => person.status !== "Pending review")
        .filter((person) =>
          `${person.name} ${person.organization} ${person.location}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .filter(
          (person) =>
            industry === "All industries" || person.industry === industry,
        )
        .filter(
          (person) =>
            location === "All locations" || person.location === location,
        )
        .filter((person) => person.confidence >= Number.parseInt(confidence))
        .sort((a, b) =>
          sort === "Radar score"
            ? b.radar - a.radar
            : b.remaining.median - a.remaining.median,
        ),
    [search, industry, location, confidence, sort],
  );
  return (
    <>
      <PageIntro
        view="people"
        actions={
          <>
            <button className="button ghost" onClick={onSave}>
              Save search
            </button>
            <button
              className="button primary"
              onClick={() => onExport(filtered)}
            >
              Export {filtered.length} results
            </button>
          </>
        }
      />
      <section className="search-panel">
        <div className="search-row">
          <label className="search-large">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search by person, company, metro…"
            />
          </label>
          <select
            value={industry}
            onChange={(event) => setIndustry(event.target.value)}
            aria-label="Industry"
          >
            <option>All industries</option>
            {Array.from(new Set(people.map((person) => person.industry))).map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
          <select
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            aria-label="Location"
          >
            <option>All locations</option>
            {Array.from(new Set(people.map((person) => person.location))).map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
          <select
            value={confidence}
            onChange={(event) => setConfidence(event.target.value)}
            aria-label="Minimum confidence"
          >
            <option>50+</option>
            <option>65+</option>
            <option>80+</option>
            <option>90+</option>
          </select>
        </div>
        <div className="filter-summary">
          <div>
            <span className="filter-chip">Published only ×</span>
            <span className="filter-chip">Confidence {confidence} ×</span>
            <button
              onClick={() => {
                setIndustry("All industries");
                setLocation("All locations");
                setConfidence("65+");
              }}
            >
              Clear filters
            </button>
          </div>
          <label>
            Sort by{" "}
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option>Remaining liquidity</option>
              <option>Radar score</option>
            </select>
          </label>
        </div>
      </section>
      <section className="panel results-panel">
        <div className="results-meta">
          <strong>{filtered.length} qualified people</strong>
          <span>Updated Jul 24, 2026 · minimum confidence {confidence}</span>
        </div>
        {filtered.length ? (
          <div className="table-wrap">
            <table className="people-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Recent event</th>
                  <th>Est. remaining liquidity</th>
                  <th>Confidence</th>
                  <th>Radar</th>
                  <th>Last event</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((person) => (
                  <tr key={person.id} onClick={() => onPerson(person)}>
                    <td>
                      <span className="avatar">{person.initials}</span>
                      <span>
                        <strong>{person.name}</strong>
                        <small>
                          {person.role} · {person.organization}
                          <br />
                          {person.location}
                        </small>
                      </span>
                    </td>
                    <td>
                      <strong>{person.eventType}</strong>
                      <small>{person.industry}</small>
                    </td>
                    <td>
                      <strong>{rangeMoney(person.remaining)}</strong>
                      <small>Median {money(person.remaining.median)}</small>
                    </td>
                    <td>
                      <Confidence value={person.confidence} />
                    </td>
                    <td>
                      <span className="score">{person.radar}</span>
                    </td>
                    <td>{dateLabel(person.eventDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span>⌕</span>
            <h3>No qualified records match these filters.</h3>
            <p>Broaden the geography, industry, or confidence threshold.</p>
          </div>
        )}
      </section>
    </>
  );
}

function PersonProfile({
  person,
  activeRegion,
  onActiveRegion,
  onRegion,
  onBack,
  onAction,
}: {
  person: Person;
  activeRegion: Region;
  onActiveRegion: (slug: string) => void;
  onRegion: (slug: string) => void;
  onBack: () => void;
  onAction: (message: string) => void;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(0);
  const [affinityOpen, setAffinityOpen] = useState(false);
  const [timeline, setTimeline] = useState<"all" | "liquidity" | "deployment">(
    "all",
  );
  const affinity = calculateAffinity(person, activeRegion, regions);
  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <button onClick={() => onRegion(person.primaryRegionSlug)}>
          National Map
        </button>
        <span>
          /{" "}
          <button onClick={() => onRegion(person.primaryRegionSlug)}>
            {getRegion(person.primaryRegionSlug)?.name ?? person.location}
          </button>
        </span>
        <span>/ {person.name}</span>
      </nav>
      <button className="back-link" onClick={onBack}>
        ← Back to people
      </button>
      <section className="profile-hero">
        <div className="profile-person">
          <span className="avatar xl">{person.initials}</span>
          <div>
            <div className="profile-title-row">
              <h1>{person.name}</h1>
              {person.status === "Claimed" && (
                <span className="verified">Claimed</span>
              )}
            </div>
            <p>
              {person.role} at {person.organization}
            </p>
            <span>
              {person.industry} ·{" "}
              <button
                className="inline-region-link"
                onClick={() => onRegion(person.primaryRegionSlug)}
              >
                {person.location}
              </button>{" "}
              · City-level location only
            </span>
          </div>
        </div>
        <div className="profile-estimate">
          <span>Estimated remaining liquidity</span>
          <strong>{rangeMoney(person.remaining)}</strong>
          <small>
            Median {money(person.remaining.median)} · calculated Jul 24, 2026
          </small>
          <div>
            <Confidence value={person.confidence} />
            <span>
              Radar score <b>{person.radar}</b>
            </span>
          </div>
        </div>
        <div className="profile-actions">
          <button
            className="button ghost"
            onClick={() =>
              onAction(`${person.name} added to Founders watchlist`)
            }
          >
            ＋ Add to list
          </button>
          <button
            className="button ghost"
            onClick={() => onAction(`Alert created for ${person.name}`)}
          >
            ◌ Create alert
          </button>
          <button
            className="button primary"
            onClick={() => onAction(`Dossier generated for ${person.name}`)}
          >
            Generate dossier
          </button>
        </div>
      </section>
      <div className="profile-notice">
        <strong>Estimate, not a bank balance.</strong>
        <span>
          This range models potentially deployable liquidity from documented
          events, less known and modeled deployment.
        </span>
        <button onClick={() => onAction("Correction workflow opened")}>
          Claim or correct profile
        </button>
      </div>
      <section className="profile-affinity-summary">
        <div>
          <p className="eyebrow">Region-relative geographic affinity</p>
          <h2>
            Affinity to {activeRegion.name}: {affinity.score}/100
          </h2>
          <p>
            {affinity.evidenceCount} evidence-linked geographic relationships ·
            calculated {dateLabel(affinity.calculatedAt)}
          </p>
        </div>
        <label>
          Compare with
          <select
            aria-label="Profile affinity comparison region"
            value={activeRegion.slug}
            onChange={(event) => onActiveRegion(event.target.value)}
          >
            {regions.map((region) => (
              <option key={region.slug} value={region.slug}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button ghost"
          aria-expanded={affinityOpen}
          onClick={() => setAffinityOpen((value) => !value)}
        >
          Why this score?
        </button>
        {affinityOpen && (
          <div className="affinity-explanation">
            {affinity.components.length ? (
              affinity.components.map((component) => (
                <article key={component.type}>
                  <div>
                    <strong>{component.label}</strong>
                    <b>+{component.points}</b>
                  </div>
                  {component.reasons.map((reason, index) => (
                    <button
                      key={reason}
                      onClick={() =>
                        onAction(
                          `Opened geographic evidence ${index + 1} for ${component.label}`,
                        )
                      }
                    >
                      {reason} ↗
                    </button>
                  ))}
                  <small>
                    {component.evidenceCount} supporting evidence item(s)
                  </small>
                </article>
              ))
            ) : (
              <p>
                No documented geographic relationships currently connect this
                person to {activeRegion.name}.
              </p>
            )}
          </div>
        )}
      </section>
      <section className="profile-kpis">
        {[
          [
            "Liquidity created",
            rangeMoney(person.created),
            money(person.created.median),
          ],
          [
            "Estimated net proceeds",
            rangeMoney({
              low: person.created.low * 0.64,
              median: person.created.median * 0.7,
              high: person.created.high * 0.76,
            }),
            "after taxes, fees & holdbacks",
          ],
          [
            "Known deployments",
            rangeMoney(person.deployed),
            `${person.sourceCount - 1} documented events`,
          ],
          [
            "Modeled unobserved deployment",
            "$4.2M–$15.8M",
            "transparent model assumption",
          ],
          ["Qualifying events", "3", "2 liquidity · 1 proposed"],
        ].map(([label, value, note]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>
      <section className="profile-layout">
        <div className="profile-primary">
          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Chronological reconciliation</p>
                <h2>Liquidity ledger</h2>
              </div>
              <span className="as-of">USD · estimated ranges</span>
            </div>
            <div className="ledger">
              <div className="ledger-row header">
                <span>Date</span>
                <span>Event</span>
                <span>Effect</span>
                <span>Low</span>
                <span>Median</span>
                <span>High</span>
                <span>Confidence</span>
              </div>
              <div className="ledger-row">
                <span>May 2026</span>
                <span>
                  <strong>{person.eventType}</strong>
                  <small>{person.organization}</small>
                </span>
                <span className="positive">+ liquidity</span>
                <span>{money(person.created.low)}</span>
                <span>{money(person.created.median)}</span>
                <span>{money(person.created.high)}</span>
                <Confidence value={person.confidence} />
              </div>
              <div className="ledger-row">
                <span>Jun 2026</span>
                <span>
                  <strong>Known fund commitment</strong>
                  <small>Fieldstone Opportunity Fund I</small>
                </span>
                <span className="negative">− deployment</span>
                <span>{money(person.deployed.low)}</span>
                <span>{money(person.deployed.median)}</span>
                <span>{money(person.deployed.high)}</span>
                <Confidence value={84} />
              </div>
              <div className="ledger-row">
                <span>Jul 2026</span>
                <span>
                  <strong>Unobserved deployment model</strong>
                  <small>Time-adjusted assumption</small>
                </span>
                <span className="negative">− modeled</span>
                <span>$4.2M</span>
                <span>$9.1M</span>
                <span>$15.8M</span>
                <Confidence value={61} />
              </div>
              <div className="ledger-total">
                <span>Estimated remaining liquidity</span>
                <strong>{rangeMoney(person.remaining)}</strong>
                <small>Never reduced below zero</small>
              </div>
            </div>
          </article>
          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Source-to-estimate</p>
                <h2>Evidence & model inputs</h2>
              </div>
              <span className="as-of">Model LR-EXIT 2.4</span>
            </div>
            <div className="evidence-list">
              {evidence.map((item, index) => (
                <button
                  key={item.label}
                  className={evidenceOpen === index ? "open" : ""}
                  onClick={() => setEvidenceOpen(index)}
                >
                  <div>
                    <Classification kind={item.kind} />
                    <strong>{item.label}</strong>
                    <b>{item.value}</b>
                    <span>{evidenceOpen === index ? "−" : "+"}</span>
                  </div>
                  {evidenceOpen === index && (
                    <div className="evidence-detail">
                      <p>“{item.excerpt}”</p>
                      <footer>
                        <span>{item.source}</span>
                        <span>Analyst reviewed · Jul 23, 2026</span>
                      </footer>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </article>
          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Documented activity</p>
                <h2>Combined event timeline</h2>
              </div>
              <div className="segmented">
                {(["all", "liquidity", "deployment"] as const).map((value) => (
                  <button
                    key={value}
                    className={timeline === value ? "active" : ""}
                    onClick={() => setTimeline(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <div className="timeline">
              {[
                [
                  "Jul 18, 2026",
                  "deployment",
                  "Angel investment in Waypoint Diagnostics",
                  "$2M–$4M",
                  "known deployment",
                ],
                [
                  "Jun 3, 2026",
                  "deployment",
                  "Fieldstone Opportunity Fund I commitment",
                  "$8M–$12M",
                  "known deployment",
                ],
                [
                  "May 14, 2026",
                  "liquidity",
                  person.eventType,
                  rangeMoney(person.created),
                  "liquidity creation",
                ],
                [
                  "Feb 8, 2026",
                  "liquidity",
                  "Proposed secondary disposition",
                  "$9M–$14M",
                  "proposed · not completed",
                ],
              ]
                .filter((item) => timeline === "all" || item[1] === timeline)
                .map((item) => (
                  <div key={item[0]}>
                    <span />
                    <time>{item[0]}</time>
                    <div>
                      <Classification
                        kind={
                          item[1] === "deployment" ? "observed" : "calculated"
                        }
                      />
                      <strong>{item[2]}</strong>
                      <small>{item[4]}</small>
                    </div>
                    <b>{item[3]}</b>
                  </div>
                ))}
            </div>
          </article>
        </div>
        <aside className="profile-secondary">
          <article className="panel">
            <p className="eyebrow">Primary uncertainty</p>
            <h2>What moves the range</h2>
            {[
              ["Founder ownership", 42],
              ["Cash vs. stock", 31],
              ["Tax treatment", 18],
            ].map(([label, value], index) => (
              <div className="driver" key={String(label)}>
                <span>
                  {index + 1}. {label}
                </span>
                <i>
                  <b style={{ width: `${value}%` }} />
                </i>
                <strong>{value}%</strong>
              </div>
            ))}
            <p className="panel-note">
              Sensitivity share estimates each input’s contribution to modeled
              output variance.
            </p>
          </article>
          <article className="panel">
            <p className="eyebrow">Geographic relationships</p>
            <h2>Affinity to {activeRegion.name}</h2>
            {person.geographicRelationships.map((relationship) => (
              <button
                className="affinity geographic-link"
                key={`${relationship.type}-${relationship.evidenceId}`}
                onClick={() => onRegion(relationship.regionSlug)}
              >
                <span className="pin">•</span>
                <div>
                  <small>{relationship.type.replace(/_/g, " ")}</small>
                  <strong>
                    {getRegion(relationship.regionSlug)?.name ??
                      relationship.regionSlug}
                  </strong>
                </div>
                <span>Open region →</span>
              </button>
            ))}
            <p className="panel-note">
              No street-level residential data is stored or shown.
            </p>
          </article>
          <article className="panel">
            <p className="eyebrow">Known deployment profile</p>
            <h2>Interests & behavior</h2>
            <div className="tag-cloud">
              {[
                "Health technology",
                "B2B software",
                "Southeast",
                "$1M–$5M checks",
                "Early growth",
                "Board participation",
              ].map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <button
              className="button ghost wide"
              onClick={() => onAction("Match analysis generated")}
            >
              Generate match analysis
            </button>
          </article>
        </aside>
      </section>
    </>
  );
}

export function FeedView({
  onPerson,
  onSave,
}: {
  onPerson: (person: Person) => void;
  onSave: (message: string) => void;
}) {
  const [status, setStatus] = useState("All statuses");
  const [eventType, setEventType] = useState("All event types");
  const [sort, setSort] = useState("Newest first");
  const filtered = events
    .filter((event) => status === "All statuses" || event.status === status)
    .filter(
      (event) => eventType === "All event types" || event.type === eventType,
    )
    .slice(0, 18);
  return (
    <>
      <PageIntro
        view="feed"
        actions={
          <button
            className="button primary"
            onClick={() => onSave("Event feed saved as a workspace search")}
          >
            Save this feed
          </button>
        }
      />
      <section className="filter-bar">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option>All statuses</option>
          <option>Completed</option>
          <option>Proposed</option>
          <option>Announced</option>
          <option>Withdrawn</option>
        </select>
        <select
          value={eventType}
          onChange={(event) => setEventType(event.target.value)}
        >
          <option>All event types</option>
          {Array.from(new Set(events.map((event) => event.type))).map(
            (type) => (
              <option key={type}>{type}</option>
            ),
          )}
        </select>
        <span className="filter-chip">Last 90 days ×</span>
        <span className="filter-chip">Confidence 65+ ×</span>
        <label>
          Sort{" "}
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option>Newest first</option>
            <option>Largest median</option>
            <option>Highest confidence</option>
          </select>
        </label>
      </section>
      <section className="feed-list">
        {filtered.map((event) => (
          <article className="feed-card" key={event.id}>
            <div className="feed-status">
              <span className={`event-icon ${event.status.toLowerCase()}`}>
                {event.type.includes("Public") ? "PS" : "EX"}
              </span>
              <span className={`status ${event.status.toLowerCase()}`}>
                {event.status}
              </span>
            </div>
            <div className="feed-content">
              <div>
                <p className="eyebrow">
                  {event.type} · {event.place}
                </p>
                <button
                  onClick={() =>
                    onPerson(
                      people.find((person) => person.name === event.person)!,
                    )
                  }
                >
                  {event.person}
                </button>
                <span>{event.organization}</span>
              </div>
              <p>{event.explanation}</p>
              <div className="feed-source">
                <Classification kind={event.classification} />
                <span>{event.source}</span>
                <span>Source date {dateLabel(event.sourceDate)}</span>
              </div>
            </div>
            <div className="feed-values">
              <span>
                Gross {event.status === "Completed" ? "calculated" : "estimate"}
              </span>
              <strong>{rangeMoney(event.gross)}</strong>
              <span>Estimated net</span>
              <b>{rangeMoney(event.net)}</b>
              <Confidence value={event.confidence} />
            </div>
            <div className="feed-actions">
              <button
                onClick={() => onSave(`${event.person} added to watchlist`)}
              >
                Watch
              </button>
              <button onClick={() => onSave(`${event.id} saved to workspace`)}>
                Save
              </button>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

export function RegionsView({
  onNavigate,
}: {
  onNavigate: (view: View) => void;
}) {
  const [compare, setCompare] = useState("Capital created");
  return (
    <>
      <PageIntro
        view="regions"
        actions={
          <select
            value={compare}
            onChange={(event) => setCompare(event.target.value)}
          >
            <option>Capital created</option>
            <option>Estimated remaining</option>
            <option>Known deployment</option>
            <option>Retention ratio</option>
          </select>
        }
      />
      <section className="region-cards">
        {regions.slice(0, 6).map((region) => (
          <article key={region.slug}>
            <div>
              <span>{region.code}</span>
              <b>+{region.momentum}% momentum</b>
            </div>
            <h2>{region.metro}</h2>
            <p>{region.name}</p>
            <dl>
              <div>
                <dt>Liquidity created</dt>
                <dd>{money(region.created)}</dd>
              </div>
              <div>
                <dt>Est. controlled locally</dt>
                <dd>{money(region.controlled)}</dd>
              </div>
              <div>
                <dt>Known deployment</dt>
                <dd>{money(region.deployed)}</dd>
              </div>
            </dl>
            <div className="ratio-pair">
              <span>
                <small>Retention</small>
                <strong>{percent(region.retained)}</strong>
              </span>
              <span>
                <small>Leakage</small>
                <strong>{percent(region.leakage)}</strong>
              </span>
              <span>
                <small>Attraction</small>
                <strong>{percent(region.attraction)}</strong>
              </span>
            </div>
            <button
              className="button ghost wide"
              onClick={() => onNavigate("map")}
            >
              Open regional map
            </button>
          </article>
        ))}
      </section>
      <div className="coverage-footnote">
        <strong>Known deployment only.</strong> Ratios do not assume unobserved
        activity is zero. Event-origin, person-control, and
        deployment-destination totals are calculated separately.
      </div>
    </>
  );
}

function RankingsView({
  onPerson,
  onExport,
  activeRegion,
}: {
  onPerson: (person: Person) => void;
  onExport: () => void;
  activeRegion: Region;
}) {
  const [metric, setMetric] = useState("Estimated remaining liquidity");
  const ranked = people
    .filter(
      (person) => person.confidence >= 65 && person.status !== "Pending review",
    )
    .sort((a, b) =>
      metric === "Radar score"
        ? b.radar - a.radar
        : metric.startsWith("Affinity to")
          ? calculateAffinity(b, activeRegion, regions).score -
            calculateAffinity(a, activeRegion, regions).score
          : b.remaining.median - a.remaining.median,
    )
    .slice(0, 15);
  return (
    <>
      <PageIntro
        view="rankings"
        actions={
          <button className="button primary" onClick={onExport}>
            Export ranking
          </button>
        }
      />
      <section className="ranking-tabs">
        {[
          "Estimated remaining liquidity",
          "Confidence-adjusted liquidity",
          "Radar score",
          "Post-exit activity",
          `Affinity to ${activeRegion.name}`,
        ].map((value) => (
          <button
            className={metric === value ? "active" : ""}
            key={value}
            onClick={() => setMetric(value)}
          >
            {value}
          </button>
        ))}
      </section>
      <section className="panel ranking-panel">
        <div className="ranking-method">
          <span>Method: {metric}</span>
          <span>Data date: Jul 24, 2026</span>
          <span>Minimum confidence: 65</span>
          <button>Methodology ↗</button>
        </div>
        {ranked.map((person, index) => (
          <button
            className="ranking-row"
            key={person.id}
            onClick={() => onPerson(person)}
          >
            <span className={`rank ${index < 3 ? "top" : ""}`}>
              {index + 1}
            </span>
            <span className="avatar">{person.initials}</span>
            <span className="rank-name">
              <strong>{person.name}</strong>
              <small>
                {person.organization} · {person.location}
              </small>
            </span>
            <span>
              <small>Estimated range</small>
              <strong>{rangeMoney(person.remaining)}</strong>
            </span>
            <span>
              <small>Confidence</small>
              <Confidence value={person.confidence} />
            </span>
            <span>
              <small>Radar</small>
              <b className="score">{person.radar}</b>
            </span>
            <span>
              <small>Affinity to {activeRegion.name}</small>
              <b className="score">
                {calculateAffinity(person, activeRegion, regions).score}
              </b>
            </span>
            <span className="momentum">+{person.momentum}%</span>
          </button>
        ))}
      </section>
    </>
  );
}

function MatchingView({
  onPerson,
  notify,
  activeRegion,
}: {
  onPerson: (person: Person) => void;
  notify: (message: string) => void;
  activeRegion: Region;
}) {
  const [generated, setGenerated] = useState(false);
  const [industry, setIndustry] = useState("Healthcare");
  const [geography, setGeography] = useState("Southeast");
  const [target, setTarget] = useState("$35M");
  const results = people
    .slice(0, 8)
    .map((person, index) => ({
      person,
      score: matchScore({
        capacity: 0.93 - index * 0.025,
        confidence: person.confidence / 100,
        sectorAffinity: index % 3 === 0 ? 0.95 : 0.78,
        geographicAffinity:
          calculateAffinity(person, activeRegion, regions).score / 100,
        checkSizeFit: 0.88 - index * 0.02,
        deploymentPropensity: 0.82,
        recency: 0.9 - index * 0.04,
      }),
    }))
    .sort((a, b) => b.score - a.score);
  return (
    <>
      <PageIntro
        view="matching"
        actions={
          generated ? (
            <button
              className="button ghost"
              onClick={() => notify("Capital-match report queued")}
            >
              Generate report
            </button>
          ) : undefined
        }
      />
      {!generated ? (
        <form
          className="opportunity-form"
          onSubmit={(event) => {
            event.preventDefault();
            setGenerated(true);
            notify("18 evidence-qualified matches generated");
          }}
        >
          <div className="form-head">
            <span>01</span>
            <div>
              <h2>Define the opportunity</h2>
              <p>
                Capacity and fit are estimated from public and user-supplied
                evidence. No private contact details are used.
              </p>
            </div>
          </div>
          <div className="form-grid">
            <label className="span-2">
              <span>Opportunity name</span>
              <input defaultValue="Southeast Health Innovation Fund" required />
            </label>
            <label>
              <span>Opportunity type</span>
              <select defaultValue="Fundraising">
                <option>Fundraising</option>
                <option>Startup financing</option>
                <option>Acquisition</option>
                <option>Real estate development</option>
                <option>Philanthropic initiative</option>
              </select>
            </label>
            <label>
              <span>Target raise</span>
              <input
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              />
            </label>
            <label>
              <span>Minimum check</span>
              <input defaultValue="$1M" />
            </label>
            <label>
              <span>Maximum check</span>
              <input defaultValue="$7.5M" />
            </label>
            <label>
              <span>Industry</span>
              <select
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
              >
                <option>Healthcare</option>
                <option>Life Sciences</option>
                <option>Enterprise Software</option>
                <option>Climate Technology</option>
              </select>
            </label>
            <label>
              <span>Geographic focus</span>
              <select
                value={geography}
                onChange={(event) => setGeography(event.target.value)}
              >
                <option>Southeast</option>
                <option>National</option>
                <option>New England</option>
                <option>Mountain West</option>
              </select>
            </label>
            <label>
              <span>Stage</span>
              <select>
                <option>Early growth</option>
                <option>Seed</option>
                <option>Late growth</option>
                <option>Buyout</option>
              </select>
            </label>
            <label>
              <span>Structure</span>
              <select>
                <option>Limited partnership</option>
                <option>Preferred equity</option>
                <option>Common equity</option>
                <option>Debt</option>
              </select>
            </label>
            <label className="span-2">
              <span>Strategic keywords</span>
              <input defaultValue="care delivery, diagnostics, health equity, clinical workflow" />
            </label>
            <label className="span-2">
              <span>Opportunity summary</span>
              <textarea defaultValue="A growth-oriented fund investing in evidence-based healthcare delivery and diagnostics businesses across the Southeast." />
            </label>
          </div>
          <div className="restricted-check">
            <strong>Restricted-use check</strong>
            <span>
              This commercial fundraising workflow is permitted. Screening for
              credit, employment, insurance, or housing is prohibited.
            </span>
            <b>Passed</b>
          </div>
          <button className="button primary" type="submit">
            Generate explained matches
          </button>
        </form>
      ) : (
        <>
          <section className="match-summary">
            <div>
              <p className="eyebrow">Opportunity</p>
              <h2>Southeast Health Innovation Fund</h2>
              <span>
                {target} target · {industry} · {geography} · $1M–$7.5M checks
              </span>
            </div>
            <div>
              <strong>18</strong>
              <span>qualified matches</span>
            </div>
            <div>
              <strong>84</strong>
              <span>top match score</span>
            </div>
            <button
              className="button ghost"
              onClick={() => setGenerated(false)}
            >
              Edit opportunity
            </button>
          </section>
          <section className="match-results">
            {results.map(({ person, score }, index) => (
              <article key={person.id}>
                <span className="match-rank">{index + 1}</span>
                <span className="avatar large">{person.initials}</span>
                <div className="match-person">
                  <button onClick={() => onPerson(person)}>
                    {person.name}
                  </button>
                  <span>
                    {person.role} · {person.organization}
                  </span>
                  <small>{person.location}</small>
                </div>
                <div className="match-score">
                  <strong>{score}</strong>
                  <span>match score</span>
                </div>
                <div className="match-reasons">
                  <span>
                    <i style={{ width: "92%" }} />
                    Sector affinity <b>92</b>
                  </span>
                  <span>
                    <i style={{ width: "88%" }} />
                    Check-size fit <b>88</b>
                  </span>
                  <span>
                    <i
                      style={{
                        width: `${
                          calculateAffinity(person, activeRegion, regions).score
                        }%`,
                      }}
                    />
                    Affinity to {activeRegion.name}{" "}
                    <b>
                      {calculateAffinity(person, activeRegion, regions).score}
                    </b>
                  </span>
                </div>
                <div className="match-capacity">
                  <span>Estimated deployable range</span>
                  <strong>{rangeMoney(person.remaining)}</strong>
                  <small>{person.confidence}% evidence confidence</small>
                </div>
                <p>
                  <strong>Why this match:</strong> Documented{" "}
                  {person.industry.toLowerCase()} activity, a current{" "}
                  {person.location.split(",")[0]} affinity, a recent qualifying
                  liquidity event, and known investments consistent with the
                  opportunity’s check size.{" "}
                  <em>Public professional channels only.</em>
                </p>
                <button
                  className="button ghost"
                  onClick={() =>
                    notify(`${person.name} added to match shortlist`)
                  }
                >
                  Add to shortlist
                </button>
              </article>
            ))}
          </section>
        </>
      )}
    </>
  );
}

function WorkspaceViews({
  view,
  notify,
  onPerson,
  onExport,
}: {
  view: View;
  notify: (message: string) => void;
  onPerson: (person: Person) => void;
  onExport: () => void;
}) {
  const [alertRows, setAlertRows] = useState(seedAlerts);
  const [reporting, setReporting] = useState("");
  const [plan, setPlan] = useState("Team");
  const [apiKey, setApiKey] = useState("");

  if (view === "saved") {
    return (
      <>
        <PageIntro
          view="saved"
          actions={
            <button
              className="button primary"
              onClick={() => notify("Blank saved-search builder opened")}
            >
              New saved search
            </button>
          }
        />
        <section className="card-list">
          {savedSearches.map((item, index) => (
            <article key={item.name}>
              <span className="list-icon">SS</span>
              <div>
                <h2>{item.name}</h2>
                <p>
                  {item.results} current results · Updated {item.updated}
                </p>
                <small>Owner: {item.owner} · 6 active filters</small>
              </div>
              <div>
                <button
                  className="button ghost"
                  onClick={() =>
                    notify(`${item.name} opened with current results`)
                  }
                >
                  Open results
                </button>
                <button
                  className="dots"
                  onClick={() => notify("Saved-search actions opened")}
                >
                  •••
                </button>
              </div>
              {index === 0 && <span className="shared-badge">shared</span>}
            </article>
          ))}
        </section>
      </>
    );
  }
  if (view === "alerts") {
    return (
      <>
        <PageIntro
          view="alerts"
          actions={
            <button
              className="button primary"
              onClick={() => {
                const row = {
                  name: "New healthcare event above $20M",
                  frequency: "Immediate",
                  last: "Not yet delivered",
                  active: true,
                };
                setAlertRows([row, ...alertRows]);
                notify("Alert created and saved");
              }}
            >
              Create alert
            </button>
          }
        />
        <section className="alert-layout">
          <div className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Configured alerts</p>
                <h2>
                  {alertRows.filter((item) => item.active).length} active rules
                </h2>
              </div>
            </div>
            {alertRows.map((item, index) => (
              <div className="alert-row" key={`${item.name}-${index}`}>
                <span className="list-icon">AL</span>
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.frequency} · {item.last}
                  </span>
                  <small>
                    In-app delivery · deduplicated by event and rule
                  </small>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={item.active}
                    onChange={() =>
                      setAlertRows(
                        alertRows.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, active: !row.active }
                            : row,
                        ),
                      )
                    }
                  />
                  <i />
                </label>
                <button
                  className="dots"
                  onClick={() => notify("Alert editor opened")}
                >
                  •••
                </button>
              </div>
            ))}
          </div>
          <aside className="panel message-center">
            <p className="eyebrow">Local message center</p>
            <h2>Recent deliveries</h2>
            {events.slice(0, 4).map((event) => (
              <button
                key={event.id}
                onClick={() =>
                  onPerson(
                    people.find((person) => person.name === event.person)!,
                  )
                }
              >
                <span>New signal</span>
                <strong>{event.person}</strong>
                <small>
                  {event.type} · {rangeMoney(event.net)}
                </small>
                <time>{dateLabel(event.date)}</time>
              </button>
            ))}
            <p className="panel-note">
              Email credentials are not configured, so deliveries remain
              testable here.
            </p>
          </aside>
        </section>
      </>
    );
  }
  if (view === "reports") {
    const reportTypes = [
      "Person dossier",
      "Regional liquidity report",
      "Industry liquidity report",
      "Saved-search report",
      "Capital-match report",
    ];
    return (
      <>
        <PageIntro
          view="reports"
          actions={
            <button className="button ghost" onClick={onExport}>
              Export people CSV
            </button>
          }
        />
        <section className="report-grid">
          {reportTypes.map((type, index) => (
            <article key={type}>
              <span className="report-icon">0{index + 1}</span>
              <h2>{type}</h2>
              <p>
                {index === 0
                  ? "Evidence-linked person estimate, ledger, timeline, and source references."
                  : index === 1
                    ? "Creation, control, known deployment, regional flows, and peer comparisons."
                    : "Applied filters, confidence notes, data date, methodology, and source references."}
              </p>
              <button
                className="button primary"
                disabled={reporting === type}
                onClick={async () => {
                  setReporting(type);
                  const { jsPDF } = await import("jspdf");
                  const pdf = new jsPDF();
                  pdf.setFillColor(8, 21, 32);
                  pdf.rect(0, 0, 210, 38, "F");
                  pdf.setTextColor(255, 255, 255);
                  pdf.setFontSize(22);
                  pdf.text("Liquidity Radar", 16, 19);
                  pdf.setFontSize(10);
                  pdf.text("Private capital, mapped.", 16, 28);
                  pdf.setTextColor(20, 35, 46);
                  pdf.setFontSize(18);
                  pdf.text(type, 16, 55);
                  pdf.setFontSize(10);
                  pdf.text(
                    "Northstar Strategy · Generated July 24, 2026 · Fictional demonstration data",
                    16,
                    65,
                  );
                  pdf.setFontSize(12);
                  pdf.text(
                    "Estimated values are shown as ranges and are not bank balances.",
                    16,
                    82,
                  );
                  pdf.text("Low estimate: $48.2M", 16, 98);
                  pdf.text("Median estimate: $67.0M", 16, 108);
                  pdf.text("High estimate: $91.1M", 16, 118);
                  pdf.text("Evidence confidence: 84 / 100", 16, 128);
                  pdf.setFontSize(9);
                  pdf.text(
                    "Methodology note: outputs reflect documented events, explicit uncertain inputs,",
                    16,
                    152,
                  );
                  pdf.text(
                    "known deployment, modeled unobserved deployment, and source-linked evidence.",
                    16,
                    160,
                  );
                  pdf.save(`${type.toLowerCase().replace(/\s+/g, "-")}.pdf`);
                  setReporting("");
                  notify(`${type} PDF generated`);
                }}
              >
                {reporting === type ? "Generating…" : "Generate PDF"}
              </button>
            </article>
          ))}
        </section>
        <section className="panel export-history">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Audit history</p>
              <h2>Recent exports</h2>
            </div>
          </div>
          {[
            "Southeast healthcare people.csv",
            "Boston capital report.pdf",
            "Growth-stage matches.pdf",
            "Public sales · 90 days.csv",
          ].map((file, index) => (
            <div key={file}>
              <span className="file-icon">
                {file.endsWith("pdf") ? "PDF" : "CSV"}
              </span>
              <span>
                <strong>{file}</strong>
                <small>
                  Generated by Maya Singh · {index + 1} day{index ? "s" : ""}{" "}
                  ago
                </small>
              </span>
              <b>Ready</b>
              <button onClick={() => notify(`${file} download started`)}>
                Download
              </button>
            </div>
          ))}
        </section>
      </>
    );
  }
  if (view === "workspace") {
    return (
      <>
        <PageIntro
          view="workspace"
          actions={
            <button
              className="button primary"
              onClick={() => notify("Member invitation form opened")}
            >
              Invite member
            </button>
          }
        />
        <section className="workspace-grid">
          <article className="panel plan-card">
            <p className="eyebrow">Current plan</p>
            <div>
              <h2>{plan}</h2>
              <strong>
                {plan === "Professional"
                  ? "$499/mo"
                  : plan === "Team"
                    ? "$1,500/mo"
                    : "$25,000/yr+"}
              </strong>
            </div>
            <p>
              {plan === "Team"
                ? "5 included seats · shared lists · regional reports · higher API and export limits"
                : "Entitlements update immediately in the local billing simulator."}
            </p>
            <label>
              Simulate plan change
              <select
                value={plan}
                onChange={(event) => {
                  setPlan(event.target.value);
                  notify(`Workspace plan changed to ${event.target.value}`);
                }}
              >
                <option>Professional</option>
                <option>Team</option>
                <option>Enterprise</option>
              </select>
            </label>
          </article>
          <article className="panel usage-card">
            <p className="eyebrow">July usage</p>
            <h2>Entitlement usage</h2>
            {[
              ["Seats", "4 / 5", 80],
              ["CSV exports", "18 / 50", 36],
              ["PDF reports", "7 / 25", 28],
              ["API calls", "8,420 / 25,000", 34],
              ["Active alerts", "4 / 20", 20],
            ].map(([label, value, amount]) => (
              <div key={String(label)}>
                <span>{label}</span>
                <strong>{value}</strong>
                <i>
                  <b style={{ width: `${amount}%` }} />
                </i>
              </div>
            ))}
          </article>
          <article className="panel members-card">
            <p className="eyebrow">Access</p>
            <h2>Workspace members</h2>
            {[
              ["Maya Singh", "Workspace admin", "MS"],
              ["Jordan Lee", "Workspace member", "JL"],
              ["Sofia Brooks", "Workspace member", "SB"],
              ["API Service", "API only", "API"],
            ].map(([name, role, initials]) => (
              <div key={name}>
                <span className="avatar">{initials}</span>
                <span>
                  <strong>{name}</strong>
                  <small>{role}</small>
                </span>
                <b>Active</b>
                <button>•••</button>
              </div>
            ))}
          </article>
          <article className="panel api-card">
            <p className="eyebrow">Developer access</p>
            <h2>API keys</h2>
            {apiKey ? (
              <div className="secret-once">
                <strong>Copy this secret now</strong>
                <code>{apiKey}</code>
                <small>
                  It will not be shown again. Only its SHA-256 hash is stored.
                </small>
              </div>
            ) : (
              <p>
                Create a workspace-scoped key for published records. Requests
                are rate-limited and audited.
              </p>
            )}
            <button
              className="button ghost"
              onClick={() => {
                const secret = `lr_live_${crypto.randomUUID().replace(/-/g, "").slice(0, 28)}`;
                setApiKey(secret);
                notify("API key created; copy it now");
              }}
            >
              Create API key
            </button>
          </article>
        </section>
        <section className="restricted-ack panel">
          <span>✓</span>
          <div>
            <strong>Restricted-use acknowledgement accepted</strong>
            <p>
              Accepted by Maya Singh on Jul 1, 2026. Renewal due Jul 1, 2027.
            </p>
          </div>
          <button>Review terms</button>
        </section>
      </>
    );
  }
  return null;
}

function RegionalPreferenceCard({
  homeRegion,
  activeRegion,
  onHomeRegion,
}: {
  homeRegion: Region;
  activeRegion: Region;
  onHomeRegion: (slug: string) => void;
}) {
  return (
    <section className="panel regional-preferences">
      <div>
        <p className="eyebrow">Workspace Settings → Regional Preferences</p>
        <h2>Regional preferences</h2>
        <p>
          The workspace home region is the default affinity reference when no
          URL or recent user selection is available.
        </p>
      </div>
      <label>
        Workspace home region
        <select
          aria-label="Workspace home region"
          value={homeRegion.slug}
          onChange={(event) => onHomeRegion(event.target.value)}
        >
          {regions.map((region) => (
            <option key={region.slug} value={region.slug}>
              {region.name}
            </option>
          ))}
        </select>
      </label>
      <dl>
        <div>
          <dt>Current home region</dt>
          <dd>{homeRegion.name}</dd>
        </div>
        <div>
          <dt>Your active affinity region</dt>
          <dd>{activeRegion.name}</dd>
        </div>
      </dl>
    </section>
  );
}

function OperationsViews({
  view,
  notify,
}: {
  view: View;
  notify: (message: string) => void;
}) {
  const [queue, setQueue] = useState(reviewQueue);
  const [selected, setSelected] = useState(0);
  const [identities, setIdentities] = useState([
    {
      source: "M. Navarro",
      candidate: "Theo Navarro",
      organization: "Cedarline Software",
      score: 86,
      signals: "Name · organization · role",
    },
    {
      source: "Amara J. Voss",
      candidate: "Amara Voss",
      organization: "Northstar BioSystems",
      score: 94,
      signals: "Owner CIK · exact name",
    },
    {
      source: "J. Mercer",
      candidate: "Julian Mercer",
      organization: "Mercury Robotics",
      score: 72,
      signals: "Name · geography · time overlap",
    },
    {
      source: "P. Kapoor",
      candidate: "Priya Kapoor",
      organization: "Signal Orchard",
      score: 79,
      signals: "Name · former company",
    },
  ]);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  if (view === "review") {
    const item = queue[selected] || queue[0];
    return (
      <>
        <PageIntro
          view="review"
          actions={
            <>
              <span className="queue-count">{queue.length} items</span>
              <button
                className="button ghost"
                onClick={() => notify("Review queue filters opened")}
              >
                Queue filters
              </button>
            </>
          }
        />
        {item ? (
          <section className="review-layout">
            <aside className="review-queue">
              {queue.map((row, index) => (
                <button
                  className={selected === index ? "active" : ""}
                  key={row.id}
                  onClick={() => setSelected(index)}
                >
                  <span>
                    <Classification kind={row.classification} />
                    <b>{row.reviewType}</b>
                  </span>
                  <strong>{row.person}</strong>
                  <small>
                    {row.organization} · {row.age} old
                  </small>
                  <footer>
                    <Confidence value={row.confidence} />
                    <span>{row.assigned}</span>
                  </footer>
                </button>
              ))}
            </aside>
            <article className="review-workbench">
              <div className="review-head">
                <div>
                  <p className="eyebrow">{item.reviewType}</p>
                  <h2>
                    {item.person} · {item.type}
                  </h2>
                  <span>
                    {item.organization} · {item.place} · {dateLabel(item.date)}
                  </span>
                </div>
                <Confidence value={item.confidence} />
              </div>
              <div className="review-columns">
                <section>
                  <p className="eyebrow">Source document</p>
                  <h3>{item.source}</h3>
                  <div className="source-document">
                    <span>Transaction summary</span>
                    <p>
                      The company announced that it entered into a definitive
                      agreement providing cash consideration, subject to
                      customary closing conditions and adjustments.
                    </p>
                    <mark>
                      Cash consideration is expected to represent a majority of
                      transaction value at close.
                    </mark>
                    <p>
                      Additional amounts may remain subject to escrow, rollover
                      equity, and post-closing adjustments.
                    </p>
                  </div>
                  <button className="text-link">Open preserved source ↗</button>
                </section>
                <section>
                  <p className="eyebrow">Extracted claims</p>
                  {evidence.slice(0, 3).map((claim) => (
                    <div className="claim" key={claim.label}>
                      <Classification kind={claim.kind} />
                      <span>
                        <strong>{claim.label}</strong>
                        <small>{claim.source}</small>
                      </span>
                      <b>{claim.value}</b>
                    </div>
                  ))}
                  <div className="model-output">
                    <span>Proposed estimated net</span>
                    <strong>{rangeMoney(item.net)}</strong>
                    <small>
                      Top uncertainty: ownership · consideration · tax treatment
                    </small>
                  </div>
                </section>
              </div>
              <label className="review-note">
                <span>Analyst note / required reason</span>
                <textarea defaultValue="Evidence supports publication above the private-event confidence threshold. Identity and transaction completion have been reviewed." />
              </label>
              <div className="review-actions">
                <button
                  className="button danger"
                  onClick={() => {
                    setQueue(queue.filter((_, index) => index !== selected));
                    setSelected(0);
                    notify("Review item rejected with audit reason");
                  }}
                >
                  Reject
                </button>
                <button
                  className="button ghost"
                  onClick={() => notify("More-evidence request assigned")}
                >
                  Request evidence
                </button>
                <button
                  className="button ghost"
                  onClick={() => notify("Model recalculation completed")}
                >
                  Recalculate
                </button>
                <button
                  className="button primary"
                  onClick={() => {
                    setQueue(queue.filter((_, index) => index !== selected));
                    setSelected(0);
                    notify("Event approved and published; audit log recorded");
                  }}
                >
                  Approve & publish
                </button>
              </div>
            </article>
          </section>
        ) : (
          <div className="empty-state panel">
            <span>✓</span>
            <h3>The review queue is clear.</h3>
            <p>New private events and uncertain evidence will appear here.</p>
          </div>
        )}
      </>
    );
  }
  if (view === "sources") {
    return (
      <>
        <PageIntro
          view="sources"
          actions={
            <button
              className="button primary"
              onClick={() => notify("Manual source form opened")}
            >
              Add source
            </button>
          }
        />
        <section className="source-stats">
          {[
            ["12,842", "Source documents"],
            ["47,291", "Evidence claims"],
            ["91%", "Claim review coverage"],
            ["0.7%", "Duplicate rate"],
          ].map(([value, label]) => (
            <article key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </section>
        <section className="panel source-table">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Claims</th>
                  <th>Reliability</th>
                  <th>Retrieved</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 12).map((event, index) => (
                  <tr key={event.id}>
                    <td>
                      <strong>{event.source}</strong>
                      <small>
                        Hash 8d3f…{index}a2 · raw document preserved
                      </small>
                    </td>
                    <td>
                      {index % 3 === 0
                        ? "SEC filing"
                        : index % 3 === 1
                          ? "Announcement"
                          : "Public feed"}
                    </td>
                    <td>{3 + index}</td>
                    <td>Tier {1 + (index % 3)}</td>
                    <td>{dateLabel(event.sourceDate)}</td>
                    <td>
                      <span className="status completed">Current</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }
  if (view === "identity") {
    return (
      <>
        <PageIntro
          view="identity"
          actions={
            <span className="queue-count">{identities.length} candidates</span>
          }
        />
        <section className="identity-list">
          {identities.map((item, index) => (
            <article key={item.source}>
              <div className="identity-side">
                <span className="avatar">
                  {item.source
                    .split(" ")
                    .map((word) => word[0])
                    .join("")}
                </span>
                <span>
                  <small>Source identity</small>
                  <strong>{item.source}</strong>
                  <p>{item.organization}</p>
                </span>
              </div>
              <div className="identity-score">
                <strong>{item.score}%</strong>
                <span>match confidence</span>
                <small>{item.signals}</small>
              </div>
              <div className="identity-side">
                <span className="avatar">
                  {item.candidate
                    .split(" ")
                    .map((word) => word[0])
                    .join("")}
                </span>
                <span>
                  <small>Candidate record</small>
                  <strong>{item.candidate}</strong>
                  <p>{item.organization}</p>
                </span>
              </div>
              <div className="identity-actions">
                <button
                  className="button ghost"
                  onClick={() => {
                    setIdentities(identities.filter((_, i) => i !== index));
                    notify("Identity candidates marked distinct");
                  }}
                >
                  Keep separate
                </button>
                <button
                  className="button primary"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Merge ${item.source} into ${item.candidate}? This action will be audited and can be reversed.`,
                      )
                    ) {
                      setIdentities(identities.filter((_, i) => i !== index));
                      notify("Identity records merged; aliases preserved");
                    }
                  }}
                >
                  Merge records
                </button>
              </div>
            </article>
          ))}
        </section>
      </>
    );
  }
  if (view === "jobs") {
    return (
      <>
        <PageIntro
          view="jobs"
          actions={
            <button
              className="button primary"
              onClick={() => notify("SEC daily discovery job queued")}
            >
              Run ingestion
            </button>
          }
        />
        <section className="job-kpis">
          {[
            ["14", "Queue depth"],
            ["2", "Running jobs"],
            ["1", "Needs attention"],
            ["99.4%", "24h success rate"],
          ].map(([value, label]) => (
            <article key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </section>
        <section className="panel jobs-table">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Last run</th>
                  <th>Duration</th>
                  <th>Records</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.name}>
                    <td>
                      <strong>{job.name}</strong>
                      <small>Idempotent · retryable · audited</small>
                    </td>
                    <td>
                      <span
                        className={`job-status ${job.status.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td>{job.last}</td>
                    <td>{job.duration}</td>
                    <td>{job.records}</td>
                    <td>
                      <button
                        onClick={() => notify(`${job.name} queued for retry`)}
                      >
                        Run now
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="job-health">
          <article>
            <strong>/health</strong>
            <span>Web, worker, database</span>
            <b>Healthy</b>
          </article>
          <article>
            <strong>/ready</strong>
            <span>D1, R2, migrations</span>
            <b>Ready</b>
          </article>
          <article>
            <strong>SEC connector</strong>
            <span>Local fixtures active</span>
            <b>Configured</b>
          </article>
        </section>
      </>
    );
  }
  if (view === "privacy") {
    return (
      <>
        <PageIntro
          view="privacy"
          actions={
            <button
              className="button ghost"
              onClick={() => notify("Privacy audit export generated")}
            >
              Export audit log
            </button>
          }
        />
        <section className="privacy-layout">
          <form
            className="panel privacy-form"
            onSubmit={(event) => {
              event.preventDefault();
              setRequestSubmitted(true);
              notify("Privacy request submitted and deadline tracking started");
            }}
          >
            <p className="eyebrow">Public request workflow</p>
            <h2>
              {requestSubmitted
                ? "Request submitted"
                : "Submit a correction or privacy request"}
            </h2>
            {requestSubmitted ? (
              <div className="success-state">
                <span>✓</span>
                <strong>Request LR-PR-2026-041 has been received.</strong>
                <p>
                  Identity verification is required before personal information
                  can be changed or suppressed. A response is due within the
                  applicable jurisdictional deadline.
                </p>
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setRequestSubmitted(false)}
                >
                  Submit another request
                </button>
              </div>
            ) : (
              <>
                <div className="form-grid">
                  <label>
                    <span>Request type</span>
                    <select>
                      <option>Correct profile</option>
                      <option>Correct location</option>
                      <option>Claim profile</option>
                      <option>Suppress profile</option>
                      <option>Delete eligible information</option>
                      <option>Restrict processing</option>
                      <option>Appeal decision</option>
                    </select>
                  </label>
                  <label>
                    <span>Relationship to subject</span>
                    <select>
                      <option>Profile subject</option>
                      <option>Authorized representative</option>
                      <option>Organization representative</option>
                    </select>
                  </label>
                  <label>
                    <span>Contact email</span>
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                    />
                  </label>
                  <label>
                    <span>Person or organization</span>
                    <input required placeholder="Search or enter name" />
                  </label>
                  <label className="span-2">
                    <span>Explanation</span>
                    <textarea
                      required
                      placeholder="Describe the correction or request and provide the most reliable supporting context."
                    />
                  </label>
                  <label>
                    <span>Jurisdiction</span>
                    <select>
                      <option>United States</option>
                      <option>California</option>
                      <option>Virginia</option>
                      <option>Colorado</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <label>
                    <span>Supporting document</span>
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg" />
                  </label>
                </div>
                <label className="acknowledgement">
                  <input type="checkbox" required />
                  <span>
                    I attest that the information supplied is accurate and that
                    I am authorized to make this request.
                  </span>
                </label>
                <button className="button primary" type="submit">
                  Submit secure request
                </button>
              </>
            )}
          </form>
          <aside className="panel privacy-queue">
            <p className="eyebrow">Internal queue</p>
            <h2>Open requests</h2>
            {[
              ["Correct location", "Amara Voss", "Under review", "12 days"],
              [
                "Suppress profile",
                "Record LR-028",
                "Identity verification",
                "4 days",
              ],
              ["Claim profile", "Theo Navarro", "More information", "9 days"],
              ["Correct transaction", "Event LR-E-114", "Submitted", "1 day"],
            ].map(([type, subject, status, age]) => (
              <button key={subject}>
                <span>
                  <strong>{type}</strong>
                  <small>{subject}</small>
                </span>
                <span>{status}</span>
                <time>{age}</time>
              </button>
            ))}
            <p className="panel-note">
              Approved suppression propagates to search, exports, API responses,
              and affected aggregates.
            </p>
          </aside>
        </section>
      </>
    );
  }
  return null;
}

function OrganizationsView({
  selectedSlug,
  notify,
  onOrganization,
  onRegion,
  onPerson,
}: {
  selectedSlug: string;
  notify: (message: string) => void;
  onOrganization: (slug: string) => void;
  onRegion: (slug: string) => void;
  onPerson: (person: Person) => void;
}) {
  const selected = organizationProfiles.find(
    (organization) => organization.slug === selectedSlug,
  );
  if (selected) {
    const connectedPeople = people.filter(
      (person) => person.organization === selected.name,
    );
    const connectedEvents = events.filter(
      (event) => event.organizationSlug === selected.slug,
    );
    return (
      <>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <button onClick={() => onOrganization("")}>Organizations</button>
          <span>/</span>
          <span>{selected.name}</span>
        </nav>
        <div className="page-intro">
          <div>
            <p className="eyebrow">Connected organization profile</p>
            <h1>{selected.name}</h1>
            <p>
              {selected.type.replaceAll("_", " ")} · {selected.industry} ·{" "}
              {selected.publicClassification}
            </p>
          </div>
          <button
            className="button secondary"
            onClick={() => onOrganization("")}
          >
            Back to organizations
          </button>
        </div>
        <section className="organization-profile-metrics">
          <article>
            <span>Connected people</span>
            <strong>{connectedPeople.length}</strong>
          </article>
          <article>
            <span>Documented events</span>
            <strong>{connectedEvents.length}</strong>
          </article>
          <article>
            <span>Connected regions</span>
            <strong>{selected.regionSlugs.length}</strong>
          </article>
        </section>
        <section className="organization-profile-grid">
          <article>
            <p className="eyebrow">Geographic footprint</p>
            <h2>Connected regions</h2>
            <div className="organization-profile-list">
              {selected.regionSlugs.map((slug) => {
                const region = getRegion(slug);
                return region ? (
                  <button key={slug} onClick={() => onRegion(slug)}>
                    <strong>{region.name}</strong>
                    <span>{region.type} profile →</span>
                  </button>
                ) : null;
              })}
            </div>
          </article>
          <article>
            <p className="eyebrow">People graph</p>
            <h2>Associated people</h2>
            <div className="organization-profile-list">
              {connectedPeople.length ? (
                connectedPeople.map((person) => (
                  <button key={person.id} onClick={() => onPerson(person)}>
                    <strong>{person.name}</strong>
                    <span>
                      {person.role} · {person.industry} →
                    </span>
                  </button>
                ))
              ) : (
                <p>No published people are connected to this organization.</p>
              )}
            </div>
          </article>
          <article>
            <p className="eyebrow">Evidence-linked activity</p>
            <h2>Organization events</h2>
            <div className="organization-profile-list">
              {connectedEvents.length ? (
                connectedEvents.slice(0, 8).map((event) => (
                  <button
                    key={event.id}
                    onClick={() => {
                      const person = people.find(
                        (candidate) => candidate.id === event.personId,
                      );
                      if (person) onPerson(person);
                    }}
                  >
                    <strong>{event.type}</strong>
                    <span>
                      {event.person} · {event.regionName} · {event.date} →
                    </span>
                  </button>
                ))
              ) : (
                <p>No published events are connected to this organization.</p>
              )}
            </div>
          </article>
        </section>
      </>
    );
  }

  return (
    <>
      <PageIntro
        view="organizations"
        actions={
          <button
            className="button primary"
            onClick={() => notify("Organization CSV export started")}
          >
            Export organizations
          </button>
        }
      />
      <section className="organization-grid">
        {organizationProfiles.map((organization, index) => (
          <article key={organization.id}>
            <div>
              <span className="org-monogram">
                {organization.name
                  .split(" ")
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join("")}
              </span>
              <span className={`org-type type-${index % 4}`}>
                {index % 5 === 0
                  ? "Investment firm"
                  : index % 5 === 1
                    ? "Private company"
                    : index % 5 === 2
                      ? "Foundation"
                      : index % 5 === 3
                        ? "Acquirer"
                        : "Family office"}
              </span>
            </div>
            <h2>{organization.name}</h2>
            <p>
              {organization.industry} ·{" "}
              {getRegion(organization.regionSlugs[0])?.metro}
            </p>
            <dl>
              <div>
                <dt>Associated people</dt>
                <dd>{2 + (index % 9)}</dd>
              </div>
              <div>
                <dt>Liquidity created</dt>
                <dd>{money(42_000_000 + index * 17_000_000)}</dd>
              </div>
              <div>
                <dt>Source documents</dt>
                <dd>{4 + (index % 14)}</dd>
              </div>
            </dl>
            <button
              className="text-link"
              onClick={() => onOrganization(organization.slug)}
            >
              Open organization profile →
            </button>
          </article>
        ))}
      </section>
    </>
  );
}

function MethodologyView({ view }: { view: "methodology" | "api" }) {
  if (view === "api") {
    const endpoints = [
      ["GET", "/api/v1/people", "Search published people"],
      [
        "GET",
        "/api/v1/people/{id}",
        "Retrieve an evidence-linked person profile",
      ],
      ["GET", "/api/v1/organizations", "List organizations"],
      ["GET", "/api/v1/events", "Query liquidity events"],
      ["GET", "/api/v1/regions", "Retrieve regional aggregates"],
      ["GET", "/api/v1/rankings", "Retrieve confidence-qualified rankings"],
      ["POST", "/api/v1/matches", "Score a capital opportunity"],
      ["GET", "/api/v1/search", "Search across published entities"],
    ];
    return (
      <>
        <PageIntro
          view="api"
          actions={
            <a className="button primary" href="/api/v1/people" target="_blank">
              Try live endpoint
            </a>
          }
        />
        <section className="api-layout">
          <aside className="panel">
            <p className="eyebrow">Authentication</p>
            <h2>API key</h2>
            <p>
              Send the workspace key in the Authorization header. Full secrets
              are shown only once at creation.
            </p>
            <pre>Authorization: Bearer lr_live_••••••••</pre>
            <p className="panel-note">
              Responses include request IDs, cursor pagination, evidence status,
              and publication metadata. Residential addresses are never
              returned.
            </p>
          </aside>
          <div className="panel endpoints">
            {endpoints.map(([method, path, description]) => (
              <div key={path}>
                <span className={method === "POST" ? "post" : ""}>
                  {method}
                </span>
                <code>{path}</code>
                <p>{description}</p>
                <button>›</button>
              </div>
            ))}
          </div>
        </section>
        <section className="panel code-example">
          <div>
            <p className="eyebrow">Example response</p>
            <h2>Range-first schemas</h2>
          </div>
          <pre>{`{
  "data": [{
    "id": "person_001",
    "display_name": "Amara Voss",
    "estimated_remaining_liquidity": {
      "low": 48200000,
      "median": 67000000,
      "high": 91100000,
      "currency": "USD"
    },
    "confidence": 84,
    "classification": "estimated",
    "estimate_date": "2026-07-24"
  }],
  "next_cursor": "eyJpZCI6..."
}`}</pre>
        </section>
      </>
    );
  }
  return (
    <>
      <PageIntro view="methodology" />
      <section className="methodology-grid">
        <article className="panel lineage-panel">
          <p className="eyebrow">Lineage contract</p>
          <h2>From source to published estimate</h2>
          {[
            "Person or region",
            "Current estimate",
            "Model run",
            "Model inputs",
            "Evidence claims",
            "Source documents",
          ].map((item, index) => (
            <div key={item}>
              <span>{index + 1}</span>
              <strong>{item}</strong>
              <small>
                {index === 0
                  ? "Resolved entity and permitted geography"
                  : index === 1
                    ? "Low, median, high, confidence, and date"
                    : index === 2
                      ? "Versioned code, seed, samples, and snapshots"
                      : index === 3
                        ? "Observed values and explicit distributions"
                        : index === 4
                          ? "Classified, reviewed, and time-bounded facts"
                          : "Preserved primary or reliable public material"}
              </small>
            </div>
          ))}
        </article>
        <article className="panel formula-panel">
          <p className="eyebrow">Private-company exit</p>
          <h2>Range-based proceeds model</h2>
          <code>Equity value = Enterprise value − Debt + Cash</code>
          <code>
            Gross proceeds = Equity value × Ownership × Cash consideration
          </code>
          <code>
            Net liquidity = Gross proceeds − Taxes − Fees − Escrow − Rollover
            equity − Known obligations
          </code>
          <p>
            Every uncertain input uses an explicit distribution. The
            demonstration model uses 10,000 deterministic samples and stores the
            random seed, model version, input snapshot, output percentiles, and
            sensitivity results.
          </p>
          <div className="method-tags">
            <Classification kind="observed" />
            <Classification kind="calculated" />
            <Classification kind="estimated" />
            <Classification kind="inferred" />
          </div>
        </article>
        <article className="panel">
          <p className="eyebrow">Confidence scoring</p>
          <h2>Transparent component weights</h2>
          {[
            ["Source reliability", 20],
            ["Transaction certainty", 15],
            ["Identity certainty", 15],
            ["Ownership certainty", 15],
            ["Consideration certainty", 10],
            ["Completion certainty", 10],
            ["Tax certainty", 5],
            ["Deployment coverage", 5],
            ["Recency", 5],
          ].map(([label, value]) => (
            <div className="weight" key={String(label)}>
              <span>{label}</span>
              <i>
                <b style={{ width: `${Number(value) * 5}%` }} />
              </i>
              <strong>{value}%</strong>
            </div>
          ))}
        </article>
        <article className="panel">
          <p className="eyebrow">Known limitations</p>
          <h2>What the platform does not claim</h2>
          <ul>
            <li>It does not know or estimate bank-account balances.</li>
            <li>
              Known deployment is incomplete and never treated as total
              spending.
            </li>
            <li>Form 144 proposals are not completion evidence.</li>
            <li>
              Private-market ownership and consideration often remain uncertain.
            </li>
            <li>
              Geography stops at public city, county, metro, state, or country
              levels.
            </li>
            <li>
              Rankings exclude profiles below the publication confidence
              threshold.
            </li>
          </ul>
        </article>
      </section>
    </>
  );
}

export function RadarApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [role, setRole] = useState<UserRole>("customer");
  const [viewState, setView] = useState<View>("dashboard");
  const [selectedPerson, setSelectedPerson] = useState<Person>(people[0]);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [activeRegionChoice, setActiveRegionChoice] = useState("");
  const [homeRegionSlug, setHomeRegionSlug] = useState("");
  const ready = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const locationHref = useSyncExternalStore(
    subscribeToLocation,
    getLocationSnapshot,
    getServerLocationSnapshot,
  );
  const currentUrl = new URL(locationHref);
  const routeView = viewFromPath(currentUrl.pathname, currentUrl.searchParams);
  const view = ready ? routeView : viewState;
  const storedRole = ready
    ? (window.localStorage.getItem("lr_demo_role") as UserRole | null)
    : null;
  const effectiveAuthenticated = authenticated || Boolean(storedRole);
  const effectiveRole = authenticated ? role : storedRole || role;
  const storedHomeRegion = ready
    ? window.localStorage.getItem("lr_home_region")
    : null;
  const recentRegion = ready
    ? window.localStorage.getItem("lr_recent_region")
    : null;
  const routeRegionSlug =
    currentUrl.pathname.match(/^\/regions\/([^/]+)/)?.[1] || "";
  const selectedRegionSlug =
    currentUrl.searchParams.get("region") || routeRegionSlug;
  const resolvedHomeRegionSlug =
    homeRegionSlug || storedHomeRegion || "montgomery-county-md";
  const activeRegionSlug =
    activeRegionChoice ||
    selectActiveRegion({
      urlRegion:
        currentUrl.searchParams.get("affinityRegion") ||
        selectedRegionSlug ||
        null,
      recentRegion,
      homeRegion: resolvedHomeRegionSlug,
    });
  const activeRegion =
    getRegion(activeRegionSlug) ??
    getRegion(resolvedHomeRegionSlug) ??
    regions[0];
  const homeRegion =
    getRegion(resolvedHomeRegionSlug) ??
    getRegion("montgomery-county-md") ??
    regions[0];
  const pathPersonSlug =
    currentUrl.pathname.match(/^\/people\/([^/]+)/)?.[1] || "";
  const pathOrganizationSlug =
    currentUrl.pathname.match(/^\/organizations\/([^/]+)/)?.[1] || "";
  const currentPerson =
    people.find((person) => person.slug === pathPersonSlug) || selectedPerson;
  const queryString = currentUrl.searchParams.toString();
  const mapState = parseMapState(currentUrl.searchParams);

  function notify(message: string) {
    setToast({ title: "Workspace updated", detail: message });
    window.setTimeout(() => setToast(null), 3600);
  }

  async function persist(
    type: string,
    title: string,
    payload: Record<string, unknown> = {},
  ) {
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, title, payload }),
      });
      if (!response.ok) throw new Error("Persistence failed");
      notify(`${title} saved to Northstar Strategy`);
    } catch {
      notify(`${title} is available in this demonstration session`);
    }
  }

  function applyLocation(
    pathname: string,
    params = new URLSearchParams(),
    replace = false,
  ) {
    const next = `${pathname}${params.size ? `?${params}` : ""}`;
    if (replace) window.history.replaceState({}, "", next);
    else window.history.pushState({}, "", next);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  function navigate(next: View) {
    setView(next);
    setMobileNav(false);
    const params = new URLSearchParams();
    if (activeRegion.slug) params.set("affinityRegion", activeRegion.slug);
    if (next === "people" && search) params.set("q", search);
    applyLocation(pathForView(next), params);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openPerson(person: Person) {
    setSelectedPerson(person);
    setView("profile");
    applyLocation(
      `/people/${person.slug}`,
      new URLSearchParams({ affinityRegion: activeRegion.slug }),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openOrganization(slug: string) {
    setView("organizations");
    applyLocation(
      slug ? `/organizations/${slug}` : "/organizations",
      new URLSearchParams({ affinityRegion: activeRegion.slug }),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openRegion(slug: string, context?: URLSearchParams) {
    const region = getRegion(slug);
    if (!region) return;
    setView("region");
    setActiveRegionChoice(slug);
    window.localStorage.setItem("lr_recent_region", slug);
    const params = new URLSearchParams(context);
    params.set("affinityRegion", slug);
    applyLocation(`/regions/${slug}`, params);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openFilteredView(
    target: "feed" | "people",
    filters: Record<string, string>,
  ) {
    const params = new URLSearchParams(filters);
    const referencedRegion = filters.region;
    const affinitySlug = referencedRegion || activeRegion.slug;
    if (affinitySlug) params.set("affinityRegion", affinitySlug);
    if (referencedRegion) {
      setActiveRegionChoice(referencedRegion);
      window.localStorage.setItem("lr_recent_region", referencedRegion);
    }
    setView(target);
    applyLocation(pathForView(target), params);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateCurrentQuery(
    target: "feed" | "people",
    params: URLSearchParams,
    replace = false,
  ) {
    if (!params.has("affinityRegion")) {
      params.set("affinityRegion", activeRegion.slug);
    }
    setView(target);
    applyLocation(pathForView(target), params, replace);
  }

  function changeActiveRegion(slug: string) {
    if (!getRegion(slug)) return;
    setActiveRegionChoice(slug);
    window.localStorage.setItem("lr_recent_region", slug);
    const params = new URLSearchParams(currentUrl.searchParams);
    params.set("affinityRegion", slug);
    applyLocation(currentUrl.pathname, params, true);
    notify(`Affinity scores recalculated for ${getRegion(slug)!.name}`);
  }

  function changeHomeRegion(slug: string) {
    const region = getRegion(slug);
    if (!region) return;
    setHomeRegionSlug(slug);
    window.localStorage.setItem("lr_home_region", slug);
    changeActiveRegion(slug);
    void persist("regional_preference", "Workspace home region", {
      home_region_id: slug,
    });
  }

  function exportPeople(
    records = people.filter((person) => person.status !== "Pending review"),
  ) {
    download(
      "liquidity-radar-people.csv",
      csvForPeople(records, activeRegion),
      "text/csv;charset=utf-8",
    );
    notify(
      `${records.length} published records exported with estimate ranges and evidence metadata`,
    );
  }

  if (!effectiveAuthenticated) {
    return (
      <Login
        onLogin={(nextRole) => {
          setRole(nextRole);
          setAuthenticated(true);
          window.localStorage.setItem("lr_demo_role", nextRole);
          const nextView =
            routeView !== "dashboard"
              ? routeView
              : nextRole === "customer"
                ? "dashboard"
                : "review";
          setView(nextView);
          if (routeView === "dashboard" && nextView !== "dashboard") {
            applyLocation(pathForView(nextView));
          }
        }}
      />
    );
  }

  let content: React.ReactNode;
  if (view === "dashboard")
    content = (
      <Dashboard
        onNavigate={navigate}
        onPerson={openPerson}
        onExport={() => exportPeople(people.slice(0, 12))}
      />
    );
  else if (view === "map")
    content = (
      <>
        <PageIntro view="map" />
        <LiquidityMap
          metric={mapState.metric}
          period={mapState.period}
          industry={mapState.industry}
          selectedRegion={mapState.region}
          center={mapState.center}
          zoom={mapState.zoom}
          onMetricChange={(metric) => {
            const next = serializeMapState({ ...mapState, metric });
            next.set("affinityRegion", activeRegion.slug);
            applyLocation("/map", next, true);
          }}
          onPeriodChange={(period) => {
            const next = serializeMapState({ ...mapState, period });
            next.set("affinityRegion", activeRegion.slug);
            applyLocation("/map", next, true);
          }}
          onIndustryChange={(industry) => {
            const next = serializeMapState({ ...mapState, industry });
            next.set("affinityRegion", activeRegion.slug);
            applyLocation("/map", next, true);
          }}
          onViewportChange={(center, zoom) => {
            const next = serializeMapState({ ...mapState, center, zoom });
            next.set("affinityRegion", activeRegion.slug);
            applyLocation("/map", next, true);
          }}
          onRegion={(region) =>
            openRegion(region, serializeMapState({ ...mapState, region }))
          }
          onPeople={(region) => openFilteredView("people", { region })}
          onEvents={(region) => openFilteredView("feed", { region })}
        />
        <div className="coverage-footnote">
          <strong>Privacy protected.</strong> The map uses aggregate metro
          points and never displays residential coordinates. Confidence-aware
          totals exclude insufficient-evidence records.
        </div>
      </>
    );
  else if (view === "feed")
    content = (
      <EventsExplorer
        key={`events-${queryString}`}
        queryString={queryString}
        onQueryChange={(params, replace) =>
          updateCurrentQuery("feed", params, replace)
        }
        onPerson={openPerson}
        onRegion={openRegion}
        onOrganization={openOrganization}
        notify={notify}
      />
    );
  else if (view === "people")
    content = (
      <PeopleExplorer
        key={`people-${queryString}-${activeRegion.slug}`}
        queryString={queryString}
        activeRegion={activeRegion}
        onQueryChange={(params, replace) =>
          updateCurrentQuery("people", params, replace)
        }
        onPerson={openPerson}
        onSave={() =>
          persist("saved_search", search || "Qualified people · confidence 65+")
        }
        onExport={exportPeople}
      />
    );
  else if (view === "profile")
    content = (
      <PersonProfile
        person={currentPerson}
        activeRegion={activeRegion}
        onActiveRegion={changeActiveRegion}
        onRegion={openRegion}
        onBack={() => navigate("people")}
        onAction={notify}
      />
    );
  else if (view === "organizations")
    content = (
      <OrganizationsView
        selectedSlug={pathOrganizationSlug}
        notify={notify}
        onOrganization={openOrganization}
        onRegion={openRegion}
        onPerson={openPerson}
      />
    );
  else if (view === "regions")
    content = (
      <RegionsDirectory onRegion={openRegion} onMap={() => navigate("map")} />
    );
  else if (view === "region")
    content = (
      <RegionDetail
        key={`${routeRegionSlug}-${activeRegion.slug}`}
        regionSlug={routeRegionSlug}
        activeRegion={activeRegion}
        onRegion={openRegion}
        onPerson={openPerson}
        onEvents={(filters) => openFilteredView("feed", filters)}
        onPeople={(filters) => openFilteredView("people", filters)}
        onOrganization={openOrganization}
      />
    );
  else if (view === "rankings")
    content = (
      <RankingsView
        onPerson={openPerson}
        onExport={() => exportPeople()}
        activeRegion={activeRegion}
      />
    );
  else if (view === "matching")
    content = (
      <MatchingView
        onPerson={openPerson}
        notify={notify}
        activeRegion={activeRegion}
      />
    );
  else if (["saved", "alerts", "reports", "workspace"].includes(view))
    content = (
      <>
        <WorkspaceViews
          view={view}
          notify={notify}
          onPerson={openPerson}
          onExport={() => exportPeople()}
        />
        {view === "workspace" && (
          <RegionalPreferenceCard
            homeRegion={homeRegion}
            activeRegion={activeRegion}
            onHomeRegion={changeHomeRegion}
          />
        )}
        {view === "saved" && (
          <div className="coverage-footnote">
            <strong>Affinity region: {activeRegion.name}.</strong> Saved people
            searches and exports recalculate geographic affinity against the
            currently selected region.
          </div>
        )}
      </>
    );
  else if (["review", "sources", "identity", "jobs", "privacy"].includes(view))
    content = <OperationsViews view={view} notify={notify} />;
  else
    content = <MethodologyView view={view === "api" ? "api" : "methodology"} />;

  return (
    <div className="app-shell">
      <Sidebar view={view} onNavigate={navigate} open={mobileNav} />
      <Header
        view={view}
        search={search}
        onSearch={setSearch}
        role={effectiveRole}
        onNavigate={navigate}
        activeRegion={activeRegion}
        onActiveRegion={changeActiveRegion}
        onLogout={() => {
          window.localStorage.removeItem("lr_demo_role");
          setAuthenticated(false);
        }}
        onMenu={() => setMobileNav((value) => !value)}
      />
      {mobileNav && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <main className="app-main">{content}</main>
      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          <div>
            <strong>{toast.title}</strong>
            <p>{toast.detail}</p>
          </div>
          <button onClick={() => setToast(null)}>×</button>
        </div>
      )}
    </div>
  );
}
