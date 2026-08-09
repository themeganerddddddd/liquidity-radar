"use client";

import { useMemo, useState } from "react";
import type {
  MoneyMotionRecord,
  MoneyMotionSnapshot,
} from "../lib/money-in-motion";
import { EvidenceDrawer } from "./MoneyInMotion";

function compactMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function dateLabel(value: string) {
  if (!value) return "Not established";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Not established";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function eventLabel(value: string) {
  return (
    {
      SECONDARY_SALE: "Stock sale",
      BUSINESS_SALE: "Business sale",
      BUSINESS_FOR_SALE: "Business listed for sale",
      MERGER: "Merger",
      ACQUISITION: "Acquisition",
      DIVESTITURE: "Divestiture",
      RECAPITALIZATION: "Recapitalization",
      TENDER_OFFER: "Tender offer",
      ASSET_SALE: "Asset sale",
      COMMERCIAL_REAL_ESTATE_SALE: "Real estate sale",
      PATENT_ASSIGNMENT: "Patent sale or transfer",
      TRADEMARK_ASSIGNMENT: "Trademark sale or transfer",
      LICENSE_TRANSFER: "License transfer",
      CHANGE_OF_CONTROL: "Change of control",
      HEALTHCARE_CHOW: "Healthcare ownership sale",
      ENERGY_ASSET_TRANSFER: "Energy asset sale",
      TRANSPORT_ASSET_TRANSFER: "Transportation asset sale",
      DISSOLUTION_AFTER_TRANSACTION: "Post-sale dissolution",
      OTHER: "Other capital event",
    }[value] || titleCase(value)
  );
}

function recordName(record: MoneyMotionRecord) {
  return (
    record.person ||
    record.company ||
    record.seller ||
    record.buyer ||
    record.title ||
    "Name not established"
  );
}

function place(record: MoneyMotionRecord) {
  return (
    [record.location.country, record.location.state, record.location.city]
      .filter(Boolean)
      .join(" · ") || "Location not established"
  );
}

function proceeds(record: MoneyMotionRecord) {
  const low = record.estimate.potentiallyDeployableLow;
  const high = record.estimate.potentiallyDeployableHigh;
  if (low !== null && high !== null) {
    return {
      amount:
        low === high
          ? compactMoney(low, record.currency)
          : `${compactMoney(low, record.currency)}–${compactMoney(high, record.currency)}`,
      basis: "Estimated proceeds",
    };
  }
  if (record.reportedTransactionValue !== null) {
    return {
      amount: compactMoney(record.reportedTransactionValue, record.currency),
      basis: "Reported deal value",
    };
  }
  return { amount: "Not disclosed", basis: "No public amount" };
}

function searchableText(record: MoneyMotionRecord) {
  return [
    recordName(record),
    record.company,
    record.person,
    record.seller,
    record.buyer,
    record.asset,
    record.title,
    record.summary,
    record.industry,
    eventLabel(record.eventType),
    place(record),
    ...record.evidence.flatMap((evidence) => [
      evidence.publisher,
      evidence.title,
    ]),
  ]
    .join(" ")
    .toLowerCase();
}

export function PeopleInMotionView({
  snapshot,
  query: controlledQuery,
  onQuery,
}: {
  snapshot: MoneyMotionSnapshot;
  query?: string;
  onQuery?: (value: string) => void;
}) {
  const [localQuery, setLocalQuery] = useState("");
  const [eventType, setEventType] = useState("");
  const [selected, setSelected] = useState<MoneyMotionRecord | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const query = controlledQuery ?? localQuery;

  const setQuery = (value: string) => {
    setVisibleCount(50);
    if (onQuery) onQuery(value);
    else setLocalQuery(value);
  };

  const eventTypes = useMemo(
    () =>
      [...new Set(snapshot.records.map((record) => record.eventType))].sort(
        (left, right) => eventLabel(left).localeCompare(eventLabel(right)),
      ),
    [snapshot.records],
  );

  const records = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return snapshot.records
      .filter((record) => {
        if (eventType && record.eventType !== eventType) return false;
        return (
          !normalizedQuery || searchableText(record).includes(normalizedQuery)
        );
      })
      .sort((left, right) => {
        const dateOrder = (right.eventDate || right.publishedAt).localeCompare(
          left.eventDate || left.publishedAt,
        );
        return dateOrder || left.id.localeCompare(right.id);
      });
  }, [snapshot.records, query, eventType]);

  const visibleRecords = records.slice(0, visibleCount);

  return (
    <>
      <section
        className="people-motion-controls real-people-controls unified-directory-controls sales-directory-controls"
        aria-label="Capital directory filters"
      >
        <label className="people-motion-search">
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search names, companies, locations, or events…"
            aria-label="Search capital events"
          />
        </label>
        <label>
          <span>Type</span>
          <select
            aria-label="Type"
            value={eventType}
            onChange={(event) => {
              setEventType(event.target.value);
              setVisibleCount(50);
            }}
          >
            <option value="">All event types</option>
            {eventTypes.map((item) => (
              <option key={item} value={item}>
                {eventLabel(item)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="people-motion-result-bar unified-result-bar">
        <strong>{records.length.toLocaleString()} capital events</strong>
        <span>Sorted by event date, newest first</span>
      </div>

      <section
        className="people-motion-table real-people-directory unified-directory-table sales-directory-table"
        aria-label="Capital directory results"
      >
        <div className="people-motion-row real-people-row heading sales-directory-row">
          <span>Name</span>
          <span>Proceeds</span>
          <span>Location</span>
          <span>Date</span>
          <span>Type</span>
          <span>Event description</span>
        </div>
        {visibleRecords.map((record) => {
          const amount = proceeds(record);
          const name = recordName(record);
          return (
            <button
              className="people-motion-row real-people-row sales-directory-row"
              type="button"
              key={record.id}
              data-event-date={record.eventDate || record.publishedAt}
              onClick={() => setSelected(record)}
              aria-label={`Open event for ${name}: ${record.title}`}
            >
              <span>
                <strong>{name}</strong>
              </span>
              <span>
                <strong>{amount.amount}</strong>
                <small>{amount.basis}</small>
              </span>
              <span>
                <strong>{place(record)}</strong>
              </span>
              <span>
                <strong>
                  {dateLabel(record.eventDate || record.publishedAt)}
                </strong>
              </span>
              <span>
                <strong>{eventLabel(record.eventType)}</strong>
              </span>
              <span>
                <strong>{record.title}</strong>
                {record.summary && record.summary !== record.title && (
                  <small>{record.summary}</small>
                )}
              </span>
            </button>
          );
        })}
        {!records.length && (
          <div className="people-motion-empty">
            <strong>No capital events match this search.</strong>
            <p>Try another name, location, company, or event type.</p>
          </div>
        )}
      </section>

      {visibleRecords.length < records.length && (
        <button
          className="motion-load-more"
          type="button"
          onClick={() => setVisibleCount((count) => count + 50)}
        >
          Load 50 more
        </button>
      )}

      {selected && (
        <EvidenceDrawer record={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
