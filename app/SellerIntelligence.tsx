"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  SellerIntelligenceProfile,
  SellerIntelligenceSnapshot,
  SellerManualRecord,
  SellerProfileSort,
} from "../lib/seller-intelligence";
import { sortSellerProfiles } from "../lib/seller-intelligence";

type SellerFilter =
  | "all"
  | "unresolved-5"
  | "unresolved-10"
  | "unresolved-25"
  | "unresolved-50"
  | "unresolved-100"
  | "owner"
  | "multiple"
  | "exit"
  | "strong"
  | "updated";

function money(value: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

function date(value: string) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function SortButton({
  label,
  column,
  active,
  direction,
  onSort,
}: {
  label: string;
  column: SellerProfileSort;
  active: SellerProfileSort;
  direction: "asc" | "desc";
  onSort: (column: SellerProfileSort) => void;
}) {
  const selected = active === column;
  return (
    <button
      type="button"
      className={selected ? "active" : ""}
      onClick={() => onSort(column)}
      aria-label={`Sort by ${label}${selected ? ` ${direction === "asc" ? "ascending" : "descending"}` : ""}`}
    >
      {label}{" "}
      <span aria-hidden="true">
        {selected ? (direction === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );
}

function statusClass(status: SellerIntelligenceProfile["status"]) {
  return status.toLowerCase().replaceAll(" ", "-");
}

export function SellerIntelligenceView({
  snapshot,
  onOpenProfile,
}: {
  snapshot: SellerIntelligenceSnapshot;
  onOpenProfile: (profile: SellerIntelligenceProfile) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SellerFilter>("all");
  const [sort, setSort] = useState<SellerProfileSort>("priority");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const profiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const threshold = Number(filter.replace("unresolved-", "")) * 1_000_000;
    const matches = snapshot.profiles.filter((profile) => {
      if (
        needle &&
        ![
          profile.seller,
          profile.location.display,
          profile.entityType,
          profile.status,
          ...profile.counties,
          ...profile.relatedPeople.map((person) => person.name),
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      )
        return false;
      if (filter.startsWith("unresolved-"))
        return (
          !profile.ownerFound && profile.totalRecordedConsideration >= threshold
        );
      if (filter === "owner") return profile.ownerFound;
      if (filter === "multiple") return profile.multipleDispositions;
      if (filter === "exit") return profile.businessExitCandidate;
      if (filter === "strong") return profile.exitConvergence.score >= 50;
      if (filter === "updated") {
        const age =
          Date.parse(snapshot.generatedAt) -
          Date.parse(profile.mostRecentDisposition);
        return age <= 90 * 86_400_000;
      }
      return true;
    });
    return sortSellerProfiles(matches, sort, direction);
  }, [direction, filter, query, snapshot, sort]);

  const pages = Math.max(1, Math.ceil(profiles.length / pageSize));
  const visible = profiles.slice((page - 1) * pageSize, page * pageSize);
  const changeSort = (next: SellerProfileSort) => {
    setPage(1);
    if (next === sort)
      setDirection((current) => (current === "desc" ? "asc" : "desc"));
    else {
      setSort(next);
      setDirection(
        next === "seller" || next === "location" || next === "status"
          ? "asc"
          : "desc",
      );
    }
  };
  const filters: Array<[SellerFilter, string, number | null]> = [
    ["all", "All sellers", snapshot.stats.totalSellerEntities],
    ["unresolved-5", "Unresolved $5M+", snapshot.stats.unresolved5m],
    ["unresolved-10", "Unresolved $10M+", snapshot.stats.unresolved10m],
    ["unresolved-25", "Unresolved $25M+", snapshot.stats.unresolved25m],
    ["unresolved-50", "Unresolved $50M+", snapshot.stats.unresolved50m],
    ["unresolved-100", "Unresolved $100M+", snapshot.stats.unresolved100m],
    ["owner", "Owner found", snapshot.stats.resolvedSellerEntities],
    [
      "multiple",
      "Multiple dispositions",
      snapshot.stats.multipleDispositionSellers,
    ],
    ["exit", "Business exit candidates", snapshot.stats.businessExitCandidates],
    [
      "strong",
      "Strong exit signals",
      snapshot.stats.strongExitSignals + snapshot.stats.highExitConvergence,
    ],
    ["updated", "Recently updated", null],
  ];

  return (
    <div className="seller-workspace">
      <section
        className="seller-summary"
        aria-label="Seller Intelligence summary"
      >
        <div>
          <span>Unresolved sellers</span>
          <strong>{snapshot.stats.unresolvedSellers.toLocaleString()}</strong>
        </div>
        <div>
          <span>Recorded dispositions</span>
          <strong>{money(snapshot.stats.recordedDispositions, true)}</strong>
        </div>
        <div>
          <span>Resolved owners</span>
          <strong>
            {snapshot.stats.resolvedSellerEntities.toLocaleString()}
          </strong>
        </div>
        <div>
          <span>Unresolved $10M+</span>
          <strong>{snapshot.stats.unresolved10m.toLocaleString()}</strong>
        </div>
        <div>
          <span>Multiple sales</span>
          <strong>
            {snapshot.stats.multipleDispositionSellers.toLocaleString()}
          </strong>
        </div>
        <div>
          <span>Exit candidates</span>
          <strong>
            {snapshot.stats.businessExitCandidates.toLocaleString()}
          </strong>
        </div>
        <div>
          <span>Strong exit signals</span>
          <strong>{snapshot.stats.strongExitSignals.toLocaleString()}</strong>
        </div>
        <div>
          <span>High exit convergence</span>
          <strong>{snapshot.stats.highExitConvergence.toLocaleString()}</strong>
        </div>
      </section>

      <label className="chicago-search seller-search">
        <span aria-hidden="true">⌕</span>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Search seller, person, entity, or location…"
        />
      </label>
      <div
        className="chicago-quick-filters seller-quick-filters"
        aria-label="Seller filters"
      >
        {filters.map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            className={filter === key ? "active" : ""}
            onClick={() => {
              setFilter(key);
              setPage(1);
            }}
          >
            {label}
            {count === null ? "" : ` · ${count.toLocaleString()}`}
          </button>
        ))}
      </div>
      <div className="chicago-results-meta">
        <strong>
          {profiles.length.toLocaleString()} matching seller profiles
        </strong>
        <span>
          Ranked by supported disposition activity and independent exit
          evidence.
        </span>
      </div>
      <section
        className="seller-results-table"
        aria-label="Seller Intelligence directory"
      >
        <div className="seller-results-head">
          <SortButton
            label="Seller"
            column="seller"
            active={sort}
            direction={direction}
            onSort={changeSort}
          />
          <SortButton
            label="Recent dispositions"
            column="value"
            active={sort}
            direction={direction}
            onSort={changeSort}
          />
          <SortButton
            label="Location"
            column="location"
            active={sort}
            direction={direction}
            onSort={changeSort}
          />
          <SortButton
            label="Status"
            column="status"
            active={sort}
            direction={direction}
            onSort={changeSort}
          />
        </div>
        {visible.map((profile) => (
          <button
            key={profile.id}
            type="button"
            className="seller-result-row"
            onClick={() => onOpenProfile(profile)}
          >
            <span>
              <strong>{profile.seller}</strong>
              <small>
                {profile.dispositionCount} property disposition
                {profile.dispositionCount === 1 ? "" : "s"} ·{" "}
                {profile.propertyTypes
                  .join(", ")
                  .replaceAll("_", " ")
                  .toLowerCase()}
              </small>
            </span>
            <span className="seller-value">
              <strong>{money(profile.totalRecordedConsideration, true)}</strong>
              <small>Most recent {date(profile.mostRecentDisposition)}</small>
            </span>
            <span>
              <strong>{profile.location.display}</strong>
              <small>{profile.entityType}</small>
              {profile.counties.length > 1 && (
                <small>Cook + DuPage County activity</small>
              )}
            </span>
            <span>
              <em className={`seller-status ${statusClass(profile.status)}`}>
                {profile.status}
              </em>
              <small>
                {profile.ownerFound
                  ? "Supported person relationship"
                  : "No supported owner yet"}
              </small>
            </span>
          </button>
        ))}
        {!visible.length && (
          <div className="chicago-empty">
            <strong>No matching sellers</strong>
            <span>Try another filter or search.</span>
          </div>
        )}
        {pages > 1 && (
          <footer className="chicago-pagination">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button
              type="button"
              disabled={page === pages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </footer>
        )}
      </section>
      <p className="chicago-disclaimer">{snapshot.disclaimer}</p>
    </div>
  );
}

type ManualForm = Omit<
  SellerManualRecord,
  "id" | "sellerKey" | "createdAt" | "updatedAt" | "managers"
> & { managers: string };

const emptyManualForm: ManualForm = {
  entityLegalName: "",
  illinoisFileNumber: "",
  entityType: "",
  entityStatus: "",
  formationDate: "",
  president: "",
  secretary: "",
  managers: "",
  registeredAgent: "",
  sourceUrl: "",
  lookupDate: "",
  checkedBy: "",
};

export function SellerIntelligenceProfileView({
  profile,
  onBack,
}: {
  profile: SellerIntelligenceProfile;
  onBack: () => void;
}) {
  const [manual, setManual] = useState<SellerManualRecord[]>(
    profile.manualRecords,
  );
  const [form, setForm] = useState<ManualForm>(emptyManualForm);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch(
      `/api/v1/seller-intelligence/manual?seller_key=${encodeURIComponent(profile.sellerKey)}`,
      {
        headers: { Authorization: "Bearer lr_demo_local_2026" },
        signal: controller.signal,
      },
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (body?.data) setManual(body.data as SellerManualRecord[]);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [profile.sellerKey]);

  const saveManual = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("Saving…");
    const response = await fetch("/api/v1/seller-intelligence/manual", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer lr_demo_local_2026",
      },
      body: JSON.stringify({
        ...form,
        sellerKey: profile.sellerKey,
        managers: form.managers
          .split(/[,;\n]/)
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    });
    const body = (await response.json()) as {
      data?: SellerManualRecord;
      error?: string;
    };
    if (!response.ok || !body.data) {
      setMessage(
        typeof body.error === "string"
          ? body.error
          : "Record could not be saved.",
      );
      return;
    }
    setManual((records) => [
      body.data!,
      ...records.filter((record) => record.id !== body.data!.id),
    ]);
    setForm(emptyManualForm);
    setFormOpen(false);
    setMessage("Illinois SOS record saved with its audit trail.");
  };

  return (
    <div className="seller-profile-page">
      <button type="button" className="profile-back" onClick={onBack}>
        ← Back to Seller Intelligence
      </button>
      <article className="seller-profile">
        <header>
          <div>
            <p className="eyebrow">Seller Intelligence profile</p>
            <h2>{profile.seller}</h2>
            <p>
              {profile.entityType} · {profile.location.display}
              {profile.counties.length
                ? ` · ${profile.counties.join(" + ")} County`
                : ""}
            </p>
          </div>
          <div className="seller-profile-total">
            <span>Total recorded consideration</span>
            <strong>{money(profile.totalRecordedConsideration, true)}</strong>
            <small>Not net cash received</small>
          </div>
        </header>
        <section className="seller-profile-metrics">
          <div>
            <span>Transactions</span>
            <strong>{profile.dispositionCount}</strong>
          </div>
          <div>
            <span>Largest</span>
            <strong>{money(profile.largestDisposition, true)}</strong>
          </div>
          <div>
            <span>Most recent</span>
            <strong>{date(profile.mostRecentDisposition)}</strong>
          </div>
          <div>
            <span>Exit convergence</span>
            <strong>{profile.exitConvergence.score}/100</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{profile.status}</strong>
          </div>
        </section>
        <section>
          <div className="seller-section-heading">
            <div>
              <p className="eyebrow">Property history</p>
              <h3>All recorded dispositions</h3>
            </div>
            <span>
              {profile.dispositionCount} transactions ·{" "}
              {profile.dispositionWindowDays} day window
            </span>
          </div>
          <div className="seller-property-list">
            <div className="seller-property-head">
              <span>Property</span>
              <span>Recorded consideration</span>
              <span>Buyer</span>
              <span>Date</span>
            </div>
            {profile.dispositions.map((record) => (
              <details key={record.id} className="seller-property-row">
                <summary>
                  <span>
                    <strong>
                      {record.property.address || record.property.categoryLabel}
                    </strong>
                    <small>
                      {record.property.city}, Illinois ·{" "}
                      {record.property.county} County ·{" "}
                      {record.property.categoryLabel}
                    </small>
                  </span>
                  <span>
                    <strong>
                      {money(
                        record.proceeds.recordedSaleConsideration ||
                          record.transaction.displayValueHigh ||
                          0,
                      )}
                    </strong>
                    <small>
                      {record.property.parcelCount} parcel
                      {record.property.parcelCount === 1 ? "" : "s"}
                    </small>
                  </span>
                  <span>
                    <strong>{record.buyer || "Unavailable"}</strong>
                    <small>{record.transaction.deedType}</small>
                  </span>
                  <span>
                    <strong>{date(record.transaction.saleDate)}</strong>
                    <small>
                      {record.transaction.documentNumber ||
                        "No document number"}
                    </small>
                  </span>
                </summary>
                <div className="seller-property-detail">
                  <p>{record.transaction.valueExplanation}</p>
                  {record.evidence.map((source) => (
                    <a
                      key={source.id}
                      href={source.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {source.publisher} ↗
                    </a>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
        <section className="seller-profile-columns">
          <div>
            <h3>People and roles</h3>
            {profile.relatedPeople.length ? (
              <ul className="seller-relationship-list">
                {profile.relatedPeople.map((person) => (
                  <li key={`${person.name}-${person.type}`}>
                    <strong>{person.name}</strong>
                    <span>
                      {person.type.replaceAll("_", " ").toLowerCase()}
                    </span>
                    <small>
                      {person.supportsOwnership
                        ? "Supports owner attribution"
                        : "Role only — does not establish ownership"}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No defensible person relationship has been found.</p>
            )}
            <p className="chicago-caution">
              A manager, officer, attorney, or registered agent is not treated
              as an owner without separate ownership evidence.
            </p>
          </div>
          <div>
            <h3>Entity family</h3>
            <ul className="seller-relationship-list">
              {profile.relatedEntities.map((entity) => (
                <li key={`${entity.name}-${entity.type}`}>
                  <strong>{entity.name}</strong>
                  <span>{entity.type.replaceAll("_", " ").toLowerCase()}</span>
                  <small>{entity.source}</small>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section>
          <h3>Exit convergence</h3>
          <div className="chicago-score">
            <strong>{profile.exitConvergence.score}</strong>
            <span>{profile.exitConvergence.label}</span>
          </div>
          {profile.exitConvergence.components.length ? (
            <ul className="chicago-signal-list">
              {profile.exitConvergence.components.map((component) => (
                <li key={component.id}>
                  <span>{component.label}</span>
                  <strong>+{component.points}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>No independent business-exit evidence found.</p>
          )}
        </section>
        <section>
          <div className="seller-section-heading">
            <div>
              <p className="eyebrow">Manual enrichment</p>
              <h3>Illinois Secretary of State</h3>
            </div>
            <button
              type="button"
              className="seller-primary-button"
              onClick={() => setFormOpen((open) => !open)}
            >
              {formOpen ? "Cancel" : "Add SOS record"}
            </button>
          </div>
          <p>
            Manual records retain their source URL, lookup date, and reviewer.
            They do not silently promote managers or registered agents to
            owners.
          </p>
          {manual.length > 0 && (
            <ul className="seller-manual-list">
              {manual.map((record) => (
                <li key={record.id}>
                  <strong>{record.entityLegalName}</strong>
                  <span>
                    {record.entityStatus} · File{" "}
                    {record.illinoisFileNumber || "not reported"}
                  </span>
                  <small>
                    Checked {date(record.lookupDate)} by {record.checkedBy} ·{" "}
                    <a href={record.sourceUrl} target="_blank" rel="noreferrer">
                      Source ↗
                    </a>
                  </small>
                </li>
              ))}
            </ul>
          )}
          {formOpen && (
            <form className="seller-manual-form" onSubmit={saveManual}>
              {(Object.keys(emptyManualForm) as Array<keyof ManualForm>).map(
                (key) => (
                  <label key={key}>
                    <span>
                      {key
                        .replace(/([A-Z])/g, " $1")
                        .replace(/^./, (letter) => letter.toUpperCase())}
                    </span>
                    <input
                      required={[
                        "entityLegalName",
                        "sourceUrl",
                        "lookupDate",
                        "checkedBy",
                      ].includes(key)}
                      type={
                        key === "formationDate" || key === "lookupDate"
                          ? "date"
                          : key === "sourceUrl"
                            ? "url"
                            : "text"
                      }
                      value={form[key]}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ),
              )}
              <button type="submit" className="seller-primary-button">
                Save audited record
              </button>
            </form>
          )}
          {message && (
            <p className="seller-form-message" role="status">
              {message}
            </p>
          )}
        </section>
        <section>
          <h3>Sources</h3>
          <ul className="chicago-source-list">
            {profile.evidence.map((source) => (
              <li key={source.id}>
                <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                  {source.publisher} ↗
                </a>
                <span>
                  {source.title} · retrieved {date(source.retrievedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <footer className="seller-profile-disclaimer">
          {profile.freshness}.{" "}
          {profile.needsManualReview
            ? "Priority seller needs manual person resolution. "
            : ""}
          Recorded consideration does not establish a seller’s net proceeds or
          current liquidity.
        </footer>
      </article>
    </div>
  );
}
