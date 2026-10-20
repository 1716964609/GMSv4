import type { MachineTranslationProvider, PostEditingProvider } from "../translation/types";

export const mockMachineTranslator: MachineTranslationProvider = {
  async translate({ sourceText }) {
    return `[mock-deepl] ${sourceText}`;
  }
};

export const mockPostEditor: PostEditingProvider = {
  async edit({ intermediateTranslation }) {
    return `[mock-gpt] ${intermediateTranslation}`;
  }
};
