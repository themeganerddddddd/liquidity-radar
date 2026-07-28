"use client";

import { useMemo, useState } from "react";
import type { PublicDataSnapshot, SecFiling } from "../lib/public-data";

export type RealPersonRecord = {
  id: string;
  name: string;
  kind: "Person" | "Entity";
  initials: string;
  issuers: string[];
  forms: string[];
  filings: SecFiling[];
  lastFiledAt: string;
  archiveEntityId: string;
};

function entityKind(name: string): RealPersonRecord["kind"] {
  return /\b(LLC|L\.L\.C\.|INC|CORP|LTD|LP|L\.P\.|TRUST|FUND|CAPITAL|PARTNERS|HOLDINGS)\b/i.test(
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
  const grouped = new Map<string, SecFiling[]>();

  for (const filing of data.sec.filings) {
    const name = filing.reportingParty.trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    grouped.set(key, [...(grouped.get(key) ?? []), filing]);
  }

  return [...grouped.entries()]
    .map(([key, filings]) => {
      const ordered = [...filings].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
      const name = ordered[0].reportingParty.trim();
      return {
        id: `${recordId(name)}-${key.length}`,
        name,
        kind: entityKind(name),
        initials: initials(name),
        issuers: [...new Set(ordered.map((filing) => filing.issuer))],
        forms: [...new Set(ordered.map((filing) => filing.form))],
        filings: ordered,
        lastFiledAt: ordered[0].filedAt,
        archiveEntityId: archiveEntityId(ordered[0].url),
      };
    })
    .sort((left, right) => right.lastFiledAt.localeCompare(left.lastFiledAt));
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
  const [form, setForm] = useState("All forms");
  const [kind, setKind] = useState("All reporting parties");
  const forms = [...new Set(people.flatMap((person) => person.forms))].sort();

  const filtered = useMemo(
    () =>
      people
        .filter((person) =>
          [person.name, ...person.issuers, ...person.forms]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
        )
        .filter((person) => form === "All forms" || person.forms.includes(form))
        .filter(
          (person) => kind === "All reporting parties" || person.kind === kind,
        )
        .sort((left, right) =>
          nameSort(left.name).localeCompare(nameSort(right.name)),
        ),
    [form, kind, people, query],
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
          <span>Record type</span>
          <select
            value={form}
            onChange={(event) => setForm(event.target.value)}
            aria-label="Filter people by SEC form"
          >
            <option>All forms</option>
            {forms.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Party type</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            aria-label="Filter by reporting party type"
          >
            <option>All reporting parties</option>
            <option>Person</option>
            <option>Entity</option>
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
          <span>Observed records</span>
          <span>Latest filing</span>
          <span>Evidence</span>
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
              <strong>{person.filings.length}</strong>
              <small>{person.forms.join(", ")}</small>
            </span>
            <span>
              <strong>{displayDate(person.lastFiledAt)}</strong>
              <small>SEC EDGAR</small>
            </span>
            <b>View profile →</b>
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
        Names and issuer relationships on this page are taken from SEC filing
        metadata. Inclusion does not by itself prove investable cash, net worth,
        or intent to invest.
      </p>
    </>
  );
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

  return (
    <>
      <button type="button" className="real-profile-back" onClick={onBack}>
        ← People directory
      </button>

      <section className="real-person-profile-hero">
        <div className="real-person-profile-identity">
          <span>{person.initials || "SEC"}</span>
          <div>
            <p className="eyebrow">SEC-observed reporting party</p>
            <div>
              <h1>{person.name}</h1>
              <b>{person.kind}</b>
            </div>
            <p>
              Publicly associated with {person.issuers.join(", ")} through{" "}
              {person.forms.join(", ")} filing metadata.
            </p>
          </div>
        </div>
        <div className="real-person-profile-summary">
          <span>Observed public records</span>
          <strong>{person.filings.length}</strong>
          <small>Latest filing {displayDate(person.lastFiledAt)}</small>
          <a href={person.filings[0].url} target="_blank" rel="noreferrer">
            Open latest SEC record ↗
          </a>
        </div>
      </section>

      <div className="real-profile-disclosure">
        <strong>Evidence boundary</strong>
        <p>
          This profile summarizes attributable filing metadata. Liquidity Radar
          does not infer this party’s cash balance, net worth, investment
          intent, or deployable capital from the filing alone.
        </p>
      </div>

      <section className="real-profile-kpis" aria-label="Profile summary">
        <article>
          <span>Linked issuers</span>
          <strong>{person.issuers.length}</strong>
          <small>{person.issuers.join(", ")}</small>
        </article>
        <article>
          <span>SEC forms observed</span>
          <strong>{person.forms.length}</strong>
          <small>{person.forms.join(", ")}</small>
        </article>
        <article>
          <span>Latest public activity</span>
          <strong>{displayDate(person.lastFiledAt)}</strong>
          <small>Based on the indexed EDGAR feed</small>
        </article>
        <article>
          <span>Liquidity conclusion</span>
          <strong>Not asserted</strong>
          <small>Transaction-level review required</small>
        </article>
      </section>

      <section className="real-profile-layout">
        <div className="real-profile-primary">
          <article className="real-profile-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Source timeline</p>
                <h2>Observed SEC filing history</h2>
              </div>
              <span>{person.filings.length} records</span>
            </div>
            <div className="real-profile-timeline">
              {person.filings.map((filing) => (
                <a
                  key={`${filing.form}-${filing.accession}`}
                  href={filing.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <i />
                  <div>
                    <span>
                      {filing.form} · {displayDate(filing.filedAt)}
                    </span>
                    <strong>{filing.issuer}</strong>
                    <small>Accession {filing.accession}</small>
                  </div>
                  <b>SEC ↗</b>
                </a>
              ))}
            </div>
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
                      <small>{candidate.issuers.join(", ")}</small>
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
                <h2>What the record establishes</h2>
              </div>
            </div>
            <dl className="real-profile-facts">
              <div>
                <dt>Filed name</dt>
                <dd>{person.name}</dd>
              </div>
              <div>
                <dt>Party classification</dt>
                <dd>{person.kind}</dd>
              </div>
              <div>
                <dt>Issuer relationship</dt>
                <dd>{person.issuers.join(", ")}</dd>
              </div>
              <div>
                <dt>SEC archive entity ID</dt>
                <dd>{person.archiveEntityId}</dd>
              </div>
              <div>
                <dt>Source publisher</dt>
                <dd>U.S. Securities and Exchange Commission</dd>
              </div>
            </dl>
          </article>

          <article className="real-profile-panel real-profile-limit">
            <p className="eyebrow">Not established by this profile</p>
            <ul>
              <li>Personal cash balance or net worth</li>
              <li>Available investment allocation</li>
              <li>Current employer title or biography</li>
              <li>Contact information</li>
            </ul>
          </article>
        </aside>
      </section>
    </>
  );
}
