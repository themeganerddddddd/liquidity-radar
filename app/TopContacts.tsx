"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChicagoPropertySnapshot } from "../lib/chicago-property";
import type { MoneyMotionSnapshot } from "../lib/money-in-motion";
import {
  buildTopContacts,
  type TopContactGeography,
  type TopContactRecommendation,
  type TopContactsSnapshot,
} from "../lib/top-contacts";

const API_KEY = "lr_demo_local_2026";

const geographyLabels: Record<TopContactGeography, string> = {
  CHICAGO_METRO: "Chicago Metro",
  COOK: "Cook County",
  DUPAGE: "DuPage County",
};

function compactMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function proceeds(recommendation: TopContactRecommendation) {
  const low = recommendation.estimatedProceedsLow;
  const high = recommendation.estimatedProceedsHigh;
  if (low === null || high === null) return "Unknown";
  return low === high
    ? compactMoney(low, recommendation.currency)
    : `${compactMoney(low, recommendation.currency)}–${compactMoney(high, recommendation.currency)}`;
}

function proposedValue(recommendation: TopContactRecommendation) {
  const event = recommendation.primaryEvent;
  if (event.reportedTransactionValue !== null) {
    return {
      value: compactMoney(event.reportedTransactionValue, event.currency),
      basis:
        event.stage === "PRE_SALE" ||
        event.stage === "ANNOUNCED" ||
        event.stage === "PENDING_REGULATORY"
          ? "Public proposed value"
          : "Reported transaction value",
    };
  }
  return {
    value: proceeds(recommendation),
    basis:
      recommendation.estimatedProceedsLow === null
        ? "No public value available"
        : "Estimated proceeds range",
  };
}

function weekLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function eventDate(recommendation: TopContactRecommendation) {
  const value =
    recommendation.primaryEvent.eventDate ||
    recommendation.primaryEvent.publishedAt ||
    recommendation.latestMaterialEventAt;
  return weekLabel(value.slice(0, 10));
}

type RecommendationScope = "current" | "last" | "history";

export function TopContacts({
  motion,
  property,
  onOpen,
}: {
  motion: MoneyMotionSnapshot;
  property: ChicagoPropertySnapshot;
  onOpen: (recommendation: TopContactRecommendation) => void;
}) {
  const [geography, setGeography] =
    useState<TopContactGeography>("CHICAGO_METRO");
  const [scope, setScope] = useState<RecommendationScope>("current");
  const [remote, setRemote] = useState<TopContactsSnapshot | null>(null);
  const [historical, setHistorical] = useState<{
    key: string;
    data: TopContactRecommendation[];
  }>({ key: "", data: [] });
  const [message, setMessage] = useState("");

  const local = useMemo(
    () => buildTopContacts(motion, property, { geography, limit: 10 }),
    [geography, motion, property],
  );
  const snapshot = remote?.geographyId === geography ? remote : local;

  const refresh = async (nextScope: RecommendationScope = scope) => {
    const week = nextScope === "current" ? "" : `&week=${nextScope}`;
    const response = await fetch(
      `/api/v1/top-contacts?location=${geography}&limit=10${week}`,
      {
        cache: "no-store",
        headers: { authorization: `Bearer ${API_KEY}` },
      },
    );
    if (!response.ok)
      throw new Error("Weekly recommendations are unavailable.");
    const payload = (await response.json()) as {
      data: TopContactRecommendation[];
      stats?: TopContactsSnapshot["stats"];
      meta?: TopContactsSnapshot;
    };
    if (nextScope === "current" && payload.stats) {
      setRemote({
        ...local,
        ...(payload.meta || {}),
        recommendations: payload.data,
        stats: payload.stats,
      });
    } else {
      setHistorical({
        key: `${geography}:${nextScope}`,
        data: payload.data || [],
      });
    }
  };

  useEffect(() => {
    const request = window.setTimeout(() => {
      void refresh(scope).catch(() => {
        if (scope !== "current")
          setMessage("No saved ranking for this period yet.");
      });
    }, 0);
    return () => window.clearTimeout(request);
    // The local ranking is an intentional immediate fallback while the durable
    // recommendation state is loaded from D1.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geography, scope, motion.generatedAt, property.generatedAt]);

  const currentRecommendations =
    scope === "current"
      ? snapshot.recommendations
      : historical.key === `${geography}:${scope}`
        ? historical.data
        : [];
  return (
    <section className="top-contacts" aria-labelledby="top-contacts-heading">
      <div className="top-contacts-heading">
        <div>
          <p className="eyebrow">Weekly prospecting list</p>
          <h2 id="top-contacts-heading">Top 10 Contacts This Week</h2>
          <p>
            Ranked from public events dated within seven days of the latest data
            refresh, then scored for ownership quality, location, and
            professional contactability. Older records are not used to fill the
            list.
          </p>
        </div>
        <label>
          <span>Geography</span>
          <select
            value={geography}
            onChange={(event) =>
              setGeography(event.target.value as TopContactGeography)
            }
          >
            {Object.entries(geographyLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="top-contacts-tabs" aria-label="Recommendation period">
        {(
          [
            ["current", "This Week"],
            ["last", "Last Week"],
            ["history", "History"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={scope === value ? "active" : ""}
            onClick={() => setScope(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {message && <p className="top-contacts-message">{message}</p>}
      <div className="top-contacts-table">
        <div className="top-contacts-row heading">
          <span>Name</span>
          <span>Why now</span>
          <span>Proposed value</span>
          <span>Location</span>
          <span>Date</span>
        </div>
        {currentRecommendations.map((recommendation) => {
          const value = proposedValue(recommendation);
          return (
            <article
              className="top-contacts-row"
              key={`${recommendation.weekStart}-${recommendation.geographyId}-${recommendation.personId}`}
            >
              <span className="top-contacts-person">
                <button type="button" onClick={() => onOpen(recommendation)}>
                  <strong>
                    <i>{recommendation.rank}</i>
                    {recommendation.name}
                  </strong>
                  <small>
                    {recommendation.role || "Public reporting party"}
                    {recommendation.company
                      ? ` — ${recommendation.company}`
                      : ""}
                  </small>
                </button>
              </span>
              <span className="top-contacts-why">
                <p>{recommendation.whyNow}</p>
              </span>
              <span>
                <strong>{value.value}</strong>
                <small>{value.basis}</small>
              </span>
              <span>
                <strong>{recommendation.location}</strong>
                <small>{recommendation.county} County activity</small>
              </span>
              <span className="top-contacts-date">
                <strong>{eventDate(recommendation)}</strong>
                {scope === "history" && (
                  <small>
                    Ranked week of {weekLabel(recommendation.weekStart)}
                  </small>
                )}
              </span>
            </article>
          );
        })}
        {!currentRecommendations.length && (
          <p className="top-contacts-empty">
            No saved recommendations are available for this period.
          </p>
        )}
      </div>
      <p className="top-contacts-disclaimer" title={snapshot.disclaimer}>
        Estimated potential proceeds are associated with publicly documented
        transactions—not a bank balance or confirmed net cash received.
      </p>
    </section>
  );
}
