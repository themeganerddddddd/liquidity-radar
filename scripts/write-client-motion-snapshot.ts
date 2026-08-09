import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { buildClientMotionSnapshot } from "../lib/client-motion-snapshot";
import type { MoneyMotionSnapshot } from "../lib/money-in-motion";

export async function writeClientMotionSnapshot(
  inputPath: string,
  outputPath: string,
) {
  const snapshot = JSON.parse(
    await fs.readFile(inputPath, "utf8"),
  ) as MoneyMotionSnapshot;
  const clientSnapshot = buildClientMotionSnapshot(snapshot);
  const compressed = gzipSync(JSON.stringify(clientSnapshot), { level: 9 });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, compressed);
  return compressed.byteLength;
}
