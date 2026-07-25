import { runWrangler } from "./wrangler";

runWrangler([
  "d1",
  "execute",
  "DB",
  "--local",
  "--config",
  "config/wrangler.local.jsonc",
  "--file",
  "scripts/reset.sql",
]);
runWrangler([
  "d1",
  "migrations",
  "apply",
  "DB",
  "--local",
  "--config",
  "config/wrangler.local.jsonc",
]);
runWrangler([
  "d1",
  "execute",
  "DB",
  "--local",
  "--config",
  "config/wrangler.local.jsonc",
  "--file",
  "scripts/seed.sql",
]);

console.log("Local D1 data reset, migrated, and reseeded.");
