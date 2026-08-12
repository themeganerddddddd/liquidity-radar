import { describe, expect, it } from "vitest";
import type {
  ChicagoPropertyRecord,
  ChicagoPropertySnapshot,
} from "../../lib/chicago-property";
import type {
  MoneyMotionRecord,
  MoneyMotionSnapshot,
  PersonLiquiditySummary,
} from "../../lib/money-in-motion";
import {
  buildTopContacts,
  type PersistedRecommendationState,
  type ProfessionalContact,
} from "../../lib/top-contacts";

const generatedAt = "2026-08-12T12:00:00.000Z";

function record(
  id: string,
  name: string,
  overrides: Partial<MoneyMotionRecord> = {},
): MoneyMotionRecord {
  return {
    id,
    clusterKey: id,
    person: name,
    company: "Dover Corporation",
    seller: "Example Business",
    buyer: "Buyer",
    asset: "",
    title: "Reported transaction",
    summary: "Public transaction evidence",
    whyHere: "Ownership is reported",
    eventType: "BUSINESS_SALE",
    stage: "CLOSED",
    eventDate: "2026-08-07",
    publishedAt: "2026-08-08",
    location: {
      country: "United States",
      state: "Illinois",
      city: "Chicago",
      basis: "public business address",
    },
    industry: "Industrials",
    personRole: "Founder and owner",
    subjectKind: "PERSON",
    marketClass: "PRIVATE",
    reportedTransactionValue: 20_000_000,
    transactionValueClassification: "REPORTED",
    currency: "USD",
    estimate: {
      grossAttributableLow: 10_000_000,
      grossAttributableHigh: 10_000_000,
      potentiallyDeployableLow: 5_500_000,
      potentiallyDeployableHigh: 8_500_000,
      currency: "USD",
      classification: "ESTIMATED",
      methodology: "Reported ownership",
      calculation: "Reported value × ownership",
      uncertainty: [],
    },
    confidence: {
      sourceReliability: 25,
      transactionCertainty: 25,
      identityMatch: 20,
      ownershipCertainty: 15,
      valuationCertainty: 15,
      total: 100,
      explanation: [],
    },
    actionability: {
      magnitude: 25,
      recency: 20,
      preCloseTiming: 0,
      ownershipCertainty: 15,
      privateMarket: 10,
      sourceCorroboration: 10,
      total: 80,
      explanation: [],
    },
    leadTime: {
      firstSignalAt: "2026-08-07",
      firstPreSaleSignalAt: "",
      announcedAt: "",
      regulatoryFilingAt: "",
      closedAt: "2026-08-07",
      leadDaysToAnnouncement: null,
      leadDaysToClose: null,
    },
    independentSourceCount: 2,
    firstReportedAt: "2026-08-07",
    latestReportedAt: "2026-08-08",
    ownershipEvidence: true,
    evidence: [
      {
        id: `evidence-${id}`,
        sourceId: "sec",
        sourceUrl: `https://example.test/${id}`,
        publisher: "SEC",
        title: "Official filing",
        publishedAt: "2026-08-08",
        retrievedAt: generatedAt,
        classification: "REPORTED",
        excerpt: "Public transaction evidence",
      },
    ],
    sourceEventIds: [id],
    ...overrides,
  };
}

function person(
  index: number,
  overrides: Partial<PersonLiquiditySummary> = {},
): PersonLiquiditySummary {
  const name = overrides.name || `Person ${index}`;
  const event = `event-${index}`;
  return {
    personId: `person-${index}`,
    name,
    role: "Founder and owner",
    company: "Dover Corporation",
    location: {
      country: "United States",
      state: "Illinois",
      city: "Chicago",
      basis: "public business address",
    },
    industry: "Industrials",
    marketClass: "PRIVATE",
    latestEventId: event,
    latestEventTitle: "Reported transaction",
    latestStage: "CLOSED",
    eventCount: 1,
    firstSignalAt: "2026-08-07",
    latestSignalAt: "2026-08-07",
    latestCloseAt: "2026-08-07",
    estimatedLiquidityLow: 5_500_000,
    estimatedLiquidityHigh: 8_500_000,
    currency: "USD",
    highestConfidence: 100,
    actionability: {
      magnitude: 25,
      recency: 20,
      preCloseTiming: 0,
      ownershipCertainty: 15,
      privateMarket: 10,
      sourceCorroboration: 10,
      total: 80,
      explanation: [],
    },
    sourceCount: 2,
    openPreLiquidityCount: 0,
    closedEventCount: 1,
    leadDaysToClose: null,
    evidence: record(event, name).evidence,
    uncertainties: [],
    ...overrides,
  };
}

