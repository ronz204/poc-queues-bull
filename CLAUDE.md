# Cerve

A recurring analytical reporting engine over a synthetic sales dataset. The point of the system is not the reports themselves but a domain that genuinely needs recurring job scheduling, multi-worker coordination, distributed locking with fencing tokens, and versioned cache-aside invalidation all at once — a vehicle for practicing those four mechanisms together instead of in isolation.

---

## Knowledge base layout

| Path | Holds |
|---|---|
| `.claude/docs/` | Self-contained reference files, one concern each: vision (`overview.md`), per-component functional reference (`modules.md`), stack/topology/infrastructure (`structure.md`), persistence (`database.md`), mechanism deep-dives (`expertise.md`), build sequencing (`approach.md`) |
| `.claude/rules/` | Conventions auto-loaded when a matching file is opened/edited, scoped via `paths:` frontmatter |
| `.claude/skills/` | This project's `archivist`/`specifier`/`sentinel`/`surveyor` knowledge-base pipeline |
| `.claude/settings.json` | Permission policy — see Permissions below |
| `deltas/` | Per-slice spec/design files (`<slice>.spec.md`, optional `<slice>.design.md`): `report-lifecycle` and `sales-ingestion` today; new slices get specced on demand via `specifier` as work on them starts |

## Setup & common commands

Scripts live in `package.json` (Bun): `bun run test`, `bun run lint` / `lint:fix`, `bun run drizz:migrate`, `bun run drizz:seeding`, `bun run dev:service`, `bun run dev:worker`. There's no typecheck script; TypeScript isn't a local dependency, so run it with `bunx -p typescript tsc --noEmit -p .`. Build progress is tracked in `ROADMAP.md`.

## Permissions

The full policy lives in `.claude/settings.json`. It denies pushing/pulling git remotes and reading `.env`/secrets files, and pre-approves read-only git inspection, `docker compose`/`docker exec`, `curl`, and `powershell`.

## Conventions

Project-wide conventions live as their own rule files under `.claude/rules/` and load automatically when a matching file is touched: bounded-context layering and port placement (`domain-layering.md`), application use-case layering and outbox recording (`usecase-layering.md`), English-only code and runtime strings (`lang-english-only.md`), how to size and scope a delta slice (`when-write-delta.md`), and how this knowledge base itself gets edited (`kb-deltas-routing.md`).
