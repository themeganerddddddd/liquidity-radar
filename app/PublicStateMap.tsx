"use client";

import { useEffect, useMemo, useState } from "react";
import {
  geoAlbersUsa,
  geoPath,
  type ExtendedFeature,
  type ExtendedFeatureCollection,
  type GeoGeometryObjects,
} from "d3-geo";
import type { PublicDataSnapshot } from "../lib/public-data";

type StateProperties = {
  STUSPS: string;
  NAME: string;
};

type StateFeature = ExtendedFeature<GeoGeometryObjects, StateProperties>;
type StateFeatureCollection = ExtendedFeatureCollection<StateFeature>;

type Metric = "applications" | "projected" | "growth";

type StateRow = {
  code: string;
  name: string;
  applications: number;
  projected: number;
  monthlyChange: number;
  growth: number;
  gdp: number;
};

const metrics: Array<{
  id: Metric;
  label: string;
  source: string;
}> = [
  { id: "applications", label: "Business applications", source: "Census" },
  { id: "projected", label: "Projected formations", source: "Census" },
  { id: "growth", label: "Real GDP growth", source: "BEA" },
];

function stateRows(data: PublicDataSnapshot): StateRow[] {
  return data.businessFormation.states.map((formation) => {
    const economy = data.regionalEconomy.states.find(
      (item) => item.code === formation.code,
    );
    return {
      code: formation.code,
      name: formation.name,
      applications: formation.applications,
      projected: formation.projectedFormations,
      monthlyChange: formation.monthlyChange,
      growth: economy?.quarterlyGrowth ?? 0,
      gdp: economy?.realGdpMillions ?? 0,
    };
  });
}

function metricValue(row: StateRow, metric: Metric) {
  return row[metric];
}

function formatMetric(value: number, metric: Metric) {
  if (metric === "growth") return `${value >= 0 ? "+" : ""}${value}%`;
  return value.toLocaleString();
}

