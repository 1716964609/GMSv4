# GMS v4

GMS v4 is a glossary-aware translation web application. It translates operator-provided text through two sequential stages:

1. DeepL produces an intermediate translation using terminology from the current upload.
2. GPT post-edits that translation and returns the final translation.

The final translation is returned only after the required processing and glossary persistence steps have succeeded.

## Project status

This repository implements the AI Unified Process (AIUP) Steps 1–10 for the current draft specification baseline:

1. Product Vision
2. Requirements Catalog
3. Entity Model
4. Use Case Diagram
5. Project Scaffolding
6. Database Migration
7. System Use Case Specification
8. AI Implementation
9. Automated Tests
10. End-to-End Tests

The authoritative requirements and behavior are documented in:

- [`docs/requirements.md`](docs/requirements.md)
- [`docs/entity-model.md`](docs/entity-model.md)
- [`docs/use-cases/UC-001.md`](docs/use-cases/UC-001.md)

The use-case diagram is in [`docs/use_cases.puml`](docs/use_cases.puml).

## Architecture

GMS v4 is a single deployable Modular Monolith:

- TypeScript
- React
- Next.js App Router
- Node.js
- SQLite with Drizzle ORM
- npm

There are no separate frontend and backend services. The main modules are:

```text
app/                         Next.js pages and API routes
src/modules/presentation/    Browser-facing presentation helpers
src/modules/translation/     UC-001 workflow and provider selection
src/modules/glossary/        Glossary validation and persistence
src/modules/external-provider/DeepL, OpenAI, and mock adapters
src/db/                      SQLite client, schema, and migrations
tests/                       Unit, integration, contract, and E2E tests
```

## Requirements and glossary rules

- Original Text and source/target languages are required.
- A JSON Glossary upload is optional.
- An uploaded JSON array contains zero to 1,000 entries in total, including mixed language pairs.
- Each entry contains exactly `source_term`, `target_term`, `source_lang`, and `target_lang`.
- Duplicate detection, deduplication, conflict resolution, and linguistic language detection are not performed.
- Only entries from the current upload are sent to DeepL and GPT. Previously persisted entries are not queried for translation.
- After both translation stages succeed, all uploaded entries are appended atomically to the cumulative SQLite Glossary.
- The persistent Glossary does not replace or delete previous entries.
- Original Text, Intermediate Translation, Final Translation, and translation history are not persisted.
- A failed request never returns the Intermediate Translation as a successful result.

## Prerequisites

- Node.js with the built-in `node:sqlite` runtime used by this project
- npm

Install dependencies:

```bash
npm install
```

## Local setup

Copy the safe template and review the values before running the application:

```bash
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Open <http://localhost:3000>.

The SQLite database is created at `./data/gmsv4.sqlite` by default. Database files are local runtime data and are ignored by Git. Migration source files under `drizzle/` are tracked.

## Mock mode

Mock mode is the default unless `TRANSLATION_PROVIDER=real` is set. It does not call DeepL or OpenAI and is suitable for local development, automated tests, and demonstrations.

To make the mode explicit:

```bash
TRANSLATION_PROVIDER=mock npm run dev
```

## Real API configuration

Real providers are server-side only. Never put API keys in browser code, commit them, or include them in logs.

Set the following values in an ignored `.env.local` file or the deployment secret manager:

```env
TRANSLATION_PROVIDER=real
DATABASE_URL=./data/gmsv4.sqlite
DEEPL_API_URL=https://api-free.deepl.com
DEEPL_API_KEY=<server-side DeepL API key>
OPENAI_API_URL=https://api.openai.com
OPENAI_API_KEY=<server-side OpenAI API key>
OPENAI_MODEL=gpt-6-luna
OPENAI_MAX_COMPLETION_TOKENS=4096
```

`OPENAI_MAX_COMPLETION_TOKENS` is optional. The OpenAI adapter uses Chat Completions with `reasoning_effort=medium`, omits incompatible sampling parameters, and rejects truncated or refused responses.

For a glossary-aware request, the DeepL adapter creates a request-scoped temporary glossary, applies its ID to translation, and attempts cleanup on success or failure. Cleanup is best effort and does not change the UC-001 success gate. Glossary language codes are normalized to root codes when creating DeepL dictionaries, while translation variants remain available for the translation request.

Do not perform a first live request until the API keys, model access, account limits, and expected costs have been independently approved.

## Database

Apply the version-controlled migration with:

```bash
npm run db:migrate
```

The schema contains only the `glossary_entries` table with the four canonical glossary fields. No translation text, user table, authentication data, or translation-history table is created.

## Verification

Run the full local verification suite:

```bash
npm run typecheck
npm test
npm run test:translation
npm run test:e2e
npm run build
git diff --check
```

The E2E runner uses Chromium, mock providers, and an isolated temporary SQLite database. Contract tests use local HTTP stubs and never call the real DeepL or OpenAI endpoints.

## Publication and security notes

- `.env.example` contains placeholders only; `.env.local` and other environment files are ignored.
- SQLite files, Next.js output, `node_modules`, Playwright reports, and test results are ignored.
- Do not add downloaded test data, API responses, credentials, or personal documents to the repository.
- Review `git status` and `git diff --cached` before any publication or commit.
