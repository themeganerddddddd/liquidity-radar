import { spawnSync } from "node:child_process";
import path from "node:path";

export function runWrangler(args: string[]) {
  const executable = process.execPath;
  const cli = path.join(
    process.cwd(),
    "node_modules",
    "wrangler",
    "bin",
    "wrangler.js",
  );
  const result = spawnSync(executable, [cli, ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      XDG_CONFIG_HOME: path.join(process.cwd(), ".wrangler", "xdg"),
      WRANGLER_LOG_PATH: path.join(process.cwd(), ".wrangler", "logs"),
      WRANGLER_WRITE_LOGS: "false",
    },
    encoding: "utf8",
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
