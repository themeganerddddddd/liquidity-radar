"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, {
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { regions, type Region } from "./data";
import { money } from "../lib/format";
import type { MapUrlState } from "../lib/regional";

export type MapMetric = MapUrlState["metric"];
export type MapPeriod = MapUrlState["period"];

type StateSummary = {
  code: string;
  name: string;
  regions: Region[];
  value: number;
  events: number;
  highConfidencePeople: number;
};

const metricLabels: Record<MapMetric, string> = {
  created: "Liquidity created",
  controlled: "Estimated remaining",
  deployed: "Known deployment",
  momentum: "Capital momentum",
};

const periodLabels: Record<MapPeriod, string> = {
  "30d": "30 days",
  "90d": "90 days",
  "12m": "12 months",
  "3y": "3 years",
};

const periodMultipliers: Record<MapPeriod, number> = {
  "30d": 0.38,
  "90d": 1,
  "12m": 2.65,
  "3y": 5.8,
};

const stateNames: Record<string, string> = {
  CA: "California",
  DC: "District of Columbia",
  LA: "Louisiana",
  MA: "Massachusetts",
  MD: "Maryland",
  NC: "North Carolina",
  NY: "New York",
  TX: "Texas",
  VA: "Virginia",
};

const illustrativeStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#f4f1e9" },
    },
  ],
};

function selectedValue(region: Region, metric: MapMetric) {
  return region[metric];
}

function adjustedValue(region: Region, metric: MapMetric, period: MapPeriod) {
  const value = selectedValue(region, metric);
  return metric === "momentum"
    ? value
    : Math.round(value * periodMultipliers[period]);
}

function displayValue(value: number, metric: MapMetric) {
  return metric === "momentum" ? `+${value}%` : money(value);
}

function stateColor(value: number, maximum: number) {
  const ratio = maximum ? Math.sqrt(Math.max(value, 0) / maximum) : 0;
  if (ratio > 0.86) return "#075e61";
  if (ratio > 0.7) return "#13787a";
  if (ratio > 0.54) return "#2a9390";
  if (ratio > 0.38) return "#66aaa4";
  return "#9bc4bb";
}

function stateFillExpression(summaries: StateSummary[]) {
  const maximum = Math.max(...summaries.map((summary) => summary.value), 1);
  return [
    "match",
    ["get", "STUSPS"],
    ...summaries.flatMap((summary) => [
      summary.code,
      stateColor(summary.value, maximum),
    ]),
    "#dfe7e3",
  ];
}

function ensureStateLayers(map: MapLibreMap) {
  if (!map.getSource("census-states")) {
    map.addSource("census-states", {
      type: "geojson",
      data: "/data/us-states-20m.geojson",
      attribution: "U.S. Census Bureau, 2025 Cartographic Boundary Files",
    });
  }
  if (!map.getLayer("state-shadows")) {
    map.addLayer({
      id: "state-shadows",
      type: "fill",
      source: "census-states",
      paint: {
        "fill-color": "#0e3037",
        "fill-opacity": 0.12,
        "fill-translate": [0, 3],
      },
    });
  }
  if (!map.getLayer("state-fills")) {
    map.addLayer({
      id: "state-fills",
      type: "fill",
      source: "census-states",
      paint: {
        "fill-color": "#dfe7e3",
        "fill-opacity": 0.98,
      },
    });
  }
  if (!map.getLayer("state-outlines")) {
    map.addLayer({
      id: "state-outlines",
      type: "line",
      source: "census-states",
      paint: {
        "line-color": "#ffffff",
        "line-width": 1.15,
        "line-opacity": 0.95,
      },
    });
  }
  if (!map.getLayer("selected-state")) {
    map.addLayer({
      id: "selected-state",
      type: "line",
      source: "census-states",
      filter: ["==", ["get", "STUSPS"], ""],
      paint: {
        "line-color": "#f3ad36",
        "line-width": 3.5,
      },
    });
  }
}

