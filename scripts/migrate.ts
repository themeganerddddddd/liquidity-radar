import { runWrangler } from "./wrangler";

runWrangler([
  "d1",
  "migrations",
  "apply",
  "DB",
  "--local",
  "--config",
  "config/wrangler.local.jsonc",
]);
