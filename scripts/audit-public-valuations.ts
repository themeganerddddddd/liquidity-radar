import path from "node:path";
import { auditPublicValuations } from "../lib/valuation-safety";
import { readChunkedPublicSnapshot } from "./public-snapshot-files";

const input = path.join(process.cwd(), "public", "data", "public-signals.json");
const audit = auditPublicValuations(await readChunkedPublicSnapshot(input));

for (const warning of audit.warnings) {
  console.warn(`Valuation audit warning: ${warning}`);
}
if (audit.errors.length) {
  for (const error of audit.errors) {
    console.error(`Valuation audit error: ${error}`);
  }
  throw new Error(
    `Public valuation audit failed with ${audit.errors.length} error(s).`,
  );
}

console.log(
  `Valuation audit passed: ${audit.totals.events.toLocaleString()} events, ${audit.totals.holdings.toLocaleString()} holdings, ${audit.totals.completedExits.toLocaleString()} completed exits; ${audit.totals.correctedEvents} source-normalized events, ${audit.totals.correctedHoldings} source-normalized holdings, and ${audit.totals.jointEvents.toLocaleString()} joint-filing events excluded from personal attribution.`,
);
