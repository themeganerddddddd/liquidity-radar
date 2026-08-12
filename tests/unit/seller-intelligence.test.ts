import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type {
  ChicagoPropertyRecord,
  ChicagoPropertySnapshot,
  ExitConvergenceComponent,
} from "../../lib/chicago-property";
import {
  buildSellerIntelligence,
  detectSameAddressBusinessChange,
  manualRecordNeedsRefresh,
  manualRecordRelationships,
  sortChicagoPropertyRecords,
  type SellerManualRecord,
} from "../../lib/seller-intelligence";

function propertyRecord(
  overrides: Partial<ChicagoPropertyRecord> & {
    value?: number;
    date?: string;
    components?: ExitConvergenceComponent[];
  } = {},
): ChicagoPropertyRecord {
  const value = overrides.value ?? 120_000_000;
  const saleDate = overrides.date ?? "2026-07-01";
  const components = overrides.components ?? [
    {
      id: "commercial_disposition",
      label: "Commercial property disposition",
      points: 20,
      sourceRecordId: overrides.id ?? "record-1",
    },
  ];
  return {
    id: overrides.id ?? "record-1",
    transactionKey: overrides.transactionKey ?? "DOC:record-1",
    sellerPerson: "",
    sellerEntity: "Priority Holdings LLC",
    sellerOriginal: "Priority Holdings LLC",
    buyer: "Buyer LLC",
    resolutionMethod: "UNRESOLVED",
    resolutionConfidence: 0,
    businessMatch: null,
    property: {
      county: "Cook",
      address: "100 W Lake St",
      city: "Chicago",
      state: "Illinois",
      zip: "60601",
      category: "INDUSTRIAL",
      categoryLabel: "Industrial",
      classificationBasis: "official use",
      sourceClassifications: ["Industrial"],
      pins: ["01020300400000"],
      parcelCount: 1,
      commercial: true,
      largeResidential: false,
      latitude: 41.885,
      longitude: -87.63,
    },
    transaction: {
      saleDate,
      documentNumber: overrides.id ?? "record-1",
      deedType: "WARRANTY DEED",
      recordedSalePrice: value,
      ptaxFullConsideration: value,
      ptaxNetConsideration: value,
      ptaxTaxableConsideration: value,
      valueStatus: "RECORDED",
      displayValueLow: value,
      displayValueHigh: value,
      valueDiscrepancy: false,
      valueExplanation: "Recorded consideration is not net proceeds.",
      quality: "MARKET_SALE",
      qualityReasons: [],
      multiParcel: false,
      additionalSellersReported: false,
      additionalBuyersReported: false,
      ptax203AAttached: false,
      ptax203BAttached: false,
    },
    proceeds: {
      recordedSaleConsideration: value,
      knownOwnershipShare: null,
      grossAttributableValue: null,
      potentialProceedsLow: null,
      potentialProceedsHigh: null,
      netProceedsKnown: false,
      explanation: "Ownership and net proceeds are unknown.",
    },
    repeatedSeller: {
      transactionCount: 1,
      totalRecordedDispositions: value,
      windowDays: 0,
    },
    exitConvergence: {
      score: components.reduce((sum, component) => sum + component.points, 0),
      label: "Asset Sale Only",
      components,
      hasBusinessExitEvidence: components.some(
        (component) => component.id === "confirmed_business_exit",
      ),
      hasLicenseCancellation: components.some(
        (component) => component.id === "license_cancellation",
      ),
    },
    evidence: [
      {
        id: `evidence-${overrides.id ?? "record-1"}`,
        sourceId: "cook_property_sales",
        publisher: "Cook County Assessor's Office",
        title: "Official parcel sale",
        sourceUrl: "https://datacatalog.cookcountyil.gov/d/wvhk-k5uv",
        recordId: overrides.id ?? "record-1",
        retrievedAt: "2026-08-11T00:00:00.000Z",
        facts: [],
      },
    ],
    ...overrides,
  } as ChicagoPropertyRecord;
}

