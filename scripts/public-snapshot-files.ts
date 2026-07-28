import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  PublicDataSnapshot,
  PublicHoldingPosition,
  PublicLiquidityChunk,
  PublicLiquidityEvent,
} from "../lib/public-data";

const chunkCount = 12;

function partyKey(event: PublicLiquidityEvent) {
  return (
    event.reportingPartyCik ||
    event.reportingParty.toLocaleLowerCase().replace(/\s+/g, " ").trim()
  );
}

function orderEvents(events: PublicLiquidityEvent[]) {
  return [...events].sort(
    (left, right) =>
      right.transactionDate.localeCompare(left.transactionDate) ||
      right.filingDate.localeCompare(left.filingDate) ||
      left.id.localeCompare(right.id),
  );
}

function orderHoldings(holdings: PublicHoldingPosition[]) {
  return [...holdings].sort(
    (left, right) =>
      right.asOfDate.localeCompare(left.asOfDate) ||
      left.id.localeCompare(right.id),
  );
}

function mergeChunks(
  snapshot: PublicDataSnapshot,
  chunks: PublicLiquidityChunk[],
) {
  const events = new Map(
    [
      ...snapshot.liquidity.events,
      ...chunks.flatMap((chunk) => chunk.events),
    ].map((event) => [event.id, event]),
  );
  const holdings = new Map(
    [
      ...snapshot.liquidity.holdings,
      ...chunks.flatMap((chunk) => chunk.holdings),
    ].map((holding) => [holding.id, holding]),
  );
  return {
    ...snapshot,
    liquidity: {
      ...snapshot.liquidity,
      events: orderEvents([...events.values()]),
      holdings: orderHoldings([...holdings.values()]),
    },
  };
}

export async function readChunkedPublicSnapshot(input: string) {
  const snapshot = JSON.parse(
    await readFile(input, "utf8"),
  ) as PublicDataSnapshot;
  if (!snapshot.liquidity.chunkUrls?.length) return snapshot;
  const chunks = await Promise.all(
    snapshot.liquidity.chunkUrls.map(async (url) => {
      const file = path.join(path.dirname(input), path.basename(url));
      return JSON.parse(await readFile(file, "utf8")) as PublicLiquidityChunk;
    }),
  );
  return mergeChunks(snapshot, chunks);
}

export async function writeChunkedPublicSnapshot(
  snapshot: PublicDataSnapshot,
  output: string,
) {
  const orderedEvents = orderEvents(snapshot.liquidity.events);
  const seenParties = new Set<string>();
  const bootstrapEvents: PublicLiquidityEvent[] = [];
  const remainingEvents: PublicLiquidityEvent[] = [];
  for (const event of orderedEvents) {
    const key = partyKey(event);
    if (!seenParties.has(key)) {
      seenParties.add(key);
      bootstrapEvents.push(event);
    } else {
      remainingEvents.push(event);
    }
  }

  const chunks = Array.from<unknown, PublicLiquidityChunk>(
    { length: chunkCount },
    () => ({ events: [], holdings: [] }),
  );
  remainingEvents.forEach((event, index) => {
    chunks[index % chunkCount].events.push(event);
  });
  orderHoldings(snapshot.liquidity.holdings).forEach((holding, index) => {
    chunks[index % chunkCount].holdings.push(holding);
  });

  const chunkUrls = chunks.map(
    (_, index) => `/data/liquidity-${String(index + 1).padStart(2, "0")}.json`,
  );
  const bootstrapSnapshot: PublicDataSnapshot = {
    ...snapshot,
    liquidity: {
      ...snapshot.liquidity,
      events: bootstrapEvents,
      holdings: [],
      chunkUrls,
    },
  };

  await mkdir(path.dirname(output), { recursive: true });
  await Promise.all([
    writeFile(
      output,
      `${JSON.stringify(bootstrapSnapshot, null, 2)}\n`,
      "utf8",
    ),
    ...chunks.map((chunk, index) =>
      writeFile(
        path.join(path.dirname(output), path.basename(chunkUrls[index])),
        `${JSON.stringify(chunk, null, 2)}\n`,
        "utf8",
      ),
    ),
  ]);
}
