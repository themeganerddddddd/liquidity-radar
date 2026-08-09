import { describe, expect, it } from "vitest";
import {
  parseUsptoAssignmentXml,
  retainRecentUsptoEvents,
} from "../../lib/uspto-odp";

const context = {
  retrievedAt: "2026-08-09T04:00:00.000Z",
  publishedAt: "2026-08-08T05:07:19.000Z",
  sourceUrl:
    "https://api.uspto.gov/api/v1/datasets/products/files/PASDL/ad20260807.zip",
  fileName: "ad20260807.zip",
};

function assignment(conveyance: string, reel: string, assignor: string) {
  return `<patent-assignment>
    <assignment-record>
      <reel-no>${reel}</reel-no><frame-no>81</frame-no>
      <recorded-date><date>20260807</date></recorded-date>
      <conveyance-text>${conveyance}</conveyance-text>
    </assignment-record>
    <patent-assignors><patent-assignor><name>${assignor}</name></patent-assignor></patent-assignors>
    <patent-assignees><patent-assignee><name>EXAMPLE TECHNOLOGY, INC.</name><city>BOSTON</city><state>MASSACHUSETTS</state></patent-assignee></patent-assignees>
    <patent-properties><patent-property><invention-title>Useful invention</invention-title><document-id><doc-number>US123A1</doc-number></document-id></patent-property></patent-properties>
  </patent-assignment>`;
}

describe("USPTO current ODP assignment parser", () => {
  it("creates a person-first ownership-transfer signal without inventing cash", () => {
    const xml = `<us-patent-assignments>${assignment("ASSIGNMENT OF ASSIGNOR&apos;S INTEREST", "70016", "DOE, JANE A.")}</us-patent-assignments>`;
    const result = parseUsptoAssignmentXml(xml, context);

    expect(result.recordsSeen).toBe(1);
    expect(result.recordsAccepted).toBe(1);
    expect(result.events[0]).toMatchObject({
      subject_person: "Jane A. Doe",
      buyer_entity: "Example Technology, Inc.",
      event_type: "PATENT_ASSIGNMENT",
      event_stage: "CLOSED",
      reported_transaction_value: null,
      location: {
        country: "United States",
        state: "Massachusetts",
        city: "Boston",
      },
    });
    expect(result.events[0].raw_text).toContain(
      "cash consideration is not reported and is not inferred",
    );
  });

  it("rejects name changes and security interests", () => {
    const xml = `<us-patent-assignments>
      ${assignment("CHANGE OF NAME", "70017", "DOE, JANE")}
      ${assignment("SECURITY INTEREST", "70018", "DOE, JOHN")}
    </us-patent-assignments>`;
    const result = parseUsptoAssignmentXml(xml, context);

    expect(result.recordsSeen).toBe(2);
    expect(result.recordsAccepted).toBe(0);
    expect(result.recordsRejected).toBe(2);
  });

  it("retains prior accepted assignments when a new daily file has no qualifying transfers", () => {
    const xml = `<us-patent-assignments>${assignment("ASSIGNMENT OF ASSIGNOR&apos;S INTEREST", "70016", "DOE, JANE A.")}</us-patent-assignments>`;
    const cached = parseUsptoAssignmentXml(xml, context).events;

    expect(retainRecentUsptoEvents([], cached)).toEqual(cached);
    expect(retainRecentUsptoEvents(cached, cached)).toHaveLength(1);
  });
});
