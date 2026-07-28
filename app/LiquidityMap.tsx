"use client";

import { useEffect, useMemo, useState } from "react";
import {
  geoAlbersUsa,
  geoPath,
  type ExtendedFeature,
  type ExtendedFeatureCollection,
  type GeoGeometryObjects,
} from "d3-geo";
import { events, people, regions, type Region } from "./data";
import { money } from "../lib/format";
import type { MapUrlState } from "../lib/regional";
import type { PublicDataSnapshot } from "../lib/public-data";
import publicSignalsJson from "../public/data/public-signals.json";

export type MapMetric = MapUrlState["metric"];
export type MapPeriod = MapUrlState["period"];

const publicSignals = publicSignalsJson as PublicDataSnapshot;

type StateSummary = {
  code: string;
  name: string;
  regions: Region[];
  value: number;
  events: number;
  highConfidencePeople: number;
};

type StateProperties = {
  STUSPS: string;
  NAME: string;
};

type StateFeature = ExtendedFeature<GeoGeometryObjects, StateProperties>;
type StateFeatureCollection = ExtendedFeatureCollection<StateFeature>;

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
  AK: "Alaska",
  AL: "Alabama",
  AR: "Arkansas",
  AZ: "Arizona",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DC: "District of Columbia",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  IA: "Iowa",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  MA: "Massachusetts",
  MD: "Maryland",
  ME: "Maine",
  MI: "Michigan",
  MN: "Minnesota",
  MO: "Missouri",
  MS: "Mississippi",
  MT: "Montana",
  NC: "North Carolina",
  ND: "North Dakota",
  NE: "Nebraska",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NV: "Nevada",
  NY: "New York",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VA: "Virginia",
  VT: "Vermont",
  WA: "Washington",
  WI: "Wisconsin",
  WV: "West Virginia",
  WY: "Wyoming",
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

function compactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function stateColor(value: number, maximum: number) {
  const ratio = maximum ? Math.sqrt(Math.max(value, 0) / maximum) : 0;
  if (ratio > 0.86) return "#075e61";
  if (ratio > 0.7) return "#13787a";
  if (ratio > 0.54) return "#2a9390";
  if (ratio > 0.38) return "#66aaa4";
  return "#9bc4bb";
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
  const [tableView, setTableView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stateFeatures, setStateFeatures] = useState<StateFeature[]>([]);
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
  const focusedFormation = publicSignals.businessFormation.states.find(
    (state) => state.code === focusedState?.code,
  );
  const focusedEconomy = publicSignals.regionalEconomy.states.find(
    (state) => state.code === focusedState?.code,
  );
  const focusedAdvisers = publicSignals.advisers.states.find(
    (state) => state.code === focusedState?.code,
  );

  useEffect(() => {
    const controller = new AbortController();
    async function loadBoundaries() {
      try {
        const response = await fetch("/data/us-states-20m.geojson", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Boundary file returned ${response.status}.`);
        }
        const collection = (await response.json()) as StateFeatureCollection;
        const features = collection.features.filter(
          (feature) =>
            feature.properties?.STUSPS && feature.properties.STUSPS !== "PR",
        );
        if (features.length < 51) {
          throw new Error("The state boundary file is incomplete.");
        }
        setStateFeatures(features);
        setError("");
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "The state illustration could not be loaded.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadBoundaries();
    return () => controller.abort();
  }, []);

  const stateDrawing = useMemo(() => {
    if (!stateFeatures.length) return [];
    const collection: StateFeatureCollection = {
      type: "FeatureCollection",
      features: stateFeatures,
    };
    const projection = geoAlbersUsa().fitExtent(
      [
        [34, 30],
        [926, 532],
      ],
      collection,
    );
    const path = geoPath(projection);
    const summaryByCode = new Map(
      stateSummaries.map((summary) => [summary.code, summary]),
    );
    const maximum = Math.max(
      ...stateSummaries.map((summary) => summary.value),
      1,
    );
    return stateFeatures
      .map((feature) => {
        const code = feature.properties.STUSPS;
        const summary = summaryByCode.get(code);
        const centroid = path.centroid(feature);
        return {
          code,
          name: feature.properties.NAME,
          path: path(feature) ?? "",
          centroid,
          labelVisible: path.area(feature) > 360,
          summary,
          fill: summary ? stateColor(summary.value, maximum) : "#dfe7e3",
        };
      })
      .filter((state) => state.path);
  }, [stateFeatures, stateSummaries]);

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
            <div className="map-coverage-badge">
              <strong>Nationwide demo coverage</strong>
              <span>
                {stateSummaries.length} states/DC · {regions.length} regional
                views · {people.length} people · {events.length} events
              </span>
            </div>
            <svg
              className="state-map-svg"
              viewBox="0 0 960 570"
              preserveAspectRatio="xMidYMid meet"
              aria-label="Fixed United States state map of regional capital metrics"
              role="group"
            >
              <title>
                Fixed United States state map of regional capital metrics
              </title>
              <g className="state-map-paths">
                {stateDrawing.map((state) => (
                  <path
                    key={state.code}
                    className={
                      state.code === focusedState?.code
                        ? "state-shape selected"
                        : state.summary
                          ? "state-shape has-data"
                          : "state-shape"
                    }
                    d={state.path}
                    fill={state.fill}
                    role={state.summary ? "button" : undefined}
                    tabIndex={state.summary ? 0 : -1}
                    aria-label={
                      state.summary
                        ? `${state.name}: ${displayValue(state.summary.value, metric)} ${metricLabels[metric].toLowerCase()}`
                        : `${state.name}: no matching data`
                    }
                    aria-pressed={
                      state.summary
                        ? state.code === focusedState?.code
                        : undefined
                    }
                    onClick={() => {
                      if (state.summary) setFocusedCode(state.code);
                    }}
                    onKeyDown={(event) => {
                      if (
                        state.summary &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
                        event.preventDefault();
                        setFocusedCode(state.code);
                      }
                    }}
                  >
                    <title>
                      {state.name}
                      {state.summary
                        ? ` · ${displayValue(state.summary.value, metric)}`
                        : " · no matching data"}
                    </title>
                  </path>
                ))}
              </g>
              <g className="state-map-labels" aria-hidden="true">
                {stateDrawing
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
                <div className="state-public-context">
                  <div>
                    <p className="eyebrow">Official public context</p>
                    <span>
                      Census {publicSignals.businessFormation.period} · BEA{" "}
                      {publicSignals.regionalEconomy.period.replace(":", " ")}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>Business applications</dt>
                      <dd>
                        {focusedFormation?.applications.toLocaleString() ?? "—"}
                      </dd>
                      <small>
                        {focusedFormation
                          ? `${focusedFormation.monthlyChange >= 0 ? "+" : ""}${focusedFormation.monthlyChange}% MoM`
                          : "Not available"}
                      </small>
                    </div>
                    <div>
                      <dt>Projected formations</dt>
                      <dd>
                        {focusedFormation?.projectedFormations.toLocaleString() ??
                          "—"}
                      </dd>
                      <small>within four quarters</small>
                    </div>
                    <div>
                      <dt>Real GDP growth</dt>
                      <dd>
                        {focusedEconomy
                          ? `${focusedEconomy.quarterlyGrowth >= 0 ? "+" : ""}${focusedEconomy.quarterlyGrowth}%`
                          : "—"}
                      </dd>
                      <small>quarter over quarter</small>
                    </div>
                    <div>
                      <dt>Registered advisers</dt>
                      <dd>{focusedAdvisers?.firms.toLocaleString() ?? "—"}</dd>
                      <small>
                        {focusedAdvisers
                          ? `${compactCurrency(focusedAdvisers.regulatoryAssets)} reported assets`
                          : "Not available"}
                      </small>
                    </div>
                  </dl>
                </div>
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
          State geometry and business-formation context: U.S. Census Bureau.
          Real GDP: U.S. BEA. Adviser context: SEC Form ADV. Capital-flow map
          shading and person-level values remain fictional demonstration data.
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
