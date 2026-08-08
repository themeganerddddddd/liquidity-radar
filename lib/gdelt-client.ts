import { stableId } from "./money-in-motion";

export type GdeltArticle = {
  url: string;
  title: string;
  seendate: string;
  domain: string;
  language: string;
  sourcecountry: string;
  family: string;
};

export type GdeltQueryState = {
  watermark: string;
  nextRetryAt: string;
  consecutiveFailures: number;
  lastSuccessAt: string;
  lastAttemptAt: string;
  lastErrorType: string;
};

export type GdeltCacheEntry = {
  fetchedAt: string;
  articles: GdeltArticle[];
};

export type GdeltPersistentState = {
  version: 1;
  updatedAt: string;
  queries: Record<string, GdeltQueryState>;
  cache: Record<string, GdeltCacheEntry>;
  articles: Record<string, GdeltArticle>;
  metrics: {
    requests: number;
    cacheHits: number;
    rateLimitCount: number;
    successfulQueries: number;
  };
};

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "headers" | "json">>;

export const GDELT_QUERY_FAMILIES = [
  {
    id: "closed_announced",
    query:
      '("acquired by" OR "has acquired" OR "has been acquired" OR "acquisition of" OR "agreed to acquire" OR "agreed to sell" OR "completed its acquisition" OR "completed the sale" OR "sold to" OR "sale to")',
  },
  {
    id: "pre_liquidity",
    query:
      '("exploring a sale" OR "exploring strategic alternatives" OR "considering a sale" OR "seeking a buyer" OR "sale process" OR "retained a financial advisor" OR "retained an investment bank" OR "engaged a financial advisor" OR "engaged an investment bank" OR "put up for sale" OR "marketed for sale")',
  },
  {
    id: "other_liquidity",
    query:
      '("majority stake" OR "minority stake" OR "secondary sale" OR "secondary transaction" OR recapitalization OR "founder exit" OR "management buyout" OR "tender offer" OR "asset sale" OR "portfolio sale")',
  },
] as const;

export function emptyGdeltState(): GdeltPersistentState {
  return {
    version: 1,
    updatedAt: "",
    queries: {},
    cache: {},
    articles: {},
    metrics: {
      requests: 0,
      cacheHits: 0,
      rateLimitCount: 0,
      successfulQueries: 0,
    },
  };
}

export function canonicalizeArticleUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_)/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function matchesGdeltHeadline(family: string, title: string) {
  if (
    /\b(?:what happens|how to|why |guide to|earnings call|transcript)\b/i.test(
      title,
    )
  )
    return false;
  if (family === "pre_liquidity") {
    return /\b(?:exploring (?:a sale|strategic alternatives)|considering a sale|seeking a buyer|sale process|retained (?:a financial advisor|an investment bank)|engaged (?:a financial advisor|an investment bank)|put up for sale|marketed for sale)\b/i.test(
      title,
    );
  }
  if (family === "other_liquidity") {
    return /\b(?:majority stake|minority stake|secondary sale|secondary transaction|recapitalization|founder exit|management buyout|tender offer|asset sale|portfolio sale)\b/i.test(
      title,
    );
  }
  return /\b(?:acquired by|has acquired|has been acquired|acquisition of|agreed to acquire|agreed to sell|completed its acquisition|completed the sale|sold to|sale to)\b/i.test(
    title,
  );
}

export function parseRetryAfter(value: string | null, now: number) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return now + seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) && date > now ? date : null;
}

export function gdeltBackoffMs(
  consecutiveFailures: number,
  retryAfter: string | null,
  now: number,
  random: () => number,
) {
  const honored = parseRetryAfter(retryAfter, now);
  if (honored !== null) return honored - now;
  const base = Math.min(
    24 * 60 * 60 * 1000,
    15 * 60 * 1000 * 2 ** Math.max(0, consecutiveFailures - 1),
  );
  return Math.round(base + base * 0.2 * random());
}

function gdeltTimestamp(value: number) {
  return new Date(value)
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
}

function queryWindow(
  now: number,
  watermark: string,
  initialWindowMs = 6 * 60 * 60 * 1000,
  maximumWindowMs = 24 * 60 * 60 * 1000,
) {
  const overlapMs = 30 * 60 * 1000;
  const parsed = Date.parse(watermark);
  const start = Number.isFinite(parsed)
    ? Math.max(parsed - overlapMs, now - maximumWindowMs)
    : now - initialWindowMs;
  return { start, end: now };
}

