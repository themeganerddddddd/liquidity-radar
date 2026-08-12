import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type { ChicagoPropertySnapshot } from "../lib/chicago-property";
import { propertyMotionEvents } from "../lib/chicago-property";
import type { MoneyMotionSnapshot } from "../lib/money-in-motion";
import { buildSellerIntelligence } from "../lib/seller-intelligence";

const root = process.cwd();
const inputPath = path.join(
  root,
  "public",
  "data",
  "chicago-property-client.json.gz",
);
const outputPath = path.join(root, "docs", "seller-intelligence-validation.md");
const motionInputPath = path.join(
  root,
  "public",
  "data",
  "money-in-motion-client.json.gz",
);
const snapshot = JSON.parse(
  gunzipSync(await fs.readFile(inputPath)).toString("utf8"),
) as ChicagoPropertySnapshot;
const motionSnapshot = JSON.parse(
  gunzipSync(await fs.readFile(motionInputPath)).toString("utf8"),
) as MoneyMotionSnapshot;
const sellers = buildSellerIntelligence(snapshot);
const peopleInMotionAdditions = propertyMotionEvents(
  snapshot.records,
  snapshot.generatedAt,
).filter((event) => event.subject_person).length;

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

const sourceRows = motionSnapshot.sourceHealth
  .filter(
    (source) => source.mode !== "IMPORT_ONLY" && source.mode !== "DISABLED",
  )
  .map(
    (source) =>
      `| ${source.name} | ${source.mode} | ${source.watermark || "—"} | ${source.lastSuccessAt || "—"} | ${source.error || "—"} |`,
  )
  .join("\n");

const report = `# Seller Intelligence completion report

Generated: ${snapshot.generatedAt}

Seller Intelligence aggregates real Cook County and Illinois property-transfer records by seller. Recorded consideration is not net cash received. A manager, president, executive, attorney, or registered agent does not establish ownership or personal proceeds.

## Completion metrics

| Metric | Result |
| --- | ---: |
| Total seller entities | ${sellers.stats.totalSellerEntities.toLocaleString()} |
| Unresolved sellers | ${sellers.stats.unresolvedSellers.toLocaleString()} |
| Resolved seller entities | ${sellers.stats.resolvedSellerEntities.toLocaleString()} |
| Confirmed/reported owners | ${sellers.stats.confirmedOrReportedOwners.toLocaleString()} |
| Managers/officers found | ${sellers.stats.managersOrOfficers.toLocaleString()} |
| $5M+ unresolved | ${sellers.stats.unresolved5m.toLocaleString()} |
| $10M+ unresolved | ${sellers.stats.unresolved10m.toLocaleString()} |
| $25M+ unresolved | ${sellers.stats.unresolved25m.toLocaleString()} |
| $50M+ unresolved | ${sellers.stats.unresolved50m.toLocaleString()} |
| $100M+ unresolved | ${sellers.stats.unresolved100m.toLocaleString()} |
| Multiple-disposition sellers | ${sellers.stats.multipleDispositionSellers.toLocaleString()} |
| Business exit candidates | ${sellers.stats.businessExitCandidates.toLocaleString()} |
| Possible Exit Activity | ${sellers.stats.possibleExitActivity.toLocaleString()} |
| Strong Exit Signals | ${sellers.stats.strongExitSignals.toLocaleString()} |
| High Exit Convergence | ${sellers.stats.highExitConvergence.toLocaleString()} |
| Recorded dispositions | ${money(sellers.stats.recordedDispositions)} |
| People in Motion additions | ${peopleInMotionAdditions.toLocaleString()} |

No Strong or High Exit records are manufactured to satisfy counts.

## Automatic sources refreshed

The four-hour workflow incrementally refreshes the sources below, using persisted watermarks, overlap windows, retries, idempotent normalization, and source-level failure isolation. A source with no upstream change exits without replacing the snapshot.

| Source | Status | Watermark | Last successful sync | Error |
| --- | --- | --- | --- | --- |
${sourceRows}

## Manual/import sources pending

- Illinois Secretary of State individual entity searches — manual audited enrichment; never bulk scraped.
- Cook County assumed-name records where no permitted machine-readable feed is available — manual/import pending.
- Manual UCC enrichment and other restricted corporate-registry sources — pending authorized data access.

Manual records store the source URL, lookup date, reviewer, and status. High-value active records become **Needs Refresh** after 30 days for $25M+, 60 days for $10M+, and 90 days otherwise.

## Product safeguards and validation

- Exact/normalized public business matching may associate a person; fuzzy candidates remain unresolved.
- Only CONFIRMED_OWNER and REPORTED_OWNER relationships support person-level attribution. Ownership percentage remains unknown unless reported.
- Multi-parcel transactions are clustered and counted once; repeated distinct transactions are aggregated by seller.
- Exit Convergence is recalculated from distinct evidence components after each four-hour sync and capped at 100.
- The API supports seller, person, location, value, disposition, resolution, exit, recency, and business-exit filters.
- Tests: targeted Seller Intelligence unit and integration contracts run in CI; the release also requires the complete \`npm run validate\` suite.
- Production build: the release requires a successful Vinext production build before Sites deployment.
`;

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, report, "utf8");
console.log(
  `Wrote ${path.relative(root, outputPath)} for ${sellers.profiles.length.toLocaleString()} seller profiles.`,
);
