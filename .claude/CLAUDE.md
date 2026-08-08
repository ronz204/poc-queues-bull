# Cascade

Cascade is the working name for this repo's domain: a fake e-commerce order-processing monolith whose only real purpose is to be a learning harness for BullMQ on Redis, with PostgreSQL as the source of truth for business state. There's no ship date and no deadline — it's not a product. See `.claude/docs/overview.md` for the full framing and the phase-by-phase roadmap.

The repo/package name (`poc-engine`, infra name `bullky`) and the domain nickname `Cascade` refer to the same thing — `poc-engine` is where the code lives, `Cascade` is what the docs call the domain it implements.

## Knowledge base layout

This repo's documentation lives under `.claude/`, alongside the rules/skills that act on it. Know which piece to reach for before you go looking:

- **`.claude/docs/`** (English) — engineering reference cross-checked against the actual codebase: what Cascade is, module requirements, architecture, DB design. No product framing (there is no product), self-contained files. This is what grounds implementation work.
- **`.claude/rules/`** (English) — conventions that load automatically when a matching file is opened or edited, instead of being read on demand.
- **`.claude/skills/`** (project-scoped) — capabilities to reach for across tasks: `archivist`, `specifier`.
- **`projects/<project>/deltas/`** — per-project, finer-grained than `.claude/docs/`: each slice's living `<slice>.spec.md`, plus an optional `<slice>.docs.md` for supplementary theory/context. Flat files, no per-slice subfolder, no decision history. Not under `.claude/` because it belongs to the project it describes, not to the cross-project reference layer.

No `.claude/agents/` in this repo — subagents aren't used here; everything routes through the two skills above.

**Precedence when a doc disagrees with the code:** the actual code always wins. Don't silently propagate a stale doc — flag the mismatch, and update the file only in the direction of improvement (never regress a doc just to match old content).

### `.claude/docs/` — the engineering reference

Maintained via the `archivist` skill: every claim is checked against the actual codebase, never carried over by assumption.

| File | Purpose | Consult when |
|---|---|---|
| `.claude/docs/overview.md` | What Cascade is and why the domain (not a "feature demo") serves the learning goal, the phase-0–7 roadmap, explicit non-goals, design principles | Confirming whether something is in scope for the current phase, or why a domain decision was made a certain way |
| `.claude/docs/modules.md` | Cross-cutting BullMQ requirements (queue/worker definition, job reliability, throughput control, observability, process lifecycle) plus the Order Processing module's flow, sub-flows, and an integration/risk summary by phase | Implementing or reviewing any queue, job, or worker behavior |
| `.claude/docs/structure.md` | The two-entrypoint (`api`/`worker`) architectural decision, service map, stack + rationale, the queue/background-job pattern, environments and configuration | Backend, infra, queue, or cross-process changes |
| `.claude/docs/database.md` | Postgres schema design for `orders`/`order_events` — columns, enums, indexes, what was deliberately left out, open questions. Target shape only; no migration has created these tables yet | Writing the first Drizzle schema/migration, or any schema change afterward |

### `.claude/rules/` — conventions applied automatically

- **`sanitize.md`** — global (no `paths:`), applies to every file in the repo. Language-agnostic design principles: Domain-Driven Design, Spec-Driven Development, SOLID, high cohesion/low coupling, DRY, immutability, predictable behavior and failure handling, and a non-goals section against premature abstraction.

No per-stack or per-path rules yet (nothing scoped to `projects/poc-engine/**` specifically, no Drizzle-migration rule, no test-file rule) — `sanitize.md` is the only one, and it's deliberately stack-agnostic. Add a scoped rule via `archivist` once a stack-specific convention actually needs enforcing on every matching edit, rather than folding it into `sanitize.md`.

### `.claude/skills/` — project-scoped capabilities

- **`archivist`** — creates and updates everything above plus each slice's `spec.md`/`docs.md`: `.claude/docs/`, `.claude/rules/`, new skills, and `projects/*/deltas/`. Invoke it whenever documenting an architecture decision, writing up a module, recording a DB/schema decision, capturing a coding convention, or writing/amending a slice's spec — it always inspects the real codebase before writing, never documents from memory or from conversation alone. Writes every artifact from a matching skeleton under its own `references/*.template.md`.
- **`specifier`** — the information-gathering step before a robust spec: investigates a slice's real implementation, checks it against existing docs/rules, and asks the targeted questions code alone can't answer (intent, boundaries, invariants, open decisions), then hands the result to `archivist` to write. Invoke it before creating or hardening a slice's `spec.md` — it never writes into `deltas/` itself.

### `projects/<project>/deltas/` — per-slice specs

Spec-Driven Development at the granularity of one cohesive capability (a "slice"), not one source file — e.g. a specific sub-flow of order processing. One required file per slice, one optional:

- **`<slice>.spec.md`** — the living, current contract: intent, scope/non-goals, contract, invariants, deferred/open questions, acceptance criteria. Edited in place as the slice's reality changes — this is the only durable record of the slice, so it has to stay complete and current on its own.
- **`<slice>.docs.md`** (optional) — supplementary theory or context that doesn't fit the spec's contract shape. Not a decision log — this repo deliberately doesn't keep a history of how a spec arrived at its current state, only the current state itself.

`projects/poc-engine/deltas/` exists but is empty — no slice has been specced yet. Use `specifier` to gather what a new slice's spec needs, then `archivist` to write it.

## Permissions

`.claude/settings.json` denies reading `.env`/`.env.*` files and blocks `git push`/`git pull` outright — don't attempt to work around either; ask the user to run those directly instead.

## Repo layout

Currently one deployable project under `projects/`:

- **`projects/poc-engine`** — Bun + Elysia backend, the only code in this repo today. Two entrypoints share one codebase (`api` and `worker` — see `structure.md` for why they're kept as separate processes). Drizzle ORM + PostgreSQL for persistence, BullMQ over Redis for job orchestration.

`services/` holds local infra (PostgreSQL, two separate Redis instances — one for BullMQ queues, one for caching) via `compose.yml`. See `.claude/docs/structure.md` for the full service map and stack rationale.
