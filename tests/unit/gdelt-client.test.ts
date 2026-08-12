import { describe, expect, it, vi } from "vitest";
import {
  canonicalizeArticleUrl,
  emptyGdeltState,
  gdeltQueryWindow,
  matchesGdeltHeadline,
  parseRetryAfter,
  runGdeltIncremental,
  type FetchLike,
  type GdeltRequestDiagnostic,
} from "../../lib/gdelt-client";

function response(
  status: number,
  payload: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  const body = JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json", ...headers }),
    json: async () => payload,
    text: async () => body,
  };
}

const now = Date.parse("2026-08-08T12:00:00Z");

describe("resilient GDELT ingestion", () => {
  it("completes a normal successful fetch for every query family", async () => {
    const fetcher = vi.fn(async () => response(200, { articles: [] }));
    const result = await runGdeltIncremental({
      fetcher: fetcher as FetchLike,
      now,
      minimumDelayMs: 0,
    });

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(result.state.metrics.successfulQueries).toBe(3);
    expect(result.state.metrics.httpStatusDistribution).toEqual({ "200": 3 });
    expect(
      Object.values(result.state.queries).every(
        (query) => query.watermark === "2026-08-08T12:00:00.000Z",
      ),
    ).toBe(true);
  });

  it("honors Retry-After without preventing other query families", async () => {
    const diagnostics: GdeltRequestDiagnostic[] = [];
    let attempt = 0;
    const fetcher = vi.fn(async () => {
      attempt += 1;
      return attempt === 1
        ? response(
            429,
            { message: "one request every five seconds" },
            { "retry-after": "120" },
          )
        : response(200, { articles: [] });
    }) as FetchLike;
    const result = await runGdeltIncremental({
      fetcher,
      now,
      random: () => 0,
      minimumDelayMs: 0,
      logger: (diagnostic) => diagnostics.push(diagnostic),
    });

    expect(result.stoppedForRateLimit).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(result.state.metrics.rateLimitCount).toBe(1);
    expect(result.state.metrics.successfulQueries).toBe(2);
    expect(result.state.queries.closed_announced.nextRetryAt).toBe(
      "2026-08-08T12:02:00.000Z",
    );
    expect(diagnostics[0]).toMatchObject({
      httpStatus: 429,
      queryFamily: "closed_announced",
      retryAfter: "120",
      backoffMs: 120_000,
      willRetry: true,
      watermarkWillAdvance: false,
    });
  });

  it("isolates HTTP 500 failures and records response diagnostics", async () => {
    let attempt = 0;
    const fetcher = vi.fn(async () => {
      attempt += 1;
      return attempt === 1
        ? response(500, { error: "upstream unavailable" })
        : response(200, { articles: [] });
    }) as FetchLike;
    const result = await runGdeltIncremental({
      fetcher,
      now,
      minimumDelayMs: 0,
      random: () => 0,
      logger: () => undefined,
    });

    expect(result.state.metrics.failedRequests).toBe(1);
    expect(result.state.queries.closed_announced.lastErrorType).toBe(
      "HTTP_500",
    );
    expect(result.state.queries.closed_announced.watermark).toBe("");
    expect(result.state.metrics.successfulQueries).toBe(2);
    expect(result.state.requestLog[0].summary).toContain(
      "upstream unavailable",
    );
  });

  it("records network fetch failures and preserves the failed watermark", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("fetch failed", {
        cause: new Error("Connect Timeout Error"),
      });
    }) as FetchLike;
    const result = await runGdeltIncremental({
      fetcher,
      now,
      minimumDelayMs: 0,
      random: () => 0,
      maximumQueries: 1,
      logger: () => undefined,
    });

    expect(result.articles).toEqual([]);
    expect(result.state.metrics.networkFailureCount).toBe(1);
    expect(result.state.queries.closed_announced.lastErrorType).toBe(
      "CONNECT_TIMEOUT",
    );
    expect(result.state.queries.closed_announced.watermark).toBe("");
    expect(result.state.requestLog[0].httpStatus).toBeNull();
  });

  it("persists backoff and skips a backed-off family", async () => {
    const state = emptyGdeltState();
    state.queries.closed_announced = {
      watermark: "",
      nextRetryAt: "2026-08-08T13:00:00.000Z",
      consecutiveFailures: 1,
      lastSuccessAt: "",
      lastAttemptAt: "2026-08-08T11:00:00.000Z",
      lastErrorType: "RATE_LIMITED",
      lastErrorSummary: "quota",
      lastHttpStatus: 429,
      lastWindowStart: "2026-08-08T05:00:00.000Z",
      lastWindowEnd: "2026-08-08T11:00:00.000Z",
    };
    const fetcher = vi.fn(async () => response(200, { articles: [] }));
    const result = await runGdeltIncremental({
      state,
      fetcher: fetcher as FetchLike,
      now,
      minimumDelayMs: 0,
      maximumQueries: 1,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.state.queries.pre_liquidity.lastSuccessAt).toBe(
      "2026-08-08T12:00:00.000Z",
    );
  });

  it("persists and reuses exact incremental-window cache entries", async () => {
    const fetcher = vi.fn(async () =>
      response(200, { articles: [] }),
    ) as FetchLike;
    const first = await runGdeltIncremental({
      fetcher,
      now,
      minimumDelayMs: 0,
    });
    const second = await runGdeltIncremental({
      state: first.state,
      fetcher,
      now,
      minimumDelayMs: 0,
    });
    const third = await runGdeltIncremental({
      state: second.state,
      fetcher,
      now,
      minimumDelayMs: 0,
    });

    expect(fetcher).toHaveBeenCalledTimes(6);
    expect(third.state.metrics.cacheHits - second.state.metrics.cacheHits).toBe(
      3,
    );
  });

  it("advances a stale watermark in bounded increments without skipping history", async () => {
    const state = emptyGdeltState();
    state.queries.closed_announced = {
      watermark: "2026-08-08T06:00:00.000Z",
      nextRetryAt: "",
      consecutiveFailures: 0,
      lastSuccessAt: "2026-08-08T06:00:00.000Z",
      lastAttemptAt: "",
      lastErrorType: "",
      lastErrorSummary: "",
      lastHttpStatus: 200,
      lastWindowStart: "",
      lastWindowEnd: "",
    };
    const fetcher = vi.fn(async (requestUrl: string) => {
      expect(requestUrl).toContain("api.gdeltproject.org");
      return response(200, { articles: [] });
    });
    const result = await runGdeltIncremental({
      state,
      fetcher: fetcher as FetchLike,
      now,
      maximumWindowMs: 2 * 60 * 60 * 1000,
      overlapMs: 30 * 60 * 1000,
      maximumQueries: 1,
      minimumDelayMs: 0,
    });
    const url = new URL(String(fetcher.mock.calls[0][0]));

    expect(url.searchParams.get("startdatetime")).toBe("20260808053000");
    expect(url.searchParams.get("enddatetime")).toBe("20260808080000");
    expect(result.state.queries.closed_announced.watermark).toBe(
      "2026-08-08T08:00:00.000Z",
    );
    expect(
      gdeltQueryWindow(now, "2026-08-08T06:00:00.000Z", undefined, 7_200_000),
    ).toEqual({
      start: Date.parse("2026-08-08T05:30:00.000Z"),
      end: Date.parse("2026-08-08T08:00:00.000Z"),
    });
  });

  it("deduplicates syndicated canonical URLs but retains independent articles", async () => {
    const fetcher = vi.fn(async () =>
      response(200, {
        articles: [
          {
            url: "https://www.news.test/deal/?utm_source=wire#top",
            title: "Buyer agreed to acquire Seller",
            seendate: "20260808T113000Z",
            domain: "news.test",
            language: "English",
            sourcecountry: "United States",
          },
          {
            url: "https://news.test/deal",
            title: "Buyer agreed to acquire Seller",
            seendate: "20260808T114000Z",
            domain: "news.test",
            language: "English",
            sourcecountry: "United States",
          },
          {
            url: "https://independent.test/transaction",
            title: "Seller has been acquired by Buyer",
            seendate: "20260808T114500Z",
            domain: "independent.test",
            language: "English",
            sourcecountry: "United States",
          },
        ],
      }),
    ) as FetchLike;
    const result = await runGdeltIncremental({
      fetcher,
      now,
      minimumDelayMs: 0,
      maximumQueries: 1,
    });

    expect(result.articles).toHaveLength(2);
    expect(result.articles.map((article) => article.domain).sort()).toEqual([
      "independent.test",
      "news.test",
    ]);
  });

  it("parses Retry-After and canonicalizes article URLs", () => {
    expect(parseRetryAfter("60", now)).toBe(now + 60_000);
    expect(parseRetryAfter("Sat, 08 Aug 2026 12:05:00 GMT", now)).toBe(
      now + 300_000,
    );
    expect(
      canonicalizeArticleUrl(
        "https://WWW.Example.com/story/?utm_campaign=x&article=9#section",
      ),
    ).toBe("https://example.com/story?article=9");
  });

  it("keeps precise transaction headlines and rejects contextual false positives", () => {
    expect(
      matchesGdeltHeadline(
        "closed_announced",
        "Northstar has been acquired by Acme Industrial",
      ),
    ).toBe(true);
    expect(
      matchesGdeltHeadline(
        "other_liquidity",
        "What Happens to Your Pension When the Company Is Bought",
      ),
    ).toBe(false);
    expect(
      matchesGdeltHeadline(
        "pre_liquidity",
        "Founder retained an investment bank to explore a sale",
      ),
    ).toBe(true);
  });
});
