---
name: archivist
description: Use whenever creating or updating anything in this project's Claude Code knowledge base — docs under `.claude/docs/`, rules under `.claude/rules/`, skills under `.claude/skills/`, or a slice's spec/docs file under any `projects/*/deltas/` directory (flat files: `<slice>.spec.md`, optionally `<slice>.docs.md`). Trigger this any time the user asks to document architecture, write up a decision, record a convention, scaffold a new skill, or write/update a spec before implementing something non-trivial — even without saying "documentation", e.g. "dejemos esto anotado", "hagamos un spec para X antes de tocar código", "turn this into a skill", "agreguemos esta convención a las reglas". Always inspect the actual project (code, existing docs, existing conventions) before writing anything; never document from memory or from the conversation alone.
---

# Archivist

Creates and updates every artifact in this project's Claude Code knowledge base: docs, rules, skills, and per-slice specs/docs. What makes this different from writing any one of those from scratch is threefold — every claim is grounded in the actual project instead of assumption, every artifact lands in the right *kind* of file instead of getting crammed into whichever one is open, and every kind has a matching skeleton in `references/` so its shape stays consistent across instances instead of being re-derived from prose each time. Docs live under `.claude/docs/`; per-slice specs live as flat files directly under each project's own `deltas/` directory (e.g. `projects/poc-engine/deltas/<slice>.spec.md`) — no per-slice subfolder, no append-only history log. A slice's `spec.md` is the only durable record of its current state.

---

## Step 0 — Read before you write

Never write or edit any of these from memory, from what the user just said, or from what an older doc says. Read the actual project first.

- If the artifact concerns part of the codebase, find and read the relevant source — actual files, actual migrations, actual config — not a description of them from earlier in the conversation.
- If it concerns infrastructure (roles, permissions, provisioning, deployment), check the actual provisioning scripts/migrations, not just what was decided in conversation — decisions drift from implementation.
- If it's a spec or docs file for a slice, read that slice's current `<slice>.spec.md` (if it exists) and its `<slice>.docs.md` (if present) first, so you don't contradict settled content silently — plus the actual source implementing the slice, the same discipline as any other artifact.
- If the user references a decision made earlier in chat ("ya cambiamos a X", "we already decided Y"), verify it landed in the actual project before documenting it as current. If it hasn't landed yet, say so and ask whether to document it as current or as planned/intended.
- Skim what already exists in `.claude/docs/`, `.claude/rules/`, `.claude/skills/`, and any `projects/*/deltas/*.spec.md` so you don't duplicate or contradict something already documented elsewhere.

If the actual project contradicts an existing doc, or contradicts what the user just described, don't silently resolve it — surface the conflict and let the user decide which one is current.

---

## Step 1 — Figure out what kind of artifact this is

| Content is... | Goes in |
|---|---|
| Stable reference material: architecture, domain concepts, provisioning facts, cross-cutting conventions — read occasionally, not applied on every edit | `.claude/docs/<topic>.md` |
| A convention that must be **applied every time** a certain kind of file is written or edited (schema conventions, a style rule, a pattern that must be repeated) | `.claude/rules/<topic>.md`, scoped via `paths:` frontmatter |
| A capability Claude Code should reach for across many tasks, potentially with bundled scripts/templates/references | `.claude/skills/<name>/SKILL.md` |
| The living, current contract for one project slice/capability — intent, contract, invariants, current state | `projects/<project>/deltas/<slice>.spec.md` |
| Supplementary theory/context for a slice that doesn't fit spec.md's living-contract shape — domain background, how a piece of technology/mechanism works, why a rule behaves the way it does. Optional, and never a decision log. | `projects/<project>/deltas/<slice>.docs.md` |

The doc-vs-rule line is about repetition (read occasionally vs. applied every time a matching file is touched). The rule-vs-skill line is about surface: a rule injects context automatically into whatever's already happening; a skill is a capability the main session pulls in deliberately, potentially with bundled scripts/references/assets. The doc-vs-spec line is about grain and ownership: a doc in `.claude/docs/` is cross-cutting reference material spanning the whole project; a slice's `spec.md` is finer-grained, lives inside the project it describes, and is expected to change as often as that slice does — a decision that stabilizes and matters beyond one slice graduates into `.claude/docs/`, it doesn't stay duplicated in both places. The spec-vs-docs line (within one slice) is about shape: `spec.md` is always structured as the same living contract; `docs.md` exists only when a slice needs free-form theory or mechanism explanation that wouldn't fit that shape without stretching it — most slices never need one.

