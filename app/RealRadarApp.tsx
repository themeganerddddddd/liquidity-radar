"use client";

import { useState, useSyncExternalStore } from "react";
import snapshotJson from "../public/data/public-signals.json";
import type { PublicDataSnapshot } from "../lib/public-data";
import { PublicSignalsPanel } from "./PublicSignalsPanel";
import { PublicStateMap } from "./PublicStateMap";
import {
  clearTestSession,
  readTestSession,
  TestAuth,
  type TestSession,
} from "./TestAuth";

const snapshot = snapshotJson as PublicDataSnapshot;

function compactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function subscribeToHydration() {
  return () => {};
}

export function RealRadarApp() {
  const [session, setSession] = useState<TestSession | "signed-out" | null>(
    null,
  );
  const ready = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const effectiveSession =
    session === "signed-out"
      ? null
      : (session ?? (ready ? readTestSession() : null));

  if (!ready) {
    return (
      <main className="test-auth-loading" aria-label="Loading test access">
        <span className="radar-mark" aria-hidden="true">
          <i />
        </span>
        <p>Loading Liquidity Radar…</p>
      </main>
    );
  }

  if (!effectiveSession) {
    return (
      <TestAuth onAuthenticated={(nextSession) => setSession(nextSession)} />
    );
  }

  return (
    <main className="real-shell">
      <header className="real-nav">
        <a className="real-brand" href="#top" aria-label="Liquidity Radar home">
          <span className="radar-mark" aria-hidden="true">
            <i />
          </span>
          <span>
            <strong>Liquidity Radar</strong>
            <small>Public-record explorer</small>
          </span>
        </a>
        <nav aria-label="Page navigation">
          <a href="#state-map">State map</a>
          <a href="#official-records">Official records</a>
          <a href="#methodology">Methodology</a>
        </nav>
        <div className="real-nav-actions">
          <span className="real-only-pill">
            <i />
            Real records only
          </span>
          <div className="real-account-summary">
            <span>{effectiveSession.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{effectiveSession.name}</strong>
              <small>{effectiveSession.role}</small>
            </div>
            <button
              type="button"
              onClick={() => {
                clearTestSession();
                setSession("signed-out");
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="real-hero" id="top">
        <div className="real-hero-copy">
          <p className="eyebrow">Official public capital signals</p>
          <h1>See what the public record says—without invented profiles.</h1>
          <p>
            Explore current filing activity, registered investment advisers,
            private-foundation returns, business formation, and state economic
            growth. Every displayed record is attributable to a government
            publisher.
          </p>
          <div className="real-hero-actions">
            <a className="button primary" href="#state-map">
              Explore the state map
            </a>
            <a className="button ghost" href="#methodology">
              Review source methodology
            </a>
          </div>
          <div className="real-disclosure">
            <strong>Test release</strong>
            <span>
              This version intentionally excludes personal liquidity estimates,
              inferred bank balances, fictional people, and modeled events.
            </span>
          </div>
        </div>

        <div className="real-hero-proof" aria-label="Official data coverage">
          <article>
            <span>Registered advisers</span>
            <strong>{snapshot.advisers.firmCount.toLocaleString()}</strong>
            <small>SEC Form ADV roster</small>
          </article>
          <article>
            <span>Reported regulatory assets</span>
            <strong>
              {compactCurrency(snapshot.advisers.totalRegulatoryAssets)}
            </strong>
            <small>Firm-reported; not personal wealth</small>
          </article>
          <article>
            <span>Private-foundation filings</span>
            <strong>{snapshot.foundations.filingCount.toLocaleString()}</strong>
            <small>IRS Form 990-PF index</small>
          </article>
          <article>
            <span>State coverage</span>
            <strong>{snapshot.businessFormation.states.length}</strong>
            <small>50 states plus the District of Columbia</small>
          </article>
        </div>
      </section>

      <PublicStateMap />

      <div id="official-records">
        <PublicSignalsPanel />
      </div>

      <section className="real-methodology" id="methodology">
        <div>
          <p className="eyebrow">Methodology and limits</p>
          <h2>Observed records remain observed records.</h2>
          <p>
            A filing is not automatically a completed liquidity event, an
            adviser’s regulatory assets are not personal wealth, and a
            foundation return is not evidence of an individual’s available
            capital. Liquidity Radar preserves those distinctions.
          </p>
        </div>
        <div className="real-method-grid">
          {snapshot.sources.map((source) => (
            <a
              key={source.id}
              href={source.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span>{source.publisher}</span>
              <strong>{source.name}</strong>
              <small>{source.freshness}</small>
            </a>
          ))}
        </div>
      </section>

      <footer className="real-footer">
        <span>Liquidity Radar</span>
        <p>
          Official public records with direct publisher attribution. No
          fictional profiles or personal liquidity claims.
        </p>
      </footer>
    </main>
  );
}
