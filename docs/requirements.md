# GMS v4 — Requirements Catalog

**Status:** Draft
**Version:** 0.2
**Methodology:** AI Unified Process / Spec-Driven Development

## 1. Product Vision

GMS v4 is an independent, glossary-aware translation web application.

Its primary objective is to produce translations that follow terminology explicitly defined by the user in a bring-your-own-glossary dataset.

The application combines three components:

1. Machine translation using the DeepL API.
2. Translation post-editing using a single GPT model through the OpenAI API.
3. A user-provided glossary containing source and target terminology.

The translation workflow consists of two sequential processing stages.

### Stage 1 — Glossary-Aware Machine Translation

The application provides the original text and applicable glossary entries to DeepL.

DeepL generates an initial translation while applying the user-provided terminology.

### Stage 2 — LLM Translation Post-Editing

The application provides the following inputs to the GPT model:

- Original source text
- Initial translation produced by DeepL
- User-provided glossary entries

The GPT model reviews and refines the initial translation to improve translation quality and align terminology with the user's glossary.

The GPT model must be instructed to preserve the user-specified target terminology when the corresponding source terms are applicable.

The Final Translation is returned to the Operator
only after both translation stages and any required
glossary persistence operation have completed successfully.

The initial application supports direct use by a single user without account registration or login.

---

## 2. Functional Requirements

| ID | Title | Description |
|---|---|---|
| FR-001 | Source Text Input | The user can enter original text into a browser text box, specify source and target languages, and submit a translation request. The Submit button remains disabled when the source text is empty. |
| FR-002 | Machine Translation Provider | The application uses the DeepL API as its sole machine translation provider. |
| FR-003 | LLM Provider | The application uses a single GPT model through the OpenAI API as its sole LLM for translation post-editing. |
| FR-004 | Glossary Upload and Accumulation | The Operator can optionally upload a glossary file in JSON format. Only entries from the current upload are used for the current translation. After both translation stages succeed, the application appends the uploaded entries to the persistent Glossary before returning a successful response. |
| FR-005 | Glossary-Aware Machine Translation | The application submits the original text, selected language pair, and applicable user-provided glossary terminology to DeepL. DeepL produces the initial translated text. |
| FR-006 | Glossary-Aware LLM Post-Editing | After FR-005, the application provides the original text, the DeepL translation, and the applicable glossary terminology to the GPT model. The model refines the translation and is instructed to follow the user-defined target terminology. Its output contains only the final translated text. |
| FR-007 | Translation Output | The application displays the final translated text in the browser and provides a Download button that saves the translation as a TXT file. |

---

## 3. Constraints

| ID | Title | Description |
|---|---|---|
| C-001 | Application Independence | GMS v4 operates as an independent application. |
| C-002 | Canonical Glossary Entry | Each glossary entry contains exactly four canonical fields: `source_term`, `target_term`, `source_lang`, and `target_lang`. |
| C-003 | Database Scope | Persistent application database storage is limited to glossary data. |
| C-004 | No Translation History | The application does not persist original text, intermediate translations, final translations, or translation history in its database. |