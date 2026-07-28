import { describe, expect, it } from "vitest";
import publicSignalsJson from "../../public/data/public-signals.json";
import type { PublicDataSnapshot } from "../../lib/public-data";

const publicSignals = publicSignalsJson as PublicDataSnapshot;

describe("official public-record contracts", () => {
  it("ships validated coverage from five government source families", () => {
    expect(publicSignals.sources).toHaveLength(5);
    expect(new Set(publicSignals.sources.map((source) => source.id))).toEqual(
      new Set(["sec", "adv", "irs", "census", "bea"]),
    );
    expect(
      publicSignals.sources.every((source) =>
        source.sourceUrl.startsWith("https://"),
      ),
    ).toBe(true);
  });

  it("covers every state and the District of Columbia", () => {
    expect(publicSignals.businessFormation.states).toHaveLength(51);
    expect(publicSignals.regionalEconomy.states).toHaveLength(51);
    expect(
      new Set(publicSignals.businessFormation.states.map((state) => state.code))
        .size,
    ).toBe(51);
  });

  it("contains attributable filing and institutional records", () => {
    expect(publicSignals.sec.filings.length).toBeGreaterThanOrEqual(10);
    expect(publicSignals.advisers.firmCount).toBeGreaterThan(10_000);
    expect(publicSignals.advisers.topFirms.length).toBeGreaterThan(0);
    expect(publicSignals.foundations.filingCount).toBeGreaterThan(10_000);
    expect(publicSignals.foundations.recentFilings.length).toBeGreaterThan(0);
  });

  it("does not label official records as fictional demonstration data", () => {
    expect(JSON.stringify(publicSignals).toLowerCase()).not.toContain(
      "fictional",
    );
    expect(JSON.stringify(publicSignals).toLowerCase()).not.toContain(
      "demo account",
    );
  });
});
