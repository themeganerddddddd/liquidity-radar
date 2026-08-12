"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PROPERTY_CATEGORIES,
  type ChicagoPropertyRecord,
  type ChicagoPropertySnapshot,
  type PropertyCounty,
  type PropertyCategory,
  type ValueStatus,
} from "../lib/chicago-property";
import {
  chicagoProfileRecords,
  sortChicagoPropertyRecords,
  type ChicagoPropertySort,
} from "../lib/seller-intelligence";

type ResultsMode = "list" | "map";
type PropertyGroup = "all" | "commercial" | "residential";
type CountyFilter = "all" | PropertyCounty;

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
  return [
    record.property.city,
    `${record.property.county} County`,
    record.property.state,
  ]
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

function profileInitials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "LR"
  );
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

function SortHeader({
  column,
  label,
  sortKey,
  direction,
  onSort,
}: {
  column: ChicagoPropertySort;
  label: string;
  sortKey: ChicagoPropertySort;
  direction: "asc" | "desc";
  onSort: (column: ChicagoPropertySort) => void;
}) {
  const active = column === sortKey;
  return (
    <button
      type="button"
      className={active ? "active" : ""}
      aria-label={`Sort by ${label} ${active && direction === "asc" ? "descending" : "ascending"}`}
      onClick={() => onSort(column)}
    >
      {label}
      <span aria-hidden="true">
        {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
      </span>
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const onOpenRef = useRef(onOpen);
  const hasFittedRef = useRef(false);
  const lastFitRequestRef = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const [fitRequest, setFitRequest] = useState(0);
  const plotted = useMemo(
    () =>
      records.filter(
        (record) =>
          Number.isFinite(record.property.latitude) &&
          Number.isFinite(record.property.longitude) &&
          record.property.latitude! >= 41.35 &&
          record.property.latitude! <= 42.25 &&
          record.property.longitude! >= -88.55 &&
          record.property.longitude! <= -87.35,
      ),
    [records],
  );

  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    let active = true;
    void import("leaflet").then((leaflet) => {
      if (!active || !containerRef.current || mapRef.current) return;
      const map = leaflet
        .map(containerRef.current, {
          center: [41.86, -87.93],
          zoom: 9,
          minZoom: 8,
          maxZoom: 19,
          preferCanvas: true,
          zoomControl: true,
          scrollWheelZoom: true,
        })
        .setMaxBounds([
          [41.35, -88.55],
          [42.25, -87.35],
        ]);
      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          minZoom: 8,
          maxZoom: 19,
          crossOrigin: true,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        })
        .addTo(map);
      leaflet.control.scale({ imperial: true, metric: false }).addTo(map);
      mapRef.current = map;
      layerRef.current = leaflet.layerGroup().addTo(map);
      setMapReady(true);
    });
    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !layerRef.current) return;
    let active = true;
    void import("leaflet").then((leaflet) => {
      if (!active || !mapRef.current || !layerRef.current) return;
      layerRef.current.clearLayers();
      const bounds = leaflet.latLngBounds([]);
      const renderer = leaflet.canvas({ padding: 0.35 });
      for (const record of plotted) {
        const latitude = record.property.latitude!;
        const longitude = record.property.longitude!;
        const value = record.transaction.displayValueHigh || 0;
        const color =
          record.exitConvergence.score >= 50
            ? "#18895b"
            : record.property.largeResidential
              ? "#d77a38"
              : "#315ee8";
        const marker = leaflet.circleMarker([latitude, longitude], {
          renderer,
          radius: Math.min(
            11,
            Math.max(4, (Math.log10(Math.max(value, 1)) - 5.3) * 3),
          ),
          color: "#ffffff",
          weight: 1.25,
          fillColor: color,
          fillOpacity: 0.72,
        });
        const tooltip = document.createElement("div");
        tooltip.className = "chicago-map-tooltip";
        for (const [className, text] of [
          ["seller", sellerLabel(record)],
          ["value", displayValue(record)],
          [
            "detail",
            `${record.property.categoryLabel} · ${dateLabel(record.transaction.saleDate)}`,
          ],
          [
            "detail",
            [record.property.address, locationLabel(record)]
              .filter(Boolean)
              .join(", "),
          ],
        ]) {
          const line = document.createElement("span");
          line.className = className;
          line.textContent = text;
          tooltip.append(line);
        }
        marker.bindTooltip(tooltip, { direction: "top", offset: [0, -4] });
        marker.on("click", () => onOpenRef.current(record));
        marker.addTo(layerRef.current);
        bounds.extend([latitude, longitude]);
      }
      if (
        bounds.isValid() &&
        (!hasFittedRef.current || fitRequest !== lastFitRequestRef.current)
      ) {
        mapRef.current.fitBounds(bounds, {
          padding: [26, 26],
          maxZoom: plotted.length === 1 ? 15 : 12,
          animate: false,
        });
        hasFittedRef.current = true;
        lastFitRequestRef.current = fitRequest;
      }
      window.setTimeout(() => mapRef.current?.invalidateSize(), 0);
    });
    return () => {
      active = false;
    };
  }, [fitRequest, mapReady, plotted]);

  return (
    <section className="chicago-map-panel" aria-label="Chicago property map">
      <div className="chicago-map-canvas">
        <div
          ref={containerRef}
          className="chicago-leaflet-map"
          aria-label="Interactive OpenStreetMap of Cook and DuPage County property sales"
        />
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
          Drag or zoom the real street map, then select a marker to open the
          seller profile. Markers use asset locations only; owner mailing
          addresses are never shown.
        </span>
        <button
          type="button"
          className="chicago-map-fit"
          disabled={!plotted.length}
          onClick={() => setFitRequest((request) => request + 1)}
        >
          Fit filtered sales
        </button>
        {records.length > plotted.length && (
          <small>
            {(records.length - plotted.length).toLocaleString()} filtered sale
            {records.length - plotted.length === 1 ? "" : "s"} lack a usable
            parcel coordinate and are retained in the list.
          </small>
        )}
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

export function ChicagoPropertyProfile({
  record,
  snapshot,
  onBack,
}: {
  record: ChicagoPropertyRecord;
  snapshot: ChicagoPropertySnapshot;
  onBack: () => void;
}) {
  const profileRecords = chicagoProfileRecords(snapshot.records, record);
  const totalRecorded = profileRecords.reduce(
    (sum, item) => sum + (item.proceeds.recordedSaleConsideration || 0),
    0,
  );
  const largestRecorded = Math.max(
    ...profileRecords.map(
      (item) => item.proceeds.recordedSaleConsideration || 0,
    ),
  );
  const profileCounties = [
    ...new Set(profileRecords.map((item) => item.property.county)),
  ];
  const businessOwners = [
    ...new Map(
      profileRecords
        .flatMap((item) => item.businessMatch?.owners || [])
        .map((owner) => [`${owner.name}:${owner.role}`, owner]),
    ).values(),
  ];
  const evidence = [
    ...new Map(
      profileRecords
        .flatMap((item) => item.evidence)
        .map((item) => [item.id, item]),
    ).values(),
  ];
  return (
    <div className="chicago-profile-page">
      <button type="button" className="real-profile-back" onClick={onBack}>
        ← Chicago Property
      </button>
      <article
        className="chicago-detail chicago-profile"
        aria-labelledby="chicago-detail-title"
      >
        <header className="property-profile-hero">
          <div className="property-profile-identity">
            <span>{profileInitials(sellerLabel(record))}</span>
            <div>
              <p className="eyebrow">Evidence-linked property seller</p>
              <div>
                <h2 id="chicago-detail-title">{sellerLabel(record)}</h2>
                <b>{Math.round(record.resolutionConfidence * 100)}% resolved</b>
              </div>
              <p>
                {record.sellerPerson && record.sellerEntity
                  ? `${record.sellerEntity} · `
                  : ""}
                {profileCounties.join(" + ")} County activity · Latest sale{" "}
                {dateLabel(profileRecords[0].transaction.saleDate)}.
              </p>
            </div>
          </div>
          <div className="property-profile-summary">
            <span>Total recorded consideration</span>
            <strong>{money(totalRecorded, true)}</strong>
            <small>
              Across {profileRecords.length} transaction
              {profileRecords.length === 1 ? "" : "s"} · not net cash received
            </small>
            {evidence[0]?.sourceUrl && (
              <a href={evidence[0].sourceUrl} target="_blank" rel="noreferrer">
                Open supporting record ↗
              </a>
            )}
          </div>
        </header>

        <div className="property-profile-disclosure">
          <strong>Recorded value, not bank balance</strong>
          <p>
            Consideration comes from official county and Illinois transfer
            records. It is not the seller’s net proceeds, ownership share, or
            current liquidity. Person and business relationships appear only
            when supported by separate public evidence.
          </p>
        </div>

        <section
          className="chicago-profile-metrics"
          aria-label="Seller disposition summary"
        >
          <div>
            <span>Transactions</span>
            <strong>{profileRecords.length.toLocaleString()}</strong>
          </div>
          <div>
            <span>Total recorded</span>
            <strong>{money(totalRecorded, true)}</strong>
          </div>
          <div>
            <span>Largest transaction</span>
            <strong>{money(largestRecorded, true)}</strong>
          </div>
          <div>
            <span>Most recent</span>
            <strong>{dateLabel(profileRecords[0].transaction.saleDate)}</strong>
          </div>
          <div>
            <span>County coverage</span>
            <strong>{profileCounties.join(" + ")}</strong>
          </div>
        </section>

        <section>
          <h3>All property dispositions</h3>
          <p>
            Each row is one clustered transaction. Multi-parcel sales are
            counted once, and the amounts below are recorded consideration—not
            net proceeds.
          </p>
          <div className="chicago-property-ledger">
            <div className="chicago-property-ledger-head">
              <span>Property</span>
              <span>Recorded consideration</span>
              <span>Location</span>
              <span>Date</span>
            </div>
            {profileRecords.map((item) => (
              <details key={item.id} className="chicago-property-ledger-row">
                <summary>
                  <span>
                    <strong>{item.property.categoryLabel}</strong>
                    <small>
                      {item.property.address || "Address unavailable"}
                    </small>
                  </span>
                  <span>
                    <strong>{displayValue(item)}</strong>
                    <small>{item.transaction.valueStatus.toLowerCase()}</small>
                  </span>
                  <span>
                    <strong>{locationLabel(item)}</strong>
                    <small>
                      {item.property.county} County Â· {item.property.zip}
                    </small>
                  </span>
                  <span>
                    <strong>{dateLabel(item.transaction.saleDate)}</strong>
                    <small>
                      {item.transaction.documentNumber || "No document number"}
                    </small>
                  </span>
                </summary>
                <div className="chicago-property-ledger-detail">
                  <dl className="chicago-detail-list">
                    <div>
                      <dt>Buyer</dt>
                      <dd>{item.buyer || "Unavailable"}</dd>
                    </div>
                    <div>
                      <dt>Deed type</dt>
                      <dd>{item.transaction.deedType}</dd>
                    </div>
                    <div>
                      <dt>Parcels</dt>
                      <dd>{item.property.parcelCount}</dd>
                    </div>
                    <div>
                      <dt>PINs</dt>
                      <dd>{item.property.pins.join(", ") || "Unavailable"}</dd>
                    </div>
                  </dl>
                  <div className="chicago-ledger-sources">
                    {item.evidence.map((source) => (
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
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="chicago-profile-guidance">
          <h3>How to use this profile</h3>
          <p>
            Use the disposition history to identify repeated selling activity,
            then verify owner relationships and independent business-exit
            evidence before outreach. A recorded property value does not
            establish how much cash any person received.
          </p>
        </section>

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
            {evidence.map((item) => (
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
  onOpenRecord,
}: {
  snapshot: ChicagoPropertySnapshot;
  onOpenRecord: (record: ChicagoPropertyRecord) => void;
}) {
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mode, setMode] = useState<ResultsMode>("list");
  const [group, setGroup] = useState<PropertyGroup>("all");
  const [county, setCounty] = useState<CountyFilter>("all");
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
  const [sortKey, setSortKey] = useState<ChicagoPropertySort>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const cutoff = dateWindow
      ? new Date(Date.parse(snapshot.generatedAt) - dateWindow * 86_400_000)
          .toISOString()
          .slice(0, 10)
      : "";
    const matches = snapshot.records.filter((record) => {
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
          record.property.county,
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
      if (county !== "all" && record.property.county !== county) return false;
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
    return sortChicagoPropertyRecords(matches, sortKey, sortDirection);
  }, [
    snapshot.records,
    snapshot.generatedAt,
    query,
    group,
    county,
    minValue,
    dateWindow,
    category,
    city,
    zip,
    resolution,
    valueStatus,
    strongExit,
    sortKey,
    sortDirection,
  ]);

  const cities = useMemo(
    () =>
      [
        ...new Set(
          snapshot.records
            .filter(
              (record) => county === "all" || record.property.county === county,
            )
            .map((record) => record.property.city)
            .filter(Boolean),
        ),
      ].sort(),
    [snapshot.records, county],
  );
  const zips = useMemo(
    () =>
      [
        ...new Set(
          snapshot.records
            .filter(
              (record) => county === "all" || record.property.county === county,
            )
            .map((record) => record.property.zip)
            .filter(Boolean),
        ),
      ].sort(),
    [snapshot.records, county],
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
  const sortBy = (column: ChicagoPropertySort) => {
    if (sortKey === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(column);
      setSortDirection(
        column === "seller" || column === "location" ? "asc" : "desc",
      );
    }
    setPage(1);
  };
  const sortDescription =
    sortKey === "date"
      ? sortDirection === "desc"
        ? "Newest recorded date first"
        : "Oldest recorded date first"
      : `${sortKey === "seller" ? "Name" : sortKey === "value" ? "Sale value" : "Location"} ${sortDirection === "asc" ? "ascending" : "descending"}`;

  return (
    <div className="chicago-property-workspace">
      <section
        className="chicago-summary"
        aria-label="Chicago property summary"
      >
        {[
          [
            "Chicago Metro sales",
            snapshot.stats.significantSales.toLocaleString(),
          ],
          ["Cook County", snapshot.stats.cookSales.toLocaleString()],
          ["DuPage County", snapshot.stats.dupageSales.toLocaleString()],
          [
            "Cross-county sellers",
            snapshot.stats.crossCountySellerEntities.toLocaleString(),
          ],
          ["Resolved owners", snapshot.stats.resolvedOwners.toLocaleString()],
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
              county !== "all",
              city,
              zip,
              resolution !== "all",
              valueStatus !== "all",
              strongExit,
            ].filter(Boolean).length
              ? ` (${[minValue, dateWindow, category !== "all", county !== "all", city, zip, resolution !== "all", valueStatus !== "all", strongExit].filter(Boolean).length})`
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
          active={county === "all"}
          onClick={() =>
            setAndReset(() => {
              setCounty("all");
              setCity("");
              setZip("");
            })
          }
        >
          All Chicago Metro
        </Toggle>
        <Toggle
          active={county === "Cook"}
          onClick={() =>
            setAndReset(() => {
              setCounty("Cook");
              setCity("");
              setZip("");
            })
          }
        >
          Cook County
        </Toggle>
        <Toggle
          active={county === "DuPage"}
          onClick={() =>
            setAndReset(() => {
              setCounty("DuPage");
              setCity("");
              setZip("");
            })
          }
        >
          DuPage County
        </Toggle>
        <span className="chicago-filter-divider" aria-hidden="true" />
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
              setCounty("all");
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
          {sortDescription} · Updated{" "}
          {dateLabel(snapshot.generatedAt.slice(0, 10))}
        </span>
      </div>

      {mode === "map" ? (
        <ChicagoPropertyMap records={filtered} onOpen={onOpenRecord} />
      ) : (
        <section
          className="chicago-results-table"
          aria-label="Chicago property results"
        >
          <div className="chicago-results-head">
            <SortHeader
              column="seller"
              label="Name"
              sortKey={sortKey}
              direction={sortDirection}
              onSort={sortBy}
            />
            <SortHeader
              column="value"
              label="Proceeds / sale value"
              sortKey={sortKey}
              direction={sortDirection}
              onSort={sortBy}
            />
            <SortHeader
              column="location"
              label="Location"
              sortKey={sortKey}
              direction={sortDirection}
              onSort={sortBy}
            />
            <SortHeader
              column="date"
              label="Date"
              sortKey={sortKey}
              direction={sortDirection}
              onSort={sortBy}
            />
          </div>
          {visible.map((record) => (
            <button
              key={record.id}
              type="button"
              className="chicago-result-row"
              onClick={() => onOpenRecord(record)}
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
                  {record.property.address || "Address unavailable"} Â·{" "}
                  {record.property.county} County
                </small>
              </span>
              <span className="chicago-date">
                <strong>{dateLabel(record.transaction.saleDate)}</strong>
                <small>
                  {record.transaction.documentNumber || "Document unavailable"}
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
    </div>
  );
}
