import type { PostEditingProvider } from "../translation/types";

type OpenAIProviderOptions = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxCompletionTokens?: number;
  timeoutMs?: number;
};

const DEFAULT_BASE_URL = "https://api.openai.com";
const DEFAULT_TIMEOUT_MS = 30_000;

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, "").replace(/\/v1\/chat\/completions$/, "");
}

export class OpenAIProvider implements PostEditingProvider {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly maxCompletionTokens: number | undefined;
  private readonly timeoutMs: number;

  constructor(options: OpenAIProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? process.env.OPENAI_API_URL ?? DEFAULT_BASE_URL);
    this.model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-6-luna";
    const configuredMaxCompletionTokens = options.maxCompletionTokens ?? process.env.OPENAI_MAX_COMPLETION_TOKENS;
    this.maxCompletionTokens = configuredMaxCompletionTokens === undefined
      ? undefined
      : Number(configuredMaxCompletionTokens);
    if (this.maxCompletionTokens !== undefined && (!Number.isInteger(this.maxCompletionTokens) || this.maxCompletionTokens <= 0)) {
      throw new Error("OPENAI_MAX_COMPLETION_TOKENS must be a positive integer.");
    }
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async edit({ sourceText, intermediateTranslation, sourceLang, targetLang, glossary }: Parameters<PostEditingProvider["edit"]>[0]) {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          n: 1,
          reasoning_effort: "medium",
          ...(this.maxCompletionTokens === undefined ? {} : { max_completion_tokens: this.maxCompletionTokens }),
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
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(`OpenAI returned HTTP ${response.status}.`);
    }

    const body = await response.json() as {
      choices?: Array<{
        finish_reason?: string;
        message?: { content?: string; refusal?: string | null };
      }>;
    };
    const choice = body.choices?.[0];
    if (choice?.finish_reason === "length") {
      throw new Error("OpenAI response reached max_completion_tokens.");
    }
    if (choice?.message?.refusal) {
      throw new Error("OpenAI refused to produce a translation.");
    }
    const finalTranslation = choice?.message?.content?.trim();
    if (!finalTranslation) {
      throw new Error("OpenAI returned no final translation.");
    }

    return finalTranslation;
  }
}
