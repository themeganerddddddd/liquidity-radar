"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PublicCompletedExit,
  PublicDataSnapshot,
} from "../lib/public-data";
import {
  findPlaceCoordinates,
  isWithinTerritory,
  territoryStorageKey,
  type SavedTerritory,
} from "../lib/territories";
import type { RealPersonRecord } from "./RealPeople";

function compactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function completedExitAmount(record: PublicCompletedExit) {
  return (
    record.consideration.cashAmount ??
    record.consideration.totalAmount ??
    Math.max(
      0,
      ...record.ownerAttributions.map((owner) => owner.attributedCash ?? 0),
    )
  );
}

function completedExitMatchesTerritory(
  record: PublicCompletedExit,
  data: PublicDataSnapshot,
  territory: SavedTerritory,
) {
  const locations = [
    record.location,
    ...record.ownerAttributions.map((owner) => owner.location),
  ];
  return locations.some((location) =>
    isWithinTerritory(
      findPlaceCoordinates(data.geography, location.city, location.state),
      data.geography,
      territory.metroId,
      territory.radiusMiles,
    ),
  );
}

function parseSavedTerritories(value: string | null): SavedTerritory[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as SavedTerritory[];
    return Array.isArray(parsed)
      ? parsed.filter(
          (territory) =>
            territory &&
            typeof territory.id === "string" &&
            typeof territory.metroId === "string" &&
            Number.isFinite(territory.radiusMiles),
        )
      : [];
  } catch {
    return [];
  }
}

