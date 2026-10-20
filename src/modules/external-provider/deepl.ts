import type { MachineTranslationProvider } from "../translation/types";

export class DeepLProvider implements MachineTranslationProvider {
  async translate({ sourceText, sourceLang, targetLang, glossary }: Parameters<MachineTranslationProvider["translate"]>[0]) {
    const apiKey = process.env.DEEPL_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPL_API_KEY is not configured.");
    }

    const glossaryId = process.env.DEEPL_GLOSSARY_ID;
    if (glossary.length > 0 && !glossaryId) {
      throw new Error("DEEPL_GLOSSARY_ID is required for glossary-aware DeepL requests.");
    }

    const response = await fetch(process.env.DEEPL_API_URL ?? "https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: [sourceText],
        source_lang: sourceLang,
        target_lang: targetLang,
        ...(glossaryId ? { glossary_id: glossaryId } : {})
      })
    });

    if (!response.ok) {
      throw new Error(`DeepL returned HTTP ${response.status}.`);
    }

    const body = await response.json() as { translations?: Array<{ text?: string }> };
    const translation = body.translations?.[0]?.text;
    if (!translation) {
      throw new Error("DeepL returned no translation.");
    }

    return translation;
  }
}
