import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import { applyMigrationQueries, createDatabase } from "../src/db/client";

const databaseDirectory = mkdtempSync(join(tmpdir(), "gmsv4-e2e-"));
const databasePath = join(databaseDirectory, "e2e.sqlite");

async function main() {
  await migrate(createDatabase(databasePath), async (queries) => applyMigrationQueries(queries, databasePath), {
    migrationsFolder: "./drizzle"
  });

  const child = spawn("npx", ["playwright", "test"], {
    env: {
      ...process.env,
      DATABASE_URL: databasePath,
      TRANSLATION_PROVIDER: "mock"
    },
    stdio: "inherit"
  });

  child.on("close", (code, signal) => {
    rmSync(databaseDirectory, { recursive: true, force: true });
    if (signal) {
      process.kill(process.pid, signal);
    }
    process.exitCode = code ?? 1;
  });
}

main().catch((error) => {
  rmSync(databaseDirectory, { recursive: true, force: true });
  console.error(error);
  process.exitCode = 1;
});
