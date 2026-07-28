import { describe, expect, it } from "vitest";
import { events, people, regions } from "../../app/data";
import {
  filterLiquidityEvents,
  filterRegionalPeople,
  peopleConnectedToRegion,
} from "../../lib/data-query";
import { calculateAffinity, selectActiveRegion } from "../../lib/regional";
import { DEMO_API_KEY } from "../../lib/api";
import { GET as getEvents } from "../../app/api/v1/events/route";
import { GET as getPeople } from "../../app/api/v1/people/route";

function apiRequest(path: string) {
  return new Request(`https://example.test${path}`, {
    headers: { authorization: `Bearer ${DEMO_API_KEY}` },
  });
}

describe("connected event search", () => {
  it("searches by person name", () => {
    const matches = filterLiquidityEvents({ q: "Elena Park" });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((event) => event.person === "Elena Park")).toBe(true);
  });

  it("searches by location and industry", () => {
    expect(filterLiquidityEvents({ q: "Maryland" }).length).toBeGreaterThan(0);
    expect(
      filterLiquidityEvents({ q: "biotechnology Maryland" }).some(
        (event) => event.person === "Elena Park",
      ),
    ).toBe(true);
  });

  it("combines free text with structured region filters", () => {
    const matches = filterLiquidityEvents({
      q: "biotechnology",
      region: "montgomery-county-md",
      minConfidence: 65,
      status: "Completed",
    });
    expect(matches.length).toBeGreaterThan(0);
    expect(
      matches.every(
        (event) =>
          event.industry === "Biotechnology" &&
          event.regionSlug === "montgomery-county-md",
      ),
    ).toBe(true);
  });
});

describe("regional detail and affinity contracts", () => {
  it("returns relevant people and events for Montgomery County", () => {
    expect(
      peopleConnectedToRegion("montgomery-county-md").length,
    ).toBeGreaterThan(2);
    expect(
      filterLiquidityEvents({ region: "montgomery-county-md" }).length,
    ).toBeGreaterThan(2);
  });

  it("respects workspace home region and user-selected override priority", () => {
    expect(selectActiveRegion({ homeRegion: "montgomery-county-md" })).toBe(
      "montgomery-county-md",
    );
    expect(
      selectActiveRegion({
        recentRegion: "new-york",
        homeRegion: "montgomery-county-md",
      }),
    ).toBe("new-york");
  });

  it("changes affinity when the selected region changes", () => {
    const elena = people.find((person) => person.name === "Elena Park")!;
    const montgomery = regions.find(
      (region) => region.slug === "montgomery-county-md",
    )!;
    const newYork = regions.find((region) => region.slug === "new-york")!;
    expect(calculateAffinity(elena, montgomery, regions).score).toBeGreaterThan(
      calculateAffinity(elena, newYork, regions).score,
    );
  });

  it("keeps suppressed profiles out of regional and affinity filters", () => {
    const suppressed = new Set(
      people
        .filter((person) => person.status === "Pending review")
        .map((person) => person.id),
    );
    const results = filterRegionalPeople({
      region: "maryland",
      affinityRegion: "maryland",
    });
    expect(results.every((record) => !suppressed.has(record.person.id))).toBe(
      true,
    );
  });
});

describe("regional API filtering", () => {
  it("filters the Events API by region and search terms", async () => {
    const response = await getEvents(
      apiRequest(
        "/api/v1/events?region=montgomery-county-md&q=biotechnology&limit=50",
      ),
    );
    const body = (await response.json()) as {
      data: Array<{ location: { region_slug: string }; industry: string }>;
    };
    expect(response.status).toBe(200);
    expect(body.data.length).toBeGreaterThan(0);
    expect(
      body.data.every(
        (record) =>
          record.location.region_slug === "montgomery-county-md" &&
          record.industry === "Biotechnology",
      ),
    ).toBe(true);
  });

  it("filters the People API by affinity", async () => {
    const response = await getPeople(
      apiRequest(
        "/api/v1/people?region=montgomery-county-md&affinityRegion=montgomery-county-md&minAffinity=60&limit=50",
      ),
    );
    const body = (await response.json()) as {
      data: Array<{ affinity: { score: number } }>;
    };
    expect(response.status).toBe(200);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((record) => record.affinity.score >= 60)).toBe(true);
  });
});

it("keeps the enhanced fictional event set non-empty", () => {
  expect(events.length).toBeGreaterThanOrEqual(75);
});
