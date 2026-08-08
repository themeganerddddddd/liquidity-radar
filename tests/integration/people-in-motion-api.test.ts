import { describe, expect, it } from "vitest";
import { GET } from "../../app/api/v1/people-in-motion/route";

describe("People in Motion API", () => {
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
