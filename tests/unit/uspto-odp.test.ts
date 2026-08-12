import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import {
  classifyUsptoConveyance,
  emptyUsptoOdpState,
  parseUsptoAssignmentXml,
  retainRecentUsptoEvents,
  runUsptoOdpSync,
} from "../../lib/uspto-odp";

const context = {
  retrievedAt: "2026-08-09T04:00:00.000Z",
  publishedAt: "2026-08-08T05:07:19.000Z",
  sourceUrl:
    "https://api.uspto.gov/api/v1/datasets/products/files/PASDL/ad20260807.zip",
  fileName: "ad20260807.zip",
};

function assignment(
  conveyance: string,
  reel: string,
  assignor: string,
  extra = "",
) {
  return `<patent-assignment>
    <assignment-record>
      <reel-no>${reel}</reel-no><frame-no>81</frame-no>
      <recorded-date><date>20260807</date></recorded-date>
      <conveyance-text>${conveyance}</conveyance-text>
    </assignment-record>
    <patent-assignors><patent-assignor><name>${assignor}</name><execution-date><date>20260805</date></execution-date></patent-assignor></patent-assignors>
    <patent-assignees><patent-assignee><name>EXAMPLE TECHNOLOGY, INC.</name><city>BOSTON</city><state>MASSACHUSETTS</state></patent-assignee></patent-assignees>
    <patent-properties><patent-property><invention-title>Useful invention</invention-title><document-id><doc-number>US123A1</doc-number></document-id></patent-property></patent-properties>
    ${extra}
  </patent-assignment>`;
}

function archive(xml: string, paddingBytes = 0, compressed = false) {
  return zipSync(
    {
      "assignment.xml": strToU8(
        `<us-patent-assignments>${xml}</us-patent-assignments>`,
      ),
      ...(paddingBytes ? { "padding.bin": new Uint8Array(paddingBytes) } : {}),
    },
    { level: compressed ? 6 : 0 },
  );
}

function fetchSequence(zip: Uint8Array, fileSize = zip.byteLength) {
  const metadata = {
    bulkDataProductBag: [
      {
        productFileBag: {
          fileDataBag: [
            {
              fileName: "ad20260807.zip",
              fileSize,
              fileDownloadURI: context.sourceUrl,
              fileReleaseDate: "2026-08-08 05:07:19",
            },
          ],
        },
      },
    ],
  };
  return vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify(metadata), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(zip.buffer as ArrayBuffer, {
        status: 200,
        headers: {
          "content-type": "application/zip",
          "content-length": String(zip.byteLength),
        },
      }),
    ) as unknown as typeof fetch;
}

