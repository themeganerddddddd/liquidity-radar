import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import {
  normalizeImportedRows,
  type ImportRow,
  type ImportSourceId,
} from "../lib/import-adapters";

const sourceId = process.argv[2] as ImportSourceId | undefined;
const inputPath = process.argv[3];
const outputPath = process.argv[4];

if (!sourceId || !inputPath || !outputPath) {
  console.error(
    "Usage: npm run source:normalize-import -- <source_id> <input.csv|json> <output.json>",
  );
  process.exit(1);
}

const supported: ImportSourceId[] = [
  "fcc_uls",
  "uspto_assignments",
  "ferc",
  "stb",
  "registry_maryland",
  "registry_district_of_columbia",
  "registry_virginia",
  "commercial_property",
  "broker_feeds",
];
if (!supported.includes(sourceId)) {
  throw new Error(`Unsupported source. Choose: ${supported.join(", ")}`);
}

const raw = await fs.readFile(path.resolve(inputPath), "utf8");
const rows = (
  inputPath.toLowerCase().endsWith(".json")
    ? JSON.parse(raw)
    : parse(raw, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
      })
) as ImportRow[];
if (!Array.isArray(rows))
  throw new Error("Import must contain an array or CSV rows.");
const result = normalizeImportedRows(sourceId, rows);
await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
await fs.writeFile(
  path.resolve(outputPath),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);
console.log(
  `${sourceId}: ${result.recordsAccepted}/${result.recordsSeen} accepted; ${result.recordsRejected} rejected.`,
);
