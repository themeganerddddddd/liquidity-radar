import { describe, expect, it } from "vitest";
import { events, people, regions } from "../../app/data";
import publicSignalsJson from "../../public/data/public-signals.json";
import type { PublicDataSnapshot } from "../../lib/public-data";
import { DEMO_API_KEY, authorizeApi, publicPerson } from "../../lib/api";

describe("publication and workspace isolation contracts", () => {
  it("excludes pending-review people from customer results", () => {
    const published = people.filter(
      (person) => person.status !== "Pending review",
    );
    expect(published.length).toBeLessThan(people.length);
    expect(published.every((person) => person.confidence >= 65)).toBe(true);
  });

  it("suppresses precise coordinates from API person output", () => {
    const output = publicPerson(people[0]);
    expect(output.primary_economic_location).toMatch(/,\s[A-Z]{2}$/);
    expect(output).not.toHaveProperty("coordinates");
    expect(output).not.toHaveProperty("address");
  });

  it("requires the configured demonstration API key", () => {
    expect(
      authorizeApi(
        new Request("https://example.test", {
          headers: { authorization: `Bearer ${DEMO_API_KEY}` },
        }),
      ),
    ).toBe(true);
    expect(authorizeApi(new Request("https://example.test"))).toBe(false);
  });
});

describe("regional and event aggregate contracts", () => {
  it("ships validated official public-source coverage alongside demo records", () => {
    const publicSignals = publicSignalsJson as PublicDataSnapshot;
    expect(publicSignals.advisers.firmCount).toBeGreaterThan(10_000);
    expect(publicSignals.foundations.filingCount).toBeGreaterThan(10_000);
    expect(publicSignals.businessFormation.states).toHaveLength(51);
    expect(publicSignals.regionalEconomy.states).toHaveLength(51);
    expect(publicSignals.sec.filings.length).toBeGreaterThanOrEqual(10);
    expect(publicSignals.sources).toHaveLength(5);
  });

  it("covers every state and the District of Columbia with expanded demo data", () => {
    expect(new Set(regions.map((region) => region.code)).size).toBe(51);
    expect(regions.length).toBeGreaterThanOrEqual(52);
    expect(people.length).toBeGreaterThanOrEqual(240);
    expect(events.length).toBeGreaterThanOrEqual(720);
  });

  it("keeps retention and leakage complementary for known deployment", () => {
    for (const region of regions)
      expect(region.retained + region.leakage).toBeCloseTo(1);
  });

  it("keeps proposed events distinct from completed events", () => {
    expect(events.some((event) => event.status === "Proposed")).toBe(true);
    expect(
      events
        .filter((event) => event.status === "Proposed")
        .every((event) => event.explanation.includes("not assumed")),
    ).toBe(true);
  });

  it("includes range, confidence, evidence, geography, and publication fields for export", () => {
    const record = people[1];
    expect(record.remaining.low).toBeLessThan(record.remaining.median);
    expect(record.remaining.median).toBeLessThan(record.remaining.high);
    expect(record.sourceCount).toBeGreaterThan(0);
    expect(record.location).toBeTruthy();
    expect(record.status).toBeTruthy();
  });
});
