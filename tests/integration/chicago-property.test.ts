import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ChicagoPropertySnapshot } from "../../lib/chicago-property";
import { GET } from "../../app/api/v1/chicago-property/route";

let snapshotPromise: Promise<ChicagoPropertySnapshot> | null = null;

function loadSnapshot() {
  snapshotPromise ||= readFile(
    path.join(
      process.cwd(),
      "public",
      "data",
      "chicago-property-client.json.gz",
    ),
  ).then(
    (bytes) =>
      JSON.parse(gunzipSync(bytes).toString("utf8")) as ChicagoPropertySnapshot,
  );
  return snapshotPromise;
}

describe("production Chicago Property contracts", () => {
  it("ships a real, official 2022-present property snapshot", async () => {
    const snapshot = await loadSnapshot();
    expect(snapshot.records.length).toBeGreaterThan(10_000);
    expect(snapshot.coverage.startDate).toMatch(/^2022-/);
    expect(snapshot.stats.commercialSales).toBeGreaterThan(8_000);
    expect(snapshot.stats.largeResidentialSales).toBeGreaterThan(2_000);
    expect(snapshot.stats.recordedTransactionValue).toBeGreaterThan(
      50_000_000_000,
    );
    expect(snapshot.stats.ptaxMatches).toBeGreaterThan(9_000);
    expect(snapshot.stats.cookSales).toBeGreaterThan(10_000);
    expect(snapshot.stats.dupageSales).toBeGreaterThan(1_000);
    expect(snapshot.stats.dupageRecordedValue).toBeGreaterThan(1_000_000_000);
    expect(snapshot.stats.crossCountySellerEntities).toBeGreaterThan(0);
    expect(
      snapshot.records
        .filter((record) => record.property.county === "DuPage")
        .some(
          (record) =>
            record.property.latitude !== null &&
            record.evidence.some(
              (evidence) => evidence.sourceId === "dupage_property_lookup",
            ),
        ),
    ).toBe(true);
    expect(snapshot.sourceHealth.map((source) => source.id)).toEqual(
      expect.arrayContaining([
        "cook_property_sales",
        "illinois_ptax",
        "cook_transfer_forms",
        "cook_parcel_addresses",
        "cook_commercial_valuation",
        "cook_parcel_universe",
        "dupage_parcel_gis",
        "chicago_business_licenses",
        "chicago_business_owners",
      ]),
    );
    expect(
      snapshot.sourceHealth.every((source) =>
        source.sourceUrl.startsWith("https://"),
      ),
    ).toBe(true);
  });

  it("does not duplicate multi-parcel value or classify legal entities as people", async () => {
    const snapshot = await loadSnapshot();
    expect(new Set(snapshot.records.map((record) => record.id)).size).toBe(
      snapshot.records.length,
    );
    expect(
      snapshot.records
        .filter((record) => record.transaction.multiParcel)
        .every(
          (record) =>
            record.property.parcelCount > 1 &&
            record.transaction.displayValueHigh ===
              record.proceeds.recordedSaleConsideration,
        ),
    ).toBe(true);
    expect(
      snapshot.records
        .filter((record) => record.sellerPerson)
        .some((record) =>
          /\b(?:L L C|LLC|L P|LP|INC|CORP|HOLDINGS?|PROPERTIES)\b/i.test(
            record.sellerPerson,
          ),
        ),
    ).toBe(false);
  });

  it("keeps sale consideration separate from person-level and net proceeds", async () => {
    const snapshot = await loadSnapshot();
    expect(
      snapshot.records.every(
        (record) =>
          record.proceeds.netProceedsKnown === false &&
          record.proceeds.grossAttributableValue === null &&
          record.proceeds.potentialProceedsLow === null &&
          record.proceeds.potentialProceedsHigh === null,
      ),
    ).toBe(true);
    expect(JSON.stringify(snapshot.records).toLowerCase()).not.toContain(
      "owner mailing",
    );
  });

  it("requires authentication and supports the requested API filters", async () => {
    const unauthorized = await GET(
      new Request("http://localhost/api/v1/chicago-property"),
    );
    expect(unauthorized.status).toBe(401);

    const response = await GET(
      new Request(
        "http://localhost/api/v1/chicago-property?county=DuPage&commercial_only=true&min_value=10000000&person_resolved=false&limit=5",
        { headers: { authorization: "Bearer lr_demo_local_2026" } },
      ),
    );
    const payload = (await response.json()) as {
      data: ChicagoPropertySnapshot["records"];
      meta: { returned: number; matched: number };
    };
    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(5);
    expect(payload.meta.matched).toBeGreaterThan(100);
    expect(
      payload.data.every(
        (record) =>
          record.property.commercial &&
          record.property.county === "DuPage" &&
          !record.sellerPerson &&
          (record.transaction.displayValueHigh || 0) >= 10_000_000,
      ),
    ).toBe(true);
  });
});
