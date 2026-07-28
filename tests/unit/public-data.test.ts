import { describe, expect, it } from "vitest";
import { parseSecAtom } from "../../lib/public-data";

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
});
