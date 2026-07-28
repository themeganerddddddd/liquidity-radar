"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, {
  type Map as MapLibreMap,
  type Marker,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { regions } from "./data";
import { money } from "../lib/format";
import { markerSize, type MapUrlState } from "../lib/regional";

export type MapMetric = MapUrlState["metric"];
export type MapPeriod = MapUrlState["period"];

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

const denseRegionOffsets: Record<string, [number, number]> = {
  "washington-arlington-alexandria": [-54, 26],
  "montgomery-county-md": [-30, -40],
  maryland: [34, -32],
  "northern-virginia": [38, 28],
};

const periodMultipliers: Record<MapPeriod, number> = {
  "30d": 0.38,
  "90d": 1,
  "12m": 2.65,
  "3y": 5.8,
};

const fallbackStyle: StyleSpecification = {
  version: 8,
  sources: {
    openstreetmap: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#dce6e8" },
    },
    {
      id: "openstreetmap",
      type: "raster",
      source: "openstreetmap",
      paint: {
        "raster-opacity": 0.92,
        "raster-saturation": -0.55,
        "raster-contrast": 0.08,
        "raster-brightness-min": 0.16,
        "raster-brightness-max": 0.92,
      },
    },
  ],
};

function selectedValue(region: (typeof regions)[number], metric: MapMetric) {
  return region[metric];
}

function adjustedValue(
  region: (typeof regions)[number],
  metric: MapMetric,
  period: MapPeriod,
) {
  const value = selectedValue(region, metric);
  return metric === "momentum"
    ? value
    : Math.round(value * periodMultipliers[period]);
}

function displayValue(value: number, metric: MapMetric) {
  return metric === "momentum" ? `+${value}%` : money(value);
}

export function LiquidityMap({
  metric,
  period,
  industry,
  selectedRegion,
  center,
  zoom,
  onMetricChange,
  onPeriodChange,
  onIndustryChange,
  onViewportChange,
  onRegion,
  onPeople,
  onEvents,
}: {
  metric: MapMetric;
  period: MapPeriod;
  industry: string;
  selectedRegion: string;
  center: [number, number];
  zoom: number;
  onMetricChange: (metric: MapMetric) => void;
  onPeriodChange: (period: MapPeriod) => void;
  onIndustryChange: (industry: string) => void;
  onViewportChange: (center: [number, number], zoom: number) => void;
  onRegion: (slug: string) => void;
  onPeople: (slug: string) => void;
  onEvents: (slug: string) => void;
}) {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
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

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapNode.current,
      center,
      zoom,
      minZoom: 2.5,
      maxZoom: 10,
      maxBounds: [
        [-130, 22],
        [-64, 51],
      ],
      attributionControl: false,
      style: configuredStyle || fallbackStyle,
    });
    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
        visualizePitch: false,
      }),
      "bottom-right",
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left",
    );
    map.on("load", () => {
      setLoading(false);
      setError("");
    });
    map.on("error", (event) => {
      const message =
        event.error?.message ||
        "The basemap could not be loaded. Use the accessible regional table below.";
      setError(message);
      setLoading(false);
    });
    map.on("moveend", () => {
      const currentCenter = map.getCenter();
      onViewportChange([currentCenter.lng, currentCenter.lat], map.getZoom());
    });
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // Map creation is intentionally tied to the configured style only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configuredStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || loading) return;
    markersRef.current.forEach((marker) => marker.remove());
    const values = visibleRegions.map((region) =>
      adjustedValue(region, metric, period),
    );
    markersRef.current = visibleRegions.map((region) => {
      const value = adjustedValue(region, metric, period);
      const size = markerSize(value, values);
      const markerButton = document.createElement("button");
      markerButton.type = "button";
      markerButton.className = `map-region-marker ${
        selectedRegion === region.slug ? "selected" : ""
      }`;
      markerButton.style.width = `${size}px`;
      markerButton.style.height = `${size}px`;
      markerButton.setAttribute(
        "aria-label",
        `${region.name}, ${metricLabels[metric]} ${displayValue(value, metric)}. Open regional actions.`,
      );
      markerButton.innerHTML = `<span>${region.code}</span>`;

      const openPopup = () => {
        const popupContent = document.createElement("div");
        popupContent.className = "regional-popup";
        const low = Math.round(value * 0.78);
        const high = Math.round(value * 1.28);
        popupContent.innerHTML = `
          <strong>${region.name}</strong>
          <span>${metricLabels[metric]} · ${periodLabels[period]}</span>
          <b>${displayValue(value, metric)}</b>
          <dl>
            <div><dt>Low</dt><dd>${displayValue(low, metric)}</dd></div>
            <div><dt>Median</dt><dd>${displayValue(value, metric)}</dd></div>
            <div><dt>High</dt><dd>${displayValue(high, metric)}</dd></div>
            <div><dt>Events</dt><dd>${region.eventCount}</dd></div>
            <div><dt>High-confidence people</dt><dd>${region.highConfidencePeople}</dd></div>
          </dl>
        `;
        const actions = document.createElement("div");
        actions.className = "regional-popup-actions";
        [
          ["View region", () => onRegion(region.slug)],
          ["View people", () => onPeople(region.slug)],
          ["View events", () => onEvents(region.slug)],
        ].forEach(([label, action]) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = String(label);
          button.addEventListener("click", action as () => void);
          actions.appendChild(button);
        });
        popupContent.appendChild(actions);
        new maplibregl.Popup({
          closeButton: true,
          closeOnClick: false,
          focusAfterOpen: true,
          offset: Math.round(size / 2) + 8,
        })
          .setLngLat(region.coordinates)
          .setDOMContent(popupContent)
          .addTo(map);
      };
      markerButton.addEventListener("click", (event) => {
        event.stopPropagation();
        openPopup();
      });
      markerButton.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPopup();
        }
      });
      return new maplibregl.Marker({
        element: markerButton,
        anchor: "center",
        offset: denseRegionOffsets[region.slug] ?? [0, 0],
      })
        .setLngLat(region.coordinates)
        .addTo(map);
    });
  }, [
    industry,
    loading,
    metric,
    onEvents,
    onPeople,
    onRegion,
    period,
    selectedRegion,
    visibleRegions,
  ]);

  return (
    <section className="map-panel" aria-labelledby="map-title">
      <div className="panel-head map-head">
        <div>
          <p className="eyebrow">National capital flows</p>
          <h2 id="map-title">Where private capital is moving</h2>
          <p className="map-context">
            OpenStreetMap supplies recognizable state, road, city, and regional
            context without a proprietary token.
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
      <div className="map-stage" hidden={tableView}>
        {loading && (
          <div className="map-loading" role="status">
            <span />
            Loading United States basemap…
          </div>
        )}
        {error && (
          <div className="map-error" role="alert">
            <strong>Basemap unavailable</strong>
            <span>{error}</span>
            <button onClick={() => setTableView(true)}>
              Open regional table
            </button>
          </div>
        )}
        <div
          ref={mapNode}
          className="map-canvas"
          aria-label="Interactive United States map of regional capital metrics"
        />
        <div className="map-legend" aria-label="Map marker size legend">
          <strong>{metricLabels[metric]}</strong>
          <span>Lower</span>
          <i className="small" />
          <i className="medium" />
          <i className="large" />
          <span>Higher</span>
          <small>Square-root scale · {periodLabels[period]}</small>
        </div>
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
