import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { idempotencyKey, parseForm144, parseForm4 } from "../../lib/sec";

const fixture = (name: string) =>
  readFileSync(new URL(`../../fixtures/sec/${name}`, import.meta.url), "utf8");

describe("Form 4 parser", () => {
  it("extracts a sale and calculates observed gross proceeds", () => {
    const parsed = parseForm4(fixture("form4-sale.xml"));
    expect(parsed.issuer.name).toBe("Northstar BioSystems");
    expect(parsed.liquidityTransactions).toHaveLength(1);
    expect(parsed.liquidityTransactions[0].grossProceeds).toBe(5_100_000);
  });

  it("aggregates multiple transaction candidates", () => {
    const parsed = parseForm4(fixture("form4-multiple.xml"));
    expect(parsed.liquidityTransactions).toHaveLength(2);
    expect(
      parsed.liquidityTransactions.reduce(
        (sum, item) => sum + (item.grossProceeds || 0),
        0,
      ),
    ).toBe(2_350_000);
  });

  it("does not treat an award as liquidity", () => {
    expect(
      parseForm4(fixture("form4-award.xml")).liquidityTransactions,
    ).toHaveLength(0);
  });

  it("rejects malformed XML", () => {
    expect(() => parseForm4(fixture("malformed.xml"))).toThrow();
  });
});

describe("Form 144 parser", () => {
  it("creates a proposed event without implying completion", () => {
    const parsed = parseForm144(fixture("form144.xml"));
    expect(parsed.eventType).toBe("proposed_public_share_sale");
    expect(parsed.aggregateMarketValue).toBe(7_437_500);
    expect(parsed.completed).toBe(false);
  });
});

describe("idempotency", () => {
  it("returns the same key for the same filing and hash", () => {
    expect(idempotencyKey("0001", "abc")).toBe(idempotencyKey("0001", "abc"));
    expect(idempotencyKey("0001", "abc")).not.toBe(
      idempotencyKey("0002", "abc"),
    );
  });
});
