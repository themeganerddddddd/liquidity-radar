import path from "node:path";
import {
  fetchSecLiquidityEvidence,
  mergePublicLiquidityEvidence,
} from "../lib/public-data";
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
const currentFilings = snapshot.sec.filings.filter(
  (filing) => filing.form === "Form 144",
);
const currentEvidence = await fetchSecLiquidityEvidence(
  currentFilings,
  userAgent,
);
const liquidity = mergePublicLiquidityEvidence(
  snapshot.liquidity,
  currentEvidence,
);
const generatedAt = new Date().toISOString();
const sources = snapshot.sources.map((source) =>
  source.id === "sec"
    ? { ...source, recordCount: liquidity.events.length }
    : source,
);

await writeChunkedPublicSnapshot(
  {
    ...snapshot,
    generatedAt,
    sources,
    sec: { ...snapshot.sec, updatedAt: generatedAt },
    liquidity,
  },
  output,
);

console.log(
  JSON.stringify({
    requestedFilings: currentFilings.length,
    parsedEvents: currentEvidence.events.length,
    parsedFilings: new Set(
      currentEvidence.events.map((event) => event.accession),
    ).size,
    totalProposedValue: currentEvidence.events
      .filter((event) => event.eventType === "proposed_public_share_sale")
      .reduce((sum, event) => sum + event.grossAmount, 0),
  }),
);