function snapshot(records: ChicagoPropertyRecord[]): ChicagoPropertySnapshot {
  return {
    schemaVersion: 2,
    generatedAt: "2026-08-11T00:00:00.000Z",
    coverage: { startDate: "2022-01-01", endDate: "2026-08-11" },
    thresholds: { commercial: 1_000_000, largeResidential: 3_000_000 },
    disclaimer: "Recorded consideration is not net proceeds.",
    sourceHealth: [],
    stats: {} as ChicagoPropertySnapshot["stats"],
    records,
  };
}

describe("cross-county seller identity", () => {
  it("aggregates Cook and DuPage dispositions into one seller profile", () => {
    const cook = propertyRecord({ id: "cook-sale", value: 4_000_000 });
    const dupage = propertyRecord({
      id: "dupage-sale",
      transactionKey: "DUPAGE:DOC:2",
      value: 6_000_000,
      date: "2026-08-01",
    });
    dupage.property.county = "DuPage";
    dupage.property.city = "Oak Brook";
    const result = buildSellerIntelligence(snapshot([cook, dupage]));
    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0]).toMatchObject({
      dispositionCount: 2,
      totalRecordedConsideration: 10_000_000,
      multipleDispositions: true,
      counties: ["Cook", "DuPage"],
    });
  });
});

