import { createDatabase } from "../../db/client";
import { glossaryEntries } from "../../db/schema";
import type { GlossaryEntry } from "./types";
import type { GlossaryPersistence } from "../translation/types";

export function createGlossaryPersistence(databaseUrl?: string): GlossaryPersistence {
  const database = createDatabase(databaseUrl);

  return {
    async appendAtomic(entries: GlossaryEntry[]) {
      await database.transaction(async (transaction) => {
        for (const entry of entries) {
          await transaction.insert(glossaryEntries).values({
            sourceTerm: entry.source_term,
            targetTerm: entry.target_term,
            sourceLang: entry.source_lang,
            targetLang: entry.target_lang
          }).run();
        }
      });
    }
  };
}
