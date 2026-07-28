import { describe, expect, it } from "vitest";
import snapshotJson from "../../public/data/public-signals.json";
import { buildRealPeople } from "../../app/RealPeople";
import type { PublicDataSnapshot } from "../../lib/public-data";

describe("real people profiles", () => {
  it("builds profiles only from attributable SEC reporting-party names", () => {
    const data = snapshotJson as PublicDataSnapshot;
    const people = buildRealPeople(data);
    const namedFilings = data.sec.filings.filter(
      (filing) => filing.reportingParty.trim().length > 0,
    );

    expect(people.length).toBeGreaterThan(20);
    expect(people.flatMap((person) => person.filings)).toHaveLength(
      namedFilings.length,
    );
    expect(
      people.every(
        (person) =>
          person.name.length > 0 &&
          person.issuers.length > 0 &&
          person.filings.every(
            (filing) =>
              filing.reportingParty.toLowerCase() === person.name.toLowerCase(),
          ),
      ),
    ).toBe(true);
  });

  it("does not add modeled wealth or liquidity fields to a person profile", () => {
    const [person] = buildRealPeople(snapshotJson as PublicDataSnapshot);

    expect(person).not.toHaveProperty("netWorth");
    expect(person).not.toHaveProperty("liquidity");
    expect(person).not.toHaveProperty("cash");
    expect(person).not.toHaveProperty("radarScore");
  });
});
