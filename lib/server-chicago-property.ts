import { gunzipSync, strFromU8 } from "fflate";
import {
  CHICAGO_PROPERTY_SCHEMA_VERSION,
  type ChicagoPropertySnapshot,
} from "./chicago-property";

const upstreamUrl =
  "https://raw.githubusercontent.com/themeganerddddddd/liquidity-radar/main/public/data/chicago-property-client.json.gz";
const refreshIntervalMs = 5 * 60 * 1000;

let memoizedSnapshot: ChicagoPropertySnapshot | null = null;
let memoizedUntil = 0;
let testSnapshot: ChicagoPropertySnapshot | null = null;

function isValidSnapshot(value: unknown): value is ChicagoPropertySnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ChicagoPropertySnapshot>;
  return (
    candidate.schemaVersion === CHICAGO_PROPERTY_SCHEMA_VERSION &&
    typeof candidate.generatedAt === "string" &&
    Array.isArray(candidate.records) &&
    Array.isArray(candidate.sourceHealth)
  );
}

async function parseSnapshotResponse(response: Response) {
  if (!response.ok)
    throw new Error(`Snapshot request failed: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contents =
    bytes[0] === 0x1f && bytes[1] === 0x8b
      ? strFromU8(gunzipSync(bytes))
      : strFromU8(bytes);
  const snapshot: unknown = JSON.parse(contents);
  if (!isValidSnapshot(snapshot))
    throw new Error("Invalid Chicago Property snapshot");
  return snapshot;
}

async function loadTestSnapshot() {
  if (testSnapshot) return testSnapshot;
  const [{ readFile }, path] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ]);
  const bytes = await readFile(
    path.resolve(
      process.cwd(),
      "public",
      "data",
      "chicago-property-client.json.gz",
    ),
  );
  const contents = gunzipSync(new Uint8Array(bytes));
  const snapshot: unknown = JSON.parse(strFromU8(contents));
  if (!isValidSnapshot(snapshot))
    throw new Error("Invalid Chicago Property test snapshot");
  testSnapshot = snapshot;
  return testSnapshot;
}

async function loadPackagedSnapshot(requestUrl?: string) {
  if (!requestUrl) throw new Error("No packaged snapshot URL is available.");
  return parseSnapshotResponse(
    await fetch(new URL("/data/chicago-property-client.json.gz", requestUrl), {
      cache: "no-store",
    }),
  );
}

export async function loadCurrentChicagoPropertySnapshot(requestUrl?: string) {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return loadTestSnapshot();
  }
  const now = Date.now();
  if (memoizedSnapshot && now < memoizedUntil) return memoizedSnapshot;
  try {
    const refreshBucket = Math.floor(now / refreshIntervalMs);
    memoizedSnapshot = await parseSnapshotResponse(
      await fetch(`${upstreamUrl}?refresh=${refreshBucket}`, {
        cache: "no-store",
      }),
    );
  } catch {
    if (!memoizedSnapshot) {
      memoizedSnapshot = await loadPackagedSnapshot(requestUrl);
    }
  }
  memoizedUntil = now + refreshIntervalMs;
  return memoizedSnapshot;
}
