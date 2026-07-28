"use client";

import { useEffect, useMemo, useState } from "react";
import snapshotJson from "../public/data/public-signals.json";
import type { PublicDataSnapshot } from "../lib/public-data";

const initialSnapshot = snapshotJson as PublicDataSnapshot;

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function compactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function periodLabel(period: string) {
  const monthly = period.match(/^(\d{4})-(\d{2})$/);
  if (monthly) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${period}-01T00:00:00Z`));
  }
  return period.replace(":", " ");
}

function filingEntity(filing: PublicDataSnapshot["sec"]["filings"][number]) {
  return filing.reportingParty
    ? `${filing.reportingParty} · ${filing.issuer}`
    : filing.issuer;
}

export function PublicSignalsPanel() {
  const [data, setData] = useState(initialSnapshot);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/public-data", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Public-data refresh failed.");
        return response.json() as Promise<{ data: PublicDataSnapshot }>;
      })
      .then((body) => setData(body.data))
      .catch(() => {
        // The checked-in official snapshot remains visible if a source is down.
      });
    return () => controller.abort();
  }, []);

  const statePulse = useMemo(
    () =>
      data.businessFormation.states.slice(0, 8).map((formation) => ({
        ...formation,
        economy: data.regionalEconomy.states.find(
          (state) => state.code === formation.code,
        ),
      })),
    [data],
  );

  return (
    <section className="public-signals" aria-labelledby="public-signals-title">
      <div className="public-signals-head">
        <div>
          <p className="eyebrow">Official public-data layer</p>
          <h2 id="public-signals-title">Live signals, clearly separated</h2>
          <p>
            Government records and regional indicators are shown as observed
            public context. They do not become personal liquidity estimates
            without evidence matching and human review.
          </p>
        </div>
        <div className={`live-source-state ${data.sec.mode}`}>
          <i />
          <span>
            SEC {data.sec.mode === "live" ? "live feed" : "verified snapshot"}
          </span>
          <small>
            Synced{" "}
            {new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZoneName: "short",
            }).format(new Date(data.sec.updatedAt))}
          </small>
        </div>
      </div>

      <div className="public-signal-kpis">
        <article>
          <span>SEC-registered advisers</span>
          <strong>{data.advisers.firmCount.toLocaleString()}</strong>
          <small>{data.advisers.period} Form ADV roster</small>
        </article>
        <article>
          <span>Reported regulatory assets</span>
          <strong>
            {compactCurrency(data.advisers.totalRegulatoryAssets)}
          </strong>
          <small>Firm-reported; not household wealth</small>
        </article>
        <article>
          <span>Private-foundation filings</span>
          <strong>{data.foundations.filingCount.toLocaleString()}</strong>
          <small>{data.foundations.year} IRS 990-PF index</small>
        </article>
        <article>
          <span>Business applications</span>
          <strong>
            {data.businessFormation.national.applications.toLocaleString()}
          </strong>
          <small>
            {periodLabel(data.businessFormation.period)} ·{" "}
            {data.businessFormation.national.monthlyChange >= 0 ? "+" : ""}
            {data.businessFormation.national.monthlyChange}% MoM
          </small>
        </article>
        <article>
          <span>Projected formations</span>
          <strong>
            {data.businessFormation.national.projectedFormations.toLocaleString()}
          </strong>
          <small>Within four quarters · Census BFS</small>
        </article>
      </div>

      <div className="public-signal-grid">
        <article className="public-data-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Observed filing activity</p>
              <h3>Latest SEC filings</h3>
            </div>
            <span>{data.sec.filings.length} indexed</span>
          </div>
          <div className="public-filing-list">
            {data.sec.filings.slice(0, 7).map((filing) => (
              <a
                href={filing.url}
                key={`${filing.form}-${filing.accession}`}
                target="_blank"
                rel="noreferrer"
              >
                <span>{filing.form}</span>
                <div>
                  <strong>{filingEntity(filing)}</strong>
                  <small>
                    Filed {filing.filedAt} · {filing.accession}
                  </small>
                </div>
                <b aria-hidden="true">↗</b>
              </a>
            ))}
          </div>
          <p className="public-data-caution">
            Form 144 is proposed activity. Form 4 and ownership schedules may
            report non-cash or non-sale changes and require transaction-level
            review.
          </p>
        </article>

        <article className="public-data-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Census + BEA</p>
              <h3>State economic pulse</h3>
            </div>
            <span>{periodLabel(data.businessFormation.period)}</span>
          </div>
          <div className="state-pulse-table">
            <div className="state-pulse-row header">
              <span>State</span>
              <span>Applications</span>
              <span>Projected</span>
              <span>Real GDP QoQ</span>
            </div>
            {statePulse.map((state) => (
              <div className="state-pulse-row" key={state.code}>
                <strong>
                  <i>{state.code}</i>
                  {state.name}
                </strong>
                <span>{state.applications.toLocaleString()}</span>
                <span>{state.projectedFormations.toLocaleString()}</span>
                <b
                  className={
                    (state.economy?.quarterlyGrowth ?? 0) >= 0
                      ? "positive"
                      : "negative"
                  }
                >
                  {(state.economy?.quarterlyGrowth ?? 0) >= 0 ? "+" : ""}
                  {state.economy?.quarterlyGrowth ?? 0}%
                </b>
              </div>
            ))}
          </div>
        </article>

        <article className="public-data-card compact">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Capital managers</p>
              <h3>Largest reported adviser books</h3>
            </div>
            <span>Form ADV</span>
          </div>
          <div className="ranked-public-list">
            {data.advisers.topFirms.slice(0, 6).map((firm, index) => (
              <div key={`${firm.crd}-${firm.name}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{firm.name}</strong>
                  <small>
                    {firm.city}, {firm.state} · filed {firm.filingDate}
                  </small>
                </div>
                <b>{compactCurrency(firm.regulatoryAssets)}</b>
              </div>
            ))}
          </div>
        </article>

        <article className="public-data-card compact">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Deployment context</p>
              <h3>Recent private-foundation returns</h3>
            </div>
            <span>IRS 990-PF</span>
          </div>
          <div className="ranked-public-list">
            {data.foundations.recentFilings.slice(0, 6).map((filing, index) => (
              <div key={filing.objectId}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{filing.name}</strong>
                  <small>
                    EIN ••••{filing.ein.slice(-4)} · tax period{" "}
                    {filing.taxPeriod}
                  </small>
                </div>
                <b>Filed</b>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="public-source-directory" aria-label="Public data sources">
        {data.sources.map((source) => (
          <a
            href={source.sourceUrl}
            key={source.id}
            target="_blank"
            rel="noreferrer"
          >
            <span>{source.publisher}</span>
            <strong>{source.name}</strong>
            <small>
              {compactNumber(source.recordCount)} records · {source.freshness}
            </small>
            <p>{source.methodology}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