If content doesn't cleanly fit an existing file, propose either a new section in the closest existing doc or a new file following the same naming/structure pattern already in use — don't force it into an unrelated file just to avoid creating one.

---

## Use the matching template

Most artifact kinds above have a fill-in skeleton in `references/`: `docs.template.md`, `rules.template.md`, `skills.template.md`, `spec.template.md`. Read the one that matches before writing, and fill it in rather than re-deriving the shape from the prose in the steps below each time — the templates carry the structure, the steps below carry the reasoning behind that structure.

**`<slice>.docs.md` is the one deliberate exception — it has no template.** It's meant to stay a loose, improvised write-up shaped by whatever the slice actually needs (a table here, a diagram there, a couple of paragraphs of explanation) rather than a fixed skeleton forcing every slice's supplementary context into the same sections. Still ground it in the real source/technology per Step 0, and still keep it out of decision-log territory (see Step 4) — just don't reach for a template to structure it.

---

## Step 2 — Writing conventions for docs and rules

These apply to `.claude/docs/*.md` and `.claude/rules/*.md`. The volatile-vs-durable reference rule below also governs `.claude/skills/*` — see Step 3:

- **No references to volatile implementation artifacts.** Never cite a specific file path, filename, or function/class/variable name as proof a convention exists (e.g. "already used in `deps.wiring.ts`" or "see `column.helper.ts`"), and never copy a table that already lives in a config file (a path-alias list belongs in `tsconfig.json` alone — point at it, don't duplicate it). These break the moment the file moves, gets renamed, or the stub gets filled in differently than expected — and nothing forces the doc to notice. Describe the *pattern*, not *where it currently lives*. Exception: a single-instance, tool-mandated config filename (`package.json`, `tsconfig.json`, `drizzle.config.ts`, `compose.yml`) is safe to name — renaming one breaks the tool itself, so it isn't actually volatile.
- **`.claude/docs/*.md` gets one carve-out from the rule above: durable architecture vocabulary.** A schema name, a module boundary, a bounded context, a security invariant — these describe the system's actual shape and only change via a deliberate architecture decision, which is exactly what a docs file exists to capture. What still doesn't belong, even in docs, is *where in the source tree* that shape is implemented — a specific file path stays off-limits there too. `.claude/rules/*.md` and `.claude/skills/*` don't get this carve-out — they describe process/convention, not the system's architecture, so they stay fully agnostic to implementation nouns as well as locations.
- **English**, regardless of what the source material or conversation was in.
- **Pure technical POV.** Strip product pitch, ROI framing, competitive positioning, sales language, business/legal framing — even if the source had it. If a business fact drives an engineering decision (e.g. a compliance requirement shaping a storage choice), state the *engineering implication*, not the business rationale.
- **Self-contained files.** Docs in `.claude/docs/` don't reference each other ("see X.md") — each should stand alone. Rules may reference a doc once if the split genuinely creates a dependency — keep it to the minimum, prefer restating a short fact over adding a pointer.
- **Plain section headers**, no emoji.
- **Tables** for comparisons, stack choices with rationale, risk/complexity summaries.
- **Fenced code blocks** for SQL, JSON, config snippets, ASCII diagrams — never describe a schema or query in prose when a code block says it exactly.
- **Explain why, not just what.** A convention stated without its reasoning gets silently violated the first time someone doesn't see why it matters.
- **Length:** docs stay ~100–200 lines — a section growing past that is a sign it belongs in a more specific file. Rules can run longer since they only load conditionally, but stay scoped to one concern.
- **Non-goals sections earn their place** when a scope boundary is easy to violate by accident.

### Rule mechanics

`.claude/rules/<name>.md` loads automatically when Claude Code reads a file matching the `paths:` glob patterns in the frontmatter — same priority as `CLAUDE.md`.

```yaml
---
paths:
  - "<glob pattern, quoted — YAML requires it for patterns starting with * or {>"
---
```

- Quote every glob pattern.
- Omit `paths:` entirely only for a rule meant to apply globally — this should be rare.
- One rule file per concern — a new convention with different trigger paths is a new rule, not an addition to an unrelated one.

---

## Step 3 — Writing new skills (`.claude/skills/<name>/SKILL.md`)

A skill's `name` + `description` are always in context; the body loads only when it triggers; anything under `scripts/`, `references/`, or `assets/` loads on demand.

- **`description` does double duty**: state what the skill does *and* when to use it, and lean slightly pushy — Claude tends to under-trigger skills, so spell out phrasings and contexts explicitly rather than trusting a vague description to be inferred.
- Keep the `SKILL.md` body under ~500 lines. If it's growing past that, split stable reference material into `references/*.md` and point to it from the body rather than inlining everything.
- Write instructions in the imperative, and explain *why* rather than issuing bare musts — same principle as docs and rules.
- Every new skill goes through the same Step 0 discipline: don't invent its instructions from a generic template — `references/skills.template.md` gives the *shape*, but the actual content still has to come from how the task is really done in this project, checking existing docs/rules first so the new skill doesn't duplicate or contradict what already exists.
- Same volatile-vs-durable reference rule as Step 2 applies to `SKILL.md` and everything under its `references/` — a skill's instructions and reference material should point at a durable structure (a project, a directory holding one concern) or describe a pattern in the abstract, never cite a specific implementation file as the proof that pattern exists in this repo.

---

## Step 4 — Writing specs and slice docs (`projects/<project>/deltas/`)

A slice is a cohesive capability inside a project (e.g. a specific job pipeline inside `poc-engine`), not one source file — pick the grain the same way a bounded context would be picked, not by file structure. Slices live as flat files directly under that project's `deltas/` — `<slice>.spec.md`, optionally `<slice>.docs.md` — never a per-slice subfolder.

- **`<slice>.spec.md` is living, current truth** — edited in place as the slice's contract changes. It should always describe *what is true now*, not a history of how it got there. There is no append-only decision log backing it up — this file has to be complete and correct on its own.
- **`<slice>.docs.md` is optional and separate in purpose** — create it only when the slice needs theory/context that doesn't fit the spec's living-contract shape (domain background, how a dependency's mechanism actually works, why a rule behaves the way it does). It is explicitly **not** a history replacement: never write it as a decision log ("we changed X because Y", superseded-decision narratives, timestamps) — that kind of time-bound content is deliberately not kept in this system. If content is decision-shaped, fold the current state into `spec.md` instead, or leave it out.
- **Reconcile conflicts explicitly, don't pick a side quietly.** If writing a spec surfaces a mismatch between the real implementation and an existing `.claude/docs/*` claim, fix the doc in the direction the code/decision actually supports, and update `spec.md` in place to match — no separate record of the resolution is kept beyond the corrected text itself.
- **Specs are frequently handed off from the `specifier` skill**, which does the information-gathering (intent, invariants, open questions — the parts code alone can't answer) and the user Q&A. Treat that handoff as vetted input, but still verify it against the actual code before writing, per Step 0 — `specifier` investigates and asks, `archivist` is still the one that writes.

---

## Step 5 — Before presenting the draft

- Re-read the finished artifact once as if you'd never seen the project: does every claim trace back to something actually read in Step 0, not something assumed?
- **Scan for volatile references** (Step 2): any file path, filename, or function/class/variable name cited as proof — outside `<slice>.spec.md`/`<slice>.docs.md`, where that's the point. In `.claude/docs/*.md`, confirm what survived is architecture vocabulary (schema/module/invariant), not a source-tree location.
- Check it against the length/format norms for its type (doc, rule, skill, spec) and confirm it matches its `references/*.template.md` skeleton — except a `<slice>.docs.md`, which has no template to match by design; for that one, confirm instead that it stayed free-form and didn't drift into decision-log shape.
- If you touched an existing file, confirm you didn't reintroduce a cross-reference between docs, or product/business language that was previously stripped.
- If you wrote or edited a `<slice>.spec.md`, confirm the file itself reads as complete and current — there's no history entry to fall back on, so a claim left implicit or half-updated stays that way until the next edit.
- If Step 0 turned up a conflict between artifacts, or between an artifact and the code, lead with that when presenting the draft — don't bury it at the end.
