import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  parseForm144Liquidity,
  parseForm4Liquidity,
  parseSecAtom,
  type SecFiling,
} from "../../lib/public-data";

const fixture = (name: string) =>
  readFileSync(new URL(`../../fixtures/sec/${name}`, import.meta.url), "utf8");

const filing = (form: string): SecFiling => ({
  accession: "0001900099-26-000001",
  form,
  filedAt: "2026-07-20",
  updatedAt: "2026-07-20T12:00:00Z",
  issuer: "Example issuer",
  reportingParty: "Example person",
  url: "https://www.sec.gov/Archives/example-index.htm",
});

describe("official public-data parsing", () => {
  it("parses SEC Atom filing metadata without treating it as a liquidity conclusion", () => {
    const entries = parseSecAtom(
      `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>4 - Example Holdings LLC (0001234567) (Reporting)</title>
          <link rel="alternate" type="text/html" href="https://www.sec.gov/Archives/example-index.htm"/>
          <summary type="html">&lt;b&gt;Filed:&lt;/b&gt; 2026-07-27 &lt;b&gt;AccNo:&lt;/b&gt; 0001234567-26-000001</summary>
          <updated>2026-07-27T19:00:00-04:00</updated>
          <id>urn:tag:sec.gov,2008:accession-number=0001234567-26-000001</id>
        </entry>
      </feed>`,
      "Form 4",
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      accession: "0001234567-26-000001",
      form: "Form 4",
      filedAt: "2026-07-27",
      entity: "Example Holdings LLC",
      role: "Reporting",
    });
  });

  it("filters prefix-matched EDGAR forms that are not actual Form 4 records", () => {
    const entries = parseSecAtom(
      `<feed>
        <entry>
          <title>424B2 - Example Issuer (0001234567) (Filer)</title>
          <link href="https://www.sec.gov/Archives/424-index.htm"/>
          <updated>2026-07-27T19:00:00Z</updated>
          <category term="424B2"/>
          <id>urn:tag:sec.gov,2008:accession-number=0001234567-26-000002</id>
        </entry>
        <entry>
          <title>4 - Example Person (0001234568) (Reporting)</title>
          <link href="https://www.sec.gov/Archives/4-index.htm"/>
          <updated>2026-07-27T19:00:00Z</updated>
          <category term="4"/>
          <id>urn:tag:sec.gov,2008:accession-number=0001234568-26-000003</id>
        </entry>
      </feed>`,
      "Form 4",
      ["4", "4/A"],
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].actualForm).toBe("4");
  });

  it("calculates completed Form 4 proceeds without treating awards as cash", () => {
    const sale = parseForm4Liquidity(
      fixture("form4-sale.xml"),
      filing("Form 4"),
    );
    const award = parseForm4Liquidity(
      fixture("form4-award.xml"),
      filing("Form 4"),
    );

    expect(sale.events).toHaveLength(1);
    expect(sale.events[0]).toMatchObject({
      eventType: "completed_public_share_sale",
      status: "completed",
      grossAmount: 5_100_000,
      amountClassification: "calculated",
    });
    expect(award.events).toHaveLength(0);
  });

  it("keeps Form 144 values proposed rather than completed", () => {
    const evidence = parseForm144Liquidity(
      fixture("form144.xml"),
      filing("Form 144"),
    );

    expect(evidence.events).toHaveLength(1);
    expect(evidence.events[0]).toMatchObject({
      eventType: "proposed_public_share_sale",
      status: "proposed",
      grossAmount: 7_437_500,
    });
  });
});
