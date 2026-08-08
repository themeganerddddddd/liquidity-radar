import { describe, expect, it } from "vitest";
import {
  normalizeImportedRows,
  type ImportRow,
  type ImportSourceId,
} from "../../lib/import-adapters";

const common: ImportRow = {
  source_url: "https://agency.gov/record/1",
  event_date: "2026-08-01",
  external_record_id: "1",
  publisher: "Public agency",
};

describe("restricted and import-only source adapters", () => {
  const cases: Array<{
    source: ImportSourceId;
    row: ImportRow;
    type: string;
  }> = [
    {
      source: "fcc_uls",
      row: {
        ...common,
        action: "Assignment granted",
        assignor: "A",
        assignee: "B",
      },
      type: "LICENSE_TRANSFER",
    },
    {
      source: "uspto_assignments",
      row: {
        ...common,
        conveyance_text: "Assignment and sale",
        assignor: "A",
        assignee: "B",
      },
      type: "PATENT_ASSIGNMENT",
    },
    {
      source: "ferc",
      row: { ...common, title: "Application for acquisition of energy assets" },
      type: "ENERGY_ASSET_TRANSFER",
    },
    {
      source: "stb",
      row: { ...common, title: "Petition for control of rail carrier" },
      type: "TRANSPORT_ASSET_TRANSFER",
    },
    {
      source: "registry_maryland",
      row: {
        ...common,
        entity_name: "A",
        status: "Articles of dissolution",
        related_transaction_url: "https://agency.gov/deal/1",
      },
      type: "DISSOLUTION_AFTER_TRANSACTION",
    },
    {
      source: "commercial_property",
      row: {
        ...common,
        status: "Recorded deed sale",
        sale_price: "$12,000,000",
      },
      type: "COMMERCIAL_REAL_ESTATE_SALE",
    },
    {
      source: "broker_feeds",
      row: {
        ...common,
        status: "Business for sale",
        title: "HVAC listing",
        seller: "Private Owner",
      },
      type: "BUSINESS_FOR_SALE",
    },
  ];

  for (const fixture of cases) {
    it(`normalizes qualifying ${fixture.source} records`, () => {
      const result = normalizeImportedRows(fixture.source, [fixture.row]);
      expect(result.recordsAccepted).toBe(1);
      expect(result.events[0].event_type).toBe(fixture.type);
    });
  }

  it("rejects imports without a public evidence URL", () => {
    const result = normalizeImportedRows("fcc_uls", [
      { event_date: "2026-08-01", action: "Assignment granted" },
    ]);
    expect(result.recordsRejected).toBe(1);
  });

  it("excludes USPTO name changes and security interests", () => {
    const result = normalizeImportedRows("uspto_assignments", [
      { ...common, conveyance_text: "Corrective change of name" },
      {
        ...common,
        external_record_id: "2",
        conveyance_text: "Security interest",
      },
    ]);
    expect(result.recordsAccepted).toBe(0);
  });

  it("keeps anonymous broker sellers anonymous", () => {
    const result = normalizeImportedRows("broker_feeds", [
      { ...common, status: "Business for sale", seller: "Hidden Owner" },
    ]);
    expect(result.events[0].seller_entity).toBe("");
    expect(result.events[0].subject_person).toBe("");
  });
});
