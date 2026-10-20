import type { GlossaryEntry } from "../glossary/types";

export interface TranslationRequest {
  sourceText: string;
  sourceLang: string;
  targetLang: string;
  glossary: GlossaryEntry[];
  glossaryUploaded: boolean;
}

export interface MachineTranslationProvider {
  translate(input: {
    sourceText: string;
    sourceLang: string;
    targetLang: string;
    glossary: GlossaryEntry[];
  }): Promise<string>;
}

export interface PostEditingProvider {
  edit(input: {
    sourceText: string;
    intermediateTranslation: string;
    sourceLang: string;
    targetLang: string;
    glossary: GlossaryEntry[];
  }): Promise<string>;
}

export interface GlossaryPersistence {
  appendAtomic(entries: GlossaryEntry[]): Promise<void>;
}

export interface TranslationServiceDependencies {
  machineTranslator: MachineTranslationProvider;
  postEditor: PostEditingProvider;
  glossaryPersistence: GlossaryPersistence;
}
