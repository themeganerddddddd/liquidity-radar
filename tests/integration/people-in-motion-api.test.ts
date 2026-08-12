import { describe, expect, it, vi } from "vitest";
import { gzipSync } from "node:zlib";
import { GET } from "../../app/api/v1/people-in-motion/route";
import { GET as getPublicSnapshot } from "../../app/api/money-in-motion-snapshot/route";

describe("People in Motion API", () => {
  it("keeps live refreshes enabled when a hosted runtime omits NODE_ENV", async () => {
    const originalFetch = global.fetch;
    const upstream = {
      schemaVersion: 2,
      generatedAt: "2099-01-01T00:00:00.000Z",
      records: [],
      peopleInMotion: [],
      sourceHealth: [],
    };
    vi.stubEnv("NODE_ENV", "");
    vi.stubEnv("VITEST", "");
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(upstream), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ) as typeof fetch;

    try {
      vi.resetModules();
      const { loadCurrentMotionSnapshot } =
        await import("../../lib/server-motion-snapshot");
      const refreshed = await loadCurrentMotionSnapshot();

      expect(refreshed.generatedAt).toBe(upstream.generatedAt);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("?refresh="),
        expect.objectContaining({ cache: "no-store" }),
      );
    } finally {
      global.fetch = originalFetch;
      vi.unstubAllEnvs();
    }
  });

  it("falls back to the packaged snapshot when the live source is unavailable", async () => {
    const originalFetch = global.fetch;
    const fallback = {
      schemaVersion: 2,
      generatedAt: "2099-02-01T00:00:00.000Z",
      disclaimer: "Public-record fallback",
      stats: {
        records: 0,
        people: 0,
        organizations: 0,
        sources: 0,
        liveSources: 0,
        knownOrReportedValues: 0,
        estimates: 0,
        privateCompanyEvents: 0,
        preCloseSignals: 0,
        highConfidenceEstimates: 0,
        secEstimateShare: 0,
      },
      records: [],
      peopleInMotion: [],
      sourceHealth: [],
    };
    vi.stubEnv("NODE_ENV", "");
    vi.stubEnv("VITEST", "");
    global.fetch = vi.fn(async (input) => {
      if (String(input).includes("raw.githubusercontent.com")) {
        return new Response(null, { status: 503 });
      }
      return new Response(gzipSync(JSON.stringify(fallback)), { status: 200 });
    }) as typeof fetch;

    try {
      vi.resetModules();
      const { loadCurrentMotionSnapshot } =
        await import("../../lib/server-motion-snapshot");
      const snapshot = await loadCurrentMotionSnapshot("https://radar.test/");

      expect(snapshot.generatedAt).toBe(fallback.generatedAt);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenLastCalledWith(
        new URL("https://radar.test/data/money-in-motion-client.json.gz"),
        { cache: "no-store" },
      );
    } finally {
      global.fetch = originalFetch;
      vi.unstubAllEnvs();
    }
  });

  it("serves the current v2 snapshot through the same-origin refresh endpoint", async () => {
    const response = await getPublicSnapshot();
    const payload = (await response.json()) as {
      schemaVersion: number;
      peopleInMotion: unknown[];
    };
    expect(response.status).toBe(200);
    expect(payload.schemaVersion).toBe(2);
    expect(payload.peopleInMotion.length).toBeGreaterThan(0);
    expect(response.headers.get("cache-control")).toMatch(/s-maxage=900/);
  });

  it("requires an authenticated API request", async () => {
    const response = await GET(
      new Request("https://radar.test/api/v1/people-in-motion"),
    );
    expect(response.status).toBe(401);
  });

  it("returns filterable person-first public records", async () => {
    const response = await GET(
      new Request(
        "https://radar.test/api/v1/people-in-motion?market_class=PRIVATE&date_window_days=5000&limit=5",
        { headers: { authorization: "Bearer lr_demo_local_2026" } },
      ),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: Array<{ marketClass: string; evidence: unknown[] }>;
      meta: { returned: number; available: number; schema_version: number };
    };
    expect(payload.meta.schema_version).toBe(2);
    expect(payload.meta.available).toBeGreaterThan(0);
    expect(payload.data.length).toBeGreaterThan(0);
    expect(payload.data.length).toBeLessThanOrEqual(5);
    expect(
      payload.data.every((person) => person.marketClass === "PRIVATE"),
    ).toBe(true);
    expect(payload.data.every((person) => person.evidence.length > 0)).toBe(
      true,
    );
  });

  it("supports a typed minimum and maximum value range", async () => {
    const response = await GET(
      new Request(
        "https://radar.test/api/v1/people-in-motion?minimum_amount=1000000&maximum_amount=10000000&limit=25",
        { headers: { authorization: "Bearer lr_demo_local_2026" } },
      ),
    );
    const payload = (await response.json()) as {
      data: Array<{ estimatedLiquidityHigh: number | null }>;
    };
    expect(response.status).toBe(200);
    expect(payload.data.length).toBeGreaterThan(0);
    expect(
      payload.data.every(
        (person) =>
          person.estimatedLiquidityHigh !== null &&
          person.estimatedLiquidityHigh >= 1_000_000 &&
          person.estimatedLiquidityHigh <= 10_000_000,
      ),
    ).toBe(true);
  });
});
