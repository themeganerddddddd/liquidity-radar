import path from "node:path";
import {
  readChunkedPublicSnapshot,
  writeChunkedPublicSnapshot,
} from "./public-snapshot-files";

const output = path.join(
  process.cwd(),
  "public",
  "data",
  "public-signals.json",
);
const snapshot = await readChunkedPublicSnapshot(output);
await writeChunkedPublicSnapshot(snapshot, output);

console.log(
  JSON.stringify({
    status: "completed",
    output,
    events: snapshot.liquidity.events.length,
    holdings: snapshot.liquidity.holdings.length,
  }),
);
