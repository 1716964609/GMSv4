import assert from "node:assert/strict";
import test from "node:test";
import { parseGlossaryJson } from "../../src/modules/glossary/validation";

test("UC-001 glossary validation accepts the four canonical string fields", () => {
  const entry = {
    source_term: "heart failure",
    target_term: "心不全",
    source_lang: "EN",
    target_lang: "JA"
  };

  assert.deepEqual(parseGlossaryJson([entry]), [entry]);
  assert.deepEqual(parseGlossaryJson([]), []);
});

test("UC-001 glossary validation rejects invalid JSON shapes", () => {
  assert.throws(() => parseGlossaryJson({}), /JSON array/);
  assert.throws(() => parseGlossaryJson([null]), /must be an object/);
  assert.throws(() => parseGlossaryJson([{ source_term: "x" }]), /exactly the four canonical fields/);
  assert.throws(() => parseGlossaryJson([{
    source_term: "x",
    target_term: "y",
    source_lang: "EN",
    target_lang: "JA",
    extra: "not allowed"
  }]), /exactly the four canonical fields/);
  assert.throws(() => parseGlossaryJson([{
    source_term: "x",
    target_term: "y",
    source_lang: "EN",
    target_lang: 42
  }]), /must be a string/);
});
