import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { MoneyMotionSnapshot } from "../../lib/money-in-motion";

const snapshot = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "public", "data", "money-in-motion.json"),
    "utf8",
  ),
) as MoneyMotionSnapshot;

describe("Money in Motion public snapshot contracts", () => {
  it("ships only source-linked public records", () => {
    expect(snapshot.records.length).toBeGreaterThan(1_000);
    expect(snapshot.stats.records).toBe(snapshot.records.length);
    for (const record of snapshot.records) {
      expect(record.evidence.length).toBeGreaterThan(0);
      expect(
        record.evidence.every((item) => /^https:\/\//.test(item.sourceUrl)),
      ).toBe(true);
      expect(
        record.evidence.some((item) =>
          /example\.(com|test)/i.test(item.sourceUrl),
        ),
      ).toBe(false);
    }
  });

  it("requires value and attribution evidence for every personal estimate", () => {
    for (const record of snapshot.records) {
      if (record.estimate.potentiallyDeployableHigh === null) continue;
      expect(record.reportedTransactionValue).not.toBeNull();
      expect(record.estimate.grossAttributableLow).not.toBeNull();
      expect(record.estimate.grossAttributableHigh).not.toBeNull();
      expect(record.estimate.calculation).not.toBe("No calculation performed.");
      expect(record.estimate.uncertainty.length).toBeGreaterThan(0);
    }
  });

  it("uses the visible five-component 100-point confidence model", () => {
    for (const record of snapshot.records) {
      const confidence = record.confidence;
      expect(confidence.total).toBe(
        confidence.sourceReliability +
          confidence.transactionCertainty +
          confidence.identityMatch +
          confidence.ownershipCertainty +
          confidence.valuationCertainty,
      );
      expect(confidence.total).toBeLessThanOrEqual(100);
    }
  });

  it("publishes explicit health or import boundaries for every adapter", () => {
    const sources = new Map(
      snapshot.sourceHealth.map((source) => [source.id, source]),
    );
    for (const id of [
      "sec",
      "ftc_hsr",
      "gdelt",
      "cms_chow",
      "fcc_uls",
      "uspto_assignments",
      "ferc",
      "stb",
      "registry_maryland",
      "registry_district_of_columbia",
      "registry_virginia",
      "commercial_property",
      "broker_feeds",
    ]) {
      expect(sources.has(id)).toBe(true);
      expect(sources.get(id)?.reason).toBeTruthy();
    }
    expect(sources.get("cms_chow")?.mode).toBe("LIVE");
    expect(sources.get("uspto_assignments")?.mode).toBe("IMPORT_ONLY");
  });
});
