"use client";

import { useMemo, useState } from "react";
import type {
  PublicDataSnapshot,
  PublicCompletedExit,
  PublicHoldingPosition,
  PublicLiquidityEvent,
  PublicOwnerAttribution,
  SecFiling,
} from "../lib/public-data";
import {
  normalizePublicLocation,
  type NormalizedPublicLocation,
} from "../lib/public-locations";
import {
  distanceMiles,
  findPlaceCoordinates,
  type Coordinates,
} from "../lib/territories";

export type LiquidityRange = {
  low: number;
  median: number;
  high: number;
};

export type RealPersonRecord = {
  id: string;
  name: string;
  kind: "Person" | "Entity";
  initials: string;
  issuers: string[];
  forms: string[];
  filings: SecFiling[];
  liquidityEvents: PublicLiquidityEvent[];
  exitAttributions: Array<{
    exit: PublicCompletedExit;
    owner: PublicOwnerAttribution;
  }>;
  holdings: PublicHoldingPosition[];
  grossCompletedSales: number;
  unallocatedJointSaleValue: number;
  grossCompletedExitCash: number;
  grossPurchases: number;
  proposedSaleValue: number;
  estimatedNetProceeds: LiquidityRange;
  estimatedUnobservedDeployment: LiquidityRange;
  estimatedRemainingLiquidity: LiquidityRange;
  estimatedPortfolioValue: number;
  confidence: number;
  relationship: string;
  location: string;
  locationDetails: NormalizedPublicLocation;
  locationBasis:
    | PublicLiquidityEvent["locationBasis"]
    | "completed_exit_public_address"
    | undefined;
  coordinates: Coordinates | null;
  lastLiquidityDate: string;
  lastFiledAt: string;
  archiveEntityId: string;
};

const netRetention = { low: 0.48, median: 0.63, high: 0.78 };
const annualUnobservedRetention = { low: 0.72, median: 0.86, high: 0.96 };

function daysBetween(from: string, to: string) {
  const fromDate = new Date(`${from.slice(0, 10)}T00:00:00Z`).getTime();
  const toDate = new Date(`${to.slice(0, 10)}T00:00:00Z`).getTime();
  if (!Number.isFinite(fromDate) || !Number.isFinite(toDate)) return 0;
  return Math.max(0, (toDate - fromDate) / 86_400_000);
}

export function estimateLiquidity(
  events: PublicLiquidityEvent[],
  asOfDate: string,
) {
  const sales = events.filter(
    (event) =>
      event.eventType === "completed_public_share_sale" &&
      event.attributionBasis !== "joint_filing_unallocated",
  );
  const purchases = events.filter(
    (event) =>
      event.eventType === "completed_public_share_purchase" &&
      event.attributionBasis !== "joint_filing_unallocated",
  );
  const grossCompletedSales = sales.reduce(
    (sum, event) => sum + event.grossAmount,
    0,
  );
  const grossPurchases = purchases.reduce(
    (sum, event) => sum + event.grossAmount,
    0,
  );
  const estimatedNetProceeds: LiquidityRange = {
    low: grossCompletedSales * netRetention.low,
    median: grossCompletedSales * netRetention.median,
    high: grossCompletedSales * netRetention.high,
  };
  const retainedBeforePurchases = sales.reduce<LiquidityRange>(
    (range, event) => {
      const years = daysBetween(event.transactionDate, asOfDate) / 365.25;
      range.low +=
        event.grossAmount *
        netRetention.low *
        annualUnobservedRetention.low ** years;
      range.median +=
        event.grossAmount *
        netRetention.median *
        annualUnobservedRetention.median ** years;
      range.high +=
        event.grossAmount *
        netRetention.high *
        annualUnobservedRetention.high ** years;
      return range;
    },
    { low: 0, median: 0, high: 0 },
  );
  const estimatedRemainingLiquidity: LiquidityRange = {
    low: Math.max(0, retainedBeforePurchases.low - grossPurchases),
    median: Math.max(0, retainedBeforePurchases.median - grossPurchases),
    high: Math.max(0, retainedBeforePurchases.high - grossPurchases),
  };
  const estimatedUnobservedDeployment: LiquidityRange = {
    low: Math.max(0, estimatedNetProceeds.low - retainedBeforePurchases.low),
    median: Math.max(
      0,
      estimatedNetProceeds.median - retainedBeforePurchases.median,
    ),
    high: Math.max(0, estimatedNetProceeds.high - retainedBeforePurchases.high),
  };

  return {
    grossCompletedSales,
    grossPurchases,
    estimatedNetProceeds,
    estimatedUnobservedDeployment,
    estimatedRemainingLiquidity,
  };
}

function estimateAttributedExitLiquidity(
  attributions: RealPersonRecord["exitAttributions"],
  asOfDate: string,
) {
  return attributions.reduce(
    (estimate, attribution) => {
      const gross = attribution.owner.attributedCash ?? 0;
      estimate.gross += gross;
      if (attribution.owner.kind !== "person") return estimate;
      const years =
        daysBetween(attribution.exit.completedAt, asOfDate) / 365.25;
      const net = {
        low: gross * netRetention.low,
        median: gross * netRetention.median,
        high: gross * netRetention.high,
      };
      estimate.net.low += net.low;
      estimate.net.median += net.median;
      estimate.net.high += net.high;
      estimate.remaining.low +=
        net.low * annualUnobservedRetention.low ** years;
      estimate.remaining.median +=
        net.median * annualUnobservedRetention.median ** years;
      estimate.remaining.high +=
        net.high * annualUnobservedRetention.high ** years;
      return estimate;
    },
    {
      gross: 0,
      net: { low: 0, median: 0, high: 0 },
      remaining: { low: 0, median: 0, high: 0 },
    },
  );
}