export function LiquidityMap({
  metric,
  period,
  industry,
  selectedRegion,
  onMetricChange,
  onPeriodChange,
  onIndustryChange,
  onRegion,
  onPeople,
  onEvents,
}: {
  metric: MapMetric;
  period: MapPeriod;
  industry: string;
  selectedRegion: string;
  onMetricChange: (metric: MapMetric) => void;
  onPeriodChange: (period: MapPeriod) => void;
  onIndustryChange: (industry: string) => void;
  onRegion: (slug: string) => void;
  onPeople: (slug: string) => void;
  onEvents: (slug: string) => void;
}) {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [tableView, setTableView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const configuredStyle =
    process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
    process.env.PUBLIC_MAP_STYLE_URL ||
    "";
  const visibleRegions = useMemo(
    () =>
      industry
        ? regions.filter((region) =>
            region.industries.some((item) => item.name === industry),
          )
        : regions,
    [industry],
  );
  const stateSummaries = useMemo(() => {
    const grouped = new Map<string, StateSummary>();
    visibleRegions.forEach((region) => {
      const current: StateSummary = grouped.get(region.code) ?? {
        code: region.code,
        name: stateNames[region.code] ?? region.code,
        regions: [],
        value: 0,
        events: 0,
        highConfidencePeople: 0,
      };
      current.regions.push(region);
      current.value += adjustedValue(region, metric, period);
      current.events += region.eventCount;
      current.highConfidencePeople += region.highConfidencePeople;
      grouped.set(region.code, current);
    });
    return [...grouped.values()].sort((a, b) => b.value - a.value);
  }, [metric, period, visibleRegions]);
  const stateSummariesRef = useRef(stateSummaries);
  const selectedCode =
    regions.find((region) => region.slug === selectedRegion)?.code ?? "";
  const [focusedCode, setFocusedCode] = useState(selectedCode || "MD");
  const validFocusedCode = stateSummaries.some(
    (summary) => summary.code === focusedCode,
  )
    ? focusedCode
    : stateSummaries.some((summary) => summary.code === selectedCode)
      ? selectedCode
      : (stateSummaries[0]?.code ?? "");
  const focusedState =
    stateSummaries.find((summary) => summary.code === validFocusedCode) ??
    stateSummaries[0];

  useEffect(() => {
    stateSummariesRef.current = stateSummaries;
  }, [stateSummaries]);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapNode.current,
      center: [-96.5, 38.4],
      zoom: 3.1,
      minZoom: 3.1,
      maxZoom: 3.1,
      renderWorldCopies: false,
      attributionControl: false,
      dragPan: false,
      scrollZoom: false,
      boxZoom: false,
      dragRotate: false,
      keyboard: false,
      doubleClickZoom: false,
      touchZoomRotate: false,
      style: configuredStyle || illustrativeStyle,
    });
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left",
    );
    map.on("load", () => {
      ensureStateLayers(map);
      map.fitBounds(
        [
          [-125, 24],
          [-66.5, 49.5],
        ],
        { padding: 18, duration: 0 },
      );
      setLoading(false);
      setError("");
      map.on("click", "state-fills", (event) => {
        const code = String(event.features?.[0]?.properties?.STUSPS ?? "");
        if (
          stateSummariesRef.current.some((summary) => summary.code === code)
        ) {
          setFocusedCode(code);
        }
      });
      map.on("mousemove", "state-fills", (event) => {
        const code = String(event.features?.[0]?.properties?.STUSPS ?? "");
        map.getCanvas().style.cursor = stateSummariesRef.current.some(
          (summary) => summary.code === code,
        )
          ? "pointer"
          : "";
      });
      map.on("mouseleave", "state-fills", () => {
        map.getCanvas().style.cursor = "";
      });
    });
    map.on("error", (event) => {
      if (!String(event.error?.message ?? "").includes("glyph")) {
        setError(
          event.error?.message ||
            "The state illustration could not be loaded. Use the accessible regional table.",
        );
        setLoading(false);
      }
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [configuredStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || loading || !map.getLayer("state-fills")) return;
    map.setPaintProperty(
      "state-fills",
      "fill-color",
      stateFillExpression(stateSummaries),
    );
    map.setFilter("selected-state", [
      "==",
      ["get", "STUSPS"],
      focusedState?.code ?? "",
    ]);
  }, [focusedState?.code, loading, stateSummaries]);

  return (
    <section className="map-panel" aria-labelledby="map-title">
      <div className="panel-head map-head">
        <div>
          <p className="eyebrow">State-based capital flows</p>
          <h2 id="map-title">Where private capital is moving</h2>
          <p className="map-context">
            A fixed illustration based on official 2025 U.S. Census state
            boundaries. Shaded states contain regional intelligence; select one
            to inspect its underlying regions.
          </p>
        </div>
        <div className="map-tools">
          <label className="field-inline">
            <span>Metric</span>
            <select
              aria-label="Map metric"
              value={metric}
              onChange={(event) =>
                onMetricChange(event.target.value as MapMetric)
              }
            >
              {Object.entries(metricLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-inline">
            <span>Period</span>
            <select
              aria-label="Map period"
              value={period}
              onChange={(event) =>
                onPeriodChange(event.target.value as MapPeriod)
              }
            >
              {Object.entries(periodLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-inline">
            <span>Industry</span>
            <select
              aria-label="Map industry"
              value={industry}
              onChange={(event) => onIndustryChange(event.target.value)}
            >
              <option value="">All industries</option>
              {Array.from(
                new Set(
                  regions.flatMap((region) =>
                    region.industries.map((item) => item.name),
                  ),
                ),
              ).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <button
            className="button ghost small"
            onClick={() => setTableView((value) => !value)}
            aria-pressed={tableView}
          >
            {tableView ? "Map view" : "Table view"}
          </button>
        </div>
      </div>
      <div className="map-stage illustrative-map-stage" hidden={tableView}>
        {loading && (
          <div className="map-loading" role="status">
            <span />
            Drawing the United States state map…
          </div>
        )}
        {error && (
          <div className="map-error" role="alert">
            <strong>State map unavailable</strong>
            <span>{error}</span>
            <button onClick={() => setTableView(true)}>
              Open regional table
            </button>
          </div>
        )}
        <div className="illustrative-map-layout">
          <div className="state-map-surface">
            <div
              ref={mapNode}
              className="map-canvas"
              aria-label="Fixed United States state map of regional capital metrics"
            />
            <div className="map-legend state-map-legend">
              <strong>{metricLabels[metric]}</strong>
              <span>Lower</span>
              <i />
              <span>Higher</span>
              <small>{periodLabels[period]} · state aggregate</small>
            </div>
          </div>
          <aside className="state-insight-panel" aria-live="polite">
            {focusedState ? (
              <>
                <p className="eyebrow">Selected state</p>
                <div className="state-insight-title">
                  <span>{focusedState.code}</span>
                  <div>
                    <h3>{focusedState.name}</h3>
                    <small>
                      {focusedState.regions.length} regional{" "}
                      {focusedState.regions.length === 1 ? "view" : "views"}
                    </small>
                  </div>
                </div>
                <strong className="state-total">
                  {displayValue(focusedState.value, metric)}
                </strong>
                <span className="state-total-label">
                  {metricLabels[metric]} · {periodLabels[period]}
                </span>
                <dl className="state-stat-grid">
                  <div>
                    <dt>Events</dt>
                    <dd>{focusedState.events}</dd>
                  </div>
                  <div>
                    <dt>High-confidence people</dt>
                    <dd>{focusedState.highConfidencePeople}</dd>
                  </div>
                </dl>
                <div className="state-region-list">
                  {focusedState.regions.map((region) => (
                    <article key={region.slug}>
                      <button
                        className="state-region-name"
                        onClick={() => onRegion(region.slug)}
                      >
                        <strong>{region.name}</strong>
                        <span>Open region →</span>
                      </button>
                      <div>
                        <button onClick={() => onPeople(region.slug)}>
                          People
                        </button>
                        <button onClick={() => onEvents(region.slug)}>
                          Events
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p>No states match the selected industry.</p>
            )}
          </aside>
        </div>
        <div className="state-map-buttons" aria-label="States with data">
          {stateSummaries.map((summary) => (
            <button
              key={summary.code}
              className={summary.code === focusedState?.code ? "active" : ""}
              onClick={() => setFocusedCode(summary.code)}
              aria-pressed={summary.code === focusedState?.code}
            >
              <strong>{summary.code}</strong>
              <span>{displayValue(summary.value, metric)}</span>
            </button>
          ))}
        </div>
        <p className="map-source-note">
          State geometry: U.S. Census Bureau 2025 Cartographic Boundary Files.
          Regional values remain fictional demonstration data.
        </p>
      </div>
      <div
        className="table-wrap map-table"
        hidden={!tableView}
        aria-label="Accessible regional map data"
      >
        <table>
          <thead>
            <tr>
              <th>Region</th>
              <th>{metricLabels[metric]}</th>
              <th>Estimate range</th>
              <th>Events</th>
              <th>High-confidence people</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRegions
              .slice()
              .sort(
                (a, b) =>
                  adjustedValue(b, metric, period) -
                  adjustedValue(a, metric, period),
              )
              .map((region) => {
                const value = adjustedValue(region, metric, period);
                return (
                  <tr key={region.slug}>
                    <td>
                      <strong>{region.name}</strong>
                      <small>
                        {region.metro} · {periodLabels[period]}
                      </small>
                    </td>
                    <td>{displayValue(value, metric)}</td>
                    <td>
                      {displayValue(Math.round(value * 0.78), metric)}–
                      {displayValue(Math.round(value * 1.28), metric)}
                    </td>
                    <td>{region.eventCount}</td>
                    <td>{region.highConfidencePeople}</td>
                    <td className="table-actions">
                      <button onClick={() => onRegion(region.slug)}>
                        View region
                      </button>
                      <button onClick={() => onPeople(region.slug)}>
                        People
                      </button>
                      <button onClick={() => onEvents(region.slug)}>
                        Events
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
