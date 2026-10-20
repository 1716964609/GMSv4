import assert from "node:assert/strict";
import test from "node:test";
import { createTranslationService } from "../../src/modules/translation/service";
import type { GlossaryEntry } from "../../src/modules/glossary/types";

const currentGlossary: GlossaryEntry[] = [{
  source_term: "current",
  target_term: "現在",
  source_lang: "EN",
  target_lang: "JA"
}];

function request(overrides: Partial<Parameters<ReturnType<typeof createTranslationService>["translate"]>[0]> = {}) {
  return {
    sourceText: "current source",
    sourceLang: "EN",
    targetLang: "JA",
    glossary: currentGlossary,
    glossaryUploaded: true,
    ...overrides
  };
}

test("UC-001 executes DeepL before GPT and passes only the current upload", async () => {
  const events: string[] = [];
  let deepLInput: unknown;
  let gptInput: unknown;
  let persisted: unknown;
  const service = createTranslationService({
    machineTranslator: {
      async translate(input) {
        events.push("deepl");
        deepLInput = input;
        return "intermediate";
      }
    },
    postEditor: {
      async edit(input) {
        events.push("gpt");
        gptInput = input;
        return "final";
      }
    },
    glossaryPersistence: {
      async appendAtomic(entries) {
        events.push("persist");
        persisted = entries;
      }
    }
  });

  const result = await service.translate(request());

  assert.deepEqual(events, ["deepl", "gpt", "persist"]);
  assert.equal(result.finalTranslation, "final");
  assert.deepEqual((deepLInput as { glossary: GlossaryEntry[] }).glossary, currentGlossary);
  assert.equal((gptInput as { intermediateTranslation: string }).intermediateTranslation, "intermediate");
  assert.deepEqual((gptInput as { glossary: GlossaryEntry[] }).glossary, currentGlossary);
  assert.equal(persisted, currentGlossary);
});

test("UC-001 sends only applicable current-upload entries to providers but persists the full upload", async () => {
  const otherLanguageEntry: GlossaryEntry = {
    source_term: "heart failure",
    target_term: "Herzinsuffizienz",
    source_lang: "EN",
    target_lang: "DE"
  };
  let providerGlossary: GlossaryEntry[] | undefined;
  let persisted: GlossaryEntry[] | undefined;
  const service = createTranslationService({
    machineTranslator: {
      async translate(input) {
        providerGlossary = input.glossary;
        return "intermediate";
      }
    },
    postEditor: { async edit() { return "final"; } },
    glossaryPersistence: { async appendAtomic(entries) { persisted = entries; } }
  });

  await service.translate(request({ glossary: [...currentGlossary, otherLanguageEntry] }));

  assert.deepEqual(providerGlossary, currentGlossary);
  assert.deepEqual(persisted, [...currentGlossary, otherLanguageEntry]);
});

test("UC-001 treats DeepL root glossary languages as applicable to regional request variants", async () => {
  const rootEntry: GlossaryEntry = {
    source_term: "color",
    target_term: "colour",
    source_lang: "EN",
    target_lang: "EN"
  };
  let providerGlossary: GlossaryEntry[] | undefined;
  const service = createTranslationService({
    machineTranslator: { async translate(input) { providerGlossary = input.glossary; return "intermediate"; } },
    postEditor: { async edit() { return "final"; } },
    glossaryPersistence: { async appendAtomic() {} }
  });

  await service.translate(request({ sourceLang: "EN-US", targetLang: "EN-GB", glossary: [rootEntry] }));

  assert.deepEqual(providerGlossary, [rootEntry]);
});

test("UC-001 skips persistence when no glossary was uploaded", async () => {
  let persistenceCalled = false;
  const service = createTranslationService({
    machineTranslator: { async translate() { return "intermediate"; } },
    postEditor: { async edit() { return "final"; } },
    glossaryPersistence: { async appendAtomic() { persistenceCalled = true; } }
  });

  const result = await service.translate(request({ glossary: [], glossaryUploaded: false }));

  assert.equal(result.finalTranslation, "final");
  assert.equal(persistenceCalled, false);
});

test("UC-001 stops after DeepL failure and exposes no result", async () => {
  let gptCalled = false;
  let persistenceCalled = false;
  const service = createTranslationService({
    machineTranslator: { async translate() { throw new Error("provider failure"); } },
    postEditor: { async edit() { gptCalled = true; return "unexpected"; } },
    glossaryPersistence: { async appendAtomic() { persistenceCalled = true; } }
  });

  await assert.rejects(() => service.translate(request()), /DeepL translation failed/);
  assert.equal(gptCalled, false);
  assert.equal(persistenceCalled, false);
});

test("UC-001 stops after GPT failure and does not persist the intermediate result", async () => {
  let persisted: unknown;
  const service = createTranslationService({
    machineTranslator: { async translate() { return "intermediate"; } },
    postEditor: { async edit() { throw new Error("provider failure"); } },
    glossaryPersistence: { async appendAtomic(entries) { persisted = entries; } }
  });

  await assert.rejects(() => service.translate(request()), /GPT post-editing failed/);
  assert.equal(persisted, undefined);
});

test("UC-001 does not return final translation when persistence fails", async () => {
  const service = createTranslationService({
    machineTranslator: { async translate() { return "intermediate"; } },
    postEditor: { async edit() { return "final"; } },
    glossaryPersistence: { async appendAtomic() { throw new Error("database failure"); } }
  });

  await assert.rejects(() => service.translate(request()), /Glossary persistence failed/);
});