function propertyRecord(
  id: string,
  county: "Cook" | "DuPage",
  sellerPerson = "",
  overrides: Partial<ChicagoPropertyRecord> = {},
): ChicagoPropertyRecord {
  return {
    id,
    transactionKey: id,
    sellerPerson,
    sellerEntity: sellerPerson || "Seller LLC",
    sellerOriginal: sellerPerson || "Seller LLC",
    buyer: "Buyer LLC",
    resolutionMethod: sellerPerson ? "PERSONAL_TITLE_MATCH" : "UNRESOLVED",
    resolutionConfidence: sellerPerson ? 0.95 : 0,
    businessMatch: null,
    property: {
      county,
      address: "",
      city: county === "Cook" ? "Chicago" : "Naperville",
      state: "Illinois",
      zip: "",
      category: "OFFICE",
      categoryLabel: "Office",
      classificationBasis: "official record",
      sourceClassifications: [],
      pins: [],
      parcelCount: 1,
      commercial: true,
      largeResidential: false,
      latitude: null,
      longitude: null,
    },
    transaction: {
      saleDate: "2026-07-20",
      documentNumber: id,
      deedType: "Warranty deed",
      recordedSalePrice: 6_000_000,
      ptaxFullConsideration: null,
      ptaxNetConsideration: null,
      ptaxTaxableConsideration: null,
      valueStatus: "RECORDED",
      displayValueLow: 6_000_000,
      displayValueHigh: 6_000_000,
      valueDiscrepancy: false,
      valueExplanation: "Recorded consideration",
      quality: "MARKET_SALE",
      qualityReasons: [],
      multiParcel: false,
      additionalSellersReported: false,
      additionalBuyersReported: false,
      ptax203AAttached: false,
      ptax203BAttached: false,
    },
    proceeds: {
      recordedSaleConsideration: 6_000_000,
      knownOwnershipShare: null,
      grossAttributableValue: null,
      potentialProceedsLow: null,
      potentialProceedsHigh: null,
      netProceedsKnown: false,
      explanation: "Ownership share unknown",
    },
    exitConvergence: {
      score: 40,
      label: "Possible Exit Activity",
      components: [],
      hasBusinessExitEvidence: false,
      hasLicenseCancellation: false,
    },
    repeatedSeller: {
      transactionCount: 1,
      totalRecordedDispositions: 6_000_000,
      windowDays: 0,
    },
    evidence: [],
    ...overrides,
  };
}

function propertySnapshot(
  records: ChicagoPropertyRecord[] = [propertyRecord("cook", "Cook")],
): ChicagoPropertySnapshot {
  return {
    schemaVersion: 2,
    generatedAt,
    coverage: { startDate: "2026-01-01", endDate: "2026-08-12" },
    thresholds: { commercial: 1_000_000, largeResidential: 2_000_000 },
    disclaimer: "Public records",
    stats: {} as ChicagoPropertySnapshot["stats"],
    records,
    sourceHealth: [],
  };
}

function motionSnapshot(
  people: PersonLiquiditySummary[],
  recordOverrides: Record<string, Partial<MoneyMotionRecord>> = {},
): MoneyMotionSnapshot {
  return {
    schemaVersion: 2,
    generatedAt,
    disclaimer: "Public evidence",
    stats: {} as MoneyMotionSnapshot["stats"],
    peopleInMotion: people,
    records: people.map((candidate) =>
      record(candidate.latestEventId, candidate.name, {
        company: candidate.company,
        personRole: candidate.role,
        location: candidate.location,
        eventDate: candidate.latestSignalAt,
        stage: candidate.latestStage,
        ...recordOverrides[candidate.personId],
      }),
    ),
    sourceHealth: [],
  };
}

