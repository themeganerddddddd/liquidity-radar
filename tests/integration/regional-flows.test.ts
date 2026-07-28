import { describe, expect, it } from "vitest";
import publicSignalsJson from "../../public/data/public-signals.json";
import type { PublicDataSnapshot } from "../../lib/public-data";

const data = publicSignalsJson as PublicDataSnapshot;

describe("state public-record relationships", () => {
  it("joins Census and BEA coverage by jurisdiction code", () => {
    const censusCodes = new Set(
      data.businessFormation.states.map((state) => state.code),
    );
    const beaCodes = new Set(
      data.regionalEconomy.states.map((state) => state.code),
    );
    expect(beaCodes).toEqual(censusCodes);
  });

  it("contains nonnegative state applications and projections", () => {
    for (const state of data.businessFormation.states) {
      expect(state.applications).toBeGreaterThanOrEqual(0);
      expect(state.projectedFormations).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps adviser assets attached to reported state summaries", () => {
    expect(data.advisers.states.length).toBeGreaterThan(40);
    for (const state of data.advisers.states) {
      expect(state.firms).toBeGreaterThanOrEqual(0);
      expect(state.regulatoryAssets).toBeGreaterThanOrEqual(0);
    }
  });

  it("preserves direct SEC filing links and accession identifiers", () => {
    for (const filing of data.sec.filings) {
      expect(filing.accession).toMatch(/\d{10}-\d{2}-\d{6}/);
      expect(filing.url).toMatch(/^https:\/\/www\.sec\.gov\//);
    }
  });
});
