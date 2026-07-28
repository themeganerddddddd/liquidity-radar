import path from "node:path";
import {
  normalizeReportedTransactionValue,
  underlyingTransactionKey,
} from "../lib/valuation-safety";
import {
  readChunkedPublicSnapshot,
  writeChunkedPublicSnapshot,
} from "./public-snapshot-files";

const output = path.join(
  process.cwd(),
  "public",
  "data",
  "public-signals.json",
);
const snapshot = await readChunkedPublicSnapshot(output);
const correctedEvents = new Map<
  string,
  (typeof snapshot.liquidity.events)[0]
>();
let eventCorrections = 0;

snapshot.liquidity.events = snapshot.liquidity.events.map((event) => {
  const normalized = normalizeReportedTransactionValue({
    accession: event.accession,
    issuerCik: event.issuerCik,
    shares: event.shares,
    reportedPrice: event.pricePerShare,
  });
  if (normalized.priceBasis === "reported_per_share") return event;
  eventCorrections += 1;
  const corrected = {
    ...event,
    pricePerShare: normalized.pricePerShare,
    grossAmount: normalized.grossAmount,
    priceBasis: normalized.priceBasis,
    note: event.note.includes(normalized.correctionNote)
      ? event.note
      : `${event.note} ${normalized.correctionNote}`.trim(),
  };
  correctedEvents.set(event.id, corrected);
  return corrected;
});

const transactionOwners = snapshot.liquidity.events.reduce((groups, event) => {
  const key = underlyingTransactionKey(event);
  const owners = groups.get(key) ?? new Set<string>();
  owners.add(event.reportingPartyCik || event.reportingParty);
  groups.set(key, owners);
  return groups;
}, new Map<string, Set<string>>());
let jointEvents = 0;
snapshot.liquidity.events = snapshot.liquidity.events.map((event) => {
  if ((transactionOwners.get(underlyingTransactionKey(event))?.size ?? 0) < 2) {
    return event;
  }
  jointEvents += 1;
  return { ...event, attributionBasis: "joint_filing_unallocated" };
});

let holdingCorrections = 0;
snapshot.liquidity.holdings = snapshot.liquidity.holdings.map((holding) => {
  const directEvent = correctedEvents.get(holding.id.replace(/-holding$/, ""));
  const matchingEvent =
    directEvent ??
    [...correctedEvents.values()].find(
      (event) =>
        event.accession === holding.accession &&
        event.securityTitle === holding.securityTitle &&
        event.directOrIndirect === holding.directOrIndirect &&
        event.sharesOwnedAfter === holding.shares,
    );
  if (!matchingEvent) return holding;
  holdingCorrections += 1;
  return {
    ...holding,
    referencePrice: matchingEvent.pricePerShare,
    estimatedValue: holding.shares * matchingEvent.pricePerShare,
    priceBasis: matchingEvent.priceBasis,
  };
});

const holdingGroupKey = (
  holding: (typeof snapshot.liquidity.holdings)[number],
) =>
  [
    holding.accession,
    holding.issuerCik,
    holding.securityTitle,
    holding.shares.toFixed(6),
    holding.directOrIndirect,
    holding.referencePrice?.toFixed(6) ?? "",
  ].join("|");
const holdingOwners = snapshot.liquidity.holdings.reduce((groups, holding) => {
  const key = holdingGroupKey(holding);
  const owners = groups.get(key) ?? new Set<string>();
  owners.add(holding.reportingPartyCik || holding.reportingParty);
  groups.set(key, owners);
  return groups;
}, new Map<string, Set<string>>());
let jointHoldings = 0;
snapshot.liquidity.holdings = snapshot.liquidity.holdings.map((holding) => {
  if ((holdingOwners.get(holdingGroupKey(holding))?.size ?? 0) < 2) {
    return holding;
  }
  jointHoldings += 1;
  return { ...holding, attributionBasis: "joint_filing_unallocated" };
});

await writeChunkedPublicSnapshot(snapshot, output);
console.log(
  `Corrected ${eventCorrections} transaction values and ${holdingCorrections} holding values; marked ${jointEvents} joint-filing events and ${jointHoldings} joint-filing holdings as unallocated.`,
);
