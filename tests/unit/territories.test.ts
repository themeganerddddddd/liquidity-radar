import { describe, expect, it } from "vitest";
import {
  distanceMiles,
  findPlaceCoordinates,
  isWithinTerritory,
} from "../../lib/territories";
import type { PublicDataSnapshot } from "../../lib/public-data";

const geography: NonNullable<PublicDataSnapshot["geography"]> = {
  updatedAt: "2026-07-28T00:00:00Z",
  sourceUrl: "https://www.census.gov/example",
  places: [
    {
      id: "3651000",
      name: "New York city",
      state: "NY",
      latitude: 40.66,
      longitude: -73.94,
    },
  ],
  metros: [
    {
      id: "35620",
      name: "New York-Newark-Jersey City, NY-NJ",
      type: "Metropolitan Statistical Area",
      latitude: 40.66,
      longitude: -73.94,
    },
  ],
};

describe("metro territory matching", () => {
  it("matches SEC care-of cities to Census place records", () => {
    expect(findPlaceCoordinates(geography, "NEW YORK", "NY")).toEqual({
      latitude: 40.66,
      longitude: -73.94,
    });
  });

  it("uses a radius rather than state-name matching", () => {
    const newYork = findPlaceCoordinates(geography, "New York", "NY");
    expect(isWithinTerritory(newYork, geography, "35620", 25)).toBe(true);
    expect(
      distanceMiles(
        { latitude: 40.66, longitude: -73.94 },
        { latitude: 42.36, longitude: -71.06 },
      ),
    ).toBeGreaterThan(180);
  });
});
