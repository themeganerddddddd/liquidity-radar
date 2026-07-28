import path from "node:path";
import { enrichSecFilingLocations } from "../lib/public-data";
import {
  readChunkedPublicSnapshot,
  writeChunkedPublicSnapshot,
} from "./public-snapshot-files";

const userAgent = process.env.SEC_USER_AGENT?.trim();
if (!userAgent) {
  throw new Error(
    "SEC_USER_AGENT is required and must identify the application and a contact email.",
  );
}

const output = path.join(
  process.cwd(),
  "public",
  "data",
  "public-signals.json",
);
const snapshot = await readChunkedPublicSnapshot(output);
const locatedAccessions = new Set(
  snapshot.liquidity.events
    .filter(
      (event) =>
        event.location.city || event.location.state || event.location.country,
    )
    .map((event) => event.accession),
);
const candidates = snapshot.sec.filings.filter(
  (filing) =>
    (filing.form === "Form 4" || filing.form === "Form 144") &&
    !locatedAccessions.has(filing.accession),
);
const enriched = await enrichSecFilingLocations(candidates, userAgent);
const byAccession = new Map(
  enriched
    .filter((filing) => filing.location)
    .map((filing) => [filing.accession, filing]),
);
const generatedAt = new Date().toISOString();

await writeChunkedPublicSnapshot(
  {
    ...snapshot,
    generatedAt,
    sec: {
      ...snapshot.sec,
      updatedAt: generatedAt,
      filings: snapshot.sec.filings.map(
        (filing) => byAccession.get(filing.accession) ?? filing,
      ),
    },
  },
  output,
);

console.log(
  JSON.stringify({
    requestedFilings: candidates.length,
    locationsAdded: byAccession.size,
  }),
);
