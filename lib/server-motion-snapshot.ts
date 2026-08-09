import localSnapshotJson from "../public/data/money-in-motion.json";
import type { MoneyMotionSnapshot } from "./money-in-motion";

const localSnapshot = localSnapshotJson as unknown as MoneyMotionSnapshot;
const upstreamUrl =
  "https://raw.githubusercontent.com/themeganerddddddd/liquidity-radar/main/public/data/money-in-motion.json";
const refreshIntervalMs = 5 * 60 * 1000;

let memoizedSnapshot: MoneyMotionSnapshot | null = null;
let memoizedUntil = 0;

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

export async function loadCurrentMotionSnapshot() {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return localSnapshot;
  }
  const now = Date.now();
  if (memoizedSnapshot && now < memoizedUntil) return memoizedSnapshot;
  try {
    const refreshBucket = Math.floor(now / refreshIntervalMs);
    const response = await fetch(`${upstreamUrl}?refresh=${refreshBucket}`, {
      cache: "force-cache",
      headers: { "User-Agent": "LiquidityRadar/0.2 snapshot-reader" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return localSnapshot;
    const upstream: unknown = await response.json();
    if (!isValidSnapshot(upstream)) return localSnapshot;
    memoizedSnapshot =
      upstream.generatedAt >= localSnapshot.generatedAt
        ? upstream
        : localSnapshot;
    memoizedUntil = now + refreshIntervalMs;
    return memoizedSnapshot;
  } catch {
    return localSnapshot;
  }
}
