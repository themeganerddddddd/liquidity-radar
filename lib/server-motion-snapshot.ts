import type { MoneyMotionSnapshot } from "./money-in-motion";

const upstreamUrl =
  "https://raw.githubusercontent.com/themeganerddddddd/liquidity-radar/main/public/data/money-in-motion.json";
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
  const filename = `${["money", "in", "motion"].join("-")}.json`;
  const contents = await readFile(
    path.resolve(process.cwd(), "public", "data", filename),
    "utf8",
  );
  testSnapshot = JSON.parse(contents) as MoneyMotionSnapshot;
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

async function loadPackagedSnapshot(requestUrl?: string) {
  if (!requestUrl) throw new Error("No packaged snapshot URL is available.");
  const response = await fetch(
    new URL("/data/money-in-motion.json.gz", requestUrl),
    { cache: "force-cache" },
  );
  if (!response.ok) {
    throw new Error(`Packaged snapshot request failed: ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  let contents: string;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const decompressed = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    contents = await new Response(decompressed).text();
  } else {
    contents = new TextDecoder().decode(bytes);
  }
  const packaged: unknown = JSON.parse(contents);
  if (!isValidSnapshot(packaged)) {
    throw new Error("Invalid packaged snapshot payload");
  }
  return packaged;
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
      cache: "force-cache",
      headers: { "User-Agent": "LiquidityRadar/0.2 snapshot-reader" },
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok)
      throw new Error(`Snapshot request failed: ${response.status}`);
    const upstream: unknown = await response.json();
    if (!isValidSnapshot(upstream)) throw new Error("Invalid snapshot payload");
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
