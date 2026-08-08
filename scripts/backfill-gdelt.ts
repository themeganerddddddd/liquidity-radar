import fs from "node:fs/promises";
import path from "node:path";
import {
  canonicalizeArticleUrl,
  emptyGdeltState,
  runGdeltIncremental,
  type GdeltPersistentState,
} from "../lib/gdelt-client";
import { stableId } from "../lib/money-in-motion";

type BackfillState = {
  version: 1;
  updatedAt: string;
  completedDates: string[];
  attempts: Array<{
    date: string;
    attemptedAt: string;
    articles: number;
    status: "COMPLETE" | "RATE_LIMITED" | "ERROR";
  }>;
};

const root = process.cwd();
const primaryStatePath = path.join(
  root,
  "public",
  "data",
  "gdelt-sync-state.json",
);
const backfillStatePath = path.join(
  root,
  "public",
  "data",
  "gdelt-backfill-state.json",
);

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

const dateIndex = process.argv.indexOf("--date");
const date = dateIndex >= 0 ? process.argv[dateIndex + 1] : "";
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  throw new Error(
    "Provide one bounded historical day: npm run data:backfill-gdelt -- --date YYYY-MM-DD",
  );
}
const end = Date.parse(`${date}T23:59:59.999Z`);
if (!Number.isFinite(end) || end >= Date.now()) {
  throw new Error("The backfill date must be a valid day before today.");
}

const backfill = await readJson<BackfillState>(backfillStatePath, {
  version: 1,
  updatedAt: "",
  completedDates: [],
  attempts: [],
});
if (backfill.completedDates.includes(date)) {
  console.log(`${date} is already complete; no request was made.`);
  process.exit(0);
}

const result = await runGdeltIncremental({
  state: emptyGdeltState(),
  now: end,
  initialWindowMs: 24 * 60 * 60 * 1000,
  maximumWindowMs: 24 * 60 * 60 * 1000,
});
const error = Object.values(result.state.queries).some(
  (query) => query.lastErrorType && query.lastErrorType !== "RATE_LIMITED",
);
const status: BackfillState["attempts"][number]["status"] =
  result.stoppedForRateLimit ? "RATE_LIMITED" : error ? "ERROR" : "COMPLETE";

if (status === "COMPLETE") {
  const primary = await readJson<GdeltPersistentState>(
    primaryStatePath,
    emptyGdeltState(),
  );
  for (const article of result.articles) {
    primary.articles[stableId(canonicalizeArticleUrl(article.url))] = article;
  }
  primary.updatedAt = new Date().toISOString();
  await fs.writeFile(primaryStatePath, `${JSON.stringify(primary)}\n`, "utf8");
  backfill.completedDates.push(date);
}
backfill.updatedAt = new Date().toISOString();
backfill.attempts = [
  ...backfill.attempts,
  {
    date,
    attemptedAt: backfill.updatedAt,
    articles: result.articles.length,
    status,
  },
].slice(-100);
await fs.writeFile(backfillStatePath, `${JSON.stringify(backfill)}\n`, "utf8");
console.log(
  `GDELT backfill ${date}: ${status}; ${result.articles.length} canonical articles.`,
);
if (status !== "COMPLETE") process.exitCode = 1;
