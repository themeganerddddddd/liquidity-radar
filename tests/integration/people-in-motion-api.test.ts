import { describe, expect, it, vi } from "vitest";
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
        expect.objectContaining({ cache: "force-cache" }),
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
});
