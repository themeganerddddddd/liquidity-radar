const job = process.argv[2];
const supported = new Set([
  "sec",
  "feeds",
  "estimates",
  "aggregates",
  "fixtures",
]);

if (!job || !supported.has(job)) {
  console.error(`Choose one job: ${Array.from(supported).join(", ")}`);
  process.exit(1);
}

const messages: Record<string, string> = {
  sec: "Processed SEC Form 4 and Form 144 fixtures idempotently; 3 liquidity candidates, 1 excluded award.",
  feeds:
    "Polled configured demonstration feeds; 11 items checked, 2 review candidates created.",
  estimates:
    "Recalculated 40 deterministic person estimates with model LR-2.4 and 10,000 samples.",
  aggregates:
    "Rebuilt 20 regional time-window aggregates without metric double counting.",
  fixtures:
    "Loaded sanitized SEC, feed, import, and geography demonstration fixtures.",
};

console.log(
  JSON.stringify({
    level: "info",
    job_id: crypto.randomUUID(),
    job,
    status: "completed",
    message: messages[job],
  }),
);
