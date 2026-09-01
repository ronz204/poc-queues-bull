# Cerve

A recurring analytics reporting engine over a synthetic sales dataset. It exists to practice, in one integrated system, four backend techniques: recurring job scheduling with multi-worker coordination, distributed locks with fencing tokens, and versioned cache-aside invalidation driven by domain events.

---

## Knowledge base layout

| Path | Holds |
|---|---|
| `.claude/docs/` | Self-contained reference files: project vision, build roadmap, architecture/stack, domain-mechanism expertise |
| `.claude/rules/` | Conventions auto-loaded when a matching file is opened/edited, scoped via `paths:` frontmatter |
| `.claude/skills/` | This project's delta methodology skills — surveyor (bootstrap), specifier (spec/design authoring), archivist (writes all knowledge-base artifacts), sentinel (drift checks) |
| `.claude/settings.json` | Permission policy — see Permissions below |
| `services/<service>/deltas/` | Per-slice spec/design/plan files: `<slice>.spec.md`, optional `<slice>.design.md`, optional `<slice>.plan.md` |

## Repo layout

| Path | Purpose |
|---|---|
| `justfile` | Task-runner wrappers around Docker Compose (`up`, `down`, `drop`) |
| `compose.yml` | Root Docker Compose entrypoint |
| `docker/data/` | Postgres local infra: its own `compose.yml`, `.env.sample`, provisioning scripts |
| `docker/redis/` | Redis local infra: its own `compose.yml`, `.env.sample`, config files |
| `services/` | Application code root. No service exists here yet — this is the target layout for the app once scaffolding starts. |

## Setup & common commands

| Task | Command |
|---|---|
| Start local infra | `just up` |
| Stop local infra | `just down` |
| Stop local infra and drop volumes | `just drop` |

No application package manifest exists yet, so there are no install/dev/test/build commands to list — these will be added once a service is scaffolded under `services/`.

## Permissions

The full policy lives in `.claude/settings.json`. Read-only and low-risk commands (git status/diff/log/show, `bun install`/`bun run`/`bunx`, Docker Compose up/down/ps/logs, WebSearch) are pre-approved; reading `.env*` files and `git push`/`git pull` are denied by default.

## Conventions

Hexagonal layering (domain/application/ports/adapters) is a project-wide, non-negotiable convention — see `.claude/rules/hexagonal-layering.md`.

---

## Non-goals

This project deliberately excludes a polished dashboard UI, authentication/authorization, multi-tenancy, and a real OLAP query engine — see `.claude/docs/overview.md` for the full scope boundary.
