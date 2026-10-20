import { DeepLProvider } from "../external-provider/deepl";
import { mockMachineTranslator, mockPostEditor } from "../external-provider/mock";
import { OpenAIProvider } from "../external-provider/openai";
import { createGlossaryPersistence } from "../glossary/repository";
import { createTranslationService } from "./service";

export function createRuntimeTranslationService() {
  const useRealProviders = process.env.TRANSLATION_PROVIDER === "real";

  return createTranslationService({
    machineTranslator: useRealProviders ? new DeepLProvider() : mockMachineTranslator,
    postEditor: useRealProviders ? new OpenAIProvider() : mockPostEditor,
    glossaryPersistence: createGlossaryPersistence()
  });
}
