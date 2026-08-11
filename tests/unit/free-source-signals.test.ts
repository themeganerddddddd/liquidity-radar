import { describe, expect, it } from "vitest";
import {
  courtListenerSaleEvents,
  extractDisclosedConsideration,
  officialTransactionNewsEvents,
  parseFccDailyAssignments,
  parseOfficialRss,
} from "../../lib/free-source-signals";

describe("current free non-stock sources", () => {
  it("normalizes FCC assignors and assignees as filing-stage signals", () => {
    const events = parseFccDailyAssignments({
      en: [
        "EN|15809888|0011749148|||R|L1|Weminuche L.L.C.|||||||||Englewood|CO|80112",
        "EN|15809888|0011749148|||E|L2|AT&T Mobility II LLC|||||||||Plano|TX|75075",
      ].join("\n"),
      hd: "HD|15809888|0011749148||||AL||||||N|N|N|N|N|N|N|N|||||||||N|||||||||||||||08/04/2026",
      retrievedAt: "2026-08-11T12:00:00.000Z",
      sourceUrl: "https://data.fcc.gov/download/pub/uls/daily/a_aa_tue.zip",
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      seller_entity: "Weminuche L.L.C.",
      buyer_entity: "AT&T Mobility II LLC",
      event_type: "LICENSE_TRANSFER",
      event_stage: "ANNOUNCED",
      reported_transaction_value: null,
    });
  });

  it("extracts only explicitly labeled docket consideration", () => {
    expect(
      extractDisclosedConsideration(
        "The aggregate purchase price under the APA is $42.5 million in cash.",
      ),
    ).toBe(42_500_000);
    expect(
      extractDisclosedConsideration("Assets worth about $42.5 million."),
    ).toBeNull();
  });

  it("separates proposed bankruptcy sales from entered sale orders", () => {
    const pending = courtListenerSaleEvents(
      [
        {
          caseName: "Acme Manufacturing Inc.",
          docketNumber: "26-10001",
          recap_documents: [
            {
              id: 1,
              absolute_url: "/docket/1/20/acme/",
              entry_date_filed: "2026-08-01",
              description:
                "Motion for Sale under Section 363; purchase price is $18 million",
            },
          ],
        },
      ],
      "2026-08-11T12:00:00.000Z",
    );
    const closed = courtListenerSaleEvents(
      [
        {
          caseName: "Beta Holdings Inc.",
          docketNumber: "26-10002",
          recap_documents: [
            {
              id: 2,
              absolute_url: "/docket/2/44/beta/",
              entry_date_filed: "2026-08-02",
              description:
                "Order Approving Sale of Assets; aggregate consideration of $31 million",
            },
          ],
        },
      ],
      "2026-08-11T12:00:00.000Z",
    );
    expect(pending[0]).toMatchObject({
      event_stage: "PRE_SALE",
      reported_transaction_value: 18_000_000,
    });
    expect(closed[0]).toMatchObject({
      event_stage: "CLOSED",
      reported_transaction_value: 31_000_000,
    });
  });

  it("parses official RSS and keeps transaction notices regulatory until completion is explicit", () => {
    const entries = parseOfficialRss(`<?xml version="1.0"?><rss><channel><item>
      <title><![CDATA[FTC Requires Divestiture as Condition of Acme Acquisition]]></title>
      <link>https://www.ftc.gov/news/acme</link>
      <description><![CDATA[The proposed acquisition is pending regulatory approval.]]></description>
      <pubDate>Mon, 10 Aug 2026 12:00:00 GMT</pubDate>
    </item></channel></rss>`);
    const events = officialTransactionNewsEvents({
      entries,
      publisher: "Federal Trade Commission",
      retrievedAt: "2026-08-11T12:00:00.000Z",
    });
    expect(entries).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event_stage: "PENDING_REGULATORY",
      source_id: "official_transaction_news",
    });
  });
});
