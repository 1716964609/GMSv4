import type { GlossaryPersistence, MachineTranslationProvider, PostEditingProvider, TranslationRequest } from "./types";
import type { GlossaryEntry } from "../glossary/types";

function glossaryLanguageRoot(language: string) {
  return language.trim().split(/[-_]/, 1)[0].toUpperCase();
}

export class TranslationWorkflowError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TranslationWorkflowError";
  }
}

export function createTranslationService(dependencies: {
  machineTranslator: MachineTranslationProvider;
  postEditor: PostEditingProvider;
  glossaryPersistence: GlossaryPersistence;
}) {
  return {
    async translate(request: TranslationRequest) {
      const applicableGlossary = request.glossary.filter((entry: GlossaryEntry) =>
        glossaryLanguageRoot(entry.source_lang) === glossaryLanguageRoot(request.sourceLang) &&
        glossaryLanguageRoot(entry.target_lang) === glossaryLanguageRoot(request.targetLang)
      );

      let intermediateTranslation: string;
      try {
        intermediateTranslation = await dependencies.machineTranslator.translate({
          sourceText: request.sourceText,
          sourceLang: request.sourceLang,
          targetLang: request.targetLang,
          glossary: applicableGlossary
        });
      } catch (error) {
        throw new TranslationWorkflowError("DeepL translation failed.", { cause: error });
      }

      let finalTranslation: string;
      try {
        finalTranslation = await dependencies.postEditor.edit({
          sourceText: request.sourceText,
          intermediateTranslation,
          sourceLang: request.sourceLang,
          targetLang: request.targetLang,
          glossary: applicableGlossary
        });
      } catch (error) {
        throw new TranslationWorkflowError("GPT post-editing failed.", { cause: error });
      }

      if (request.glossaryUploaded) {
        try {
          await dependencies.glossaryPersistence.appendAtomic(request.glossary);
        } catch (error) {
          throw new TranslationWorkflowError("Glossary persistence failed.", { cause: error });
        }
      }

      return { finalTranslation };
    }
  };
}
