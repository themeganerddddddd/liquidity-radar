import { gunzipSync, strFromU8 } from "fflate";
import type { MoneyMotionSnapshot } from "./money-in-motion";

const upstreamUrl =
  "https://raw.githubusercontent.com/themeganerddddddd/liquidity-radar/main/public/data/money-in-motion-client.json.gz";
const refreshIntervalMs = 5 * 60 * 1000;

let memoizedSnapshot: MoneyMotionSnapshot | null = null;
let memoizedUntil = 0;
let testSnapshot: MoneyMotionSnapshot | null = null;

async function loadTestSnapshot() {
  if (testSnapshot) return testSnapshot;
  const [{ readFile }, path] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ]);
  const filename = `${["money", "in", "motion", "client"].join("-")}.json.gz`;
  const bytes = await readFile(
    path.resolve(process.cwd(), "public", "data", filename),
  );
  testSnapshot = JSON.parse(
    strFromU8(gunzipSync(new Uint8Array(bytes))),
  ) as MoneyMotionSnapshot;
  return testSnapshot;
}

function isValidSnapshot(value: unknown): value is MoneyMotionSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MoneyMotionSnapshot>;
  return (
    candidate.schemaVersion === 2 &&
    typeof candidate.generatedAt === "string" &&
    Array.isArray(candidate.records) &&
    Array.isArray(candidate.peopleInMotion) &&
    Array.isArray(candidate.sourceHealth)
  );
}

async function parseSnapshotResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`Snapshot request failed: ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contents =
    bytes[0] === 0x1f && bytes[1] === 0x8b
      ? strFromU8(gunzipSync(bytes))
      : strFromU8(bytes);
  const snapshot: unknown = JSON.parse(contents);
  if (!isValidSnapshot(snapshot)) {
    throw new Error("Invalid snapshot payload");
  }
  return snapshot;
}

async function loadPackagedSnapshot(requestUrl?: string) {
  if (!requestUrl) throw new Error("No packaged snapshot URL is available.");
  const response = await fetch(
    new URL("/data/money-in-motion-client.json.gz", requestUrl),
    { cache: "no-store" },
  );
  return parseSnapshotResponse(response);
}

export async function loadCurrentMotionSnapshot(requestUrl?: string) {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return loadTestSnapshot();
  }
  const now = Date.now();
  if (memoizedSnapshot && now < memoizedUntil) return memoizedSnapshot;
  try {
    const refreshBucket = Math.floor(now / refreshIntervalMs);
    const response = await fetch(`${upstreamUrl}?refresh=${refreshBucket}`, {
      cache: "no-store",
    });
    const upstream = await parseSnapshotResponse(response);
    memoizedSnapshot = upstream;
    memoizedUntil = now + refreshIntervalMs;
    return memoizedSnapshot;
  } catch {
    if (memoizedSnapshot) return memoizedSnapshot;
    const packaged = await loadPackagedSnapshot(requestUrl);
    memoizedSnapshot = packaged;
    memoizedUntil = now + refreshIntervalMs;
    return memoizedSnapshot;
  }
}
