import assert from "node:assert/strict";
import test from "node:test";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { DeepLProvider } from "../../src/modules/external-provider/deepl";
import { OpenAIProvider } from "../../src/modules/external-provider/openai";
import type { GlossaryEntry } from "../../src/modules/glossary/types";

type Call = { method: string; path: string; body: Record<string, unknown> };

async function startStub(handler: (call: Call, response: ServerResponse) => void) {
  const calls: Call[] = [];
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString("utf8");
    const call = { method: request.method ?? "", path: request.url ?? "", body: raw ? JSON.parse(raw) as Record<string, unknown> : {} };
    calls.push(call);
    handler(call, response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    calls,
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  };
}

const glossary: GlossaryEntry[] = [{
  source_term: "heart failure",
  target_term: "心不全",
  source_lang: "EN",
  target_lang: "JA"
}];

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

test("UC-001 DeepL creates, uses, and cleans up a request-scoped glossary", async () => {
  const stub = await startStub((call, response) => {
    if (call.path === "/v3/glossaries" && call.method === "POST") {
      const dictionaries = call.body.dictionaries as Array<Record<string, unknown>>;
      assert.equal(dictionaries.length, 1);
      assert.equal(dictionaries[0].source_lang, "EN");
      assert.equal(dictionaries[0].target_lang, "JA");
      assert.equal(dictionaries[0].entries, "heart failure\t心不全");
      return json(response, 200, { glossary_id: "temporary-1" });
    }
    if (call.path === "/v2/translate" && call.method === "POST") {
      assert.equal(call.body.glossary_id, "temporary-1");
      return json(response, 200, { translations: [{ text: "中間訳" }] });
    }
    if (call.path === "/v3/glossaries/temporary-1" && call.method === "DELETE") {
      response.writeHead(204);
      return response.end();
    }
    response.writeHead(404);
    response.end();
  });

  try {
    const result = await new DeepLProvider({ apiKey: "test-deepl-key", baseUrl: stub.baseUrl }).translate({
      sourceText: "heart failure",
      sourceLang: "EN",
      targetLang: "JA",
      glossary
    });
    assert.equal(result, "中間訳");
    assert.deepEqual(stub.calls.map((call) => `${call.method} ${call.path}`), [
      "POST /v3/glossaries",
      "POST /v2/translate",
      "DELETE /v3/glossaries/temporary-1"
    ]);
  } finally {
    await stub.close();
  }
});

test("UC-001 DeepL cleans up after a provider failure without masking the original error", async () => {
  let cleanupAttempts = 0;
  const cleanupLogs: string[] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => cleanupLogs.push(String(args[0]));
  const stub = await startStub((call, response) => {
    if (call.path === "/v3/glossaries" && call.method === "POST") return json(response, 200, { glossary_id: "temporary-error" });
    if (call.path === "/v2/translate") return json(response, 502, { message: "provider unavailable" });
    if (call.path === "/v3/glossaries/temporary-error") {
      cleanupAttempts += 1;
      return json(response, 503, { message: "cleanup unavailable" });
    }
    response.writeHead(404);
    response.end();
  });

  try {
    await assert.rejects(
      () => new DeepLProvider({ apiKey: "test-deepl-key", baseUrl: stub.baseUrl }).translate({ sourceText: "x", sourceLang: "EN", targetLang: "JA", glossary }),
      /DeepL returned HTTP 502/
    );
    assert.equal(cleanupAttempts, 2);
  } finally {
    await stub.close();
    console.error = originalConsoleError;
  }
  assert.deepEqual(JSON.parse(cleanupLogs[0]), {
    event: "deepl_temporary_glossary_cleanup_failed",
    glossary_id: "temporary-error",
    attempts: 2
  });
});

test("UC-001 DeepL surfaces duplicate-term rejection and does not translate", async () => {
  const stub = await startStub((call, response) => {
    if (call.path === "/v3/glossaries") return json(response, 400, { message: "duplicate source term" });
    assert.fail(`unexpected provider call: ${call.method} ${call.path}`);
  });

  try {
    await assert.rejects(
      () => new DeepLProvider({ apiKey: "test-deepl-key", baseUrl: stub.baseUrl }).translate({ sourceText: "x", sourceLang: "EN", targetLang: "JA", glossary }),
      /DeepL glossary creation returned HTTP 400/
    );
    assert.equal(stub.calls.length, 1);
  } finally {
    await stub.close();
  }
});

test("UC-001 concurrent DeepL requests keep temporary glossary IDs isolated", async () => {
  let nextId = 1;
  const stub = await startStub((call, response) => {
    if (call.path === "/v3/glossaries") return json(response, 200, { glossary_id: `temporary-${nextId++}` });
    if (call.path === "/v2/translate") {
      const glossaryId = String(call.body.glossary_id);
      return json(response, 200, { translations: [{ text: `translation-${glossaryId}` }] });
    }
    if (call.path.startsWith("/v3/glossaries/") && call.method === "DELETE") {
      response.writeHead(204);
      return response.end();
    }
    response.writeHead(404);
    response.end();
  });

  try {
    const provider = new DeepLProvider({ apiKey: "test-deepl-key", baseUrl: stub.baseUrl });
    const results = await Promise.all([
      provider.translate({ sourceText: "one", sourceLang: "EN", targetLang: "JA", glossary }),
      provider.translate({ sourceText: "two", sourceLang: "EN", targetLang: "JA", glossary })
    ]);
    assert.deepEqual(new Set(results), new Set(["translation-temporary-1", "translation-temporary-2"]));
    assert.equal(stub.calls.filter((call) => call.method === "DELETE").length, 2);
  } finally {
    await stub.close();
  }
});

test("UC-001 OpenAI sends only the final-post-editing contract", async () => {
  const stub = await startStub((call, response) => {
    assert.equal(call.path, "/v1/chat/completions");
    assert.equal(call.body.model, "gpt-6-luna");
    assert.equal(call.body.n, 1);
    assert.equal(call.body.reasoning_effort, "medium");
    assert.equal(Object.hasOwn(call.body, "temperature"), false);
    assert.equal(Object.hasOwn(call.body, "top_p"), false);
    assert.equal(call.body.max_completion_tokens, 2048);
    const messages = call.body.messages as Array<{ role: string; content: string }>;
    const input = JSON.parse(messages[1].content) as Record<string, unknown>;
    assert.equal(input.sourceText, "原文");
    assert.equal(input.intermediateTranslation, "中間訳");
    assert.deepEqual(input.glossary, glossary);
    return json(response, 200, { choices: [{ message: { content: "最終訳" } }] });
  });

  try {
    const result = await new OpenAIProvider({ apiKey: "test-openai-key", baseUrl: stub.baseUrl, model: "gpt-6-luna", maxCompletionTokens: 2048 }).edit({
      sourceText: "原文",
      intermediateTranslation: "中間訳",
      sourceLang: "EN",
      targetLang: "JA",
      glossary
    });
    assert.equal(result, "最終訳");
  } finally {
    await stub.close();
  }
});
