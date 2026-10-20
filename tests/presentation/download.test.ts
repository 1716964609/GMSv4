import assert from "node:assert/strict";
import test from "node:test";
import { createTranslationDownload } from "../../src/modules/presentation/download";

test("FR-007 creates a TXT download payload for the final translation", () => {
  assert.deepEqual(createTranslationDownload("final text"), {
    fileName: "gms-translation.txt",
    mimeType: "text/plain;charset=utf-8",
    content: "final text"
  });
});
