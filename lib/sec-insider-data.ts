import { parse } from "csv-parse/sync";
import { strFromU8, unzipSync } from "fflate";
import type {
  PublicHoldingPosition,
  PublicLiquidityEvent,
  PublicLiquidityEvidence,
} from "./public-data";
import { mergePublicLiquidityEvidence } from "./public-data";
import { normalizeReportedTransactionValue } from "./valuation-safety";

type Row = Record<string, string>;

const months: Record<string, string> = {
  JAN: "01",
  FEB: "02",
  MAR: "03",
  APR: "04",
  MAY: "05",
  JUN: "06",
  JUL: "07",
  AUG: "08",
  SEP: "09",
  OCT: "10",
  NOV: "11",
  DEC: "12",
};

function rows(value: Uint8Array) {
  return parse(strFromU8(value), {
    bom: true,
    columns: true,
    delimiter: "\t",
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }) as Row[];
}

function archiveTable(files: Record<string, Uint8Array>, tableName: string) {
  const normalized = tableName.toLocaleLowerCase();
  const entry = Object.entries(files).find(([filename]) => {
    const basename = filename.split(/[\\/]/).at(-1)?.toLocaleLowerCase() ?? "";
    return (
      basename.startsWith(normalized) &&
      (basename.endsWith(".tsv") || basename.endsWith(".txt"))
    );
  });
  if (!entry) {
    throw new Error(`SEC insider archive is missing ${tableName}.`);
  }
  return rows(entry[1]);
}

function secDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.toUpperCase().match(/^(\d{2})-([A-Z]{3})-(\d{4})$/);
  return match && months[match[2]]
    ? `${match[3]}-${months[match[2]]}-${match[1]}`
    : value;
}

