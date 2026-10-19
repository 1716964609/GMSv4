import { DatabaseSync } from "node:sqlite";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyMigrationQueries, createDatabase } from "../src/db/client";
import { glossaryEntries } from "../src/db/schema";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "gmsv4-db-"));
const databasePath = join(temporaryDirectory, "verification.sqlite");

async function main() {
 try {
  const firstConnection = new DatabaseSync(databasePath);
  const firstDatabase = createDatabase(databasePath);

  await migrate(firstDatabase, async (queries) => applyMigrationQueries(queries, databasePath), {
    migrationsFolder: "./drizzle"
  });

  const columns = firstConnection
    .prepare("PRAGMA table_info(glossary_entries)")
    .all() as Array<{ name: string; notnull: number }>;
  const expectedColumns = ["source_term", "target_term", "source_lang", "target_lang"];

  if (columns.map((column) => column.name).join(",") !== expectedColumns.join(",")) {
    throw new Error(`Unexpected columns: ${columns.map((column) => column.name).join(",")}`);
  }

  if (columns.some((column) => column.notnull !== 1)) {
    throw new Error("All glossary entry columns must be NOT NULL.");
  }

  await firstDatabase.insert(glossaryEntries).values({
    sourceTerm: "hello",
    targetTerm: "こんにちは",
    sourceLang: "EN",
    targetLang: "JA"
  }).run();

  const insertedRows = await firstDatabase.select().from(glossaryEntries).all();
  if (insertedRows.length !== 1 || insertedRows[0]?.sourceTerm !== "hello") {
    throw new Error("Inserted glossary entry could not be retrieved.");
  }

  firstConnection.close();

  const secondConnection = new DatabaseSync(databasePath);
  const secondDatabase = createDatabase(databasePath);
  await migrate(secondDatabase, async (queries) => applyMigrationQueries(queries, databasePath), {
    migrationsFolder: "./drizzle"
  });
  const reopenedRows = await secondDatabase.select().from(glossaryEntries).all();

  if (reopenedRows.length !== 1 || reopenedRows[0]?.targetTerm !== "こんにちは") {
    throw new Error("Glossary data was not preserved after reopening.");
  }

  secondConnection.close();
    console.log("Database verification passed.");
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
