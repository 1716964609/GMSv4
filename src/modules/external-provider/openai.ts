import type { PostEditingProvider } from "../translation/types";

export class OpenAIProvider implements PostEditingProvider {
  async edit({ sourceText, intermediateTranslation, sourceLang, targetLang, glossary }: Parameters<PostEditingProvider["edit"]>[0]) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    const response = await fetch(process.env.OPENAI_API_URL ?? "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: "Post-edit the translation. Return only the final translated text. Preserve applicable target terminology from the glossary."
          },
          {
            role: "user",
            content: JSON.stringify({ sourceText, intermediateTranslation, sourceLang, targetLang, glossary })
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI returned HTTP ${response.status}.`);
    }

    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const finalTranslation = body.choices?.[0]?.message?.content?.trim();
    if (!finalTranslation) {
      throw new Error("OpenAI returned no final translation.");
    }

    return finalTranslation;
  }
}
