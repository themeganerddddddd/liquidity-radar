import path from "node:path";
import {
  readChunkedPublicSnapshot,
  writeChunkedPublicSnapshot,
} from "./public-snapshot-files";
import { fetchCensusGeography } from "./geography-data";
import {
  mergeCompletedExits,
  verifiedCompletedExits,
} from "../lib/completed-exits";

const output = path.join(
  process.cwd(),
  "public",
  "data",
  "public-signals.json",
);
const snapshot = await readChunkedPublicSnapshot(output);
const completedExitRecords = mergeCompletedExits(
  verifiedCompletedExits,
  snapshot.completedExits?.records ?? [],
);
const locations = [
  ...snapshot.liquidity.events.map((event) => event.location),
  ...completedExitRecords.flatMap((record) => [
    record.location,
    ...record.ownerAttributions.map((owner) => owner.location),
  ]),
];
const geography = await fetchCensusGeography(locations);
const withoutOldGeographySource = snapshot.sources.filter(
  (source) => source.id !== "census_geo",
);

await writeChunkedPublicSnapshot(
  {
    ...snapshot,
    geography,
    completedExits: {
      updatedAt: new Date().toISOString(),
      records: completedExitRecords,
    },
    sources: [
      ...withoutOldGeographySource,
      ...(!withoutOldGeographySource.some((source) => source.id === "sec_exits")
        ? [
            {
              id: "sec_exits" as const,
              name: "Completed Form 8-K transactions",
              publisher: "U.S. Securities and Exchange Commission",
              freshness:
                completedExitRecords[0]?.completedAt ||
                "Current Item 2.01 filings",
              recordCount: completedExitRecords.length,
              sourceUrl:
                "https://www.sec.gov/rules-regulations/staff-guidance/compliance-disclosure-interpretations/exchange-act-form-8-k",
              methodology:
                "Form 8-K Item 2.01 records are treated as completed only because SEC guidance limits the item to consummated significant acquisitions and dispositions. Consideration is retained only when disclosed in the filing. Named-owner proceeds require a linked Form 4, Schedule 13D/G, or explicit seller disclosure; otherwise attribution remains unavailable.",
            },
          ]
        : []),
      {
        id: "census_geo",
        name: "U.S. place and metro reference points",
        publisher: "U.S. Census Bureau",
        freshness: "2025 Gazetteer",
        recordCount: geography.places.length + geography.metros.length,
        sourceUrl: geography.sourceUrl,
        methodology:
          "Representative Census Gazetteer coordinates for public SEC care-of cities and metropolitan statistical areas. Radius results measure straight-line distance between public place and metro reference points; they do not imply a residence.",
      },
    ],
  },
  output,
);

console.log(
  JSON.stringify({
    status: "completed",
    places: geography.places.length,
    metros: geography.metros.length,
  }),
);