function articleDate(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function normalizeArticles(
  payload: { articles?: Array<Record<string, unknown>> },
  family: string,
) {
  return (payload.articles || []).flatMap((row) => {
    const url = canonicalizeArticleUrl(String(row.url || ""));
    const title = String(row.title || "").trim();
    if (!/^https:\/\//.test(url) || !title) return [];
    return [
      {
        url,
        title,
        seendate: String(row.seendate || ""),
        domain: String(row.domain || new URL(url).hostname).replace(
          /^www\./,
          "",
        ),
        language: String(row.language || ""),
        sourcecountry: String(row.sourcecountry || ""),
        family,
      } satisfies GdeltArticle,
    ];
  });
}

export async function runGdeltIncremental(input: {
  state?: GdeltPersistentState;
  fetcher?: FetchLike;
  now?: number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
  minimumDelayMs?: number;
  initialWindowMs?: number;
  maximumWindowMs?: number;
}) {
  const state = structuredClone(input.state || emptyGdeltState());
  const fetcher = input.fetcher || (fetch as FetchLike);
  const now = input.now ?? Date.now();
  const random = input.random || Math.random;
  const sleep =
    input.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const minimumDelayMs = input.minimumDelayMs ?? 5_500;
  let lastRequestAt = 0;
  let stoppedForRateLimit = false;

  for (const family of GDELT_QUERY_FAMILIES) {
    const current = state.queries[family.id] || {
      watermark: "",
      nextRetryAt: "",
      consecutiveFailures: 0,
      lastSuccessAt: "",
      lastAttemptAt: "",
      lastErrorType: "",
    };
    if (current.nextRetryAt && Date.parse(current.nextRetryAt) > now) continue;
    const window = queryWindow(
      now,
      current.watermark,
      input.initialWindowMs,
      input.maximumWindowMs,
    );
    const cacheKey = stableId(
      family.id,
      new Date(window.start).toISOString(),
      new Date(window.end).toISOString(),
    );
    const cached = state.cache[cacheKey];
    let articles: GdeltArticle[];
    if (cached && now - Date.parse(cached.fetchedAt) < 24 * 60 * 60 * 1000) {
      state.metrics.cacheHits += 1;
      articles = cached.articles;
    } else {
      const waitMs = Math.max(0, minimumDelayMs - (Date.now() - lastRequestAt));
      if (lastRequestAt && waitMs) await sleep(waitMs);
      const parameters = new URLSearchParams({
        query: `${family.query} sourcelang:english`,
        mode: "artlist",
        maxrecords: "75",
        format: "json",
        startdatetime: gdeltTimestamp(window.start),
        enddatetime: gdeltTimestamp(window.end),
        sort: "datedesc",
      });
      current.lastAttemptAt = new Date(now).toISOString();
      lastRequestAt = Date.now();
      state.metrics.requests += 1;
      try {
        const response = await fetcher(
          `https://api.gdeltproject.org/api/v2/doc/doc?${parameters}`,
          {
            headers: { "User-Agent": "LiquidityRadar/0.2 public-record-sync" },
            signal: AbortSignal.timeout(20_000),
          },
        );
        if (response.status === 429) {
          state.metrics.rateLimitCount += 1;
          current.consecutiveFailures += 1;
          current.lastErrorType = "RATE_LIMITED";
          current.nextRetryAt = new Date(
            now +
              gdeltBackoffMs(
                current.consecutiveFailures,
                response.headers.get("retry-after"),
                now,
                random,
              ),
          ).toISOString();
          stoppedForRateLimit = true;
          state.queries[family.id] = current;
          break;
        }
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        articles = normalizeArticles(
          (await response.json()) as {
            articles?: Array<Record<string, unknown>>;
          },
          family.id,
        );
        state.cache[cacheKey] = {
          fetchedAt: new Date(now).toISOString(),
          articles,
        };
        current.watermark = new Date(window.end).toISOString();
        current.lastSuccessAt = new Date(now).toISOString();
        current.nextRetryAt = "";
        current.consecutiveFailures = 0;
        current.lastErrorType = "";
        state.metrics.successfulQueries += 1;
      } catch (error) {
        current.consecutiveFailures += 1;
        current.lastErrorType =
          error instanceof Error ? error.message : "REQUEST_ERROR";
        current.nextRetryAt = new Date(
          now + gdeltBackoffMs(current.consecutiveFailures, null, now, random),
        ).toISOString();
        state.queries[family.id] = current;
        continue;
      }
    }
    for (const article of articles) {
      const key = stableId(canonicalizeArticleUrl(article.url));
      const previous = state.articles[key];
      if (
        !previous ||
        articleDate(article.seendate) >= articleDate(previous.seendate)
      ) {
        state.articles[key] = article;
      }
    }
    state.queries[family.id] = current;
  }

  const cacheEntries = Object.entries(state.cache)
    .filter(
      ([, entry]) => now - Date.parse(entry.fetchedAt) < 48 * 60 * 60 * 1000,
    )
    .slice(-60);
  state.cache = Object.fromEntries(cacheEntries);
  const articles = Object.values(state.articles)
    .sort((left, right) => right.seendate.localeCompare(left.seendate))
    .slice(0, 2_000);
  state.articles = Object.fromEntries(
    articles.map((article) => [
      stableId(canonicalizeArticleUrl(article.url)),
      article,
    ]),
  );
  state.updatedAt = new Date(now).toISOString();
  return { state, articles, stoppedForRateLimit };
}
