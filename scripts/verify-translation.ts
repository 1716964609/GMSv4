import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyMigrationQueries } from "../src/db/client";
import { createGlossaryPersistence } from "../src/modules/glossary/repository";
import { parseGlossaryJson } from "../src/modules/glossary/validation";
import { mockMachineTranslator, mockPostEditor } from "../src/modules/external-provider/mock";
import { createTranslationService } from "../src/modules/translation/service";
import type { GlossaryEntry } from "../src/modules/glossary/types";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "gmsv4-translation-"));
const databasePath = join(temporaryDirectory, "translation.sqlite");

async function prepareDatabase() {
  const database = new DatabaseSync(databasePath);
  await migrate((await import("../src/db/client")).createDatabase(databasePath), async (queries) => applyMigrationQueries(queries, databasePath), { migrationsFolder: "./drizzle" });
  database.close();
}

async function main() {
  try {
    await prepareDatabase();

    const glossary: GlossaryEntry[] = [{ source_term: "hello", target_term: "こんにちは", source_lang: "EN", target_lang: "JA" }];
    assert.deepEqual(parseGlossaryJson(glossary), glossary);
    assert.throws(() => parseGlossaryJson([{ ...glossary[0], extra: "not allowed" }]));

    const persistence = createGlossaryPersistence(databasePath);
    const service = createTranslationService({ machineTranslator: mockMachineTranslator, postEditor: mockPostEditor, glossaryPersistence: persistence });
    const withGlossary = await service.translate({ sourceText: "hello", sourceLang: "EN", targetLang: "JA", glossary, glossaryUploaded: true });
    assert.equal(withGlossary.finalTranslation, "[mock-gpt] [mock-deepl] hello");

    const withoutGlossary = await service.translate({ sourceText: "goodbye", sourceLang: "EN", targetLang: "JA", glossary: [], glossaryUploaded: false });
    assert.equal(withoutGlossary.finalTranslation, "[mock-gpt] [mock-deepl] goodbye");

    let postEditorCalled = false;
    await assert.rejects(() => createTranslationService({
      machineTranslator: { async translate() { throw new Error("DeepL down"); } },
      postEditor: { async edit() { postEditorCalled = true; return "unexpected"; } },
      glossaryPersistence: { async appendAtomic() { throw new Error("must not run"); } }
    }).translate({ sourceText: "x", sourceLang: "EN", targetLang: "JA", glossary, glossaryUploaded: true }), /DeepL translation failed/);
    assert.equal(postEditorCalled, false);

    let persistenceCalled = false;
    await assert.rejects(() => createTranslationService({
      machineTranslator: mockMachineTranslator,
      postEditor: { async edit() { throw new Error("GPT down"); } },
      glossaryPersistence: { async appendAtomic() { persistenceCalled = true; } }
    }).translate({ sourceText: "x", sourceLang: "EN", targetLang: "JA", glossary, glossaryUploaded: true }), /GPT post-editing failed/);
    assert.equal(persistenceCalled, false);

    await assert.rejects(() => createTranslationService({
      machineTranslator: mockMachineTranslator,
      postEditor: mockPostEditor,
      glossaryPersistence: { async appendAtomic() { throw new Error("database down"); } }
    }).translate({ sourceText: "x", sourceLang: "EN", targetLang: "JA", glossary, glossaryUploaded: true }), /Glossary persistence failed/);

    const database = new DatabaseSync(databasePath);
    const inserted = database.prepare("SELECT source_term, target_term, source_lang, target_lang FROM glossary_entries").all();
    assert.equal(inserted.length, 1);
    database.exec("CREATE TRIGGER fail_second_insert BEFORE INSERT ON glossary_entries WHEN (SELECT COUNT(*) FROM glossary_entries) >= 1 BEGIN SELECT RAISE(ABORT, 'forced failure'); END;");
    await assert.rejects(() => persistence.appendAtomic([
      { source_term: "one", target_term: "一", source_lang: "EN", target_lang: "JA" },
      { source_term: "two", target_term: "二", source_lang: "EN", target_lang: "JA" }
    ]));
    assert.equal((database.prepare("SELECT COUNT(*) AS count FROM glossary_entries").get() as { count: number }).count, 1);
    database.close();

    console.log("Translation workflow verification passed.");
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
