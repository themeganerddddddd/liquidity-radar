import { describe, expect, it } from "vitest";
import snapshotJson from "../../public/data/public-signals.json";
import {
  buildRealPeople,
  compareDirectoryPeople,
  estimateLiquidity,
} from "../../app/RealPeople";
import type {
  PublicDataSnapshot,
  PublicLiquidityEvent,
} from "../../lib/public-data";
import {
  formatMetroLocation,
  normalizePublicLocation,
} from "../../lib/public-locations";

describe("real people profiles", () => {
  it("builds profiles only from attributable SEC reporting-party names", () => {
    const data = snapshotJson as PublicDataSnapshot;
    const people = buildRealPeople(data);
    const namedFilings = data.sec.filings.filter(
      (filing) => filing.reportingParty.trim().length > 0,
    );

    expect(people.length).toBeGreaterThan(20);
    expect(people.flatMap((person) => person.filings)).toHaveLength(
      namedFilings.length,
    );
    expect(
      people.every(
        (person) =>
          person.name.length > 0 &&
          person.issuers.length > 0 &&
          person.filings.every(
            (filing) => filing.reportingParty.trim().length > 0,
          ),
      ),
    ).toBe(true);
  });

  it("does not add modeled wealth or liquidity fields to a person profile", () => {
    const [person] = buildRealPeople(snapshotJson as PublicDataSnapshot);

    expect(person).not.toHaveProperty("netWorth");
    expect(person).not.toHaveProperty("liquidity");
    expect(person).not.toHaveProperty("cash");
    expect(person).not.toHaveProperty("radarScore");
  });

  it("adds a named completed-exit recipient only from linked SEC ownership evidence", () => {
    const people = buildRealPeople(snapshotJson as PublicDataSnapshot);
    const mario = people.find(
      (person) => person.name === "Mario Alberto Accardi",
    );

    expect(mario).toBeDefined();
    expect(mario?.grossCompletedExitCash).toBe(9_244_716);
    expect(mario?.exitAttributions[0]).toMatchObject({
      owner: {
        sourceType: "Form 4",
        amountClassification: "calculated",
      },
      exit: {
        status: "completed",
        accession: "0001193125-26-280337",
      },
    });
  });

  it("estimates a range from completed sales and excludes proposed sales", () => {
    const base: PublicLiquidityEvent = {
      id: "sale",
      accession: "0001",
      form: "Form 4",
      status: "completed",
      eventType: "completed_public_share_sale",
      reportingParty: "Example Person",
      reportingPartyCik: "1",
      issuer: "Example Co",
      issuerCik: "2",
      issuerSymbol: "EX",
      relationship: "Officer",
      transactionDate: "2026-01-01",
      filingDate: "2026-01-02",
      securityTitle: "Common Stock",
      shares: 100_000,
      pricePerShare: 10,
      grossAmount: 1_000_000,
      amountClassification: "calculated",
      transactionCode: "S",
      directOrIndirect: "D",
      sharesOwnedAfter: 50_000,
      broker: "",
      location: { city: "", state: "", country: "" },
      sourceUrl: "https://www.sec.gov/example",
      note: "",
    };
    const proposed: PublicLiquidityEvent = {
      ...base,
      id: "proposal",
      form: "Form 144",
      status: "proposed",
      eventType: "proposed_public_share_sale",
      grossAmount: 5_000_000,
      transactionCode: "144",
    };
    const estimate = estimateLiquidity([base, proposed], "2026-01-01");

    expect(estimate.grossCompletedSales).toBe(1_000_000);
    expect(estimate.estimatedNetProceeds).toEqual({
      low: 480_000,
      median: 630_000,
      high: 780_000,
    });
    expect(estimate.estimatedRemainingLiquidity).toEqual(
      estimate.estimatedNetProceeds,
    );
  });

  it("standardizes public locations in country, full state, city order", () => {
    expect(
      normalizePublicLocation({
        country: "",
        state: "TX",
        city: "HOUSTON",
      }),
    ).toMatchObject({
      country: "United States",
      state: "Texas",
      city: "Houston",
      stateCode: "TX",
      display: "United States · Texas · Houston",
    });
    expect(
      normalizePublicLocation({
        country: "ONTARIO, CANADA",
        state: "A6",
        city: "TORONTO",
      }).display,
    ).toBe("Canada · Ontario · Toronto");
    expect(formatMetroLocation("Austin-Round Rock-San Marcos, TX")).toBe(
      "United States · Texas · Austin-Round Rock-San Marcos (city/metro area)",
    );
  });

  it("ranks completed gross proceeds in both directions", () => {
    const people = buildRealPeople(snapshotJson as PublicDataSnapshot);
    const gross = (person: (typeof people)[number]) =>
      person.grossCompletedSales + person.grossCompletedExitCash;
    const descending = [...people].sort((left, right) =>
      compareDirectoryPeople(left, right, "gross", "desc"),
    );
    const ascending = [...people].sort((left, right) =>
      compareDirectoryPeople(left, right, "gross", "asc"),
    );

    expect(gross(descending[0])).toBeGreaterThanOrEqual(
      gross(descending.at(-1)!),
    );
    expect(gross(ascending[0])).toBeLessThanOrEqual(gross(ascending.at(-1)!));
  });
});
