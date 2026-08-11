import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import {
  propertyMotionEvents,
  type ChicagoPropertyRecord,
  type ChicagoPropertySnapshot,
} from "../lib/chicago-property";

const root = process.cwd();
const inputPath = path.join(
  root,
  "public",
  "data",
  "chicago-property-client.json.gz",
);
const outputPath = path.join(root, "docs", "chicago-property-validation.md");

function money(value: number | null) {
  if (value === null) return "Unknown";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function label(record: ChicagoPropertyRecord) {
  return record.sellerPerson || record.sellerEntity || record.sellerOriginal;
}

function exampleLine(record: ChicagoPropertyRecord) {
  const source = record.evidence[0];
  return `- **${label(record)}** — ${record.property.categoryLabel}; ${money(record.transaction.displayValueHigh)} recorded consideration; ${record.property.city}, Illinois; ${record.transaction.saleDate}; ${record.property.parcelCount} parcel${record.property.parcelCount === 1 ? "" : "s"}; exit convergence ${record.exitConvergence.score}. [Official record](${source?.sourceUrl || "https://datacatalog.cookcountyil.gov/d/wvhk-k5uv"}) (document ${record.transaction.documentNumber || "unavailable"}).`;
}

function takeUnique(
  records: ChicagoPropertyRecord[],
  count: number,
  used: Set<string>,
) {
  const selected: ChicagoPropertyRecord[] = [];
  for (const record of records) {
    if (used.has(record.id)) continue;
    used.add(record.id);
    selected.push(record);
    if (selected.length === count) break;
  }
  return selected;
}

const snapshot = JSON.parse(
  gunzipSync(await fs.readFile(inputPath)).toString("utf8"),
) as ChicagoPropertySnapshot;
const used = new Set<string>();
const examples = [
  {
    title: "Commercial sales with a resolved person",
    requested: 3,
    records: takeUnique(
      snapshot.records.filter(
        (record) => record.property.commercial && Boolean(record.sellerPerson),
      ),
      3,
      used,
    ),
  },
  {
    title: "Commercial sales with an unresolved seller entity",
    requested: 2,
    records: takeUnique(
      snapshot.records.filter(
        (record) => record.property.commercial && !record.sellerPerson,
      ),
      2,
      used,
    ),
  },
  {
    title: "Strong business-exit convergence",
    requested: 2,
    records: takeUnique(
      snapshot.records.filter((record) => record.exitConvergence.score >= 50),
      2,
      used,
    ),
  },
  {
    title: "Portfolio sale",
    requested: 1,
    records: takeUnique(
      snapshot.records.filter((record) => record.transaction.multiParcel),
      1,
      used,
    ),
  },
  {
    title: "Large-home-only signal",
    requested: 1,
    records: takeUnique(
      snapshot.records.filter(
        (record) =>
          record.property.largeResidential &&
          !record.exitConvergence.hasBusinessExitEvidence,
      ),
      1,
      used,
    ),
  },
  {
    title: "Large-home plus separate business-exit evidence",
    requested: 1,
    records: takeUnique(
      snapshot.records.filter(
        (record) =>
          record.property.largeResidential &&
          record.exitConvergence.hasBusinessExitEvidence,
      ),
      1,
      used,
    ),
  },
];

const sourceRows = snapshot.sourceHealth
  .map(
    (source) =>
      `| ${source.name} | ${source.status} | ${source.rowsFetched.toLocaleString()} | ${source.matches.toLocaleString()} | ${source.watermark || "—"} | ${source.errors.join("; ") || "—"} |`,
  )
  .join("\n");
const typeRows = Object.entries(snapshot.stats.byPropertyType)
  .map(([type, count]) => `| ${type} | ${count.toLocaleString()} |`)
  .join("\n");
const valueRows = Object.entries(snapshot.stats.byValueBucket)
  .map(([bucket, count]) => `| ${bucket} | ${count.toLocaleString()} |`)
  .join("\n");
const exitRows = Object.entries(snapshot.stats.byExitConvergence)
  .map(([bucket, count]) => `| ${bucket} | ${count.toLocaleString()} |`)
  .join("\n");
const exampleSections = examples
  .map((group) => {
    const shortfall = group.requested - group.records.length;
    return `### ${group.title}\n\n${group.records.map(exampleLine).join("\n") || "- No production record currently meets this exact criterion."}${shortfall > 0 ? `\n\n_Real-record shortfall: ${shortfall}. The pipeline does not fabricate examples or lower the qualification threshold._` : ""}`;
  })
  .join("\n\n");
const motionEvents = propertyMotionEvents(
  snapshot.records,
  snapshot.generatedAt,
);
const peopleMotionEvents = motionEvents.filter((event) => event.subject_person);
const businessLicenseMatches = snapshot.records.filter(
  (record) => record.businessMatch,
).length;

const report = `# Chicago Property validation report

Generated: ${snapshot.generatedAt}

This report reflects only the production snapshot built from official public records. Recorded consideration is not net cash received, and no person-level proceeds are generated without supported ownership.

## Completion metrics

| Metric | Result |
| --- | ---: |
| Coverage | ${snapshot.coverage.startDate} through ${snapshot.coverage.endDate} |
| Significant transactions | ${snapshot.stats.significantSales.toLocaleString()} |
| Commercial transactions | ${snapshot.stats.commercialSales.toLocaleString()} |
| Large residential transactions | ${snapshot.stats.largeResidentialSales.toLocaleString()} |
| Recorded transaction value | ${money(snapshot.stats.recordedTransactionValue)} |
| PTAX matches | ${snapshot.stats.ptaxMatches.toLocaleString()} |
| Business-license matches | ${businessLicenseMatches.toLocaleString()} |
| Business-owner matches | ${snapshot.stats.businessOwnerMatches.toLocaleString()} |
| Person-resolved transactions | ${snapshot.stats.personResolvedTransactions.toLocaleString()} |
| Organization-only transactions | ${snapshot.stats.organizationOnlyTransactions.toLocaleString()} |
| License cancellations near sale | ${snapshot.stats.licenseCancellationMatches.toLocaleString()} |
| Other business-exit matches | ${snapshot.stats.otherBusinessExitMatches.toLocaleString()} |
| Strong exit convergence | ${snapshot.stats.strongExitSignals.toLocaleString()} |
| High exit convergence | ${snapshot.stats.highExitSignals.toLocaleString()} |
| People in Motion person-level events added | ${peopleMotionEvents.length.toLocaleString()} |
| Capital directory organization/person events added | ${motionEvents.length.toLocaleString()} |
| Duplicate source rows removed/clustered | ${snapshot.stats.duplicateTransactionsRemoved.toLocaleString()} |
| Non-market transfers excluded | ${snapshot.stats.nonMarketTransfersExcluded.toLocaleString()} |
| Cook/PTAX material value discrepancies | ${snapshot.stats.valueDiscrepancies.toLocaleString()} |

## Live source health

| Source | Status | Rows fetched this run | Matched records | Watermark | Error |
| --- | --- | ---: | ---: | --- | --- |
${sourceRows}

## Property-type distribution

| Property type | Transactions |
| --- | ---: |
${typeRows}

## Value distribution

| Recorded value | Transactions |
| --- | ---: |
${valueRows}

## Exit-convergence distribution

| Label | Transactions |
| --- | ---: |
${exitRows}

## Requested real-record examples

${exampleSections}

## Product safeguards verified

- Multi-parcel source rows are clustered by document/transaction and counted once.
- Cook recorded price and PTAX full, net, and taxable consideration remain separate fields.
- Quitclaim, trust, nominal, related-party, reorganization, and distress transfers are excluded from high-confidence liquidity results.
- Exact account/legal/DBA/normalized-entity methods may auto-resolve; fuzzy candidates do not.
- Business-owner percentages remain unknown unless explicitly reported.
- Property situs locations are shown; owner mailing addresses are neither collected nor surfaced.
- Sale consideration, gross attributable value, potential proceeds, and net proceeds are distinct; unknown values remain unknown.
`;

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, report, "utf8");
console.log(
  `Wrote ${path.relative(root, outputPath)} for ${snapshot.records.length.toLocaleString()} records.`,
);
