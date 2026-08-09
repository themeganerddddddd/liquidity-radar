import { describe, expect, it } from "vitest";
import {
  aggregatePeopleInMotion,
  calculateLeadTime,
  classifyNewsTransaction,
  classifyPatentAssignment,
  dedupeSourceEvents,
  estimatePotentialLiquidity,
  eventClusterKey,
  estimatePrivateCompanyValue,
  isQualifiedTransportationRecord,
  scoreActionability,
  scoreConfidence,
  type NormalizedSourceEvent,
  type MoneyMotionRecord,
} from "../../lib/money-in-motion";

function event(
  overrides: Partial<NormalizedSourceEvent> = {},
): NormalizedSourceEvent {
  return {
    source_id: "test",
    source_type: "test",
    external_record_id: "1",
    source_url: "https://example.test/1",
    retrieved_at: "2026-08-08T00:00:00Z",
    published_at: "2026-08-07",
    event_date: "2026-08-07",
    event_type: "ACQUISITION",
    event_stage: "ANNOUNCED",
    raw_title: "Buyer acquires Seller",
    raw_text: "",
    seller_entity: "Seller, Inc.",
    buyer_entity: "Buyer LLC",
    subject_person: "",
    subject_company: "Seller Inc",
    asset: "",
    location: {
      country: "United States",
      state: "Virginia",
      city: "",
      basis: "filing",
    },
    reported_transaction_value: null,
    currency: "USD",
    ownership_percentage_low: null,
    ownership_percentage_high: null,
    status: "announced",
    metadata: {},
    raw_payload_hash: "abc",
    ...overrides,
  };
}

