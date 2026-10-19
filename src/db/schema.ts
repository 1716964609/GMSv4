import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const glossaryEntries = sqliteTable("glossary_entries", {
  sourceTerm: text("source_term").notNull(),
  targetTerm: text("target_term").notNull(),
  sourceLang: text("source_lang").notNull(),
  targetLang: text("target_lang").notNull()
});
