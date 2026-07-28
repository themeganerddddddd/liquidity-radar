import snapshotJson from "../../../public/data/public-signals.json";
import {
  fetchCurrentSecFilings,
  type PublicDataSnapshot,
  type SecFiling,
} from "../../../lib/public-data";

const snapshot = snapshotJson as PublicDataSnapshot;
const cacheWindowMs = 5 * 60 * 1000;

let secCache:
  | {
      fetchedAt: number;
      filings: SecFiling[];
    }
  | undefined;

export async function GET() {
  let mode: "live" | "snapshot" = "snapshot";
  let filings = snapshot.sec.filings;
  let updatedAt = snapshot.sec.updatedAt;

  try {
    const now = Date.now();
    const userAgent = process.env.SEC_USER_AGENT;
    if (userAgent && (!secCache || now - secCache.fetchedAt > cacheWindowMs)) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      try {
        const liveFilings = await fetchCurrentSecFilings(
          userAgent,
          controller.signal,
        );
        if (liveFilings.length >= 10) {
          secCache = { fetchedAt: now, filings: liveFilings };
        }
      } finally {
        clearTimeout(timeout);
      }
    }
    if (secCache?.filings.length) {
      mode = "live";
      filings = secCache.filings;
      updatedAt =
        filings
          .map((filing) => filing.updatedAt)
          .sort()
          .at(-1) ?? new Date(secCache.fetchedAt).toISOString();
    }
  } catch {
    mode = "snapshot";
  }

  const data: PublicDataSnapshot = {
    ...snapshot,
    sec: { mode, updatedAt, filings },
  };

  return Response.json(
    { data },
    {
      headers: {
        "cache-control":
          "public, max-age=180, s-maxage=300, stale-while-revalidate=3600",
        "x-data-mode": mode,
      },
    },
  );
}
