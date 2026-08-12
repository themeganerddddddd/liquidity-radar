import { describe, expect, it } from "vitest";
import { GET } from "../../app/api/v1/seller-intelligence/route";
import type { SellerIntelligenceProfile } from "../../lib/seller-intelligence";

describe("production Seller Intelligence contracts", () => {
  it("requires authentication and returns aggregated seller profiles", async () => {
    expect(
      (await GET(new Request("http://localhost/api/v1/seller-intelligence")))
        .status,
    ).toBe(401);
    const response = await GET(
      new Request("http://localhost/api/v1/seller-intelligence?limit=5", {
        headers: { authorization: "Bearer lr_demo_local_2026" },
      }),
    );
    const body = (await response.json()) as {
      data: SellerIntelligenceProfile[];
      meta: { returned: number; available: number };
      stats: { unresolvedSellers: number; recordedDispositions: number };
    };
    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(5);
    expect(body.meta.available).toBeGreaterThan(5_000);
    expect(body.stats.unresolvedSellers).toBeGreaterThan(1_000);
    expect(body.stats.recordedDispositions).toBeGreaterThan(50_000_000_000);
    expect(
      body.data.every(
        (profile) => profile.dispositions.length === profile.dispositionCount,
      ),
    ).toBe(true);
  });

  it("supports high-value unresolved and exit filters without inventing ownership", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/v1/seller-intelligence?min_value=25000000&owner_found=false&limit=20",
        { headers: { authorization: "Bearer lr_demo_local_2026" } },
      ),
    );
    const body = (await response.json()) as {
      data: SellerIntelligenceProfile[];
      meta: { matched: number };
    };
    expect(response.status).toBe(200);
    expect(body.meta.matched).toBeGreaterThan(10);
    expect(
      body.data.every(
        (profile) =>
          !profile.ownerFound &&
          profile.totalRecordedConsideration >= 25_000_000,
      ),
    ).toBe(true);
  });
});