describe("USPTO streamed ODP assignment ingestion", () => {
  it("creates a person-first sale/assignment signal without inventing cash", () => {
    const xml = `<us-patent-assignments>${assignment(
      "ASSIGNMENT OF ASSIGNOR&apos;S INTEREST",
      "70016",
      "DOE, JANE A.",
    )}</us-patent-assignments>`;
    const result = parseUsptoAssignmentXml(xml, context);

    expect(result.recordsSeen).toBe(1);
    expect(result.recordsAccepted).toBe(1);
    expect(result.classificationCounts.SALE_OR_ASSIGNMENT).toBe(1);
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
      metadata: {
        assignmentId: "70016-81",
        executionDates: ["2026-08-05"],
        recordationDate: "2026-08-07",
        conveyanceClassification: "SALE_OR_ASSIGNMENT",
      },
    });
    expect(result.events[0].raw_text).toContain(
      "cash consideration is not reported and is not inferred",
    );
  });

  it("accepts merger conveyances as mergers", () => {
    const result = parseUsptoAssignmentXml(
      `<us-patent-assignments>${assignment(
        "MERGER AND ASSIGNMENT",
        "70017",
        "EXAMPLE HOLDINGS, LLC",
      )}</us-patent-assignments>`,
      context,
    );

    expect(result.classificationCounts.MERGER).toBe(1);
    expect(result.events[0].event_type).toBe("MERGER");
  });

  it.each([
    ["CHANGE OF NAME", "NAME_CHANGE"],
    ["SECURITY INTEREST", "SECURITY_INTEREST"],
    ["LIEN AGAINST PATENT RIGHTS", "LIEN"],
    ["EXCLUSIVE LICENSE", "LICENSE"],
    ["CORRECTIVE ASSIGNMENT", "CORRECTION"],
    ["INTERNAL REORGANIZATION", "INTERNAL_REORGANIZATION"],
    ["NOTICE", "UNKNOWN"],
  ] as const)("excludes %s as %s", (conveyance, expected) => {
    expect(classifyUsptoConveyance(conveyance)).toMatchObject({
      category: expected,
      accepted: false,
    });
    const result = parseUsptoAssignmentXml(
      `<us-patent-assignments>${assignment(
        conveyance,
        "70018",
        "DOE, JOHN",
      )}</us-patent-assignments>`,
      context,
    );
    expect(result.recordsAccepted).toBe(0);
    expect(result.recordsRejected).toBe(1);
  });

  it("rejects a malformed assignment row", () => {
    const malformed = assignment("SALE AND ASSIGNMENT", "", "DOE, JANE");
    const result = parseUsptoAssignmentXml(
      `<us-patent-assignments>${malformed}</us-patent-assignments>`,
      context,
    );
    expect(result.recordsSeen).toBe(1);
    expect(result.recordsAccepted).toBe(0);
    expect(result.recordsRejected).toBe(1);
  });

  it("streams and processes an official-style file larger than 25 MB", async () => {
    const zip = archive(
      assignment("SALE AND ASSIGNMENT", "70019", "DOE, JANE"),
      25_100_000,
    );
    expect(zip.byteLength).toBeGreaterThan(25_000_000);
    const result = await runUsptoOdpSync({
      apiKey: "test-key",
      state: emptyUsptoOdpState(),
      now: context.retrievedAt,
      fetchImpl: fetchSequence(zip),
      limits: {
        maxDownloadBytes: 30_000_000,
        maxDecompressedBytes: 100_000_000,
        streamChunkBytes: 131_072,
      },
    });

    expect(result.health.mode).toBe("LIVE");
    expect(result.health.details.bytesDownloaded).toBe(zip.byteLength);
    expect(result.health.details.bytesProcessed).toBeGreaterThan(0);
    expect(result.health.details.filesProcessed).toEqual(["ad20260807.zip"]);
    expect(result.events).toHaveLength(1);
  });

  it("rejects a configured compressed download maximum before downloading", async () => {
    const zip = archive(
      assignment("SALE AND ASSIGNMENT", "70020", "DOE, JANE"),
    );
    const fetchImpl = fetchSequence(zip, 30_000_000);
    const result = await runUsptoOdpSync({
      apiKey: "test-key",
      state: emptyUsptoOdpState(),
      now: context.retrievedAt,
      fetchImpl,
      limits: { maxDownloadBytes: 25_000_001 },
    });

    expect(result.health.mode).toBe("ERROR");
    expect(result.health.error).toContain("USPTO_MAX_DOWNLOAD_BYTES_EXCEEDED");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("protects against unexpectedly large decompressed output", async () => {
    const zip = archive(
      assignment(
        "SALE AND ASSIGNMENT",
        "70021",
        "DOE, JANE",
        `<unexpected>${"X".repeat(50_100_000)}</unexpected>`,
      ),
      0,
      true,
    );
    const result = await runUsptoOdpSync({
      apiKey: "test-key",
      state: emptyUsptoOdpState(),
      now: context.retrievedAt,
      fetchImpl: fetchSequence(zip),
      limits: {
        maxDownloadBytes: 30_000_000,
        maxDecompressedBytes: 50_000_000,
      },
    });

    expect(result.health.mode).toBe("ERROR");
    expect(result.health.error).toContain(
      "USPTO_MAX_DECOMPRESSED_BYTES_EXCEEDED",
    );
    expect(result.events).toHaveLength(0);
  });

  it("persists an interrupted checkpoint and restarts idempotently", async () => {
    const zip = archive(
      `${assignment("SALE AND ASSIGNMENT", "70022", "DOE, JANE")}${assignment(
        "SALE AND ASSIGNMENT",
        "70023",
        "DOE, JOHN",
      )}`,
    );
    const interrupted = await runUsptoOdpSync({
      apiKey: "test-key",
      state: emptyUsptoOdpState(),
      now: context.retrievedAt,
      fetchImpl: fetchSequence(zip),
      interruptAfterRecords: 1,
    });

    expect(interrupted.health.errorType).toBe("INTERRUPTED");
    expect(interrupted.state.checkpoint.status).toBe("INTERRUPTED");
    expect(interrupted.events).toHaveLength(1);

    const restarted = await runUsptoOdpSync({
      apiKey: "test-key",
      state: interrupted.state,
      now: "2026-08-09T08:00:00.000Z",
      fetchImpl: fetchSequence(zip),
    });
    expect(restarted.health.mode).toBe("LIVE");
    expect(restarted.events).toHaveLength(2);
    expect(
      new Set(restarted.events.map((event) => event.external_record_id)).size,
    ).toBe(2);
  });

  it("retains prior accepted assignments and isolates source failures", async () => {
    const xml = `<us-patent-assignments>${assignment(
      "ASSIGNMENT OF ASSIGNOR&apos;S INTEREST",
      "70024",
      "DOE, JANE A.",
    )}</us-patent-assignments>`;
    const cached = parseUsptoAssignmentXml(xml, context).events;
    const state = { ...emptyUsptoOdpState(), events: cached };
    const result = await runUsptoOdpSync({
      apiKey: "test-key",
      state,
      now: context.retrievedAt,
      fetchImpl: vi.fn(async () => {
        throw new Error("network unavailable");
      }) as unknown as typeof fetch,
    });

    expect(retainRecentUsptoEvents([], cached)).toEqual(cached);
    expect(retainRecentUsptoEvents(cached, cached)).toHaveLength(1);
    expect(result.health.mode).toBe("DEGRADED");
    expect(result.health.errorType).toBe("FETCH_OR_PARSE_ERROR");
    expect(result.events).toEqual(cached);
  });
});
