# GMS v4 contribution guidance

- Treat `docs/requirements.md`, `docs/entity-model.md`, and `docs/use-cases/UC-001.md` as the authoritative specification sources for requirements, domain concepts, and behavior. `docs/use_cases.puml` is the supporting use-case diagram.
- Use TypeScript, React, Next.js App Router, Node.js, and SQLite (deferred until Step 6) in one Modular Monolith application managed with npm.
- Reference Use Case IDs, such as `UC-001`, in implementation and automated tests.
- Update the specifications before intentionally changing system behavior.
- Keep changes small and reviewable. Do not invent business rules that are not specified.
