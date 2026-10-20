import type { GlossaryPersistence, MachineTranslationProvider, PostEditingProvider, TranslationRequest } from "./types";

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
      let intermediateTranslation: string;
      try {
        intermediateTranslation = await dependencies.machineTranslator.translate({
          sourceText: request.sourceText,
          sourceLang: request.sourceLang,
          targetLang: request.targetLang,
          glossary: request.glossary
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
          glossary: request.glossary
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
