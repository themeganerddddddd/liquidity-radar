import { stableId } from "./money-in-motion";

const GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc";
const REQUEST_LOG_LIMIT = 120;

export type GdeltArticle = {
  url: string;
  title: string;
  seendate: string;
  domain: string;
  language: string;
  sourcecountry: string;
  family: string;
};

export type GdeltRequestDiagnostic = {
  attemptedAt: string;
  httpStatus: number | null;
  requestUrl: string;
  queryFamily: string;
  windowStart: string;
  windowEnd: string;
  contentType: string;
  summary: string;
  attempt: number;
  retryAfter: string;
  backoffMs: number;
  willRetry: boolean;
  watermarkWillAdvance: boolean;
};

export type GdeltQueryState = {
  watermark: string;
  nextRetryAt: string;
  consecutiveFailures: number;
  lastSuccessAt: string;
  lastAttemptAt: string;
  lastErrorType: string;
  lastErrorSummary: string;
  lastHttpStatus: number | null;
  lastWindowStart: string;
  lastWindowEnd: string;
};

export type GdeltCacheEntry = {
  fetchedAt: string;
  articles: GdeltArticle[];
};

export type GdeltPersistentState = {
  version: 2;
  updatedAt: string;
  queries: Record<string, GdeltQueryState>;
  cache: Record<string, GdeltCacheEntry>;
  articles: Record<string, GdeltArticle>;
  requestLog: GdeltRequestDiagnostic[];
  metrics: {
    requests: number;
    failedRequests: number;
    cacheHits: number;
    rateLimitCount: number;
    networkFailureCount: number;
    successfulQueries: number;
    httpStatusDistribution: Record<string, number>;
  };
};

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<
  Pick<Response, "ok" | "status" | "headers"> &
    Partial<Pick<Response, "json" | "text">>
>;

export const GDELT_QUERY_FAMILIES = [
  {
    id: "closed_announced",
    query:
      '("acquired by" OR "has been acquired" OR "agreed to acquire" OR "agreed to sell" OR "completed its acquisition" OR "completed the sale" OR "sold to")',
  },
  {
    id: "pre_liquidity",
    query:
      '("exploring strategic alternatives" OR "exploring a sale" OR "considering a sale" OR "seeking a buyer" OR "sale process" OR "retained a financial advisor" OR "retained an investment bank" OR "engaged an investment bank" OR "put up for sale")',
  },
  {
    id: "other_liquidity",
    query:
      '("majority stake" OR "minority stake" OR "secondary sale" OR "secondary transaction" OR recapitalization OR "management buyout" OR "founder exit" OR "asset sale")',
  },
] as const;

function emptyQueryState(): GdeltQueryState {
  return {
    watermark: "",
    nextRetryAt: "",
    consecutiveFailures: 0,
    lastSuccessAt: "",
    lastAttemptAt: "",
    lastErrorType: "",
    lastErrorSummary: "",
    lastHttpStatus: null,
    lastWindowStart: "",
    lastWindowEnd: "",
  };
}

export function emptyGdeltState(): GdeltPersistentState {
  return {
    version: 2,
    updatedAt: "",
    queries: {},
    cache: {},
    articles: {},
    requestLog: [],
    metrics: {
      requests: 0,
      failedRequests: 0,
      cacheHits: 0,
      rateLimitCount: 0,
      networkFailureCount: 0,
      successfulQueries: 0,
      httpStatusDistribution: {},
    },
  };
}