export function TerritoriesView({
  data,
  people,
  onPerson,
}: {
  data: PublicDataSnapshot;
  people: RealPersonRecord[];
  onPerson: (person: RealPersonRecord) => void;
}) {
  const metros = useMemo(
    () => data.geography?.metros ?? [],
    [data.geography?.metros],
  );
  const [territories, setTerritories] = useState<SavedTerritory[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [metroId, setMetroId] = useState("");
  const [radiusMiles, setRadiusMiles] = useState(50);
  const [minimumCapital, setMinimumCapital] = useState(5_000_000);
  const [alertOnCompletedExits, setAlertOnCompletedExits] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTerritories(
        parseSavedTerritories(window.localStorage.getItem(territoryStorageKey)),
      );
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(
      territoryStorageKey,
      JSON.stringify(territories),
    );
  }, [loaded, territories]);

  const savedSummaries = useMemo(
    () =>
      territories.map((territory) => {
        const metro = metros.find(
          (candidate) => candidate.id === territory.metroId,
        );
        const peopleMatches = people.filter(
          (person) =>
            person.estimatedRemainingLiquidity.median >=
              territory.minimumCapital &&
            isWithinTerritory(
              person.coordinates,
              data.geography,
              territory.metroId,
              territory.radiusMiles,
            ),
        );
        const exitMatches = (data.completedExits?.records ?? []).filter(
          (record) =>
            territory.alertOnCompletedExits &&
            completedExitAmount(record) >= territory.minimumCapital &&
            completedExitMatchesTerritory(record, data, territory),
        );
        return { territory, metro, peopleMatches, exitMatches };
      }),
    [data, metros, people, territories],
  );
  const alerts = useMemo(
    () =>
      savedSummaries
        .flatMap(({ territory, metro, peopleMatches, exitMatches }) => [
          ...exitMatches.map((record) => ({
            id: `${territory.id}:exit:${record.id}`,
            type: "Confirmed 8-K close" as const,
            title: record.subjectBusiness,
            detail: `${territory.name} · ${record.buyer} / ${record.sellerOrTarget}`,
            amount: completedExitAmount(record),
            date: record.completedAt,
            sourceUrl: record.sourceUrl,
            person: null,
          })),
          ...peopleMatches.map((person) => ({
            id: `${territory.id}:person:${person.id}`,
            type: "Capital-directory match" as const,
            title: person.name,
            detail: `${territory.name} · ${metro?.name ?? "Saved metro"} · ${person.location}`,
            amount: person.estimatedRemainingLiquidity.median,
            date: person.lastLiquidityDate,
            sourceUrl: "",
            person,
          })),
        ])
        .sort(
          (left, right) =>
            right.date.localeCompare(left.date) || right.amount - left.amount,
        )
        .slice(0, 75),
    [savedSummaries],
  );

  const selectedMetro = metros.find((metro) => metro.id === metroId);

  return (
    <>
      <section className="real-territory-builder">
        <div className="real-territory-copy">
          <p className="eyebrow">Territory builder</p>
          <h2>Save a metro-radius capital search.</h2>
          <p>
            Radius matching uses Census place and metro reference points for
            public SEC care-of cities. It is a business-development territory,
            not a residence search.
          </p>
        </div>
        <div className="real-territory-form">
          <label>
            <span>Territory name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={selectedMetro?.name || "e.g. Northeast founders"}
            />
          </label>
          <label>
            <span>Metro center</span>
            <select
              value={metroId}
              onChange={(event) => setMetroId(event.target.value)}
              aria-label="Territory metro center"
            >
              <option value="">Select a metro</option>
              {metros.map((metro) => (
                <option value={metro.id} key={metro.id}>
                  {metro.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Radius</span>
            <select
              value={radiusMiles}
              onChange={(event) => setRadiusMiles(Number(event.target.value))}
              aria-label="Territory radius"
            >
              {[25, 50, 100, 150, 250].map((miles) => (
                <option value={miles} key={miles}>
                  {miles} miles
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Minimum capital signal</span>
            <select
              value={minimumCapital}
              onChange={(event) =>
                setMinimumCapital(Number(event.target.value))
              }
              aria-label="Minimum territory capital"
            >
              {[1, 5, 10, 25, 50, 100].map((millions) => (
                <option value={millions * 1_000_000} key={millions}>
                  ${millions}M
                </option>
              ))}
            </select>
          </label>
          <label className="real-territory-check">
            <input
              type="checkbox"
              checked={alertOnCompletedExits}
              onChange={(event) =>
                setAlertOnCompletedExits(event.target.checked)
              }
            />
            <span>Include confirmed Item 2.01 closes</span>
          </label>
          <button
            type="button"
            disabled={!metroId}
            onClick={() => {
              if (!selectedMetro) return;
              setTerritories((current) => [
                {
                  id:
                    globalThis.crypto?.randomUUID?.() ??
                    `territory-${Date.now()}`,
                  name: name.trim() || `${selectedMetro.name} territory`,
                  metroId,
                  radiusMiles,
                  minimumCapital,
                  alertOnCompletedExits,
                  createdAt: new Date().toISOString(),
                },
                ...current,
              ]);
              setName("");
            }}
          >
            Save territory and alert
          </button>
        </div>
      </section>

      <section className="real-territory-grid">
        <article className="real-territory-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Saved searches</p>
              <h2>{territories.length} active territories</h2>
            </div>
            <span>Stored on this device</span>
          </div>
          <div className="real-saved-territories">
            {savedSummaries.map(
              ({ territory, metro, peopleMatches, exitMatches }) => (
                <div key={territory.id}>
                  <span>
                    <strong>{territory.name}</strong>
                    <small>
                      {metro?.name} · {territory.radiusMiles} miles ·{" "}
                      {compactCurrency(territory.minimumCapital)} minimum
                    </small>
                  </span>
                  <b>
                    {peopleMatches.length} profiles · {exitMatches.length}{" "}
                    confirmed closes
                  </b>
                  <button
                    type="button"
                    onClick={() =>
                      setTerritories((current) =>
                        current.filter(
                          (candidate) => candidate.id !== territory.id,
                        ),
                      )
                    }
                    aria-label={`Delete ${territory.name}`}
                  >
                    Remove
                  </button>
                </div>
              ),
            )}
            {!territories.length && (
              <p className="real-territory-empty">
                Save a metro above to create your first local territory rule.
              </p>
            )}
          </div>
        </article>

        <article className="real-territory-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">In-app alerts</p>
              <h2>{alerts.length} current matches</h2>
            </div>
            <span>Recomputed from current data</span>
          </div>
          <div className="real-territory-alerts">
            {alerts.map((alert) =>
              alert.person ? (
                <button
                  type="button"
                  key={alert.id}
                  onClick={() => onPerson(alert.person!)}
                >
                  <i>{alert.type}</i>
                  <span>
                    <strong>{alert.title}</strong>
                    <small>{alert.detail}</small>
                  </span>
                  <b>{compactCurrency(alert.amount)}</b>
                  <small>{displayDate(alert.date)}</small>
                </button>
              ) : (
                <a
                  href={alert.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  key={alert.id}
                >
                  <i>{alert.type}</i>
                  <span>
                    <strong>{alert.title}</strong>
                    <small>{alert.detail}</small>
                  </span>
                  <b>{compactCurrency(alert.amount)}</b>
                  <small>{displayDate(alert.date)}</small>
                </a>
              ),
            )}
            {!alerts.length && (
              <p className="real-territory-empty">
                Territory matches will appear here after you save a rule.
              </p>
            )}
          </div>
        </article>
      </section>

      <p className="real-workspace-footnote">
        Saved territories and alerts are device-local in this test account.
        Email or SMS delivery requires managed authentication plus a delivery
        provider; this demo does not claim those alerts are being sent.
      </p>
    </>
  );
}
