import { describe, expect, it } from "vitest";
import type { PublicLiquidityEvent } from "../../lib/public-data";
import {
  normalizeReportedTransactionValue,
  uniqueCompletedSaleGross,
} from "../../lib/valuation-safety";

describe("public filing valuation normalization", () => {
  it("treats the Scorpio filing value as aggregate proceeds", () => {
    expect(
      normalizeReportedTransactionValue({
        accession: "0001969452-26-000010",
        issuerCik: "0001483934",
        shares: 15_000,
        reportedPrice: 1_230_435,
      }),
    ).toMatchObject({
      pricePerShare: 82.029,
      grossAmount: 1_230_435,
      priceBasis: "derived_from_reported_aggregate",
    });
  });

  it("treats InnSuites filing totals as aggregate transaction values", () => {
    expect(
      normalizeReportedTransactionValue({
        accession: "0001493152-25-023667",
        issuerCik: "0000082473",
        shares: 12_500,
        reportedPrice: 18_090,
      }),
    ).toMatchObject({
      pricePerShare: 1.4472,
      grossAmount: 18_090,
      priceBasis: "derived_from_reported_aggregate",
    });
  });

  it.each([
    ["0000316011-25-000073", 55_908, 1_031_414, 1_031.414],
    ["0001193125-25-316075", 2_843, 79_198, 79.198],
    ["0001823400-26-000002", 35_856, 4_015, 40.15],
  ])(
    "repairs a source-verified omitted decimal for %s",
    (accession, shares, reportedPrice, expectedPrice) => {
      const result = normalizeReportedTransactionValue({
        accession,
        issuerCik: "",
        shares,
        reportedPrice,
      });
      expect(result.pricePerShare).toBe(expectedPrice);
      expect(result.grossAmount).toBeCloseTo(shares * expectedPrice, 6);
      expect(result.priceBasis).toBe("normalized_filing_decimal");
    },
  );

  it.each([
    ["Booking Holdings", "0001075531-25-000099", 12, 5_200],
    ["Global Macro Trust", "0001294572-25-000004", 139.47, 388_138],
  ])(
    "does not guess that a legitimate or unverified high price for %s is malformed",
    (_issuer, accession, shares, reportedPrice) => {
      expect(
        normalizeReportedTransactionValue({
          accession,
          issuerCik: "",
          shares,
          reportedPrice,
        }),
      ).toMatchObject({
        pricePerShare: reportedPrice,
        grossAmount: shares * reportedPrice,
        priceBasis: "reported_per_share",
      });
    },
  );

  it("counts a joint filing transaction once across co-reporters", () => {
    const event = {
      id: "sec345-0000000000-26-000001-42-0000000001",
      eventType: "completed_public_share_sale",
      reportingPartyCik: "0000000001",
      grossAmount: 2_500_000,
    } as PublicLiquidityEvent;
    const coReporter = {
      ...event,
      id: "sec345-0000000000-26-000001-42-0000000002",
      reportingPartyCik: "0000000002",
    };

    expect(uniqueCompletedSaleGross([event, coReporter])).toBe(2_500_000);
  });
});
