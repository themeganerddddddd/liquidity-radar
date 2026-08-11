import { describe, expect, it, vi } from "vitest";
import {
  canonicalizeArticleUrl,
  emptyGdeltState,
  matchesGdeltHeadline,
  parseRetryAfter,
  runGdeltIncremental,
  type FetchLike,
} from "../../lib/gdelt-client";

function response(
  status: number,
  payload: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => payload,
  };
}

describe("resilient GDELT ingestion", () => {
  it("honors Retry-After, stops the global queue, and degrades gracefully", async () => {
    const now = Date.parse("2026-08-08T12:00:00Z");
    const fetcher = vi.fn(async () =>
      response(429, {}, { "retry-after": "120" }),
    ) as FetchLike;
    const result = await runGdeltIncremental({
      state: emptyGdeltState(),
      fetcher,
      now,
      random: () => 0,
      minimumDelayMs: 0,
    });
    expect(result.stoppedForRateLimit).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.state.metrics.rateLimitCount).toBe(1);
    expect(result.state.queries.closed_announced.nextRetryAt).toBe(
      "2026-08-08T12:02:00.000Z",
    );
  });

  it("deduplicates canonical URLs and advances query watermarks", async () => {
    const fetcher = vi.fn(async () =>
      response(200, {
        articles: [
          {
            url: "https://www.news.test/deal/?utm_source=wire#top",
            title: "Buyer acquired Seller",
            seendate: "20260808T113000Z",
            domain: "news.test",
            language: "English",
            sourcecountry: "United States",
          },
        ],
      }),
    ) as FetchLike;
    const result = await runGdeltIncremental({
      fetcher,
      now: Date.parse("2026-08-08T12:00:00Z"),
      minimumDelayMs: 0,
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].url).toBe("https://news.test/deal");
    expect(
      Object.values(result.state.queries).every(
        (query) => query.watermark === "2026-08-08T12:00:00.000Z",
      ),
    ).toBe(true);
  });

  it("persists and reuses incremental-window cache entries", async () => {
    const now = Date.parse("2026-08-08T12:00:00Z");
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

  it("skips a backed-off family before spending the one-query production budget", async () => {
    const now = Date.parse("2026-08-08T12:00:00Z");
    const state = emptyGdeltState();
    state.queries.closed_announced = {
      watermark: "",
      nextRetryAt: "2026-08-08T13:00:00.000Z",
      consecutiveFailures: 1,
      lastSuccessAt: "",
      lastAttemptAt: "2026-08-08T11:00:00.000Z",
      lastErrorType: "RATE_LIMITED",
    };
    const fetcher = vi.fn(async () =>
      response(200, { articles: [] }),
    ) as FetchLike;
    const result = await runGdeltIncremental({
      state,
      fetcher,
      now,
      minimumDelayMs: 0,
      maximumQueries: 1,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.state.queries.pre_liquidity.lastSuccessAt).toBe(
      "2026-08-08T12:00:00.000Z",
    );
  });

  it("parses numeric and date Retry-After forms", () => {
    const now = Date.parse("2026-08-08T12:00:00Z");
    expect(parseRetryAfter("60", now)).toBe(now + 60_000);
    expect(parseRetryAfter("Sat, 08 Aug 2026 12:05:00 GMT", now)).toBe(
      now + 300_000,
    );
  });

  it("removes tracking parameters without changing the article identity", () => {
    expect(
      canonicalizeArticleUrl(
        "https://WWW.Example.com/story/?utm_campaign=x&article=9#section",
      ),
    ).toBe("https://example.com/story?article=9");
  });

  it("keeps exact transaction headlines and rejects contextual false positives", () => {
    expect(
      matchesGdeltHeadline(
        "closed_announced",
        "Northstar has acquired Acme Industrial",
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
