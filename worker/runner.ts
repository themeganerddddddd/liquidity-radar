const controller = new AbortController();

console.log(
  JSON.stringify({
    level: "info",
    service: "liquidity-radar-worker",
    status: "ready",
    concurrency: Number(process.env.WORKER_CONCURRENCY || 4),
    queues: [
      "ingestion",
      "identity",
      "estimates",
      "aggregates",
      "alerts",
      "exports",
      "privacy",
    ],
  }),
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => controller.abort());
}

await new Promise<void>((resolve) => {
  controller.signal.addEventListener("abort", () => {
    console.log(
      JSON.stringify({
        level: "info",
        service: "liquidity-radar-worker",
        status: "stopped",
      }),
    );
    resolve();
  });
});

export {};
