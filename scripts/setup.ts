import { spawnSync } from "node:child_process";
import path from "node:path";

const nodeModules = path.join(process.cwd(), "node_modules");
const executable = process.execPath;
const tsxCli = path.join(nodeModules, "tsx", "dist", "cli.mjs");

const setupEnvironment = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || "development",
};

for (const script of ["scripts/migrate.ts", "scripts/seed.ts"]) {
  const result = spawnSync(executable, [tsxCli, script], {
    cwd: process.cwd(),
    env: setupEnvironment,
    encoding: "utf8",
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("");
console.log("Liquidity Radar is ready.");
console.log("Application: http://localhost:3000");
console.log("API schema: http://localhost:3000/api/v1/openapi.json");
console.log("Health: http://localhost:3000/health");
console.log("Local object storage: Cloudflare R2 development binding");
