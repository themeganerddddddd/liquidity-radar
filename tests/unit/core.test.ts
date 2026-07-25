import { describe, expect, it } from "vitest";
import {
  addRanges,
  confidenceScore,
  matchScore,
  mulberry32,
  normalizeEntityName,
  privateExitEstimate,
  publicSaleEstimate,
  radarScore,
  recencyScore,
  restrictedUseAllowed,
  subtractRanges,
} from "../../lib/core";

describe("money-range arithmetic", () => {
  it("adds ranges", () => {
    expect(
      addRanges({ low: 1, median: 2, high: 3 }, { low: 4, median: 5, high: 6 }),
    ).toEqual({
      low: 5,
      median: 7,
      high: 9,
    });
  });

  it("subtracts conservatively and never below zero", () => {
    expect(
      subtractRanges(
        { low: 10, median: 20, high: 30 },
        { low: 4, median: 6, high: 12 },
      ),
    ).toEqual({
      low: 0,
      median: 14,
      high: 26,
    });
  });
});

describe("deterministic estimation", () => {
  it("reproduces seeded random values", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(Array.from({ length: 8 }, () => a())).toEqual(
      Array.from({ length: 8 }, () => b()),
    );
  });

  it("returns ordered private-exit percentiles", () => {
    const output = privateExitEstimate(20260724, 10_000, {
      enterpriseValue: {
        low: 360_000_000,
        median: 410_000_000,
        high: 470_000_000,
      },
      debt: { low: 20_000_000, median: 30_000_000, high: 45_000_000 },
      cash: { low: 8_000_000, median: 12_000_000, high: 18_000_000 },
      ownership: { low: 0.18, median: 0.22, high: 0.27 },
      cashConsideration: { low: 0.72, median: 0.84, high: 0.94 },
      deductions: { low: 12_000_000, median: 18_000_000, high: 28_000_000 },
    });
    expect(output.low).toBeLessThan(output.median);
    expect(output.median).toBeLessThan(output.high);
    expect(output.low).toBeGreaterThan(0);
  });

  it("calculates a public sale and tax range", () => {
    expect(publicSaleEstimate(120_000, 42.5, 0.25, 0.4)).toEqual({
      gross: 5_100_000,
      net: { low: 3_060_000, median: 3_442_500, high: 3_825_000 },
    });
  });
});

describe("scores and rules", () => {
  it("computes the documented confidence weights", () => {
    expect(
      confidenceScore({
        sourceReliability: 90,
        transactionCertainty: 90,
        identityCertainty: 100,
        ownershipCertainty: 70,
        considerationCertainty: 80,
        completionCertainty: 100,
        taxCertainty: 60,
        deploymentCoverage: 50,
        recency: 100,
      }),
    ).toBe(86);
  });

  it("decays recency and bounds composite scores", () => {
    expect(recencyScore(0)).toBe(100);
    expect(recencyScore(365)).toBe(50);
    expect(
      radarScore({
        remainingMedian: 75_000_000,
        confidence: 84,
        recency: 92,
        uncommittedProbability: 0.8,
        deploymentPropensity: 0.74,
        actionability: 81,
      }),
    ).toBeGreaterThan(60);
    expect(
      matchScore({
        capacity: 0.9,
        confidence: 0.85,
        sectorAffinity: 0.95,
        geographicAffinity: 0.8,
        checkSizeFit: 0.88,
        deploymentPropensity: 0.78,
        recency: 0.9,
      }),
    ).toBeGreaterThan(80);
  });

  it("normalizes entity names and blocks restricted uses", () => {
    expect(normalizeEntityName("Northstar BioSystems, Inc.")).toBe(
      "northstar biosystems",
    );
    expect(restrictedUseAllowed("Fundraising research")).toBe(true);
    expect(restrictedUseAllowed("Employment screening workflow")).toBe(false);
    expect(restrictedUseAllowed("Housing screening")).toBe(false);
  });
});
