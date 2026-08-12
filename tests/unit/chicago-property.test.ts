import { describe, expect, it } from "vitest";
import {
  applyRepeatedSellerHistory,
  classifyPropertyCategory,
  classifySaleQuality,
  clusterCookSales,
  estimatePropertyValue,
  exitConvergence,
  finalizeChicagoRecords,
  hasMaterialValueDiscrepancy,
  isQualifiedPropertyMotionRecord,
  normalizePin,
  propertyMotionEvents,
  resolveBusinessSeller,
  type BusinessLicenseRow,
  type BusinessOwnerRow,
  type ChicagoPropertyRecord,
  type PropertyTransactionDraft,
} from "../../lib/chicago-property";
import type { MoneyMotionRecord } from "../../lib/money-in-motion";

function draft(
  overrides: Partial<PropertyTransactionDraft> = {},
): PropertyTransactionDraft {
  return {
    transactionKey: "DOC:123",
    county: "Cook",
    cookRowIds: ["row-1"],
    declarationIds: ["dec-1"],
    seller: "Smith Industrial LLC",
    buyer: "Acme Buyer LLC",
    saleDate: "2026-06-01",
    documentNumber: "123",
    deedTypes: ["SPECIAL WARRANTY DEED"],
    pins: ["01020300400000"],
    sourceClasses: ["5-93"],
    cookSalePrice: 5_000_000,
    ptaxFullConsideration: 5_000_000,
    ptaxNetConsideration: 4_900_000,
    ptaxTaxableConsideration: 4_900_000,
    address: "100 W Lake St",
    city: "Chicago",
    state: "IL",
    zip: "60601",
    ptaxUseCode: "I",
    ptaxUseDescription: "Industrial",
    relationshipFlags: [],
    multiParcel: false,
    reportedParcelCount: 1,
    additionalSellersReported: false,
    additionalBuyersReported: false,
    ptax203AAttached: false,
    ptax203BAttached: false,
    ...overrides,
  };
}

const license: BusinessLicenseRow = {
  accountNumber: "1001",
  legalName: "Smith Industrial LLC",
  dba: "Smith Works",
  city: "Chicago",
  state: "IL",
  zip: "60601",
  applicationType: "AAC",
  status: "AAC",
  statusChangeDate: "2026-06-20",
  description: "Manufacturing",
};

const owner: BusinessOwnerRow = {
  accountNumber: "1001",
  dba: "Smith Works",
  firstName: "Jane",
  middleInitial: "Q",
  lastName: "Smith",
  suffix: "",
  entityName: "",
  title: "Owner",
};

function finalize(
  inputDraft: PropertyTransactionDraft,
  licenses: BusinessLicenseRow[] = [],
  owners: BusinessOwnerRow[] = [],
  motionRecords: MoneyMotionRecord[] = [],
) {
  return finalizeChicagoRecords({
    drafts: [inputDraft],
    addressesByPin: {
      "01020300400000": {
        pin: "01020300400000",
        year: 2026,
        address: "100 W Lake St",
        city: "Chicago",
        state: "Illinois",
        zip: "60601",
      },
    },
    geographyByPin: {
      "01020300400000": {
        pin: "01020300400000",
        year: 2026,
        city: "Chicago",
        zip: "60601",
        latitude: 41.885,
        longitude: -87.63,
      },
    },
    commercialByPin: {},
    transferFormUseByDeclaration: {},
    licenses,
    owners,
    motionRecords,
    generatedAt: "2026-08-11T00:00:00.000Z",
  }).records[0];
}

