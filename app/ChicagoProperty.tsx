"use client";

import { useMemo, useState } from "react";
import {
  PROPERTY_CATEGORIES,
  type ChicagoPropertyRecord,
  type ChicagoPropertySnapshot,
  type PropertyCategory,
  type ValueStatus,
} from "../lib/chicago-property";

type ResultsMode = "list" | "map";
type PropertyGroup = "all" | "commercial" | "residential";

const pageSize = 40;

const categoryLabels: Record<PropertyCategory, string> = {
  OFFICE: "Office",
  RETAIL: "Retail",
  INDUSTRIAL: "Industrial",
  HOTEL: "Hotel",
  MULTIFAMILY: "Multifamily",
  MIXED_USE: "Mixed use",
  LAND: "Land",
  SELF_STORAGE: "Self-storage",
  HEALTHCARE: "Healthcare",
  OTHER_COMMERCIAL: "Other commercial",
  RESIDENTIAL_LUXURY: "Large residential",
  UNKNOWN: "Unknown",
};

function money(value: number | null, compact = false) {
  if (value === null) return "Unknown";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

function displayValue(record: ChicagoPropertyRecord) {
  const { displayValueLow: low, displayValueHigh: high } = record.transaction;
  if (low === null && high === null) return "Unknown";
  if (low !== null && high !== null && low !== high) {
    return `${money(low, true)}–${money(high, true)}`;
  }
  return money(high ?? low, true);
}

function dateLabel(value: string) {
  if (!value) return "Date unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function locationLabel(record: ChicagoPropertyRecord) {
  return [record.property.city, record.property.state]
    .filter(Boolean)
    .join(", ");
}

function sellerLabel(record: ChicagoPropertyRecord) {
  return record.sellerPerson || record.sellerEntity || record.sellerOriginal;
}

function sellerSubline(record: ChicagoPropertyRecord) {
  if (record.sellerPerson && record.sellerEntity) return record.sellerEntity;
  return `${record.property.categoryLabel} sale`;
}

function Toggle({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? "active" : ""}
      type="button"
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ChicagoPropertyMap({
  records,
  onOpen,
}: {
  records: ChicagoPropertyRecord[];
  onOpen: (record: ChicagoPropertyRecord) => void;
}) {
  const plotted = records
    .filter(
      (record) =>
        record.property.latitude !== null && record.property.longitude !== null,
    )
    .slice(0, 1_200);
  const longitudeMin = -88.35;
  const longitudeMax = -87.45;
  const latitudeMin = 41.4;
  const latitudeMax = 42.2;
  const x = (longitude: number) =>
    5 + ((longitude - longitudeMin) / (longitudeMax - longitudeMin)) * 90;
  const y = (latitude: number) =>
    95 - ((latitude - latitudeMin) / (latitudeMax - latitudeMin)) * 90;

  return (
    <section className="chicago-map-panel" aria-label="Chicago property map">
      <div className="chicago-map-canvas">
        <svg
          viewBox="0 0 100 100"
          role="img"
          aria-label="Cook County property sale locations"
        >
          <path
            className="chicago-map-land"
            d="M8 4H88L95 15L92 31L96 46L90 61L91 78L83 96H7L4 82L8 68L5 50L10 34L6 18Z"
          />
          <path
            className="chicago-map-water"
            d="M88 4H100V100H83L91 78L90 61L96 46L92 31L95 15Z"
          />
          <path
            className="chicago-map-city"
            d="M71 20L84 24L82 88L68 91L65 73L69 55L66 39Z"
          />
          {plotted.map((record) => {
            const markerX = x(record.property.longitude!);
            const markerY = y(record.property.latitude!);
            if (markerX < 0 || markerX > 100 || markerY < 0 || markerY > 100)
              return null;
            const value = record.transaction.displayValueHigh || 0;
            const radius = Math.min(
              2.25,
              Math.max(0.55, Math.log10(Math.max(value, 1)) - 5.3),
            );
            return (
              <circle
                key={record.id}
                cx={markerX}
                cy={markerY}
                r={radius}
                className={
                  record.exitConvergence.score >= 50
                    ? "strong"
                    : record.property.largeResidential
                      ? "residential"
                      : "commercial"
                }
                tabIndex={0}
                role="button"
                aria-label={`${sellerLabel(record)}, ${displayValue(record)}, ${locationLabel(record)}`}
                onClick={() => onOpen(record)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ")
                    onOpen(record);
                }}
              />
            );
          })}
        </svg>
        <div className="chicago-map-key" aria-label="Map legend">
          <span>
            <i className="commercial" /> Commercial
          </span>
          <span>
            <i className="residential" /> Large residential
          </span>
          <span>
            <i className="strong" /> Strong exit signal
          </span>
        </div>
      </div>
      <div className="chicago-map-note">
        <strong>{plotted.length.toLocaleString()} mapped sales</strong>
        <span>
          Markers use asset locations only. Owner mailing addresses are not
          collected or shown.
        </span>
      </div>
    </section>
  );
}

function EvidenceValues({ record }: { record: ChicagoPropertyRecord }) {
  const values = [
    ["Cook recorded sale price", record.transaction.recordedSalePrice],
    ["PTAX full consideration", record.transaction.ptaxFullConsideration],
    ["PTAX net consideration", record.transaction.ptaxNetConsideration],
    ["PTAX taxable consideration", record.transaction.ptaxTaxableConsideration],
  ] as const;
  return (
    <dl className="chicago-detail-list">
      {values.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{money(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChicagoPropertyDetail({
  record,
  onClose,
}: {
  record: ChicagoPropertyRecord;
  onClose: () => void;
}) {
  const businessOwners = record.businessMatch?.owners || [];
  return (
    <div
      className="chicago-detail-overlay"
      role="presentation"
      onMouseDown={onClose}
    >
      <article
        className="chicago-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chicago-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close property detail"
          >
            ×
          </button>
          <p className="eyebrow">Chicago Property</p>
          <h2 id="chicago-detail-title">{sellerLabel(record)}</h2>
          {record.sellerPerson && record.sellerEntity && (
            <p>{record.sellerEntity}</p>
          )}
          <div className="chicago-detail-hero">
            <strong>{displayValue(record)}</strong>
            <span>
              {record.transaction.valueStatus === "RECORDED"
                ? "Recorded sale consideration"
                : record.transaction.valueStatus === "ESTIMATED"
                  ? "Estimated property value"
                  : "Transaction value unknown"}
            </span>
          </div>
        </header>

        <section>
          <h3>Property</h3>
          <dl className="chicago-detail-list">
            <div>
              <dt>Asset location</dt>
              <dd>
                {record.property.address || "Address unavailable"}
                <br />
                {[locationLabel(record), record.property.zip]
                  .filter(Boolean)
                  .join(" ")}
              </dd>
            </div>
            <div>
              <dt>Property type</dt>
              <dd>{record.property.categoryLabel}</dd>
            </div>
            <div>
              <dt>PINs</dt>
              <dd>{record.property.pins.join(", ") || "Unavailable"}</dd>
            </div>
            <div>
              <dt>Parcel count</dt>
              <dd>
                {record.property.parcelCount}
                {record.transaction.multiParcel ? " · Portfolio sale" : ""}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h3>Transaction</h3>
          <dl className="chicago-detail-list">
            <div>
              <dt>Recorded date</dt>
              <dd>{dateLabel(record.transaction.saleDate)}</dd>
            </div>
            <div>
              <dt>Seller</dt>
              <dd>{record.sellerOriginal}</dd>
            </div>
            <div>
              <dt>Buyer</dt>
              <dd>{record.buyer || "Unavailable"}</dd>
            </div>
            <div>
              <dt>Deed / document</dt>
              <dd>
                {record.transaction.deedType || "Unavailable"}
                <br />
                {record.transaction.documentNumber ||
                  "Document number unavailable"}
              </dd>
            </div>
            <div>
              <dt>Sale quality</dt>
              <dd>
                {record.transaction.quality.replaceAll("_", " ").toLowerCase()}
              </dd>
            </div>
          </dl>
          <EvidenceValues record={record} />
          {record.transaction.valueDiscrepancy && (
            <p className="chicago-warning">
              Cook and PTAX reported values differ materially. Both are
              retained; neither overwrites the other.
            </p>
          )}
        </section>

        <section>
          <h3>Proceeds</h3>
          <dl className="chicago-detail-list">
            <div>
              <dt>Recorded sale consideration</dt>
              <dd>{money(record.proceeds.recordedSaleConsideration)}</dd>
            </div>
            <div>
              <dt>Known ownership share</dt>
              <dd>
                {record.proceeds.knownOwnershipShare === null
                  ? "Unknown"
                  : `${Math.round(record.proceeds.knownOwnershipShare * 100)}%`}
              </dd>
            </div>
            <div>
              <dt>Gross attributable value</dt>
              <dd>{money(record.proceeds.grossAttributableValue)}</dd>
            </div>
            <div>
              <dt>Net proceeds</dt>
              <dd>Unknown</dd>
            </div>
          </dl>
          <p className="chicago-caution">{record.proceeds.explanation}</p>
        </section>

        <section>
          <h3>Business connection</h3>
          {record.businessMatch ? (
            <>
              <dl className="chicago-detail-list">
                <div>
                  <dt>Legal business</dt>
                  <dd>{record.businessMatch.legalName}</dd>
                </div>
                <div>
                  <dt>DBA</dt>
                  <dd>{record.businessMatch.dba || "None reported"}</dd>
                </div>
                <div>
                  <dt>Chicago account</dt>
                  <dd>{record.businessMatch.accountNumber}</dd>
                </div>
                <div>
                  <dt>Resolution</dt>
                  <dd>
                    {record.resolutionMethod.replaceAll("_", " ").toLowerCase()}{" "}
                    · {Math.round(record.resolutionConfidence * 100)}%
                    confidence
                  </dd>
                </div>
                <div>
                  <dt>License status</dt>
                  <dd>{record.businessMatch.licenseStatus || "Unknown"}</dd>
                </div>
              </dl>
              {businessOwners.length > 0 && (
                <ul className="chicago-owner-list">
                  {businessOwners.map((owner, index) => (
                    <li key={`${owner.name}-${index}`}>
                      <strong>{owner.name}</strong>
                      <span>
                        {owner.role.replaceAll("_", " ").toLowerCase()} ·
                        ownership percentage unknown
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p>
              No defensible Chicago business-license match was found. The seller
              remains an organization-level lead.
            </p>
          )}
        </section>

        <section>
          <h3>Exit convergence</h3>
          <div className="chicago-score">
            <strong>{record.exitConvergence.score}</strong>
            <span>{record.exitConvergence.label}</span>
          </div>
          {record.exitConvergence.components.length > 0 ? (
            <ul className="chicago-signal-list">
              {record.exitConvergence.components.map((component) => (
                <li key={component.id}>
                  <span>{component.label}</span>
                  <strong>+{component.points}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No separate business-exit evidence was found around this sale.
            </p>
          )}
          {record.repeatedSeller.transactionCount > 1 && (
            <p>
              <strong>Portfolio disposition activity:</strong>{" "}
              {record.repeatedSeller.transactionCount} separate transactions
              totaling {money(record.repeatedSeller.totalRecordedDispositions)}{" "}
              within {record.repeatedSeller.windowDays} days.
            </p>
          )}
        </section>

        <section>
          <h3>Sources</h3>
          <ul className="chicago-source-list">
            {record.evidence.map((item) => (
              <li key={item.id}>
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                  {item.publisher} ↗
                </a>
                <span>{item.title}</span>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </div>
  );
}

export function ChicagoPropertyView({
  snapshot,
}: {
  snapshot: ChicagoPropertySnapshot;
}) {
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mode, setMode] = useState<ResultsMode>("list");
  const [group, setGroup] = useState<PropertyGroup>("all");
  const [minValue, setMinValue] = useState(0);
  const [dateWindow, setDateWindow] = useState(0);
  const [category, setCategory] = useState<PropertyCategory | "all">("all");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [resolution, setResolution] = useState<
    "all" | "resolved" | "unresolved"
  >("all");
  const [valueStatus, setValueStatus] = useState<ValueStatus | "all">("all");
  const [strongExit, setStrongExit] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ChicagoPropertyRecord | null>(null);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const cutoff = dateWindow
      ? new Date(Date.parse(snapshot.generatedAt) - dateWindow * 86_400_000)
          .toISOString()
          .slice(0, 10)
      : "";
    return snapshot.records.filter((record) => {
      const value = record.transaction.displayValueHigh || 0;
      if (
        normalizedQuery &&
        ![
          record.sellerPerson,
          record.sellerEntity,
          record.sellerOriginal,
          record.buyer,
          record.property.address,
          record.property.city,
          record.property.zip,
          record.property.categoryLabel,
          record.transaction.documentNumber,
          record.businessMatch?.legalName || "",
          record.businessMatch?.dba || "",
          ...(record.businessMatch?.owners.map((owner) => owner.name) || []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      )
        return false;
      if (group === "commercial" && !record.property.commercial) return false;
      if (group === "residential" && !record.property.largeResidential)
        return false;
      if (minValue && value < minValue) return false;
      if (cutoff && record.transaction.saleDate < cutoff) return false;
      if (category !== "all" && record.property.category !== category)
        return false;
      if (city && record.property.city.toLowerCase() !== city.toLowerCase())
        return false;
      if (zip && record.property.zip !== zip) return false;
      if (resolution === "resolved" && !record.sellerPerson) return false;
      if (resolution === "unresolved" && record.sellerPerson) return false;
      if (
        valueStatus !== "all" &&
        record.transaction.valueStatus !== valueStatus
      )
        return false;
      if (strongExit && record.exitConvergence.score < 50) return false;
      return true;
    });
  }, [
    snapshot.records,
    snapshot.generatedAt,
    query,
    group,
    minValue,
    dateWindow,
    category,
    city,
    zip,
    resolution,
    valueStatus,
    strongExit,
  ]);

  const cities = useMemo(
    () =>
      [
        ...new Set(
          snapshot.records
            .map((record) => record.property.city)
            .filter(Boolean),
        ),
      ].sort(),
    [snapshot.records],
  );
  const zips = useMemo(
    () =>
      [
        ...new Set(
          snapshot.records.map((record) => record.property.zip).filter(Boolean),
        ),
      ].sort(),
    [snapshot.records],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const setAndReset = (action: () => void) => {
    action();
    setPage(1);
  };

  return (
    <div className="chicago-property-workspace">
      <section
        className="chicago-summary"
        aria-label="Chicago property summary"
      >
        {[
          [
            "Significant sales",
            snapshot.stats.significantSales.toLocaleString(),
          ],
          ["Commercial sales", snapshot.stats.commercialSales.toLocaleString()],
          [
            "Large residential",
            snapshot.stats.largeResidentialSales.toLocaleString(),
          ],
          ["Resolved owners", snapshot.stats.resolvedOwners.toLocaleString()],
          [
            "Strong exit signals",
            snapshot.stats.strongExitSignals.toLocaleString(),
          ],
          [
            "Recorded transaction value",
            money(snapshot.stats.recordedTransactionValue, true),
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <section className="chicago-toolbar">
        <label className="chicago-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) =>
              setAndReset(() => setQuery(event.target.value))
            }
            placeholder="Search seller, business, owner, address, city, or document…"
            aria-label="Search Chicago property sales"
          />
        </label>
        <div className="chicago-toolbar-actions">
          <button
            type="button"
            className={filtersOpen ? "active" : ""}
            onClick={() => setFiltersOpen((current) => !current)}
          >
            Filters
            {[
              minValue,
              dateWindow,
              category !== "all",
              city,
              zip,
              resolution !== "all",
              valueStatus !== "all",
              strongExit,
            ].filter(Boolean).length
              ? ` (${[minValue, dateWindow, category !== "all", city, zip, resolution !== "all", valueStatus !== "all", strongExit].filter(Boolean).length})`
              : ""}
          </button>
          <div className="chicago-mode-toggle">
            <Toggle active={mode === "list"} onClick={() => setMode("list")}>
              List
            </Toggle>
            <Toggle active={mode === "map"} onClick={() => setMode("map")}>
              Map
            </Toggle>
          </div>
        </div>
      </section>

      <div className="chicago-quick-filters">
        <Toggle
          active={group === "all"}
          onClick={() => setAndReset(() => setGroup("all"))}
        >
          All
        </Toggle>
        <Toggle
          active={group === "commercial"}
          onClick={() => setAndReset(() => setGroup("commercial"))}
        >
          Commercial
        </Toggle>
        <Toggle
          active={group === "residential"}
          onClick={() => setAndReset(() => setGroup("residential"))}
        >
          Large residential
        </Toggle>
        <Toggle
          active={strongExit}
          onClick={() =>
            setAndReset(() => setStrongExit((current) => !current))
          }
        >
          Strong exit signals
        </Toggle>
      </div>

      {filtersOpen && (
        <section
          className="chicago-filters"
          aria-label="Chicago property filters"
        >
          <fieldset>
            <legend>Minimum sale value</legend>
            <div>
              {[1_000_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000].map(
                (value) => (
                  <Toggle
                    key={value}
                    active={minValue === value}
                    onClick={() =>
                      setAndReset(() =>
                        setMinValue(minValue === value ? 0 : value),
                      )
                    }
                  >
                    {money(value, true)}+
                  </Toggle>
                ),
              )}
            </div>
          </fieldset>
          <fieldset>
            <legend>Date</legend>
            <div>
              {[30, 90, 365].map((days) => (
                <Toggle
                  key={days}
                  active={dateWindow === days}
                  onClick={() =>
                    setAndReset(() =>
                      setDateWindow(dateWindow === days ? 0 : days),
                    )
                  }
                >
                  Last {days} days
                </Toggle>
              ))}
            </div>
          </fieldset>
          <label>
            Property type
            <select
              value={category}
              onChange={(event) =>
                setAndReset(() =>
                  setCategory(event.target.value as PropertyCategory | "all"),
                )
              }
            >
              <option value="all">All property types</option>
              {PROPERTY_CATEGORIES.filter((item) => item !== "UNKNOWN").map(
                (item) => (
                  <option key={item} value={item}>
                    {categoryLabels[item]}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            City
            <select
              value={city}
              onChange={(event) =>
                setAndReset(() => setCity(event.target.value))
              }
            >
              <option value="">All cities</option>
              {cities.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            ZIP
            <select
              value={zip}
              onChange={(event) =>
                setAndReset(() => setZip(event.target.value))
              }
            >
              <option value="">All ZIP codes</option>
              {zips.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Seller resolution
            <select
              value={resolution}
              onChange={(event) =>
                setAndReset(() =>
                  setResolution(event.target.value as typeof resolution),
                )
              }
            >
              <option value="all">All sellers</option>
              <option value="resolved">Person resolved</option>
              <option value="unresolved">Organization only</option>
            </select>
          </label>
          <label>
            Value status
            <select
              value={valueStatus}
              onChange={(event) =>
                setAndReset(() =>
                  setValueStatus(event.target.value as ValueStatus | "all"),
                )
              }
            >
              <option value="all">Recorded, estimated, or unknown</option>
              <option value="RECORDED">Recorded</option>
              <option value="ESTIMATED">Estimated</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </label>
          <button
            type="button"
            className="chicago-clear"
            onClick={() => {
              setMinValue(0);
              setDateWindow(0);
              setCategory("all");
              setCity("");
              setZip("");
              setResolution("all");
              setValueStatus("all");
              setStrongExit(false);
              setGroup("all");
              setPage(1);
            }}
          >
            Clear filters
          </button>
        </section>
      )}

      <div className="chicago-results-meta">
        <strong>{filtered.length.toLocaleString()} significant sales</strong>
        <span>
          Newest recorded date first · Updated{" "}
          {dateLabel(snapshot.generatedAt.slice(0, 10))}
        </span>
      </div>

      {mode === "map" ? (
        <ChicagoPropertyMap records={filtered} onOpen={setSelected} />
      ) : (
        <section
          className="chicago-results-table"
          aria-label="Chicago property results"
        >
          <div className="chicago-results-head">
            <span>Name</span>
            <span>Proceeds / sale value</span>
            <span>Location</span>
          </div>
          {visible.map((record) => (
            <button
              key={record.id}
              type="button"
              className="chicago-result-row"
              onClick={() => setSelected(record)}
            >
              <span className="chicago-seller">
                <strong>{sellerLabel(record)}</strong>
                <small>{sellerSubline(record)}</small>
                {record.exitConvergence.score >= 50 && (
                  <em>{record.exitConvergence.label}</em>
                )}
              </span>
              <span className="chicago-value">
                <strong>{displayValue(record)}</strong>
                <small>
                  {record.transaction.valueStatus === "RECORDED"
                    ? "Recorded sale consideration"
                    : record.transaction.valueStatus === "ESTIMATED"
                      ? "Estimated property value"
                      : "Value unknown"}
                  {record.transaction.multiParcel
                    ? ` · ${record.property.parcelCount} parcels`
                    : ""}
                </small>
              </span>
              <span className="chicago-location">
                <strong>
                  {locationLabel(record) || "Location unavailable"}
                </strong>
                <small>
                  {dateLabel(record.transaction.saleDate)}
                  {record.property.address
                    ? ` · ${record.property.address}`
                    : ""}
                </small>
              </span>
            </button>
          ))}
          {!visible.length && (
            <div className="chicago-empty">
              <strong>No matching property sales</strong>
              <span>Try clearing one or more filters.</span>
            </div>
          )}
          {pages > 1 && (
            <footer className="chicago-pagination">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {pages}
              </span>
              <button
                type="button"
                disabled={currentPage === pages}
                onClick={() =>
                  setPage((current) => Math.min(pages, current + 1))
                }
              >
                Next
              </button>
            </footer>
          )}
        </section>
      )}

      <p className="chicago-disclaimer">{snapshot.disclaimer}</p>
      {selected && (
        <ChicagoPropertyDetail
          record={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
