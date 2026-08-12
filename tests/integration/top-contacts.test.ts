import { describe, expect, it } from "vitest";
import { GET } from "../../app/api/v1/top-contacts/route";
import type { TopContactRecommendation } from "../../lib/top-contacts";

const headers = { authorization: "Bearer lr_demo_local_2026" };

describe("Top Contacts API", () => {
  it("requires authentication", async () => {
    const response = await GET(
      new Request("http://localhost/api/v1/top-contacts"),
    );
    expect(response.status).toBe(401);
  });

  it("returns ten evidence-backed Chicago Metro recommendations by default", async () => {
    const response = await GET(
      new Request("http://localhost/api/v1/top-contacts", { headers }),
    );
    const body = (await response.json()) as {
      data: TopContactRecommendation[];
      stats: { eligiblePeople: number; visibleRecommendations: number };
      meta: { geographyId: string; schemaVersion: number };
    };
    expect(response.status).toBe(200);
    expect(body.meta.geographyId).toBe("CHICAGO_METRO");
    expect(body.meta.schemaVersion).toBe(1);
    expect(body.data).toHaveLength(10);
    expect(body.stats.eligiblePeople).toBeGreaterThanOrEqual(10);
    expect(
      body.data.every(
        (recommendation) =>
          (recommendation.primaryEvent.ownershipEvidence ||
            recommendation.primaryEvent.eventType ===
              "COMMERCIAL_REAL_ESTATE_SALE") &&
          recommendation.contactPriorityScore <= 100 &&
          recommendation.whyNow.length > 30,
      ),
    ).toBe(true);
    expect(new Set(body.data.map((item) => item.personId)).size).toBe(10);
  }, 15_000);

  it("supports Cook, DuPage, priority, and proceeds filters", async () => {
    for (const [location, county] of [
      ["COOK", "Cook"],
      ["DUPAGE", "DuPage"],
    ] as const) {
      const response = await GET(
        new Request(
          `http://localhost/api/v1/top-contacts?location=${location}&min_priority=1&min_proceeds=1&limit=5`,
          { headers },
        ),
      );
      const body = (await response.json()) as {
        data: TopContactRecommendation[];
      };
      expect(response.status).toBe(200);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data.length).toBeLessThanOrEqual(5);
      expect(body.data.every((item) => item.county.includes(county))).toBe(
        true,
      );
    }
  });

  it("does not expose homes, private phone numbers, or guessed emails", async () => {
    const response = await GET(
      new Request("http://localhost/api/v1/top-contacts", { headers }),
    );
    const body = (await response.json()) as {
      data: TopContactRecommendation[];
    };
    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toContain("mailto:");
    expect(serialized).not.toContain("personal_phone");
    expect(serialized).not.toContain("private phone");
    expect(body.data.every((item) => /^[^,]+, IL$/.test(item.location))).toBe(
      true,
    );
    expect(
      body.data
        .flatMap((item) => item.contacts)
        .every((contact) =>
          [
            "BUSINESS_EMAIL",
            "WORK_PHONE",
            "COMPANY_WEBSITE",
            "CONTACT_PAGE",
            "PROFESSIONAL_PROFILE",
          ].includes(contact.type),
        ),
    ).toBe(true);
  });
});
