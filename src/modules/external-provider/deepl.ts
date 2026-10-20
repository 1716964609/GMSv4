import type { MachineTranslationProvider } from "../translation/types";

type DeepLResponse = {
  translations?: Array<{ text?: string }>;
};

type GlossaryResponse = {
  glossary_id?: string;
  glossaryId?: string;
};

type DeepLProviderOptions = {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
};

const DEFAULT_BASE_URL = "https://api-free.deepl.com";
const DEFAULT_TIMEOUT_MS = 30_000;

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, "").replace(/\/v2\/translate$/, "");
}

export function normalizeDeepLGlossaryLanguage(language: string) {
  return language.trim().split(/[-_]/, 1)[0].toUpperCase();
}

export class DeepLProvider implements MachineTranslationProvider {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: DeepLProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.DEEPL_API_KEY;
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? process.env.DEEPL_API_URL ?? DEFAULT_BASE_URL);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async translate({ sourceText, sourceLang, targetLang, glossary }: Parameters<MachineTranslationProvider["translate"]>[0]) {
    const apiKey = this.apiKey;
    if (!apiKey) {
      throw new Error("DEEPL_API_KEY is not configured.");
    }

    let glossaryId: string | undefined;
    try {
      if (glossary.length > 0) {
        glossaryId = await this.createTemporaryGlossary(glossary);
      }

      const response = await this.request("/v2/translate", {
        method: "POST",
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

      const body = await response.json() as DeepLResponse;
      const translation = body.translations?.[0]?.text;
      if (!translation) {
        throw new Error("DeepL returned no translation.");
      }

      return translation;
    } finally {
      if (glossaryId) {
        await this.deleteTemporaryGlossary(glossaryId);
      }
    }
  }

  private async createTemporaryGlossary(glossary: Parameters<MachineTranslationProvider["translate"]>[0]["glossary"]) {
    const dictionaries = new Map<string, string[]>();
    for (const entry of glossary) {
      const key = `${normalizeDeepLGlossaryLanguage(entry.source_lang)}->${normalizeDeepLGlossaryLanguage(entry.target_lang)}`;
      const entries = dictionaries.get(key) ?? [];
      entries.push(`${entry.source_term}\t${entry.target_term}`);
      dictionaries.set(key, entries);
    }

    const response = await this.request("/v3/glossaries", {
      method: "POST",
      body: JSON.stringify({
        name: `gmsv4-${crypto.randomUUID()}`,
        dictionaries: [...dictionaries.entries()].map(([key, entries]) => {
          const [sourceLang, targetLang] = key.split("->");
          return {
            source_lang: sourceLang,
            target_lang: targetLang,
            entries: entries.join("\n"),
            entries_format: "tsv"
          };
        })
      })
    });

    if (!response.ok) {
      throw new Error(`DeepL glossary creation returned HTTP ${response.status}.`);
    }

    const body = await response.json() as GlossaryResponse;
    const glossaryId = body.glossary_id ?? body.glossaryId;
    if (!glossaryId) {
      throw new Error("DeepL returned no temporary glossary ID.");
    }
    return glossaryId;
  }

  private async deleteTemporaryGlossary(glossaryId: string) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.request(`/v3/glossaries/${encodeURIComponent(glossaryId)}`, { method: "DELETE" });
        if (response.ok || response.status === 404) return;
      } catch {
        // Cleanup is best effort and must not mask the translation result or original error.
      }
    }
    console.error(JSON.stringify({
      event: "deepl_temporary_glossary_cleanup_failed",
      glossary_id: glossaryId,
      attempts: 2
    }));
  }

  private async request(path: string, init: { method: string; body?: string }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `DeepL-Auth-Key ${this.apiKey}`,
          "Content-Type": "application/json"
        },
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
