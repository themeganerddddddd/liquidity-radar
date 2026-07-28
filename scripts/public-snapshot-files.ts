import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  PublicDataSnapshot,
  PublicHoldingPosition,
  PublicLiquidityChunk,
  PublicLiquidityEvent,
} from "../lib/public-data";

const chunkCount = 12;

async function replaceFile(temporary: string, target: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rename(temporary, target);
      return;
    } catch (error) {
      lastError = error;
      const code = (error as NodeJS.ErrnoException).code;
      if (!["EACCES", "EBUSY", "EPERM"].includes(code ?? "")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** attempt));
    }
  }
  throw lastError;
}

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
      const file = path.join(
        path.dirname(input),
        path.basename(url.split("?")[0]),
      );
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

  const chunkVersion = encodeURIComponent(
    snapshot.generatedAt || snapshot.liquidity.updatedAt,
  );
  const chunkUrls = chunks.map(
    (_, index) =>
      `/data/liquidity-${String(index + 1).padStart(2, "0")}.json?v=${chunkVersion}`,
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
  const files = [
    {
      target: output,
      contents: `${JSON.stringify(bootstrapSnapshot, null, 2)}\n`,
    },
    ...chunks.map((chunk, index) => ({
      target: path.join(
        path.dirname(output),
        path.basename(chunkUrls[index].split("?")[0]),
      ),
      contents: `${JSON.stringify(chunk, null, 2)}\n`,
    })),
  ];
  for (const file of files) {
    const temporary = `${file.target}.tmp`;
    await writeFile(temporary, file.contents, "utf8");
    await replaceFile(temporary, file.target);
  }
}