function normalizeState(input?: GdeltPersistentState) {
  const empty = emptyGdeltState();
  const supplied = (input || {}) as Partial<GdeltPersistentState>;
  return {
    ...empty,
    ...structuredClone(supplied),
    version: 2 as const,
    queries: Object.fromEntries(
      Object.entries(supplied.queries || {}).map(([id, query]) => [
        id,
        { ...emptyQueryState(), ...query },
      ]),
    ),
    cache: supplied.cache || {},
    articles: supplied.articles || {},
    requestLog: supplied.requestLog || [],
    metrics: {
      ...empty.metrics,
      ...(supplied.metrics || {}),
      httpStatusDistribution: supplied.metrics?.httpStatusDistribution || {},
    },
  } satisfies GdeltPersistentState;
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
    return /\b(?:exploring (?:a sale|strategic alternatives)|considering a sale|seeking a buyer|sale process|retained (?:a financial advisor|an investment bank)|engaged an investment bank|put up for sale)\b/i.test(
      title,
    );
  }
  if (family === "other_liquidity") {
    return /\b(?:majority stake|minority stake|secondary sale|secondary transaction|recapitalization|founder exit|management buyout|asset sale)\b/i.test(
      title,
    );
  }
  return /\b(?:acquired by|has been acquired|agreed to acquire|agreed to sell|completed its acquisition|completed the sale|sold to)\b/i.test(
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

export function gdeltQueryWindow(
  now: number,
  watermark: string,
  initialWindowMs = 6 * 60 * 60 * 1000,
  maximumWindowMs = 12 * 60 * 60 * 1000,
  overlapMs = 30 * 60 * 1000,
) {
  const parsed = Date.parse(watermark);
  if (!Number.isFinite(parsed))
    return { start: now - initialWindowMs, end: now };
  return {
    start: Math.max(0, parsed - overlapMs),
    end: Math.min(now, parsed + maximumWindowMs),
  };
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

function errorType(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const cause =
    error instanceof Error && error.cause ? String(error.cause) : "";
  if (/connect timeout/i.test(`${message} ${cause}`)) return "CONNECT_TIMEOUT";
  if (/abort|timeout/i.test(`${message} ${cause}`)) return "REQUEST_TIMEOUT";
  if (/fetch failed|network/i.test(`${message} ${cause}`))
    return "NETWORK_FAILURE";
  return message.replace(/[^A-Z0-9_]+/gi, "_").slice(0, 80) || "REQUEST_ERROR";
}

function shortSummary(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 320);
}

async function responseText(response: Awaited<ReturnType<FetchLike>>) {
  if (response.text) return response.text();
  if (response.json) return JSON.stringify(await response.json());
  return "";
}

function appendDiagnostic(
  state: GdeltPersistentState,
  diagnostic: GdeltRequestDiagnostic,
  logger: (diagnostic: GdeltRequestDiagnostic) => void,
) {
  state.requestLog = [...state.requestLog, diagnostic].slice(
    -REQUEST_LOG_LIMIT,
  );
  logger(diagnostic);
}

export async function runGdeltIncremental(input: {
  state?: GdeltPersistentState;
  fetcher?: FetchLike;
  now?: number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
  logger?: (diagnostic: GdeltRequestDiagnostic) => void;
  minimumDelayMs?: number;
  initialWindowMs?: number;
  maximumWindowMs?: number;
  overlapMs?: number;
  maximumQueries?: number;
  familyOffset?: number;
  baseUrl?: string;
}) {
  const state = normalizeState(input.state);
  const fetcher = input.fetcher || (fetch as FetchLike);
  const now = input.now ?? Date.now();
  const random = input.random || Math.random;
  const sleep =
    input.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const logger =
    input.logger ||
    ((diagnostic) =>
      console.warn(JSON.stringify({ source: "gdelt", ...diagnostic })));
  const minimumDelayMs = input.minimumDelayMs ?? 5_500;
  const baseUrl =
    input.baseUrl || process.env.GDELT_DOC_API_URL || GDELT_DOC_URL;
  let lastRequestAt = 0;
  let encounteredRateLimit = false;

  const queryFamilies = [...GDELT_QUERY_FAMILIES];
  const familyOffset = Math.abs(input.familyOffset || 0) % queryFamilies.length;
  const orderedFamilies = [
    ...queryFamilies.slice(familyOffset),
    ...queryFamilies.slice(0, familyOffset),
  ];
  const maximumQueries = input.maximumQueries || queryFamilies.length;
  let processedQueries = 0;

  for (const family of orderedFamilies) {
    const current = {
      ...emptyQueryState(),
      ...(state.queries[family.id] || {}),
    };
    if (current.nextRetryAt && Date.parse(current.nextRetryAt) > now) continue;
    if (processedQueries >= maximumQueries) break;
    processedQueries += 1;
    const window = gdeltQueryWindow(
      now,
      current.watermark,
      input.initialWindowMs,
      input.maximumWindowMs,
      input.overlapMs,
    );
    current.lastWindowStart = new Date(window.start).toISOString();
    current.lastWindowEnd = new Date(window.end).toISOString();
    const cacheKey = stableId(
      family.id,
      current.lastWindowStart,
      current.lastWindowEnd,
    );
    const cached = state.cache[cacheKey];
    let articles: GdeltArticle[] = [];
    if (cached && now - Date.parse(cached.fetchedAt) < 24 * 60 * 60 * 1000) {
      state.metrics.cacheHits += 1;
      articles = cached.articles;
    } else {
      const waitMs = Math.max(0, minimumDelayMs - (Date.now() - lastRequestAt));
      if (lastRequestAt && waitMs) await sleep(waitMs);
      const parameters = new URLSearchParams({
        query: `${family.query} (company OR business OR stake OR assets OR transaction) sourcelang:english`,
        mode: "artlist",
        maxrecords: "75",
        format: "json",
        startdatetime: gdeltTimestamp(window.start),
        enddatetime: gdeltTimestamp(window.end),
        sort: "datedesc",
      });
      const requestUrl = `${baseUrl}?${parameters}`;
      current.lastAttemptAt = new Date(now).toISOString();
      lastRequestAt = Date.now();
      state.metrics.requests += 1;
      try {
        const response = await fetcher(requestUrl, {
          headers: { "User-Agent": "LiquidityRadar/0.3 public-record-sync" },
          signal: AbortSignal.timeout(30_000),
        });
        const statusKey = String(response.status);
        state.metrics.httpStatusDistribution[statusKey] =
          (state.metrics.httpStatusDistribution[statusKey] || 0) + 1;
        const contentType = response.headers.get("content-type") || "";
        const retryAfter = response.headers.get("retry-after") || "";
        const body = await responseText(response);
        if (!response.ok) {
          const type =
            response.status === 429
              ? "RATE_LIMITED"
              : `HTTP_${response.status}`;
          current.consecutiveFailures += 1;
          current.lastErrorType = type;
          current.lastErrorSummary = shortSummary(body) || type;
          current.lastHttpStatus = response.status;
          const backoffMs = gdeltBackoffMs(
            current.consecutiveFailures,
            retryAfter,
            now,
            random,
          );
          current.nextRetryAt = new Date(now + backoffMs).toISOString();
          state.metrics.failedRequests += 1;
          if (response.status === 429) {
            state.metrics.rateLimitCount += 1;
            encounteredRateLimit = true;
          }
          appendDiagnostic(
            state,
            {
              attemptedAt: current.lastAttemptAt,
              httpStatus: response.status,
              requestUrl,
              queryFamily: family.id,
              windowStart: current.lastWindowStart,
              windowEnd: current.lastWindowEnd,
              contentType,
              summary: current.lastErrorSummary,
              attempt: 1,
              retryAfter,
              backoffMs,
              willRetry: true,
              watermarkWillAdvance: false,
            },
            logger,
          );
          state.queries[family.id] = current;
          continue;
        }
        if (contentType && !/json/i.test(contentType)) {
          throw new Error(`INVALID_CONTENT_TYPE_${contentType}`);
        }
        let payload: { articles?: Array<Record<string, unknown>> };
        try {
          payload = JSON.parse(body) as typeof payload;
        } catch {
          throw new Error(`INVALID_JSON_${shortSummary(body)}`);
        }
        articles = normalizeArticles(payload, family.id);
        state.cache[cacheKey] = {
          fetchedAt: new Date(now).toISOString(),
          articles,
        };
        current.watermark = new Date(window.end).toISOString();
        current.lastSuccessAt = new Date(now).toISOString();
        current.nextRetryAt = "";
        current.consecutiveFailures = 0;
        current.lastErrorType = "";
        current.lastErrorSummary = "";
        current.lastHttpStatus = response.status;
        state.metrics.successfulQueries += 1;
      } catch (error) {
        current.consecutiveFailures += 1;
        current.lastErrorType = errorType(error);
        current.lastErrorSummary = shortSummary(
          error instanceof Error
            ? `${error.message}${error.cause ? `: ${String(error.cause)}` : ""}`
            : String(error),
        );
        current.lastHttpStatus = null;
        const backoffMs = gdeltBackoffMs(
          current.consecutiveFailures,
          null,
          now,
          random,
        );
        current.nextRetryAt = new Date(now + backoffMs).toISOString();
        state.metrics.failedRequests += 1;
        state.metrics.networkFailureCount += 1;
        appendDiagnostic(
          state,
          {
            attemptedAt: current.lastAttemptAt,
            httpStatus: null,
            requestUrl,
            queryFamily: family.id,
            windowStart: current.lastWindowStart,
            windowEnd: current.lastWindowEnd,
            contentType: "",
            summary: current.lastErrorSummary,
            attempt: 1,
            retryAfter: "",
            backoffMs,
            willRetry: true,
            watermarkWillAdvance: false,
          },
          logger,
        );
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

  state.cache = Object.fromEntries(
    Object.entries(state.cache)
      .filter(
        ([, entry]) => now - Date.parse(entry.fetchedAt) < 48 * 60 * 60 * 1000,
      )
      .slice(-60),
  );
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
  return { state, articles, stoppedForRateLimit: encounteredRateLimit };
}
