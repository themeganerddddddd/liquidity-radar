import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  getExitBusinessProfiles,
  parseFtcExitSignals,
} from "../../lib/exit-signals";
import { parseSecInsiderArchive } from "../../lib/sec-insider-data";

describe("expanded public signals", () => {
  it("parses qualifying sales from the SEC quarterly insider archive", () => {
    const archive = zipSync({
      "SUBMISSION.tsv": strToU8(
        [
          "ACCESSION_NUMBER\tFILING_DATE\tPERIOD_OF_REPORT\tDOCUMENT_TYPE\tISSUERCIK\tISSUERNAME\tISSUERTRADINGSYMBOL",
          "0001234567-26-000001\t15-MAR-2026\t14-MAR-2026\t4\t0000764321\tExample Public Co\tEXM",
        ].join("\n"),
      ),
      "REPORTINGOWNER.tsv": strToU8(
        [
          "ACCESSION_NUMBER\tRPTOWNERCIK\tRPTOWNERNAME\tRPTOWNER_RELATIONSHIP\tRPTOWNER_TITLE\tRPTOWNER_CITY\tRPTOWNER_STATE\tRPTOWNER_STATE_DESC",
          "0001234567-26-000001\t0001234567\tJordan Example\tOFFICER\tChief Executive Officer\tAustin\tTX\tTEXAS",
        ].join("\n"),
      ),
      "NONDERIV_TRANS.tsv": strToU8(
        [
          "ACCESSION_NUMBER\tNONDERIV_TRANS_SK\tSECURITY_TITLE\tTRANS_DATE\tTRANS_FORM_TYPE\tTRANS_CODE\tTRANS_SHARES\tTRANS_PRICEPERSHARE\tTRANS_ACQUIRED_DISP_CD\tSHRS_OWND_FOLWNG_TRANS\tDIRECT_INDIRECT_OWNERSHIP",
          "0001234567-26-000001\t1\tCommon Stock\t14-MAR-2026\t4\tS\t100000\t25.5\tD\t900000\tD",
          "0001234567-26-000001\t2\tCommon Stock\t14-MAR-2026\t4\tA\t5000\t0\tA\t905000\tD",
        ].join("\n"),
      ),
    });

    const evidence = parseSecInsiderArchive(archive);

    expect(evidence.events).toHaveLength(1);
    expect(evidence.events[0]).toMatchObject({
      reportingParty: "Jordan Example",
      eventType: "completed_public_share_sale",
      transactionDate: "2026-03-14",
      grossAmount: 2_550_000,
    });
    expect(evidence.holdings[0]).toMatchObject({
      shares: 900_000,
      estimatedValue: 22_950_000,
    });
  });

  it("parses FTC deal-watch parties without implying the deal closed", () => {
    const records = parseFtcExitSignals(`
      <article about="/legal-library/browse/early-termination-notices/20261234">
        <time datetime="2026-07-21T12:00:00Z">July 21, 2026</time>
        <div class="field--name-field-acquiring-party">
          <div class="field__items"><div class="field__item">Buyer &amp; Co.</div></div>
        </div>
        <div class="field--name-field-acquired-party">
          <div class="field__items"><div class="field__item">Jordan Seller</div></div>
        </div>
        <div class="field--name-field-other-entities">
          <div class="field__items"><div class="field__item">Example Business, Inc.</div></div>
        </div>
      </article>
    `);

    expect(records).toEqual([
      expect.objectContaining({
        id: "20261234",
        date: "2026-07-21",
        acquiringParty: "Buyer & Co.",
        acquiredParty: "Jordan Seller",
        acquiredEntities: ["Example Business, Inc."],
        status: "cleared_to_close",
      }),
    ]);
  });

  it("adds only verified acquired-business geography and profile sources", () => {
    const [profile] = getExitBusinessProfiles(["Kiavi, Inc."]);

    expect(profile).toMatchObject({
      name: "Kiavi, Inc.",
      industry: "Real-estate finance technology",
      headquarters: {
        city: "Pittsburgh",
        state: "PA",
        country: "United States",
      },
      sourceUrl: "https://www.kiavi.com/contact",
    });
    expect(getExitBusinessProfiles(["Unverified Example LLC"])).toEqual([]);
  });
});
