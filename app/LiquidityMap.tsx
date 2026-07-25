"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { regions } from "./data";
import { money, percent } from "../lib/format";

type Metric = "created" | "controlled" | "deployed" | "momentum";

const metricLabels: Record<Metric, string> = {
  created: "Liquidity created",
  controlled: "Estimated remaining",
  deployed: "Known deployment",
  momentum: "Capital momentum",
};

export function LiquidityMap({
  metric,
  onMetricChange,
}: {
  metric: Metric;
  onMetricChange: (metric: Metric) => void;
}) {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [tableView, setTableView] = useState(false);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapNode.current,
      center: [-96.5, 38.4],
      zoom: 3.2,
      minZoom: 2.5,
      maxZoom: 8,
      attributionControl: false,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#0a1823" },
          },
        ],
      },
    });
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );
    map.on("load", () => {
      map.addSource("regions", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: regions.map((region) => ({
            type: "Feature",
            properties: {
              ...region,
              value: region[metric],
              label: metricLabels[metric],
            },
            geometry: { type: "Point", coordinates: region.coordinates },
          })),
        },
      });
      map.addLayer({
        id: "region-halos",
        type: "circle",
        source: "regions",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "value"],
            0,
            16,
            4_500_000_000,
            46,
          ],
          "circle-color": "#50d7bd",
          "circle-opacity": 0.12,
        },
      });
      map.addLayer({
        id: "region-points",
        type: "circle",
        source: "regions",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "value"],
            0,
            7,
            4_500_000_000,
            23,
          ],
          "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "value"],
            0,
            "#8aa8b7",
            2_000_000_000,
            "#50d7bd",
            4_500_000_000,
            "#e8b86d",
          ],
          "circle-stroke-color": "#dffbf5",
          "circle-stroke-width": 1,
          "circle-opacity": 0.9,
        },
      });
      map.on("mouseenter", "region-points", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "region-points", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", "region-points", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const coordinates = (
          feature.geometry as GeoJSON.Point
        ).coordinates.slice() as [number, number];
        const props = feature.properties as Record<string, string | number>;
        const value = Number(props.value);
        new maplibregl.Popup({ closeButton: false, offset: 16 })
          .setLngLat(coordinates)
          .setHTML(
            `<strong>${String(props.metro)}</strong><span>${String(props.label)}</span><b>${metric === "momentum" ? `+${value}%` : money(value)}</b><small>${Number(props.people)} high-confidence people</small>`,
          )
          .addTo(map);
      });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [metric]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("regions") as
      maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: "FeatureCollection",
      features: regions.map((region) => ({
        type: "Feature",
        properties: {
          ...region,
          value: region[metric],
          label: metricLabels[metric],
        },
        geometry: { type: "Point", coordinates: region.coordinates },
      })),
    });
  }, [metric]);

  return (
    <section className="map-panel" aria-labelledby="map-title">
      <div className="panel-head map-head">
        <div>
          <p className="eyebrow">National capital flows</p>
          <h2 id="map-title">Where private capital is moving</h2>
        </div>
        <div className="map-tools">
          <label className="field-inline">
            <span>Metric</span>
            <select
              value={metric}
              onChange={(event) => onMetricChange(event.target.value as Metric)}
            >
              {Object.entries(metricLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button ghost small"
            onClick={() => setTableView((value) => !value)}
          >
            {tableView ? "Map view" : "Table view"}
          </button>
        </div>
      </div>
      {tableView ? (
        <div className="table-wrap map-table">
          <table>
            <thead>
              <tr>
                <th>Region</th>
                <th>{metricLabels[metric]}</th>
                <th>Retention</th>
                <th>Attraction</th>
                <th>People</th>
              </tr>
            </thead>
            <tbody>
              {regions
                .slice()
                .sort((a, b) => b[metric] - a[metric])
                .map((region) => (
                  <tr key={region.code}>
                    <td>
                      <strong>{region.metro}</strong>
                      <small>{region.name}</small>
                    </td>
                    <td>
                      {metric === "momentum"
                        ? `+${region.momentum}%`
                        : money(region[metric])}
                    </td>
                    <td>{percent(region.retained)}</td>
                    <td>{percent(region.attraction)}</td>
                    <td>{region.people}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div
            ref={mapNode}
            className="map-canvas"
            aria-label="Interactive map of regional capital metrics"
          />
          <div className="map-legend">
            <span>Lower</span>
            <i />
            <i />
            <i />
            <span>Higher</span>
            <small>Aggregated metro locations only</small>
          </div>
        </>
      )}
    </section>
  );
}