describe("Top Contacts weekly ranking", () => {
  it("returns a deterministic Chicago Top 10 with no duplicate people", () => {
    const people = Array.from({ length: 12 }, (_, index) => person(index + 1));
    const result = buildTopContacts(motionSnapshot(people), propertySnapshot());
    expect(result.recommendations).toHaveLength(10);
    expect(
      new Set(result.recommendations.map((item) => item.personId)).size,
    ).toBe(10);
    expect(result.recommendations.map((item) => item.rank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("uses only non-future event dates from the latest seven-day window", () => {
    const recent = person(1, { latestSignalAt: "2026-08-05" });
    const stale = person(2, { latestSignalAt: "2026-08-04" });
    const future = person(3, { latestSignalAt: "2026-08-13" });
    const result = buildTopContacts(
      motionSnapshot([recent, stale, future]),
      propertySnapshot(),
    );
    expect(result.recommendations.map((item) => item.personId)).toEqual([
      recent.personId,
    ]);
    expect(result.recommendations[0].primaryEvent.eventDate).toBe("2026-08-05");
  });

  it("filters Cook and DuPage and aggregates a cross-county person once", () => {
    const candidate = person(1, {
      name: "Cross Region Owner",
      location: {
        country: "United States",
        state: "Illinois",
        city: "Naperville",
        basis: "public business address",
      },
    });
    const properties = propertySnapshot([
      propertyRecord("one", "Cook", candidate.name),
      propertyRecord("two", "DuPage", candidate.name),
    ]);
    const motion = motionSnapshot([candidate]);
    expect(
      buildTopContacts(motion, properties, { geography: "COOK" })
        .recommendations,
    ).toHaveLength(1);
    expect(
      buildTopContacts(motion, properties, { geography: "DUPAGE" })
        .recommendations,
    ).toHaveLength(1);
    const metro = buildTopContacts(motion, properties).recommendations[0];
    expect(metro.county).toBe("Cook + DuPage");
    expect(metro.isCrossCounty).toBe(true);
  });

  it("caps priority at 100 and rewards ownership, acquisition, and repeated dispositions", () => {
    const candidate = person(1, { name: "Strong Owner" });
    const properties = propertySnapshot([
      propertyRecord("one", "Cook", candidate.name),
      propertyRecord("two", "Cook", candidate.name),
    ]);
    const result = buildTopContacts(
      motionSnapshot([candidate], {
        [candidate.personId]: { eventType: "ACQUISITION" },
      }),
      properties,
    ).recommendations[0];
    expect(result.score.ownership).toBe(10);
    expect(result.score.boosts).toBeGreaterThanOrEqual(5);
    expect(result.contactPriorityScore).toBeLessThanOrEqual(100);
  });

  it("strongly penalizes residential-only activity", () => {
    const candidate = person(1, { name: "Residential Seller" });
    const residential = propertyRecord("home", "Cook", candidate.name);
    residential.property.commercial = false;
    residential.property.largeResidential = true;
    const ranked = buildTopContacts(
      motionSnapshot([candidate]),
      propertySnapshot([residential]),
    ).recommendations[0];
    expect(ranked.residentialOnly).toBe(true);
    expect(ranked.score.penalties).toBeGreaterThanOrEqual(35);
  });

  it("requires ownership evidence unless a commercial seller match is direct", () => {
    const candidate = person(1, { name: "Unknown Relationship" });
    const result = buildTopContacts(
      motionSnapshot([candidate], {
        [candidate.personId]: { ownershipEvidence: false },
      }),
      propertySnapshot(),
    );
    expect(result.recommendations).toHaveLength(0);
  });

  it("distinguishes verified direct, company-only, and no contact routes", () => {
    const directPerson = person(1, { name: "Direct Owner" });
    const companyPerson = person(2, { name: "Firm Route Owner" });
    const nonePerson = person(3, {
      name: "No Route Owner",
      company: "Unlisted Venture",
    });
    const direct: ProfessionalContact = {
      id: "contact-1",
      personId: directPerson.personId,
      company: directPerson.company,
      type: "BUSINESS_EMAIL",
      value: "verified@example.test",
      sourceUrl: "https://example.test/team",
      sourceName: "Company team page",
      retrievedAt: "2026-08-12",
      verificationStatus: "VERIFIED_PUBLIC",
      notes: "Exact public listing",
    };
    const results = buildTopContacts(
      motionSnapshot([directPerson, companyPerson, nonePerson]),
      propertySnapshot(),
      { manualContacts: [direct] },
    ).recommendations;
    expect(
      results.find((item) => item.personId === directPerson.personId)
        ?.contactability,
    ).toBe("DIRECT");
    expect(
      results.find((item) => item.personId === companyPerson.personId)
        ?.contactability,
    ).toBe("COMPANY");
    expect(
      results.find((item) => item.personId === nonePerson.personId)
        ?.contactability,
    ).toBe("NONE");
    expect(JSON.stringify(results)).not.toContain("mailto:");
  });

  it("skips a person and promotes the next qualified candidate", () => {
    const people = Array.from({ length: 11 }, (_, index) => person(index + 1));
    const states: PersistedRecommendationState[] = [
      {
        weekStart: "2026-08-10",
        geographyId: "CHICAGO_METRO",
        personId: people[0].personId,
        workflowStatus: "NOT_REVIEWED",
        recommendationStatus: "SKIPPED",
        skipReason: "Not a fit",
        lastMaterialEventAt: people[0].latestSignalAt,
        lastUpdatedAt: generatedAt,
      },
    ];
    const result = buildTopContacts(
      motionSnapshot(people),
      propertySnapshot(),
      {
        states,
      },
    );
    expect(result.recommendations).toHaveLength(10);
    expect(
      result.recommendations.some(
        (item) => item.personId === people[0].personId,
      ),
    ).toBe(false);
  });

  it("suppresses recent outreach, permits a new material event, and honors do-not-contact", () => {
    const contacted = person(1);
    const blocked = person(2);
    const state = (
      candidate: PersonLiquiditySummary,
      workflowStatus: PersistedRecommendationState["workflowStatus"],
      lastMaterialEventAt: string,
    ): PersistedRecommendationState => ({
      weekStart: "2026-08-03",
      geographyId: "CHICAGO_METRO",
      personId: candidate.personId,
      workflowStatus,
      recommendationStatus: "ACTIVE",
      skipReason: "",
      lastMaterialEventAt,
      lastUpdatedAt: "2026-08-05T12:00:00Z",
    });
    const suppressed = buildTopContacts(
      motionSnapshot([contacted, blocked]),
      propertySnapshot(),
      {
        states: [
          state(contacted, "CONTACTED", contacted.latestSignalAt),
          state(blocked, "DO_NOT_CONTACT", blocked.latestSignalAt),
        ],
      },
    );
    expect(suppressed.recommendations).toHaveLength(0);

    const newEvent = { ...contacted, latestSignalAt: "2026-08-10" };
    const refreshed = buildTopContacts(
      motionSnapshot([newEvent]),
      propertySnapshot(),
      { states: [state(contacted, "CONTACTED", "2026-08-01")] },
    );
    expect(refreshed.recommendations).toHaveLength(1);
  });

  it("rejects old, weak, agent, and patent-only candidates", () => {
    const candidates = [
      person(1, { latestSignalAt: "2025-01-01" }),
      person(2, { highestConfidence: 50 }),
      person(3, { role: "Registered agent" }),
      person(4, { role: "Patent assignor" }),
      person(5, { name: "Village of Example" }),
    ];
    expect(
      buildTopContacts(motionSnapshot(candidates), propertySnapshot())
        .recommendations,
    ).toHaveLength(0);
  });

  it("does not confuse an out-of-state city with an Illinois city of the same name", () => {
    const candidate = person(1, {
      name: "Arizona Executive",
      location: {
        country: "United States",
        state: "Arizona",
        city: "Phoenix",
        basis: "public business address",
      },
    });
    const phoenixIllinois = propertyRecord("phoenix-il", "Cook");
    phoenixIllinois.property.city = "Phoenix";
    const result = buildTopContacts(
      motionSnapshot([candidate]),
      propertySnapshot([phoenixIllinois]),
    );
    expect(result.recommendations).toHaveLength(0);
  });

  it("never exposes a residential address in ranking output", () => {
    const candidate = person(1, { name: "Privacy Test" });
    const property = propertyRecord("private-home", "Cook", candidate.name);
    property.property.address = "123 Private Residence Way";
    const output = buildTopContacts(
      motionSnapshot([candidate]),
      propertySnapshot([property]),
    );
    expect(JSON.stringify(output)).not.toContain("123 Private Residence Way");
    expect(output.recommendations[0].location).toBe("Chicago, IL");
  });
});