function manual(
  overrides: Partial<SellerManualRecord> = {},
): SellerManualRecord {
  return {
    id: "manual-1",
    sellerKey: "priority holdings",
    entityLegalName: "Priority Holdings LLC",
    illinoisFileNumber: "12345678",
    entityType: "LLC",
    entityStatus: "Active",
    formationDate: "2010-01-01",
    president: "Pat President",
    secretary: "Sam Secretary",
    managers: ["Manny Manager"],
    registeredAgent: "Alex Agent",
    sourceUrl: "https://apps.ilsos.gov/corporatellc/",
    lookupDate: "2026-08-01",
    checkedBy: "Test analyst",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Seller Intelligence", () => {
  it("prioritizes a $100M unresolved seller without inventing an owner", () => {
    const result = buildSellerIntelligence(snapshot([propertyRecord()]));
    expect(result.profiles[0]).toMatchObject({
      ownerFound: false,
      totalRecordedConsideration: 120_000_000,
      needsManualReview: true,
      status: "Unresolved",
    });
    expect(result.stats.unresolved100m).toBe(1);
  });

  it("stores manual SOS roles but does not treat a president, manager, or registered agent as an owner", () => {
    const relationships = manualRecordRelationships(manual());
    expect(relationships.map((item) => item.type)).toEqual(
      expect.arrayContaining(["PRESIDENT", "MANAGER", "REGISTERED_AGENT"]),
    );
    expect(relationships.every((item) => !item.supportsOwnership)).toBe(true);
    const result = buildSellerIntelligence(snapshot([propertyRecord()]), [
      manual(),
    ]);
    expect(result.profiles[0].ownerFound).toBe(false);
  });

  it("accepts supported recorded ownership while leaving the ownership percentage and person proceeds unknown", () => {
    const record = propertyRecord({ sellerPerson: "Jane Smith" });
    const result = buildSellerIntelligence(snapshot([record]));
    expect(result.profiles[0].ownerFound).toBe(true);
    expect(result.profiles[0].relatedPeople[0]).toMatchObject({
      name: "Jane Smith",
      supportsOwnership: true,
    });
    expect(record.proceeds.grossAttributableValue).toBeNull();
  });

  it("aggregates repeated dispositions but counts a duplicate multi-parcel transaction once", () => {
    const first = propertyRecord({
      id: "one",
      transactionKey: "DOC:one",
      value: 8_000_000,
      date: "2026-05-01",
    });
    const duplicateParcel = propertyRecord({
      id: "one-parcel-2",
      transactionKey: "DOC:one",
      value: 8_000_000,
      date: "2026-05-01",
    });
    const second = propertyRecord({
      id: "two",
      transactionKey: "DOC:two",
      value: 12_000_000,
      date: "2026-06-01",
    });
    const third = propertyRecord({
      id: "three",
      transactionKey: "DOC:three",
      value: 16_000_000,
      date: "2026-08-01",
    });
    const profile = buildSellerIntelligence(
      snapshot([first, duplicateParcel, second, third]),
    ).profiles[0];
    expect(profile.dispositionCount).toBe(3);
    expect(profile.totalRecordedConsideration).toBe(36_000_000);
    expect(profile.multipleDispositions).toBe(true);
    expect(profile.exitConvergence.components.map((item) => item.id)).toContain(
      "multiple_asset_disposition",
    );
  });

  it("detects, but does not overstate, a same-address license change", () => {
    const result = detectSameAddressBusinessChange({
      propertyAddress: "100 W Lake Street",
      saleDate: "2026-06-01",
      licenses: [
        {
          address: "100 W Lake Street",
          status: "AAC",
          statusChangeDate: "2026-05-01",
          legalName: "Old Company",
        },
        {
          address: "100 W Lake Street",
          status: "AAI",
          statusChangeDate: "2026-07-01",
          legalName: "New Company",
        },
      ],
    });
    expect(result.classification).toBe("POSSIBLE_OPERATING_BUSINESS_CHANGE");
  });

  it.each(["2025-08-01", "2026-08-01"])(
    "recalculates convergence for acquisition evidence before or after the property sale (%s)",
    (eventDate) => {
      const components: ExitConvergenceComponent[] = [
        {
          id: "commercial_disposition",
          label: "Commercial property disposition",
          points: 20,
          sourceRecordId: "record-1",
        },
        {
          id: "confirmed_business_exit",
          label: `Acquisition ${eventDate}`,
          points: 35,
          sourceRecordId: "deal-1",
        },
      ];
      const profile = buildSellerIntelligence(
        snapshot([propertyRecord({ components })]),
      ).profiles[0];
      expect(profile.exitConvergence.score).toBe(55);
      expect(profile.status).toBe("Strong Exit Signals");
    },
  );

  it("incorporates license cancellation as independent exit evidence", () => {
    const components: ExitConvergenceComponent[] = [
      {
        id: "commercial_disposition",
        label: "Commercial property disposition",
        points: 20,
        sourceRecordId: "record-1",
      },
      {
        id: "license_cancellation",
        label: "License cancellation",
        points: 10,
        sourceRecordId: "license-1",
      },
    ];
    const profile = buildSellerIntelligence(
      snapshot([propertyRecord({ components })]),
    ).profiles[0];
    expect(profile.exitConvergence.score).toBe(30);
    expect(profile.businessExitCandidate).toBe(true);
  });

  it("uses 30/60/90-day manual refresh windows", () => {
    expect(
      manualRecordNeedsRefresh(
        manual({ lookupDate: "2026-07-01" }),
        30_000_000,
        "2026-08-11",
      ),
    ).toBe(true);
    expect(
      manualRecordNeedsRefresh(
        manual({ lookupDate: "2026-07-01" }),
        15_000_000,
        "2026-08-11",
      ),
    ).toBe(false);
    expect(
      manualRecordNeedsRefresh(
        manual({ lookupDate: "2026-04-01" }),
        5_000_000,
        "2026-08-11",
      ),
    ).toBe(true);
  });

  it("sorts Chicago Property by recorded date in either direction", () => {
    const older = propertyRecord({ id: "older", date: "2026-01-01" });
    const newer = propertyRecord({ id: "newer", date: "2026-08-01" });
    expect(
      sortChicagoPropertyRecords([older, newer], "date", "desc")[0].id,
    ).toBe("newer");
    expect(
      sortChicagoPropertyRecords([older, newer], "date", "asc")[0].id,
    ).toBe("older");
  });

  it("reranks from the latest snapshot even when one source reports a failure", () => {
    const input = snapshot([propertyRecord()]);
    input.sourceHealth = [
      { id: "optional", status: "DEGRADED", errors: ["timeout"] },
    ] as ChicagoPropertySnapshot["sourceHealth"];
    expect(buildSellerIntelligence(input).profiles).toHaveLength(1);
  });

  it("keeps the production refresh cadence at every four hours", async () => {
    const workflow = await readFile(
      path.join(
        process.cwd(),
        ".github",
        "workflows",
        "sync-money-in-motion.yml",
      ),
      "utf8",
    );
    expect(workflow).toContain('cron: "17 */4 * * *"');
    expect(workflow).toContain("npm run data:sync-chicago");
  });
});
