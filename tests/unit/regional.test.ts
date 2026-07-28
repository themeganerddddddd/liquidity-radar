import { describe, expect, it } from "vitest";
import {
  calculateAffinity,
  eventMatchesSearch,
  markerSize,
  normalizeSearch,
  parseMapState,
  regionHierarchyMatches,
  selectActiveRegion,
  serializeMapState,
  type GeographicRelationship,
} from "../../lib/regional";
import { events, regions } from "../../app/data";

describe("regional search normalization", () => {
  it("normalizes punctuation, spacing, accents, and case", () => {
    expect(normalizeSearch("  Washington–Arlíngton,  MD ")).toBe(
      "washington arlington md",
    );
  });

  it("matches all query terms across different event fields", () => {
    const event = events.find((record) => record.person === "Elena Park")!;
    expect(eventMatchesSearch(event, "Elena Park")).toBe(true);
    expect(eventMatchesSearch(event, "biotechnology Maryland")).toBe(true);
    expect(eventMatchesSearch(event, "Elena Texas")).toBe(false);
  });

  it("matches a child geography to its state and metro ancestors", () => {
    expect(
      regionHierarchyMatches("montgomery-county-md", "maryland", regions),
    ).toBe(true);
    expect(
      regionHierarchyMatches(
        "montgomery-county-md",
        "washington-arlington-alexandria",
        regions,
      ),
    ).toBe(true);
    expect(
      regionHierarchyMatches("montgomery-county-md", "new-york", regions),
    ).toBe(false);
  });
});

describe("region-relative affinity", () => {
  const target = regions.find(
    (region) => region.slug === "montgomery-county-md",
  )!;

  it("scores transparent weighted components", () => {
    const relationships: GeographicRelationship[] = [
      {
        type: "primary_economic_location",
        regionSlug: target.slug,
        label: "Primary company is in Rockville",
        evidenceId: "one",
        occurredAt: "2026-01-01",
      },
      {
        type: "current_company",
        regionSlug: target.slug,
        label: "Current company is in Gaithersburg",
        evidenceId: "two",
        occurredAt: "2026-01-02",
      },
      {
        type: "investment_activity",
        regionSlug: target.slug,
        label: "Known local investment",
        evidenceId: "three",
        occurredAt: "2026-01-03",
      },
    ];
    const result = calculateAffinity(
      { geographicRelationships: relationships },
      target,
      regions,
    );
    expect(result.score).toBe(70);
    expect(result.evidenceCount).toBe(3);
    expect(result.mainReasons).toContain("Primary company is in Rockville");
  });

  it("applies diminishing returns to repeated relationship types", () => {
    const repeated: GeographicRelationship[] = [0, 1, 2].map((index) => ({
      type: "investment_activity",
      regionSlug: target.slug,
      label: `Investment ${index + 1}`,
      evidenceId: `investment-${index}`,
      occurredAt: "2026-01-01",
    }));
    const result = calculateAffinity(
      { geographicRelationships: repeated },
      target,
      regions,
    );
    expect(result.score).toBe(26);
    expect(result.score).toBeLessThan(45);
  });
});

describe("active region and map URL behavior", () => {
  it("uses URL, recent user choice, workspace home, then national priority", () => {
    expect(
      selectActiveRegion({
        urlRegion: "new-york",
        recentRegion: "maryland",
        homeRegion: "montgomery-county-md",
      }),
    ).toBe("new-york");
    expect(
      selectActiveRegion({
        recentRegion: "maryland",
        homeRegion: "montgomery-county-md",
      }),
    ).toBe("maryland");
    expect(selectActiveRegion({ homeRegion: "montgomery-county-md" })).toBe(
      "montgomery-county-md",
    );
    expect(selectActiveRegion({})).toBe("national");
  });

  it("caps marker scaling so small regions remain visible", () => {
    const values = [10, 100, 10_000_000];
    expect(markerSize(10, values)).toBe(18);
    expect(markerSize(10_000_000, values)).toBe(48);
    expect(markerSize(100, values)).toBeGreaterThanOrEqual(18);
  });

  it("serializes and parses map metric, period, region, center, and industry", () => {
    const state = {
      metric: "controlled" as const,
      period: "90d" as const,
      region: "montgomery-county-md",
      zoom: 6.25,
      center: [-77.15, 39.08] as [number, number],
      industry: "Biotechnology",
    };
    const serialized = serializeMapState(state);
    expect(parseMapState(serialized)).toEqual(state);
  });
});