function formatDollars(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function stateFill(value: number, minimum: number, maximum: number) {
  const spread = maximum - minimum || 1;
  const ratio = Math.max(0, Math.min(1, (value - minimum) / spread));
  if (ratio > 0.82) return "#075e61";
  if (ratio > 0.62) return "#16807d";
  if (ratio > 0.42) return "#41a19a";
  if (ratio > 0.22) return "#81beb3";
  return "#c6ddd6";
}

export function PublicStateMap({ data }: { data: PublicDataSnapshot }) {
  const [metric, setMetric] = useState<Metric>("applications");
  const [selectedCode, setSelectedCode] = useState("CA");
  const [query, setQuery] = useState("");
  const [features, setFeatures] = useState<StateFeature[]>([]);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/data/us-states-20m.geojson", {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("State boundaries are unavailable.");
        return response.json() as Promise<StateFeatureCollection>;
      })
      .then((collection) => {
        const states = collection.features.filter(
          (feature) =>
            feature.properties?.STUSPS && feature.properties.STUSPS !== "PR",
        );
        if (states.length !== 51) {
          throw new Error("The official state boundary file is incomplete.");
        }
        setFeatures(states);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setMapError(
            error instanceof Error ? error.message : "The map could not load.",
          );
        }
      });

    return () => controller.abort();
  }, []);

  const rows = useMemo(() => stateRows(data), [data]);
  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (left, right) => metricValue(right, metric) - metricValue(left, metric),
      ),
    [metric, rows],
  );
  const selected =
    rows.find((row) => row.code === selectedCode) ?? sortedRows[0];
  const filteredRows = sortedRows.filter((row) =>
    `${row.name} ${row.code}`.toLowerCase().includes(query.toLowerCase()),
  );

  const drawing = useMemo(() => {
    if (!features.length) return [];
    const collection: StateFeatureCollection = {
      type: "FeatureCollection",
      features,
    };
    const projection = geoAlbersUsa().fitExtent(
      [
        [30, 28],
        [930, 535],
      ],
      collection,
    );
    const path = geoPath(projection);
    const byCode = new Map(rows.map((row) => [row.code, row]));
    const values = rows.map((row) => metricValue(row, metric));
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);

    return features
      .map((feature) => {
        const code = feature.properties.STUSPS;
        const row = byCode.get(code);
        return {
          code,
          name: feature.properties.NAME,
          path: path(feature) ?? "",
          centroid: path.centroid(feature),
          labelVisible: path.area(feature) > 360,
          row,
          fill: row
            ? stateFill(metricValue(row, metric), minimum, maximum)
            : "#e6ece9",
        };
      })
      .filter((state) => state.path);
  }, [features, metric, rows]);

  const activeMetric = metrics.find((item) => item.id === metric)!;

  return (
    <section className="real-map" id="state-map">
      <div className="real-section-head">
        <div>
          <p className="eyebrow">State-level public records</p>
          <h2>Compare official signals across the United States</h2>
          <p>
            State shapes use U.S. Census boundaries. Select a metric, then
            choose a state to inspect its underlying published values.
          </p>
        </div>
        <label className="real-state-search">
          <span>Find a state</span>
          <input
            type="search"
            value={query}
            placeholder="Search state or code"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="real-metric-filters" aria-label="Map metric">
        {metrics.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === metric ? "active" : ""}
            aria-pressed={item.id === metric}
            onClick={() => setMetric(item.id)}
          >
            <span>{item.label}</span>
            <small>{item.source}</small>
          </button>
        ))}
      </div>

      <div className="real-map-layout">
        <div className="real-map-surface">
          <div className="real-map-badge">
            <i />
            <span>
              {data.sec.mode === "live" ? "Live SEC feed" : "Verified snapshot"}
              {" · "}
              {rows.length} jurisdictions
            </span>
          </div>
          {mapError ? (
            <div className="real-map-error" role="alert">
              <strong>Map unavailable</strong>
              <span>{mapError}</span>
            </div>
          ) : (
            <svg
              viewBox="0 0 960 570"
              className="real-map-svg"
              role="group"
              aria-label={`United States map by ${activeMetric.label}`}
            >
              <title>{`United States map by ${activeMetric.label}`}</title>
              <g>
                {drawing.map((state) => (
                  <path
                    key={state.code}
                    d={state.path}
                    fill={state.fill}
                    className={
                      state.code === selected?.code
                        ? "real-state-shape selected"
                        : "real-state-shape"
                    }
                    role="button"
                    tabIndex={0}
                    aria-pressed={state.code === selected?.code}
                    aria-label={`${state.name}: ${
                      state.row
                        ? formatMetric(metricValue(state.row, metric), metric)
                        : "not available"
                    }`}
                    onClick={() => setSelectedCode(state.code)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedCode(state.code);
                      }
                    }}
                  >
                    <title>{`${state.name} · ${
                      state.row
                        ? formatMetric(metricValue(state.row, metric), metric)
                        : "not available"
                    }`}</title>
                  </path>
                ))}
              </g>
              <g className="real-state-labels" aria-hidden="true">
                {drawing
                  .filter((state) => state.labelVisible)
                  .map((state) => (
                    <text
                      key={state.code}
                      x={state.centroid[0]}
                      y={state.centroid[1]}
                    >
                      {state.code}
                    </text>
                  ))}
              </g>
            </svg>
          )}
          <div className="real-map-legend">
            <span>Lower</span>
            <i />
            <span>Higher</span>
            <strong>
              {activeMetric.label} · {activeMetric.source}
            </strong>
          </div>
        </div>

        {selected && (
          <aside className="real-state-detail" aria-live="polite">
            <p className="eyebrow">Selected state</p>
            <div className="real-state-title">
              <span>{selected.code}</span>
              <div>
                <h3>{selected.name}</h3>
                <small>Officially published state context</small>
              </div>
            </div>
            <strong className="real-state-primary">
              {formatMetric(metricValue(selected, metric), metric)}
            </strong>
            <span className="real-state-primary-label">
              {activeMetric.label}
            </span>
            <dl className="real-state-stats">
              <div>
                <dt>Business applications</dt>
                <dd>{selected.applications.toLocaleString()}</dd>
                <small>
                  {selected.monthlyChange >= 0 ? "+" : ""}
                  {selected.monthlyChange}% month over month
                </small>
              </div>
              <div>
                <dt>Projected formations</dt>
                <dd>{selected.projected.toLocaleString()}</dd>
                <small>within four quarters</small>
              </div>
              <div>
                <dt>Real GDP growth</dt>
                <dd>{formatMetric(selected.growth, "growth")}</dd>
                <small>
                  {formatDollars(selected.gdp * 1_000_000)} real GDP
                </small>
              </div>
            </dl>
            <p className="real-state-note">
              Values describe published activity or institutional reporting.
              They are not estimates of personal liquidity.
            </p>
          </aside>
        )}
      </div>

      <div className="real-state-ranking">
        <div className="real-ranking-head">
          <strong>State ranking</strong>
          <span>
            {filteredRows.length} result
            {filteredRows.length === 1 ? "" : "s"} · {activeMetric.label}
          </span>
        </div>
        <div className="real-ranking-grid">
          {filteredRows.map((row, index) => (
            <button
              type="button"
              key={row.code}
              className={row.code === selected?.code ? "active" : ""}
              onClick={() => setSelectedCode(row.code)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>
                {row.code}
                <small>{row.name}</small>
              </strong>
              <b>{formatMetric(metricValue(row, metric), metric)}</b>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
