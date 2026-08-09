import path from "node:path";
import { writeClientMotionSnapshot } from "./write-client-motion-snapshot";

const root = process.cwd();
const inputPath = path.join(root, "public", "data", "money-in-motion.json");
const outputPath = path.join(
  root,
  "public",
  "data",
  "money-in-motion-client.json.gz",
);
const bytes = await writeClientMotionSnapshot(inputPath, outputPath);

console.log(
  `Client motion snapshot: ${(bytes / 1_048_576).toFixed(2)} MB compressed.`,
);
