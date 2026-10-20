import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyMigrationQueries, createDatabase } from "../../src/db/client";
import { createGlossaryPersistence } from "../../src/modules/glossary/repository";

test("Glossary persistence appends current entries and rolls back the whole batch", async () => {
  const directory = mkdtempSync(join(tmpdir(), "gmsv4-repository-test-"));
  const databasePath = join(directory, "test.sqlite");

  try {
    await migrate(createDatabase(databasePath), async (queries) => applyMigrationQueries(queries, databasePath), { migrationsFolder: "./drizzle" });
    const persistence = createGlossaryPersistence(databasePath);
    await persistence.appendAtomic([{ source_term: "one", target_term: "一", source_lang: "EN", target_lang: "JA" }]);

    const database = new DatabaseSync(databasePath);
    assert.equal((database.prepare("SELECT COUNT(*) AS count FROM glossary_entries").get() as { count: number }).count, 1);
    database.exec("CREATE TRIGGER fail_second_insert BEFORE INSERT ON glossary_entries WHEN (SELECT COUNT(*) FROM glossary_entries) >= 1 BEGIN SELECT RAISE(ABORT, 'forced failure'); END;");

    await assert.rejects(() => persistence.appendAtomic([
      { source_term: "two", target_term: "二", source_lang: "EN", target_lang: "JA" },
      { source_term: "three", target_term: "三", source_lang: "EN", target_lang: "JA" }
    ]));

    assert.equal((database.prepare("SELECT COUNT(*) AS count FROM glossary_entries").get() as { count: number }).count, 1);
    database.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
