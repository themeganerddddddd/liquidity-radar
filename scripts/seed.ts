import { runWrangler } from "./wrangler";

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

console.log("Seeded Northstar Strategy and fictional demonstration records.");
console.log("Customer: customer@liquidityradar.local / RadarDemo!2026");
console.log("Analyst: analyst@liquidityradar.local / RadarDemo!2026");
console.log("Admin: admin@liquidityradar.local / RadarDemo!2026");
console.log("Demonstration API key: lr_demo_local_2026");