describe("Money in Motion evidence rules", () => {
  it("keeps only transportation records with a subject and reported value", () => {
    const base = {
      eventType: "TRANSPORT_ASSET_TRANSFER",
      reportedTransactionValue: null,
      subjectKind: "ORGANIZATION",
      person: "",
      company: "Rail Company",
      seller: "",
    } as MoneyMotionRecord;
    expect(isQualifiedTransportationRecord(base)).toBe(false);
    expect(
      isQualifiedTransportationRecord({
        ...base,
        reportedTransactionValue: 25_000_000,
      }),
    ).toBe(true);
    expect(
      isQualifiedTransportationRecord({
        ...base,
        reportedTransactionValue: 25_000_000,
        subjectKind: "UNKNOWN",
      }),
    ).toBe(false);
  });
  it("does not create a personal estimate without a transaction value", () => {
    const estimate = estimatePotentialLiquidity({
      transactionValue: null,
      valueClassification: "UNKNOWN",
      ownershipLow: 0.4,
      ownershipHigh: 0.4,
    });
    expect(estimate.classification).toBe("UNKNOWN");
    expect(estimate.potentiallyDeployableHigh).toBeNull();
  });

  it("does not invent ownership when only total consideration is reported", () => {
    const estimate = estimatePotentialLiquidity({
      transactionValue: 100_000_000,
      valueClassification: "REPORTED",
      ownershipLow: null,
      ownershipHigh: null,
    });
    expect(estimate.grossAttributableLow).toBeNull();
    expect(estimate.methodology).toMatch(/without personal attribution/i);
  });

  it("produces a transparent range from supported value and ownership", () => {
    const estimate = estimatePotentialLiquidity({
      transactionValue: 100_000_000,
      valueClassification: "REPORTED",
      ownershipLow: 0.2,
      ownershipHigh: 0.3,
    });
    expect(estimate.grossAttributableLow).toBe(20_000_000);
    expect(estimate.grossAttributableHigh).toBe(30_000_000);
    expect(estimate.potentiallyDeployableLow).toBe(11_000_000);
    expect(estimate.potentiallyDeployableHigh).toBe(25_500_000);
    expect(estimate.calculation).toContain("20.00%–30.00%");
  });

  it("keeps direct filing-attributed gross values exact before the planning range", () => {
    const estimate = estimatePotentialLiquidity({
      transactionValue: 1_230_435,
      valueClassification: "REPORTED",
      ownershipLow: 1,
      ownershipHigh: 1,
      directlyAttributedGross: true,
    });
    expect(estimate.grossAttributableLow).toBe(1_230_435);
    expect(estimate.grossAttributableHigh).toBe(1_230_435);
  });

  it("caps the five confidence components at the documented 100 points", () => {
    const confidence = scoreConfidence({
      sourceReliability: 99,
      transactionCertainty: 99,
      identityMatch: 99,
      ownershipCertainty: 99,
      valuationCertainty: 99,
    });
    expect(confidence).toMatchObject({
      sourceReliability: 25,
      transactionCertainty: 25,
      identityMatch: 20,
      ownershipCertainty: 15,
      valuationCertainty: 15,
      total: 100,
    });
  });

  it("accepts explicit transaction news and rejects ordinary sales reporting", () => {
    expect(
      classifyNewsTransaction("Buyer completed acquisition of Seller")
        ?.eventType,
    ).toBe("ACQUISITION");
    expect(
      classifyNewsTransaction("Seller sales growth accelerated"),
    ).toBeNull();
  });

  it("excludes non-economic patent assignment records", () => {
    expect(
      classifyPatentAssignment("Assignment and sale of patent rights")
        ?.eventType,
    ).toBe("PATENT_ASSIGNMENT");
    expect(classifyPatentAssignment("Corrective change of name")).toBeNull();
    expect(classifyPatentAssignment("Security interest in patents")).toBeNull();
  });

  it("deduplicates repeated source records idempotently", () => {
    const older = event({ retrieved_at: "2026-08-07T00:00:00Z" });
    const newer = event({
      retrieved_at: "2026-08-08T00:00:00Z",
      raw_payload_hash: "new",
    });
    expect(dedupeSourceEvents([older, newer])).toEqual([newer]);
  });

  it("clusters aliases for the same parties and event window", () => {
    const first = event({ seller_entity: "Example Company, Inc." });
    const second = event({
      seller_entity: "Example Co",
      external_record_id: "2",
    });
    expect(eventClusterKey(first)).toBe(eventClusterKey(second));
  });

  it("does not reverse-identify an anonymous seller", () => {
    const anonymous = event({
      event_type: "BUSINESS_FOR_SALE",
      event_stage: "PRE_SALE",
      seller_entity: "",
      subject_company: "",
      raw_title: "Anonymous owner lists HVAC business for sale",
    });
    expect(anonymous.seller_entity).toBe("");
    expect(anonymous.subject_person).toBe("");
  });

  it("measures pre-sale lead time without treating a future close as cash", () => {
    const lead = calculateLeadTime({
      firstSignalAt: "2026-01-01",
      firstPreSaleSignalAt: "2026-01-01",
      announcedAt: "2026-02-01",
      closedAt: "2026-03-02",
    });
    expect(lead.leadDaysToAnnouncement).toBe(31);
    expect(lead.leadDaysToClose).toBe(60);
  });

  it("keeps actionability separate from evidence confidence", () => {
    const actionability = scoreActionability({
      potentialLiquidityHigh: 100_000_000,
      eventDate: "2026-08-01",
      asOfDate: "2026-08-08",
      stage: "PRE_SALE",
      ownershipEvidence: false,
      privateCompany: true,
      independentSourceCount: 1,
    });
    expect(actionability.total).toBeGreaterThan(60);
    expect(actionability.ownershipCertainty).toBe(0);
  });

  it("rejects employee-count-only private valuations", () => {
    const valuation = estimatePrivateCompanyValue({ employeeCount: 600 });
    expect(valuation.classification).toBe("UNKNOWN");
    expect(valuation.low).toBeNull();
    expect(valuation.assumptions.join(" ")).toMatch(/employee count alone/i);
  });

  it("deduplicates a person's events and never sums liquidity ranges", () => {
    const estimate = estimatePotentialLiquidity({
      transactionValue: 10_000_000,
      valueClassification: "REPORTED",
      ownershipLow: 1,
      ownershipHigh: 1,
    });
    const base: MoneyMotionRecord = {
      id: "record-1",
      clusterKey: "same-event",
      person: "Jamie Owner",
      company: "Private Co",
      seller: "Private Co",
      buyer: "Buyer",
      asset: "Private Co",
      title: "Private Co sold",
      summary: "",
      whyHere: "",
      eventType: "BUSINESS_SALE",
      stage: "CLOSED",
      eventDate: "2026-08-01",
      publishedAt: "2026-08-01",
      location: {
        country: "United States",
        state: "Virginia",
        city: "",
        basis: "record",
      },
      industry: "Software",
      personRole: "Founder",
      subjectKind: "PERSON",
      marketClass: "PRIVATE",
      reportedTransactionValue: 10_000_000,
      transactionValueClassification: "REPORTED",
      currency: "USD",
      estimate,
      confidence: scoreConfidence({
        sourceReliability: 25,
        transactionCertainty: 25,
        identityMatch: 20,
        ownershipCertainty: 15,
        valuationCertainty: 15,
      }),
      actionability: scoreActionability({
        potentialLiquidityHigh: estimate.potentiallyDeployableHigh,
        eventDate: "2026-08-01",
        asOfDate: "2026-08-08",
        stage: "CLOSED",
        ownershipEvidence: true,
        privateCompany: true,
        independentSourceCount: 1,
      }),
      leadTime: calculateLeadTime({
        firstSignalAt: "2026-07-01",
        firstPreSaleSignalAt: "2026-07-01",
        closedAt: "2026-08-01",
      }),
      independentSourceCount: 1,
      firstReportedAt: "2026-07-01",
      latestReportedAt: "2026-08-01",
      ownershipEvidence: true,
      evidence: [
        {
          id: "e1",
          sourceId: "official",
          publisher: "Agency",
          title: "Private Co sold",
          sourceUrl: "https://agency.gov/1",
          publishedAt: "2026-08-01",
          retrievedAt: "2026-08-01",
          classification: "REPORTED",
          excerpt: "",
        },
      ],
      sourceEventIds: ["official:1"],
    };
    const summary = aggregatePeopleInMotion([
      base,
      { ...base, id: "record-duplicate" },
      {
        ...base,
        id: "record-2",
        clusterKey: "second-event",
        estimate: {
          ...estimate,
          potentiallyDeployableLow: 1_000_000,
          potentiallyDeployableHigh: 2_000_000,
        },
      },
    ])[0];
    expect(summary.eventCount).toBe(2);
    expect(summary.estimatedLiquidityHigh).toBe(
      estimate.potentiallyDeployableHigh,
    );
  });
});