function numeric(value: string | undefined) {
  const parsed = Number(String(value ?? "").replace(/[,$\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function archiveFilingUrl(issuerCik: string, accession: string) {
  const cik = issuerCik.replace(/^0+/, "") || "0";
  const compactAccession = accession.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${compactAccession}/${accession}-index.htm`;
}

function relationship(owner: Row) {
  return [owner.RPTOWNER_RELATIONSHIP?.replace(/_/g, " "), owner.RPTOWNER_TITLE]
    .filter(Boolean)
    .join(" · ");
}

export function parseSecInsiderArchive(
  archive: Uint8Array,
): PublicLiquidityEvidence {
  const files = unzipSync(archive);
  const submissions = archiveTable(files, "SUBMISSION");
  const owners = archiveTable(files, "REPORTINGOWNER");
  const transactions = archiveTable(files, "NONDERIV_TRANS");

  const submissionByAccession = new Map(
    submissions
      .filter((submission) => /^4(?:\/A)?$/.test(submission.DOCUMENT_TYPE))
      .map((submission) => [submission.ACCESSION_NUMBER, submission]),
  );
  const ownersByAccession = owners.reduce((grouped, owner) => {
    const current = grouped.get(owner.ACCESSION_NUMBER) ?? [];
    current.push(owner);
    grouped.set(owner.ACCESSION_NUMBER, current);
    return grouped;
  }, new Map<string, Row[]>());
  const events: PublicLiquidityEvent[] = [];
  const holdings: PublicHoldingPosition[] = [];

  for (const transaction of transactions) {
    if (
      transaction.TRANS_CODE !== "S" ||
      transaction.TRANS_ACQUIRED_DISP_CD !== "D"
    ) {
      continue;
    }
    const submission = submissionByAccession.get(transaction.ACCESSION_NUMBER);
    if (!submission) continue;
    const shares = numeric(transaction.TRANS_SHARES);
    const reportedPrice = numeric(transaction.TRANS_PRICEPERSHARE);
    if (shares <= 0 || reportedPrice <= 0) continue;
    const normalizedValue = normalizeReportedTransactionValue({
      accession: transaction.ACCESSION_NUMBER,
      issuerCik: submission.ISSUERCIK,
      shares,
      reportedPrice,
    });
    const pricePerShare = normalizedValue.pricePerShare;
    const grossAmount = normalizedValue.grossAmount;
    const transactionDate =
      secDate(transaction.TRANS_DATE) || secDate(submission.PERIOD_OF_REPORT);
    const filingDate = secDate(submission.FILING_DATE);
    const filingOwners = ownersByAccession.get(transaction.ACCESSION_NUMBER);
    if (!filingOwners?.length) continue;
    const attributionBasis =
      filingOwners.length > 1
        ? "joint_filing_unallocated"
        : "single_reporting_owner";

    for (const owner of filingOwners) {
      const reportingParty = owner.RPTOWNERNAME?.trim();
      if (!reportingParty) continue;
      const reportingPartyCik = owner.RPTOWNERCIK ?? "";
      const sourceUrl = archiveFilingUrl(
        submission.ISSUERCIK,
        transaction.ACCESSION_NUMBER,
      );
      const eventId = [
        "sec345",
        transaction.ACCESSION_NUMBER,
        transaction.NONDERIV_TRANS_SK,
        reportingPartyCik,
      ].join("-");
      events.push({
        id: eventId,
        accession: transaction.ACCESSION_NUMBER,
        form: "Form 4",
        status: "completed",
        eventType: "completed_public_share_sale",
        reportingParty,
        reportingPartyCik,
        issuer: submission.ISSUERNAME,
        issuerCik: submission.ISSUERCIK,
        issuerSymbol: submission.ISSUERTRADINGSYMBOL,
        relationship: relationship(owner) || "SEC reporting owner",
        transactionDate,
        filingDate,
        securityTitle: transaction.SECURITY_TITLE || "Reported security",
        shares,
        pricePerShare,
        grossAmount,
        priceBasis: normalizedValue.priceBasis,
        attributionBasis,
        amountClassification: "calculated",
        transactionCode: "S",
        directOrIndirect:
          transaction.DIRECT_INDIRECT_OWNERSHIP || "Not reported",
        sharesOwnedAfter:
          transaction.SHRS_OWND_FOLWNG_TRANS === ""
            ? null
            : numeric(transaction.SHRS_OWND_FOLWNG_TRANS),
        broker: "",
        location: {
          city: owner.RPTOWNER_CITY ?? "",
          state: owner.RPTOWNER_STATE ?? "",
          country: owner.RPTOWNER_STATE_DESC ?? "",
        },
        sourceUrl,
        note: [
          "Completed open-market or private sale reported in the SEC quarterly insider-transactions data set.",
          normalizedValue.correctionNote,
        ]
          .filter(Boolean)
          .join(" "),
      });

      const sharesOwnedAfter = numeric(transaction.SHRS_OWND_FOLWNG_TRANS);
      if (sharesOwnedAfter > 0) {
        holdings.push({
          id: `${eventId}-holding`,
          reportingParty,
          reportingPartyCik,
          issuer: submission.ISSUERNAME,
          issuerCik: submission.ISSUERCIK,
          issuerSymbol: submission.ISSUERTRADINGSYMBOL,
          securityTitle: transaction.SECURITY_TITLE || "Reported security",
          shares: sharesOwnedAfter,
          directOrIndirect:
            transaction.DIRECT_INDIRECT_OWNERSHIP || "Not reported",
          asOfDate: transactionDate,
          referencePrice: pricePerShare,
          estimatedValue: sharesOwnedAfter * pricePerShare,
          priceBasis: normalizedValue.priceBasis,
          attributionBasis,
          valueClassification: "calculated",
          sourceUrl,
          accession: transaction.ACCESSION_NUMBER,
        });
      }
    }
  }

  return mergePublicLiquidityEvidence({
    updatedAt: new Date().toISOString(),
    events,
    holdings,
  });
}