describe("Chicago Property normalization", () => {
  it("clusters a multi-parcel portfolio sale once", () => {
    const rows = ["01020300400000", "01020300400001", "01020300400002"].map(
      (pin, index) => ({
        ":id": `row-${index}`,
        pin,
        doc_no: "2615300012",
        sale_date: "2026-06-01T00:00:00.000",
        sale_price: "18000000",
        seller_name: "Portfolio Seller LLC",
        buyer_name: "Portfolio Buyer LLC",
        deed_type: "WARRANTY DEED",
        is_multisale: "true",
        num_parcels_sale: "3",
        class: "5-93",
      }),
    );
    const result = clusterCookSales(rows);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      cookSalePrice: 18_000_000,
      multiParcel: true,
    });
    expect(result[0].pins).toHaveLength(3);
  });

  it.each([
    [{ cookSalePrice: 5_000_000 }, "MARKET_SALE"],
    [{ cookSalePrice: 10, ptaxFullConsideration: 10 }, "NOMINAL_CONSIDERATION"],
    [{ deedTypes: ["QUIT CLAIM DEED"] }, "INTERNAL_TRANSFER"],
    [{ deedTypes: ["TRUST DEED"] }, "TRUST_TRANSFER"],
    [{ buyer: "SMITH INDUSTRIAL L.L.C." }, "INTERNAL_TRANSFER"],
    [{ relationshipFlags: ["RELATED_PARTIES"] }, "FAMILY_OR_RELATED_TRANSFER"],
    [{ relationshipFlags: ["SHORT_SALE"] }, "FORECLOSURE_OR_DISTRESS"],
  ])(
    "classifies transaction quality without turning conveyances into liquidity (%s)",
    (overrides, expected) => {
      expect(classifySaleQuality(draft(overrides)).quality).toBe(expected);
    },
  );

  it("prefers official property-use fields over names", () => {
    expect(
      classifyPropertyCategory({
        sourceClasses: ["2-00"],
        ptaxUseCode: "F",
        ptaxUseDescription: "Office building",
        commercialValuations: [],
      }),
    ).toMatchObject({
      category: "OFFICE",
      basis: "Illinois PTAX-203 reported property use",
    });
  });

  it("uses official DuPage parcel class and preserves one metro identity", () => {
    expect(
      classifyPropertyCategory({
        sourceClasses: ["DUPAGE-R"],
        ptaxUseCode: "",
        ptaxUseDescription: "",
        commercialValuations: [],
      }),
    ).toMatchObject({ category: "RESIDENTIAL_LUXURY" });
    const cook = finalize(draft({ seller: "Metro Seller LLC" }));
    const dupage = structuredClone(cook);
    dupage.id = "dupage-record";
    dupage.transactionKey = "DUPAGE:DOC:456";
    dupage.property.county = "DuPage";
    const repeated = applyRepeatedSellerHistory([cook, dupage]);
    expect(
      repeated.every((record) => record.repeatedSeller.transactionCount === 2),
    ).toBe(true);
  });

  it("normalizes 14-character PINs and detects material Cook/PTAX discrepancies", () => {
    expect(normalizePin("01-02-030-040-0000")).toBe("01020300400000");
    expect(hasMaterialValueDiscrepancy(5_000_000, 5_050_000)).toBe(false);
    expect(hasMaterialValueDiscrepancy(5_000_000, 7_000_000)).toBe(true);
  });

  it("resolves exact legal entities through account-number owners without inventing ownership", () => {
    const match = resolveBusinessSeller({
      seller: "SMITH INDUSTRIAL L.L.C.",
      licenses: [license],
      owners: [owner],
    });
    expect(match).toMatchObject({
      accountNumber: "1001",
      resolutionMethod: "NORMALIZED_ENTITY_NAME",
      owners: [
        {
          name: "Jane Q Smith",
          role: "OWNER",
          ownershipPercentage: null,
        },
      ],
    });
  });

  it("rejects fuzzy and common-person-name business false positives", () => {
    expect(
      resolveBusinessSeller({
        seller: "Smith Industries LLC",
        licenses: [{ ...license, legalName: "Smythe Industry LLC" }],
        owners: [owner],
      }),
    ).toBeNull();
    expect(
      resolveBusinessSeller({
        seller: "John Smith",
        licenses: [{ ...license, legalName: "John Smith" }],
        owners: [{ ...owner, firstName: "John", lastName: "Smith" }],
      }),
    ).toBeNull();
  });

  it("resolves one public owner, retains the LLC, and detects a nearby license cancellation", () => {
    const record = finalize(draft(), [license], [owner]);
    expect(record).toMatchObject({
      sellerPerson: "Jane Q Smith",
      sellerEntity: "Smith Industrial LLC",
      resolutionMethod: "EXACT_LEGAL_NAME",
    });
    expect(record.businessMatch?.owners[0].ownershipPercentage).toBeNull();
    expect(record.exitConvergence.components.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "commercial_disposition",
        "business_owner_resolution",
        "license_cancellation",
      ]),
    );
  });

  it("does not mistake spaced legal suffixes for a person", () => {
    const record = finalize(draft({ seller: "Superior Washtenaw L L C" }));
    expect(record.sellerPerson).toBe("");
    expect(record.sellerEntity).toBe("Superior Washtenaw L L C");
  });

  it("keeps a personally titled large-home sale secondary unless separate exit evidence exists", () => {
    const home = finalize(
      draft({
        seller: "John Q Public",
        cookSalePrice: 3_800_000,
        ptaxFullConsideration: 3_800_000,
        ptaxUseCode: "B",
        ptaxUseDescription: "Residence",
        sourceClasses: ["2-00"],
      }),
    );
    expect(home.property.largeResidential).toBe(true);
    expect(home.exitConvergence.score).toBe(5);
    expect(isQualifiedPropertyMotionRecord(home)).toBe(false);

    const businessSale = {
      id: "business-sale-1",
      eventType: "BUSINESS_SALE",
      eventDate: "2026-05-01",
      publishedAt: "2026-05-01",
    } as MoneyMotionRecord;
    const converged = exitConvergence({
      id: "home-1",
      commercial: false,
      largeResidential: true,
      businessMatch: null,
      saleDate: "2026-06-01",
      relatedMotion: [businessSale],
    });
    expect(converged.score).toBe(40);
    expect(converged.hasBusinessExitEvidence).toBe(true);
  });

  it("keeps an unresolved commercial LLC as an organization-level result", () => {
    const record = finalize(draft());
    expect(record.sellerPerson).toBe("");
    expect(record.sellerEntity).toBe("Smith Industrial LLC");
    expect(record.proceeds.grossAttributableValue).toBeNull();
    expect(record.proceeds.netProceedsKnown).toBe(false);
    expect(isQualifiedPropertyMotionRecord(record)).toBe(true);
  });

  it("produces a robust estimated-value range only with enough comparables", () => {
    expect(estimatePropertyValue({ comparableValues: [1, 2, 3] })).toBeNull();
    expect(
      estimatePropertyValue({
        comparableValues: [10_000_000, 12_000_000, 16_000_000, 20_000_000],
        cookMarketValue: 17_000_000,
      }),
    ).toEqual(expect.objectContaining({ low: 11_500_000, high: 17_000_000 }));
  });

  it("aggregates only separate seller transactions and promotes qualified records without proceeds estimates", () => {
    const first = finalize(draft());
    const second = structuredClone(first) as ChicagoPropertyRecord;
    second.id = "property-2";
    second.transactionKey = "DOC:456";
    second.transaction.documentNumber = "456";
    second.transaction.saleDate = "2026-07-01";
    second.transaction.recordedSalePrice = 7_000_000;
    second.transaction.displayValueLow = 7_000_000;
    second.transaction.displayValueHigh = 7_000_000;
    second.proceeds.recordedSaleConsideration = 7_000_000;
    const records = applyRepeatedSellerHistory([first, second]);
    expect(records[0].repeatedSeller).toMatchObject({
      transactionCount: 2,
      totalRecordedDispositions: 12_000_000,
      windowDays: 30,
    });
    const events = propertyMotionEvents(records, "2026-08-11T00:00:00.000Z");
    expect(events).toHaveLength(2);
    expect(
      events.every((event) => event.ownership_percentage_low === null),
    ).toBe(true);
    expect(
      events.every((event) => event.metadata.netProceedsKnown === false),
    ).toBe(true);
  });

  it("excludes owner mailing addresses from normalized results", () => {
    const record = finalize(draft({ seller: "Jane Public" }));
    expect(JSON.stringify(record).toLowerCase()).not.toContain("mailing");
    expect(record.property.address).toBe("100 W Lake St");
  });
});
