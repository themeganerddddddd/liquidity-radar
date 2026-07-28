import path from "node:path";
import { describe, expect, it } from "vitest";
import publicSignalsJson from "../../public/data/public-signals.json";
import type { PublicDataSnapshot } from "../../lib/public-data";
import { readChunkedPublicSnapshot } from "../../scripts/public-snapshot-files";

const publicSignals = publicSignalsJson as PublicDataSnapshot;

describe("official public-record contracts", () => {
  it("ships validated coverage from eight government source families", () => {
    expect(publicSignals.sources).toHaveLength(8);
    expect(new Set(publicSignals.sources.map((source) => source.id))).toEqual(
      new Set([
        "sec",
        "sec_exits",
        "adv",
        "irs",
        "census",
        "census_geo",
        "bea",
        "ftc",
      ]),
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
    expect(publicSignals.exitSignals?.records.length).toBeGreaterThan(0);
    expect(publicSignals.completedExits?.records.length).toBeGreaterThanOrEqual(
      5,
    );
    expect(
      publicSignals.completedExits?.records.some((record) =>
        record.ownerAttributions.some((owner) => owner.kind === "person"),
      ),
    ).toBe(true);
    expect(publicSignals.geography?.metros.length).toBeGreaterThan(300);
    expect(publicSignals.geography?.places.length).toBeGreaterThan(100);
  });

  it("does not label official records as fictional demonstration data", () => {
    expect(JSON.stringify(publicSignals).toLowerCase()).not.toContain(
      "fictional",
    );
    expect(JSON.stringify(publicSignals).toLowerCase()).not.toContain(
      "demo account",
    );
  });

  it("reconstructs the complete chunked liquidity history", async () => {
    const hydrated = await readChunkedPublicSnapshot(
      path.join(process.cwd(), "public", "data", "public-signals.json"),
    );

    expect(publicSignals.liquidity.chunkUrls?.length).toBe(12);
    expect(hydrated.liquidity.events.length).toBeGreaterThan(40_000);
    expect(
      new Set(hydrated.liquidity.events.map((event) => event.id)).size,
    ).toBe(hydrated.liquidity.events.length);
  });
});
