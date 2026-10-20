import type { GlossaryEntry } from "./types";

const GLOSSARY_FIELDS = ["source_term", "target_term", "source_lang", "target_lang"];

export function parseGlossaryJson(value: unknown): GlossaryEntry[] {
  if (!Array.isArray(value)) {
    throw new Error("Glossary must be a JSON array.");
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Glossary entry ${index + 1} must be an object.`);
    }

    const keys = Object.keys(entry);
    if (keys.length !== GLOSSARY_FIELDS.length || keys.some((key) => !GLOSSARY_FIELDS.includes(key))) {
      throw new Error(`Glossary entry ${index + 1} must contain exactly the four canonical fields.`);
    }

    const candidate = entry as Record<string, unknown>;
    for (const field of GLOSSARY_FIELDS) {
      if (typeof candidate[field] !== "string") {
        throw new Error(`Glossary entry ${index + 1} field ${field} must be a string.`);
      }
    }

    return {
      source_term: candidate.source_term as string,
      target_term: candidate.target_term as string,
      source_lang: candidate.source_lang as string,
      target_lang: candidate.target_lang as string
    };
  });
}