function entityKind(name: string): RealPersonRecord["kind"] {
  return /\b(LLC|L\.L\.C\.|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|LP|L\.P\.|LLP|PLC|P\.L\.C\.|B\.?V\.?|N\.?V\.?|S\.?A\.?|AG|GMBH|TRUST|GRAT|IRREVOCABLE|FOUNDATION|FUND|CAPITAL|PARTNERS|HOLDINGS|INVESTMENT|INVESTMENTS|VENTURES|MANAGEMENT|GROUP|ASSOCIATES|MASTER)\b/i.test(
    name,
  )
    ? "Entity"
    : "Person";
}

function normalizedName(name: string) {
  return name
    .toLocaleLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function identityKey(value: {
  reportingParty: string;
  reportingPartyCik?: string;
}) {
  const cik = value.reportingPartyCik?.replace(/^0+/, "");
  return cik ? `cik:${cik}` : `name:${normalizedName(value.reportingParty)}`;
}

function initials(name: string) {
  return name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function recordId(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function archiveEntityId(url: string) {
  return url.match(/\/data\/(\d+)\//)?.[1] ?? "Not available";
}

export function buildRealPeople(data: PublicDataSnapshot): RealPersonRecord[] {
  const names = new Map<string, string[]>();
  const nameToKey = new Map<string, string>();
  const accessionToKey = new Map<string, string>();
  const eventsByKey = new Map<string, PublicLiquidityEvent[]>();
  const holdingsByKey = new Map<string, PublicHoldingPosition[]>();
  const filingsByKey = new Map<string, SecFiling[]>();
  const exitsByKey = new Map<string, RealPersonRecord["exitAttributions"]>();
  const addName = (key: string, name: string) => {
    if (!name.trim()) return;
    const current = names.get(key) ?? [];
    if (!current.includes(name)) current.push(name);
    names.set(key, current);
    nameToKey.set(normalizedName(name), key);
  };

  for (const event of data.liquidity?.events ?? []) {
    if (!event.reportingParty.trim()) continue;
    const key = identityKey(event);
    addName(key, event.reportingParty);
    const current = eventsByKey.get(key) ?? [];
    current.push(event);
    eventsByKey.set(key, current);
    accessionToKey.set(event.accession, key);
  }
  for (const holding of data.liquidity?.holdings ?? []) {
    if (!holding.reportingParty.trim()) continue;
    const key = identityKey(holding);
    addName(key, holding.reportingParty);
    const current = holdingsByKey.get(key) ?? [];
    current.push(holding);
    holdingsByKey.set(key, current);
  }
  for (const filing of data.sec.filings) {
    const name = filing.reportingParty.trim();
    if (!name) continue;
    const key =
      nameToKey.get(normalizedName(name)) ??
      accessionToKey.get(filing.accession) ??
      `name:${normalizedName(name)}`;
    addName(key, name);
    const current = filingsByKey.get(key) ?? [];
    current.push(filing);
    filingsByKey.set(key, current);
  }
  for (const exit of data.completedExits?.records ?? []) {
    for (const owner of exit.ownerAttributions) {
      if (!owner.name.trim()) continue;
      const key =
        nameToKey.get(normalizedName(owner.name)) ??
        `name:${normalizedName(owner.name)}`;
      addName(key, owner.name);
      const current = exitsByKey.get(key) ?? [];
      current.push({ exit, owner });
      exitsByKey.set(key, current);
    }
  }

  return [...names.entries()]
    .map(([key, nameOptions]) => {
      const liquidityEvents = eventsByKey.get(key) ?? [];
      const holdings = holdingsByKey.get(key) ?? [];
      const exitAttributions = exitsByKey.get(key) ?? [];
      const preferredName =
        liquidityEvents.find((event) => event.form === "Form 144")
          ?.reportingParty ||
        liquidityEvents[0]?.reportingParty ||
        holdings[0]?.reportingParty ||
        nameOptions[0];
      const name = preferredName;
      const filings = filingsByKey.get(key) ?? [];
      const ordered = [...filings].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
      const estimate = estimateLiquidity(liquidityEvents, data.generatedAt);
      const unallocatedJointSaleValue = liquidityEvents
        .filter(
          (event) =>
            event.eventType === "completed_public_share_sale" &&
            event.attributionBasis === "joint_filing_unallocated",
        )
        .reduce((sum, event) => sum + event.grossAmount, 0);
      const exitEstimate = estimateAttributedExitLiquidity(
        exitAttributions,
        data.generatedAt,
      );
      const proposedSaleValue = liquidityEvents
        .filter((event) => event.eventType === "proposed_public_share_sale")
        .reduce((sum, event) => sum + event.grossAmount, 0);
      const issuers = [
        ...new Set([
          ...ordered.map((filing) => filing.issuer),
          ...liquidityEvents.map((event) => event.issuer),
          ...holdings.map((holding) => holding.issuer),
          ...exitAttributions.map(
            (attribution) => attribution.exit.subjectBusiness,
          ),
        ]),
      ].filter(Boolean);
      const forms = [
        ...new Set([
          ...ordered.map((filing) => filing.form),
          ...liquidityEvents.map((event) => event.form),
          ...(exitAttributions.length ? ["Form 8-K Item 2.01"] : []),
        ]),
      ];
      const latestEvidence = [...liquidityEvents].sort((left, right) =>
        right.transactionDate.localeCompare(left.transactionDate),
      )[0];
      const locationEvent = liquidityEvents.find(
        (event) =>
          event.location.city || event.location.state || event.location.country,
      );
      const locationFiling = ordered.find(
        (filing) =>
          filing.location?.city ||
          filing.location?.state ||
          filing.location?.country,
      );
      const latestLocation =
        locationEvent?.location ??
        locationFiling?.location ??
        exitAttributions.find(
          (attribution) =>
            attribution.owner.location.city || attribution.owner.location.state,
        )?.owner.location;
      const latestExitAttribution = [...exitAttributions].sort((left, right) =>
        right.exit.completedAt.localeCompare(left.exit.completedAt),
      )[0];
      const lastLiquidityDate =
        [
          latestEvidence?.transactionDate ?? "",
          latestExitAttribution?.exit.completedAt ?? "",
          ordered[0]?.filedAt ?? "",
        ]
          .sort()
          .at(-1) ?? "";
      const combinedNetProceeds = {
        low: estimate.estimatedNetProceeds.low + exitEstimate.net.low,
        median: estimate.estimatedNetProceeds.median + exitEstimate.net.median,
        high: estimate.estimatedNetProceeds.high + exitEstimate.net.high,
      };
      const combinedRemainingLiquidity = {
        low:
          estimate.estimatedRemainingLiquidity.low + exitEstimate.remaining.low,
        median:
          estimate.estimatedRemainingLiquidity.median +
          exitEstimate.remaining.median,
        high:
          estimate.estimatedRemainingLiquidity.high +
          exitEstimate.remaining.high,
      };
      const combinedDeployment = {
        low: combinedNetProceeds.low - combinedRemainingLiquidity.low,
        median: combinedNetProceeds.median - combinedRemainingLiquidity.median,
        high: combinedNetProceeds.high - combinedRemainingLiquidity.high,
      };
      const estimatedPortfolioValue = holdings.reduce(
        (sum, holding) =>
          sum +
          (holding.attributionBasis === "joint_filing_unallocated"
            ? 0
            : (holding.estimatedValue ?? 0)),
        0,
      );
      const completedSaleCount = liquidityEvents.filter(
        (event) =>
          event.eventType === "completed_public_share_sale" &&
          event.attributionBasis !== "joint_filing_unallocated",
      ).length;
      const confidence =
        completedSaleCount > 0
          ? Math.min(96, 86 + completedSaleCount * 2)
          : proposedSaleValue > 0
            ? 38
            : holdings.length
              ? 24
              : 15;
      const normalizedLocation = normalizePublicLocation(latestLocation);
      const locationBasis: RealPersonRecord["locationBasis"] =
        locationEvent?.locationBasis ??
        locationFiling?.locationBasis ??
        (latestExitAttribution?.owner.location.display &&
        latestExitAttribution.owner.location.display !==
          "Location not established"
          ? "completed_exit_public_address"
          : undefined);
      return {
        id: `${recordId(name)}-${key.length}`,
        name,
        kind: entityKind(name),
        initials: initials(name),
        issuers,
        forms,
        filings: ordered,
        liquidityEvents,
        exitAttributions,
        holdings,
        grossCompletedSales: estimate.grossCompletedSales,
        unallocatedJointSaleValue,
        grossCompletedExitCash: exitEstimate.gross,
        grossPurchases: estimate.grossPurchases,
        proposedSaleValue,
        estimatedNetProceeds: combinedNetProceeds,
        estimatedUnobservedDeployment: combinedDeployment,
        estimatedRemainingLiquidity: combinedRemainingLiquidity,
        estimatedPortfolioValue,
        confidence:
          exitEstimate.gross > 0 ? Math.max(confidence, 94) : confidence,
        relationship:
          latestEvidence?.relationship ||
          latestExitAttribution?.owner.relationship ||
          "SEC reporting party",
        location: normalizedLocation.display,
        locationDetails: normalizedLocation,
        locationBasis,
        coordinates: findPlaceCoordinates(
          data.geography,
          normalizedLocation.city,
          normalizedLocation.stateCode,
        ),
        lastLiquidityDate,
        lastFiledAt:
          ordered[0]?.filedAt ||
          latestEvidence?.filingDate ||
          latestExitAttribution?.exit.filedAt ||
          "",
        archiveEntityId:
          latestEvidence?.reportingPartyCik ||
          holdings[0]?.reportingPartyCik ||
          (ordered[0] ? archiveEntityId(ordered[0].url) : "Not available"),
      };
    })
    .sort(
      (left, right) =>
        right.estimatedRemainingLiquidity.median -
          left.estimatedRemainingLiquidity.median ||
        right.proposedSaleValue - left.proposedSaleValue ||
        right.lastFiledAt.localeCompare(left.lastFiledAt),
    );
}

function displayDate(value: string) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function nameSort(value: string) {
  return value.toLocaleLowerCase();
}

function compactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function locationBasisLabel(
  basis: RealPersonRecord["locationBasis"],
  hasLocation: boolean,
) {
  if (!hasLocation) return "No public city-level address established";
  if (basis === "seller_reported_address")
    return "SEC-reported seller address; may be business or care-of";
  if (basis === "broker_business_address")
    return "SEC-reported broker business address";
  if (basis === "issuer_business_address")
    return "SEC-reported issuer business address";
  if (basis === "completed_exit_public_address")
    return "Public address linked to completed-exit evidence";
  return "SEC-reported reporting-owner address; may be business or care-of";
}

function moneyRange(range: LiquidityRange) {
  return `${compactCurrency(range.low)}–${compactCurrency(range.high)}`;
}

type DirectorySortKey =
  "name" | "issuer" | "location" | "gross" | "liquidity" | "recent";
type DirectorySortDirection = "asc" | "desc";

function defaultSortDirection(key: DirectorySortKey): DirectorySortDirection {
  return key === "name" || key === "issuer" || key === "location"
    ? "asc"
    : "desc";
}

function grossCompletedCapital(person: RealPersonRecord) {
  return person.grossCompletedSales + person.grossCompletedExitCash;
}

export function headlineSaleValue(person: RealPersonRecord) {
  return grossCompletedCapital(person) || person.proposedSaleValue;
}

export function compareDirectoryPeople(
  left: RealPersonRecord,
  right: RealPersonRecord,
  key: DirectorySortKey,
  direction: DirectorySortDirection,
) {
  let comparison = 0;
  if (key === "name") {
    comparison = nameSort(left.name).localeCompare(nameSort(right.name));
  } else if (key === "issuer") {
    comparison = (left.issuers[0] ?? "").localeCompare(right.issuers[0] ?? "");
  } else if (key === "location") {
    comparison = left.location.localeCompare(right.location);
  } else if (key === "gross") {
    comparison = headlineSaleValue(left) - headlineSaleValue(right);
  } else if (key === "liquidity") {
    comparison =
      left.estimatedRemainingLiquidity.median -
      right.estimatedRemainingLiquidity.median;
  } else {
    comparison = left.lastLiquidityDate.localeCompare(right.lastLiquidityDate);
  }

  const directed = direction === "asc" ? comparison : -comparison;
  return directed || nameSort(left.name).localeCompare(nameSort(right.name));
}

export function RealPeopleDirectory({
  people,
  geography,
  query,
  onQuery,
  onPerson,
}: {
  people: RealPersonRecord[];
  geography: PublicDataSnapshot["geography"];
  query: string;
  onQuery: (query: string) => void;
  onPerson: (person: RealPersonRecord) => void;
}) {
  const [evidence, setEvidence] = useState("All liquidity evidence");
  const [kind, setKind] = useState("People only");
  const [country, setCountry] = useState("All countries");
  const [state, setState] = useState("All states / provinces");
  const [city, setCity] = useState("All cities");
  const [radiusMiles, setRadiusMiles] = useState(0);
  const [sortKey, setSortKey] = useState<DirectorySortKey>("liquidity");
  const [sortDirection, setSortDirection] =
    useState<DirectorySortDirection>("desc");
  const [visibleCount, setVisibleCount] = useState(50);
  const countryOptions = useMemo(
    () =>
      [
        ...new Set(
          people
            .map((person) => person.locationDetails.country)
            .filter(Boolean),
        ),
      ].sort(),
    [people],
  );
  const stateOptions = useMemo(
    () =>
      [
        ...new Set(
          people
            .filter(
              (person) =>
                country === "All countries" ||
                person.locationDetails.country === country,
            )
            .map((person) => person.locationDetails.state)
            .filter(Boolean),
        ),
      ].sort(),
    [country, people],
  );
  const countryHasStates = stateOptions.length > 0;
  const cityOptions = useMemo(
    () =>
      [
        ...new Set(
          people
            .filter(
              (person) =>
                country !== "All countries" &&
                person.locationDetails.country === country,
            )
            .filter(
              (person) =>
                state === "All states / provinces" ||
                person.locationDetails.state === state,
            )
            .map((person) => person.locationDetails.city)
            .filter(Boolean),
        ),
      ].sort(),
    [country, people, state],
  );
  const selectedCityLocation = people.find(
    (person) =>
      person.locationDetails.country === country &&
      (state === "All states / provinces" ||
        person.locationDetails.state === state) &&
      person.locationDetails.city === city,
  );
  const selectedCityCoordinates =
    selectedCityLocation?.coordinates ??
    findPlaceCoordinates(
      geography,
      city,
      selectedCityLocation?.locationDetails.stateCode ?? "",
    );

  const activateSort = (key: DirectorySortKey) => {
    setVisibleCount(50);
    if (sortKey === key) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortDirection(defaultSortDirection(key));
  };

  const sortHeading = (key: DirectorySortKey, label: string) => {
    const active = sortKey === key;
    const arrow = active ? (sortDirection === "desc" ? "↓" : "↑") : "↕";
    const order =
      sortDirection === "desc" ? "highest to lowest" : "lowest to highest";
    return (
      <span
        role="columnheader"
        aria-sort={
          active
            ? sortDirection === "desc"
              ? "descending"
              : "ascending"
            : "none"
        }
      >
        <button
          type="button"
          onClick={() => activateSort(key)}
          aria-label={`Sort by ${label}${active ? `, currently ${order}` : ""}`}
        >
          {label}
          <i className={active ? "active" : ""} aria-hidden="true">
            {arrow}
          </i>
        </button>
      </span>
    );
  };

  const filtered = useMemo(
    () =>
      people
        .filter((person) =>
          [
            person.name,
            person.location,
            ...person.issuers,
            ...person.forms,
            ...person.filings.map((filing) => filing.reportingParty),
            ...person.liquidityEvents.map((event) => event.reportingParty),
            ...person.holdings.map((holding) => holding.reportingParty),
            ...person.exitAttributions.flatMap((attribution) => [
              attribution.exit.subjectBusiness,
              attribution.exit.buyer,
              attribution.exit.sellerOrTarget,
              attribution.owner.name,
            ]),
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
        )
        .filter((person) =>
          kind === "All reporting parties"
            ? true
            : kind === "People only"
              ? person.kind === "Person"
              : person.kind === "Entity",
        )
        .filter((person) => {
          if (country === "Location not established") {
            return !person.locationDetails.country;
          }
          if (
            country !== "All countries" &&
            person.locationDetails.country !== country
          ) {
            return false;
          }
          if (
            state !== "All states / provinces" &&
            person.locationDetails.state !== state
          ) {
            return false;
          }
          if (city === "All cities") return true;
          if (radiusMiles > 0 && selectedCityCoordinates) {
            return Boolean(
              person.coordinates &&
              distanceMiles(person.coordinates, selectedCityCoordinates) <=
                radiusMiles,
            );
          }
          return person.locationDetails.city === city;
        })
        .filter((person) => {
          if (evidence === "Completed sales")
            return (
              person.grossCompletedSales + person.grossCompletedExitCash > 0
            );
          if (evidence === "Proposed sales")
            return person.proposedSaleValue > 0;
          if (evidence === "Reported holdings")
            return person.holdings.length > 0;
          return true;
        })
        .sort((left, right) =>
          compareDirectoryPeople(left, right, sortKey, sortDirection),
        ),
    [
      city,
      country,
      evidence,
      kind,
      people,
      query,
      radiusMiles,
      selectedCityCoordinates,
      sortDirection,
      sortKey,
      state,
    ],
  );
  const visible = filtered.slice(0, visibleCount);

  return (
    <>
      <section className="real-people-controls" aria-label="People filters">
        <label className="real-people-search">
          <span>Search names, firms, issuers, and locations</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setVisibleCount(50);
              onQuery(event.target.value);
            }}
            placeholder="Search a person, company, city, state, or country…"
            aria-label="Search people and reporting parties"
          />
        </label>
        <label>
          <span>Country</span>
          <select
            value={country}
            onChange={(event) => {
              setVisibleCount(50);
              setCountry(event.target.value);
              setState("All states / provinces");
              setCity("All cities");
              setRadiusMiles(0);
            }}
            aria-label="Filter by country"
          >
            <option>All countries</option>
            {countryOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
            <option>Location not established</option>
          </select>
        </label>
        <label>
          <span>State / province</span>
          <select
            value={state}
            onChange={(event) => {
              setVisibleCount(50);
              setState(event.target.value);
              setCity("All cities");
              setRadiusMiles(0);
            }}
            disabled={
              country === "All countries" ||
              country === "Location not established" ||
              !countryHasStates
            }
            aria-label="Filter by state or province"
          >
            <option>All states / provinces</option>
            {stateOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>City</span>
          <select
            value={city}
            onChange={(event) => {
              setVisibleCount(50);
              setCity(event.target.value);
              setRadiusMiles(0);
            }}
            disabled={
              country === "All countries" ||
              country === "Location not established" ||
              (countryHasStates && state === "All states / provinces")
            }
            aria-label="Filter by city"
          >
            <option>All cities</option>
            {cityOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>City radius</span>
          <select
            value={radiusMiles}
            onChange={(event) => {
              setVisibleCount(50);
              setRadiusMiles(Number(event.target.value));
            }}
            disabled={city === "All cities" || !selectedCityCoordinates}
            aria-label="City search radius in miles"
          >
            <option value={0}>Exact city</option>
            {[25, 50, 100, 150, 250].map((miles) => (
              <option value={miles} key={miles}>
                {miles} miles
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Liquidity evidence</span>
          <select
            value={evidence}
            onChange={(event) => {
              setVisibleCount(50);
              setEvidence(event.target.value);
            }}
            aria-label="Filter people by liquidity evidence"
          >
            <option>All liquidity evidence</option>
            <option>Completed sales</option>
            <option>Proposed sales</option>
            <option>Reported holdings</option>
          </select>
        </label>
        <label>
          <span>Party type</span>
          <select
            value={kind}
            onChange={(event) => {
              setVisibleCount(50);
              setKind(event.target.value);
            }}
            aria-label="Filter by reporting party type"
          >
            <option>People only</option>
            <option>All reporting parties</option>
            <option>Entities only</option>
          </select>
        </label>
        <label>
          <span>Sort by</span>
          <select
            value={sortKey}
            onChange={(event) => {
              setVisibleCount(50);
              const key = event.target.value as DirectorySortKey;
              setSortKey(key);
              setSortDirection(defaultSortDirection(key));
            }}
            aria-label="Sort people"
          >
            <option value="liquidity">Estimated liquidity</option>
            <option value="gross">Sale value</option>
            <option value="recent">Most recent</option>
            <option value="name">Name</option>
            <option value="issuer">Linked issuer</option>
            <option value="location">Location</option>
          </select>
        </label>
        <div className="real-people-result-count">
          <strong>{filtered.length}</strong>
          <span>
            attributable result{filtered.length === 1 ? "" : "s"}
            {city !== "All cities" && radiusMiles > 0
              ? ` · within ${radiusMiles} miles of ${city}`
              : ""}
          </span>
        </div>
      </section>

      <section
        className="real-people-directory"
        aria-label="SEC reporting-party directory"
      >
        <div className="real-people-row heading" role="row">
          {sortHeading("name", "Reporting party")}
          {sortHeading("issuer", "Linked issuer")}
          {sortHeading("location", "Reported location")}
          {sortHeading("gross", "Completed / proposed value")}
          {sortHeading("liquidity", "Estimated potential liquidity")}
          {sortHeading("recent", "Latest evidence")}
        </div>
        {visible.map((person) => (
          <button
            type="button"
            className="real-people-row"
            key={person.id}
            onClick={() => onPerson(person)}
            aria-label={`Open profile for ${person.name}`}
          >
            <span className="real-person-cell">
              <i>{person.initials || "SEC"}</i>
              <span>
                <strong>{person.name}</strong>
                <small>{person.kind} · SEC reporting party</small>
              </span>
            </span>
            <span>
              <strong>{person.issuers[0]}</strong>
              <small>
                {person.issuers.length > 1
                  ? `+${person.issuers.length - 1} additional issuer`
                  : "Observed filing relationship"}
              </small>
            </span>
            <span>
              <strong>{person.location}</strong>
              <small>
                {locationBasisLabel(
                  person.locationBasis,
                  Boolean(person.locationDetails.country),
                )}
              </small>
            </span>
            <span>
              <strong>
                {headlineSaleValue(person) > 0
                  ? compactCurrency(headlineSaleValue(person))
                  : "No attributable sale"}
              </strong>
              <small>
                {grossCompletedCapital(person) > 0
                  ? person.proposedSaleValue > 0
                    ? `${compactCurrency(person.proposedSaleValue)} additional proposed sale`
                    : person.grossCompletedExitCash > 0
                      ? `${compactCurrency(person.grossCompletedExitCash)} from attributed completed exit`
                      : "Completed SEC sale value"
                  : person.proposedSaleValue > 0
                    ? "Proposed Form 144 sale · not yet completed"
                    : person.unallocatedJointSaleValue > 0
                      ? `${compactCurrency(person.unallocatedJointSaleValue)} joint-filing amount; not personally allocated`
                      : `${person.liquidityEvents.length} qualifying events`}
              </small>
            </span>
            <span>
              <strong>
                {person.estimatedNetProceeds.high > 0
                  ? moneyRange(person.estimatedRemainingLiquidity)
                  : person.grossCompletedExitCash > 0
                    ? "Entity receipt not modeled"
                    : "Not yet estimated"}
              </strong>
              <small>{person.confidence}% confidence</small>
            </span>
            <span>
              <strong>{displayDate(person.lastLiquidityDate)}</strong>
              <small>View profile →</small>
            </span>
          </button>
        ))}
        {!filtered.length && (
          <div className="real-people-empty">
            <strong>No reporting parties match this search.</strong>
            <span>Try a different name, issuer, or SEC form.</span>
          </div>
        )}
      </section>

      {visible.length < filtered.length && (
        <button
          type="button"
          className="real-directory-more"
          onClick={() => setVisibleCount((current) => current + 50)}
        >
          Load 50 more profiles
          <span>
            Showing {visible.length.toLocaleString()} of{" "}
            {filtered.length.toLocaleString()}
          </span>
        </button>
      )}

      <p className="real-workspace-footnote">
        Completed gross proceeds are calculated from normalized reported shares
        and transaction prices. Amounts repeated across joint filers are not
        allocated to an individual profile or included in personal liquidity
        estimates. Potential liquidity is not a bank balance.
      </p>
    </>
  );
}

function eventLabel(event: PublicLiquidityEvent) {
  if (event.eventType === "completed_public_share_sale")
    return "Completed public-share sale";
  if (event.eventType === "completed_public_share_purchase")
    return "Completed public-share purchase";
  return "Proposed public-share sale";
}

function eventRange(event: PublicLiquidityEvent) {
  return {
    low: event.grossAmount * netRetention.low,
    median: event.grossAmount * netRetention.median,
    high: event.grossAmount * netRetention.high,
  };
}

function eventLocation(event: PublicLiquidityEvent) {
  const normalized = normalizePublicLocation(event.location);
  return normalized.country ? normalized.display : "";
}

export function RealPersonProfile({
  person,
  people,
  onBack,
  onPerson,
}: {
  person: RealPersonRecord;
  people: RealPersonRecord[];
  onBack: () => void;
  onPerson: (person: RealPersonRecord) => void;
}) {
  const related = people
    .filter(
      (candidate) =>
        candidate.id !== person.id &&
        candidate.issuers.some((issuer) => person.issuers.includes(issuer)),
    )
    .slice(0, 8);
  const latestSource =
    person.exitAttributions[0]?.owner.sourceUrl ||
    person.liquidityEvents[0]?.sourceUrl ||
    person.filings[0]?.url;
  const completedCapital =
    person.grossCompletedSales + person.grossCompletedExitCash;
  const proposedOnly = completedCapital === 0 && person.proposedSaleValue > 0;

  return (
    <>
      <button type="button" className="real-profile-back" onClick={onBack}>
        ← People directory
      </button>

      <div className="real-profile-top-stack">
        <section className="real-person-profile-hero">
          <div className="real-person-profile-identity">
            <span>{person.initials || "SEC"}</span>
            <div>
              <p className="eyebrow">Evidence-linked liquidity profile</p>
              <div>
                <h1>{person.name}</h1>
                <b>{person.confidence}% confidence</b>
              </div>
              <p>
                {person.relationship} at {person.issuers.join(", ")} · Reported
                location: {person.location}. Latest liquidity evidence{" "}
                {displayDate(person.lastLiquidityDate)}.
              </p>
            </div>
          </div>
          <div className="real-person-profile-summary">
            <span>
              {proposedOnly
                ? "Proposed sale value"
                : "Estimated potential liquidity"}
            </span>
            <strong>
              {proposedOnly
                ? compactCurrency(person.proposedSaleValue)
                : person.estimatedNetProceeds.high > 0
                  ? moneyRange(person.estimatedRemainingLiquidity)
                  : person.grossCompletedExitCash > 0
                    ? "Entity receipt not modeled"
                    : "Not yet estimated"}
            </strong>
            <small>
              {proposedOnly ? (
                <>Form 144 signal · excluded from cash until completed</>
              ) : (
                <>
                  Median{" "}
                  {compactCurrency(person.estimatedRemainingLiquidity.median)} ·
                  calculated from attributed completed events
                </>
              )}
            </small>
            {latestSource && (
              <a href={latestSource} target="_blank" rel="noreferrer">
                Open latest supporting record ↗
              </a>
            )}
          </div>
        </section>

        <div className="real-profile-disclosure">
          <strong>Estimate, not bank balance</strong>
          <p>
            Gross proceeds are observed or calculated from SEC records.
            Completed business-exit amounts are included only when an ownership
            filing or explicit seller disclosure supports attribution. Estimated
            net and potential liquidity apply visible tax, fee,
            completed-purchase, and time-based unobserved-deployment
            assumptions. Joint-filing amounts without an allocation are
            excluded. The subject’s actual financial position is not observed.
          </p>
        </div>

        <section className="real-profile-kpis" aria-label="Liquidity summary">
          <article>
            <span>
              {proposedOnly
                ? "Proposed sale value"
                : "Completed gross proceeds"}
            </span>
            <strong>
              {compactCurrency(
                proposedOnly ? person.proposedSaleValue : completedCapital,
              )}
            </strong>
            <small>
              {proposedOnly ? (
                <>
                  {
                    person.liquidityEvents.filter(
                      (event) =>
                        event.eventType === "proposed_public_share_sale",
                    ).length
                  }{" "}
                  Form 144 proposal
                  {person.liquidityEvents.filter(
                    (event) => event.eventType === "proposed_public_share_sale",
                  ).length === 1
                    ? ""
                    : "s"}{" "}
                  · not cash received
                </>
              ) : (
                <>
                  {
                    person.liquidityEvents.filter(
                      (event) =>
                        event.eventType === "completed_public_share_sale" &&
                        event.attributionBasis !== "joint_filing_unallocated",
                    ).length
                  }{" "}
                  securities sale events · {person.exitAttributions.length}{" "}
                  completed exit attribution
                  {person.exitAttributions.length === 1 ? "" : "s"}
                </>
              )}
            </small>
          </article>
          <article>
            <span>Estimated net proceeds</span>
            <strong>
              {person.estimatedNetProceeds.high > 0
                ? moneyRange(person.estimatedNetProceeds)
                : "Not modeled"}
            </strong>
            <small>After modeled tax and transaction-cost ranges</small>
          </article>
          <article>
            <span>Known public purchases</span>
            <strong>{compactCurrency(person.grossPurchases)}</strong>
            <small>Subtracted as documented cash deployment</small>
          </article>
          <article>
            <span>Estimated potential liquidity</span>
            <strong>
              {person.estimatedNetProceeds.high > 0
                ? moneyRange(person.estimatedRemainingLiquidity)
                : "Not modeled"}
            </strong>
            <small>
              Median{" "}
              {compactCurrency(person.estimatedRemainingLiquidity.median)}
            </small>
          </article>
        </section>
      </div>

      <section className="real-profile-layout">
        <div className="real-profile-primary">
          <article className="real-profile-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Cash-creation ledger</p>
                <h2>When liquidity was received or proposed</h2>
              </div>
              <span>
                {person.liquidityEvents.length + person.exitAttributions.length}{" "}
                qualifying events
              </span>
            </div>
            {person.liquidityEvents.length || person.exitAttributions.length ? (
              <div className="real-liquidity-ledger">
                <div className="real-liquidity-ledger-row heading">
                  <span>Event and date</span>
                  <span>Reported calculation</span>
                  <span>Estimated net effect</span>
                  <span>Evidence</span>
                </div>
                {person.liquidityEvents.map((event) => (
                  <a
                    className={`real-liquidity-ledger-row ${event.status}`}
                    key={event.id}
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>
                      <strong>{eventLabel(event)}</strong>
                      <small>
                        {displayDate(event.transactionDate)} · {event.issuer}
                        {eventLocation(event)
                          ? ` · ${eventLocation(event)}`
                          : ""}
                      </small>
                    </span>
                    <span>
                      <strong>
                        {event.eventType === "completed_public_share_purchase"
                          ? "−"
                          : event.status === "completed"
                            ? "+"
                            : ""}
                        {compactCurrency(event.grossAmount)}
                      </strong>
                      <small>
                        {event.shares.toLocaleString()} shares ×{" "}
                        {compactCurrency(event.pricePerShare)}
                      </small>
                    </span>
                    <span>
                      <strong>
                        {event.status === "completed" &&
                        event.eventType === "completed_public_share_sale" &&
                        event.attributionBasis !== "joint_filing_unallocated"
                          ? moneyRange(eventRange(event))
                          : event.attributionBasis ===
                              "joint_filing_unallocated"
                            ? "Not allocated to this reporter"
                            : event.status === "proposed"
                              ? "Not counted until completed"
                              : `−${compactCurrency(event.grossAmount)}`}
                      </strong>
                      <small>
                        {event.attributionBasis === "joint_filing_unallocated"
                          ? "joint filing-level amount"
                          : event.status === "completed"
                            ? event.amountClassification
                            : "proposed only"}
                      </small>
                    </span>
                    <b>{event.form} · SEC ↗</b>
                  </a>
                ))}
                {person.exitAttributions.map(({ exit, owner }) => (
                  <a
                    className="real-liquidity-ledger-row completed"
                    key={`${exit.id}-${owner.name}`}
                    href={owner.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>
                      <strong>Attributed completed business exit</strong>
                      <small>
                        {displayDate(exit.completedAt)} · {exit.subjectBusiness}
                      </small>
                    </span>
                    <span>
                      <strong>
                        {owner.attributedCash !== null
                          ? `+${compactCurrency(owner.attributedCash)}`
                          : "Amount not allocated"}
                      </strong>
                      <small>
                        {owner.attributedShares !== null &&
                        owner.cashPerShare !== null
                          ? `${owner.attributedShares.toLocaleString()} shares × ${compactCurrency(owner.cashPerShare)}`
                          : owner.relationship}
                      </small>
                    </span>
                    <span>
                      <strong>
                        {owner.attributedCash !== null &&
                        owner.kind === "person"
                          ? moneyRange({
                              low: owner.attributedCash * netRetention.low,
                              median:
                                owner.attributedCash * netRetention.median,
                              high: owner.attributedCash * netRetention.high,
                            })
                          : owner.kind === "entity"
                            ? "Entity receipt—not modeled as personal liquidity"
                            : "Not included in personal estimate"}
                      </strong>
                      <small>{owner.amountClassification}</small>
                    </span>
                    <b>{owner.sourceType} + Item 2.01 · SEC ↗</b>
                  </a>
                ))}
              </div>
            ) : (
              <p className="real-profile-empty">
                No completed or proposed cash-generating transaction was
                extracted from this party’s currently indexed filings.
              </p>
            )}
          </article>

          <article className="real-profile-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Observed portfolio</p>
                <h2>Reported securities positions</h2>
              </div>
              <span>
                {person.holdings.length} positions ·{" "}
                {compactCurrency(person.estimatedPortfolioValue)} valued
              </span>
            </div>
            {person.holdings.length ? (
              <div className="real-holdings-table">
                <div className="real-holdings-row heading">
                  <span>Issuer / security</span>
                  <span>Shares reported</span>
                  <span>Transaction-implied price</span>
                  <span>Position estimate</span>
                </div>
                {person.holdings.map((holding) => (
                  <a
                    className="real-holdings-row"
                    href={holding.sourceUrl}
                    key={holding.id}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>
                      <strong>{holding.issuer}</strong>
                      <small>
                        {holding.securityTitle} ·{" "}
                        {holding.directOrIndirect === "D"
                          ? "Direct"
                          : holding.directOrIndirect === "I"
                            ? "Indirect"
                            : holding.directOrIndirect}
                      </small>
                    </span>
                    <strong>{holding.shares.toLocaleString()}</strong>
                    <span>
                      {holding.referencePrice === null
                        ? "Not reported"
                        : compactCurrency(holding.referencePrice)}
                      {holding.priceBasis ===
                        "derived_from_reported_aggregate" && (
                        <small>Derived from reported aggregate</small>
                      )}
                      {holding.priceBasis === "normalized_filing_decimal" && (
                        <small>Normalized from filing</small>
                      )}
                      {holding.attributionBasis ===
                        "joint_filing_unallocated" && (
                        <small>
                          Joint filing; not allocated to this reporter
                        </small>
                      )}
                    </span>
                    <b>
                      {holding.estimatedValue === null
                        ? "Not valued"
                        : compactCurrency(holding.estimatedValue)}
                    </b>
                  </a>
                ))}
              </div>
            ) : (
              <p className="real-profile-empty">
                No post-transaction position was available in the currently
                indexed ownership filings.
              </p>
            )}
            <p className="real-profile-panel-note">
              Position estimates are post-transaction shares multiplied by a
              normalized price from the same filing. They are not current market
              quotes, bank balances, or complete personal portfolios.
            </p>
          </article>

          <article className="real-profile-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Issuer network</p>
                <h2>Other observed reporting parties</h2>
              </div>
              <span>{related.length} linked</span>
            </div>
            {related.length ? (
              <div className="real-related-people">
                {related.map((candidate) => (
                  <button
                    type="button"
                    key={candidate.id}
                    onClick={() => onPerson(candidate)}
                  >
                    <i>{candidate.initials || "SEC"}</i>
                    <span>
                      <strong>{candidate.name}</strong>
                      <small>
                        {candidate.issuers.join(", ")} ·{" "}
                        {moneyRange(candidate.estimatedRemainingLiquidity)}
                      </small>
                    </span>
                    <b>→</b>
                  </button>
                ))}
              </div>
            ) : (
              <p className="real-profile-empty">
                No additional reporting parties for this issuer appear in the
                current indexed window.
              </p>
            )}
          </article>
        </div>

        <aside className="real-profile-secondary">
          <article className="real-profile-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Profile facts</p>
                <h2>Observed identity and role</h2>
              </div>
            </div>
            <dl className="real-profile-facts">
              <div>
                <dt>Filed name</dt>
                <dd>{person.name}</dd>
              </div>
              <div>
                <dt>Relationship</dt>
                <dd>{person.relationship}</dd>
              </div>
              <div>
                <dt>Issuer relationship</dt>
                <dd>{person.issuers.join(", ")}</dd>
              </div>
              <div>
                <dt>SEC-reported location</dt>
                <dd>
                  {person.location}
                  <small>
                    {locationBasisLabel(
                      person.locationBasis,
                      Boolean(person.locationDetails.country),
                    )}
                  </small>
                </dd>
              </div>
              <div>
                <dt>Reporting-owner CIK</dt>
                <dd>{person.archiveEntityId}</dd>
              </div>
              <div>
                <dt>Proposed sale value</dt>
                <dd>{compactCurrency(person.proposedSaleValue)}</dd>
              </div>
            </dl>
          </article>

          <article className="real-profile-panel real-model-card">
            <p className="eyebrow">Current model assumptions</p>
            <h2>How potential liquidity is estimated</h2>
            <dl>
              <div>
                <dt>Net proceeds retained</dt>
                <dd>48% low · 63% median · 78% high</dd>
              </div>
              <div>
                <dt>Annual unobserved retention</dt>
                <dd>72% low · 86% median · 96% high</dd>
              </div>
              <div>
                <dt>Known public purchases</dt>
                <dd>Subtracted at reported gross cost</dd>
              </div>
              <div>
                <dt>Form 144 proposals</dt>
                <dd>Excluded until completion evidence appears</dd>
              </div>
            </dl>
          </article>

          <article className="real-profile-panel real-profile-limit">
            <p className="eyebrow">Known limitations</p>
            <ul>
              <li>Private spending and investments are not fully observable</li>
              <li>Tax basis and actual tax treatment are not known</li>
              <li>Holdings outside SEC ownership reports are excluded</li>
              <li>
                Location may be a business or care-of address, not a residence
              </li>
              <li>The estimate is not an actual bank-account balance</li>
            </ul>
          </article>
        </aside>
      </section>
    </>
  );
}
