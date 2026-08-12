"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChicagoPropertySnapshot } from "../lib/chicago-property";
import type { MoneyMotionSnapshot } from "../lib/money-in-motion";
import {
  buildTopContacts,
  CONTACT_WORKFLOW_STATUSES,
  type ContactWorkflowStatus,
  type RecommendationStatus,
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

const workflowLabels: Record<ContactWorkflowStatus, string> = {
  NOT_REVIEWED: "Not reviewed",
  RESEARCHING: "Researching",
  READY: "Ready",
  CONTACTED: "Contacted",
  RESPONDED: "Responded",
  MEETING: "Meeting booked",
  OPPORTUNITY_CREATED: "Opportunity created",
  NOT_RELEVANT: "Not relevant",
  DO_NOT_CONTACT: "Do not contact",
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

function contactLabel(recommendation: TopContactRecommendation) {
  if (recommendation.contactability === "DIRECT") return "Verified direct";
  if (recommendation.contactability === "COMPANY") return "Company Contact";
  if (recommendation.contactability === "PROFILE")
    return "Professional Profile";
  return "Needs Contact Research";
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
  const [updating, setUpdating] = useState("");
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

  const updateState = async (
    recommendation: TopContactRecommendation,
    workflowStatus: ContactWorkflowStatus,
    recommendationStatus: RecommendationStatus,
  ) => {
    setUpdating(recommendation.personId);
    setMessage("");
    try {
      const response = await fetch("/api/v1/top-contacts", {
        method: "POST",
        headers: {
          authorization: `Bearer ${API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "status",
          weekStart: recommendation.weekStart,
          geographyId: recommendation.geographyId,
          personId: recommendation.personId,
          workflowStatus,
          recommendationStatus,
        }),
      });
      if (!response.ok) throw new Error("Update failed");
      await refresh("current");
      setMessage(
        recommendationStatus === "SKIPPED"
          ? "Skipped and replaced by the next qualified person."
          : "Outreach workflow updated.",
      );
    } catch {
      setMessage("The workflow update could not be saved. Please try again.");
    } finally {
      setUpdating("");
    }
  };

  const currentRecommendations =
    scope === "current"
      ? snapshot.recommendations
      : historical.key === `${geography}:${scope}`
        ? historical.data
        : [];
  const metrics = [
    ["Recommended", snapshot.stats.visibleRecommendations.toLocaleString()],
    [
      "Estimated potential liquidity",
      `${compactMoney(snapshot.stats.estimatedProceedsLow)}–${compactMoney(snapshot.stats.estimatedProceedsHigh)}`,
    ],
    ["Direct contacts", snapshot.stats.directContacts.toLocaleString()],
    ["New this week", snapshot.stats.newThisWeek.toLocaleString()],
    ["Pre-liquidity", snapshot.stats.preLiquidityCandidates.toLocaleString()],
  ];

  return (
    <section className="top-contacts" aria-labelledby="top-contacts-heading">
      <div className="top-contacts-heading">
        <div>
          <p className="eyebrow">Weekly prospecting list</p>
          <h2 id="top-contacts-heading">Top 10 Contacts This Week</h2>
          <p>
            Ranked from recent public transaction evidence, ownership quality,
            location, and legitimate professional contactability.
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

      {scope === "current" && (
        <div className="top-contacts-metrics">
          {metrics.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      )}

      {message && <p className="top-contacts-message">{message}</p>}
      <div className="top-contacts-table">
        <div
          className={`top-contacts-row heading ${scope === "history" ? "history" : ""}`}
        >
          {scope === "history" && <span>Week</span>}
          <span>Name</span>
          <span>Estimated proceeds</span>
          <span>Location</span>
          <span>Contact</span>
        </div>
        {currentRecommendations.map((recommendation) => {
          const contact = recommendation.contacts[0];
          return (
            <article
              className={`top-contacts-row ${scope === "history" ? "history" : ""}`}
              key={`${recommendation.weekStart}-${recommendation.geographyId}-${recommendation.personId}`}
            >
              {scope === "history" && (
                <span className="top-contacts-week">
                  <strong>{weekLabel(recommendation.weekStart)}</strong>
                  <small>#{recommendation.rank}</small>
                </span>
              )}
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
                <small className="top-contacts-why">
                  <b>Why now:</b> {recommendation.whyNow}
                </small>
              </span>
              <span>
                <strong>{proceeds(recommendation)}</strong>
                <small>
                  Priority {recommendation.contactPriorityScore}/100
                </small>
              </span>
              <span>
                <strong>{recommendation.location}</strong>
                <small>{recommendation.county} County activity</small>
              </span>
              <span className="top-contacts-contact">
                {contact ? (
                  <a href={contact.sourceUrl} target="_blank" rel="noreferrer">
                    {contactLabel(recommendation)} ↗
                  </a>
                ) : (
                  <strong>{contactLabel(recommendation)}</strong>
                )}
                <select
                  aria-label={`Outreach status for ${recommendation.name}`}
                  value={recommendation.workflowStatus}
                  disabled={
                    scope !== "current" || updating === recommendation.personId
                  }
                  onChange={(event) =>
                    void updateState(
                      recommendation,
                      event.target.value as ContactWorkflowStatus,
                      recommendation.recommendationStatus,
                    )
                  }
                >
                  {CONTACT_WORKFLOW_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {workflowLabels[status]}
                    </option>
                  ))}
                </select>
                {scope === "current" && (
                  <div>
                    <button
                      type="button"
                      disabled={updating === recommendation.personId}
                      onClick={() =>
                        void updateState(
                          recommendation,
                          recommendation.workflowStatus,
                          "SAVED",
                        )
                      }
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      disabled={updating === recommendation.personId}
                      onClick={() =>
                        void updateState(
                          recommendation,
                          recommendation.workflowStatus,
                          "SKIPPED",
                        )
                      }
                    >
                      Skip
                    </button>
                    <button
                      type="button"
                      disabled={updating === recommendation.personId}
                      onClick={() =>
                        void updateState(
                          recommendation,
                          "CONTACTED",
                          recommendation.recommendationStatus,
                        )
                      }
                    >
                      Contacted
                    </button>
                  </div>
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
