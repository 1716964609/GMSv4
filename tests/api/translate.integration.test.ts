import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyMigrationQueries, createDatabase } from "../../src/db/client";
import { POST } from "../../app/api/translate/route";

let directory: string;
let databasePath: string;
let previousDatabaseUrl: string | undefined;
let previousProvider: string | undefined;

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "gmsv4-api-test-"));
  databasePath = join(directory, "api.sqlite");
  await migrate(createDatabase(databasePath), async (queries) => applyMigrationQueries(queries, databasePath), { migrationsFolder: "./drizzle" });
  previousDatabaseUrl = process.env.DATABASE_URL;
  previousProvider = process.env.TRANSLATION_PROVIDER;
  process.env.DATABASE_URL = databasePath;
  delete process.env.TRANSLATION_PROVIDER;
});

afterEach(() => {
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  if (previousProvider === undefined) delete process.env.TRANSLATION_PROVIDER;
  else process.env.TRANSLATION_PROVIDER = previousProvider;
  rmSync(directory, { recursive: true, force: true });
});

function form(fields: { sourceText?: string; glossary?: string }) {
  const body = new FormData();
  body.set("sourceText", fields.sourceText ?? "hello");
  body.set("sourceLang", "EN");
  body.set("targetLang", "JA");
  if (fields.glossary !== undefined) body.set("glossary", new File([fields.glossary], "glossary.json", { type: "application/json" }));
  return body;
}

function glossaryJson(count: number) {
  return JSON.stringify(Array.from({ length: count }, (_, index) => ({
    source_term: `term-${index}`,
    target_term: `用語-${index}`,
    source_lang: index % 2 === 0 ? "EN" : "DE",
    target_lang: index % 2 === 0 ? "JA" : "EN"
  })));
}

test("UC-001 API returns only the final translation after glossary persistence", async () => {
  const response = await POST(new Request("http://localhost/api/translate", { method: "POST", body: form({ glossary: JSON.stringify([{ source_term: "hello", target_term: "こんにちは", source_lang: "EN", target_lang: "JA" }]) }) }));
  const body = await response.json() as Record<string, unknown>;

  assert.equal(response.status, 200);
  assert.equal(body.finalTranslation, "[mock-gpt] [mock-deepl] hello");
  assert.equal(Object.hasOwn(body, "intermediateTranslation"), false);

  const database = new DatabaseSync(databasePath);
  assert.equal((database.prepare("SELECT COUNT(*) AS count FROM glossary_entries").get() as { count: number }).count, 1);
  database.close();
});

test("UC-001 API succeeds without a glossary and stores no entries", async () => {
  const response = await POST(new Request("http://localhost/api/translate", { method: "POST", body: form({}) }));
  const body = await response.json() as Record<string, unknown>;

  assert.equal(response.status, 200);
  assert.equal(body.finalTranslation, "[mock-gpt] [mock-deepl] hello");

  const database = new DatabaseSync(databasePath);
  assert.equal((database.prepare("SELECT COUNT(*) AS count FROM glossary_entries").get() as { count: number }).count, 0);
  database.close();
});

test("UC-001 API rejects invalid glossary input before provider execution", async () => {
  const response = await POST(new Request("http://localhost/api/translate", { method: "POST", body: form({ glossary: "{invalid" }) }));
  assert.equal(response.status, 400);

  const database = new DatabaseSync(databasePath);
  assert.equal((database.prepare("SELECT COUNT(*) AS count FROM glossary_entries").get() as { count: number }).count, 0);
  database.close();
});

test("UC-001 API accepts 0, 1, and 1,000 uploaded glossary entries", async () => {
  for (const count of [0, 1, 1_000]) {
    const response = await POST(new Request("http://localhost/api/translate", {
      method: "POST",
      body: form({ glossary: glossaryJson(count) })
    }));
    assert.equal(response.status, 200, `expected ${count} entries to be accepted`);
  }
});

test("UC-001 API rejects 1,001 uploaded glossary entries before translation or persistence", async () => {
  const response = await POST(new Request("http://localhost/api/translate", {
    method: "POST",
    body: form({ glossary: glossaryJson(1_001) })
  }));
  const body = await response.json() as { error?: string };

  assert.equal(response.status, 400);
  assert.match(body.error ?? "", /no more than 1000 entries/);

  const database = new DatabaseSync(databasePath);
  assert.equal((database.prepare("SELECT COUNT(*) AS count FROM glossary_entries").get() as { count: number }).count, 0);
  database.close();
});

test("UC-001 API rejects empty Original Text", async () => {
  const response = await POST(new Request("http://localhost/api/translate", { method: "POST", body: form({ sourceText: "" }) }));
  const body = await response.json() as { error?: string };
  assert.equal(response.status, 400);
  assert.match(body.error ?? "", /Original Text is required/);
});
