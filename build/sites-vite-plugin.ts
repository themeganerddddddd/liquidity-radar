import { access, cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { writeClientMotionSnapshot } from "../scripts/write-client-motion-snapshot";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

// Packages Sites metadata and migrations after Vite finishes compiling.
export function sites(): Plugin {
  let root = process.cwd();

  return {
    name: "sites",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    async closeBundle() {
      const outputDirectory = resolve(root, "dist", ".openai");
      const hostingConfig = resolve(root, ".openai", "hosting.json");
      const drizzleSource = resolve(root, "drizzle");
      const serverOnlySnapshot = resolve(
        root,
        "dist",
        "client",
        "data",
        "money-in-motion.json",
      );
      const packagedSnapshot = resolve(
        root,
        "dist",
        "client",
        "data",
        "money-in-motion-client.json.gz",
      );
      const snapshotSource = resolve(
        root,
        "public",
        "data",
        "money-in-motion.json",
      );

      await rm(outputDirectory, { recursive: true, force: true });
      if (await exists(snapshotSource)) {
        await mkdir(resolve(root, "dist", "client", "data"), {
          recursive: true,
        });
        await writeClientMotionSnapshot(snapshotSource, packagedSnapshot);
      }
      await rm(serverOnlySnapshot, { force: true });
      await mkdir(outputDirectory, { recursive: true });

      if (await exists(hostingConfig)) {
        await cp(hostingConfig, resolve(outputDirectory, "hosting.json"));
      }
      if (await exists(drizzleSource)) {
        await cp(drizzleSource, resolve(outputDirectory, "drizzle"), {
          recursive: true,
        });
      }
    },
  };
}
