---
paths:
  - "*/core/**"
---

# Bounded Context Layering Conventions

This governs the internal folder and file layout of every bounded context under `source/core/`, following a DDD tactical layering organized by semantic sub-slice: each bounded context is split into the cohesive concepts it holds, not into technical layers. It applies to every bounded context there, including the one holding primitives shared across the others.

---

## Bounded context folders

- Each bounded context is its own folder directly under `source/core/`, named as a two-word kebab-case pair, because a shared naming shape makes the set of bounded contexts scannable as a flat list rather than a mix of single words and long compounds.
- The second word is chosen to be descriptive of that specific context, not a suffix repeated across every bounded context, because a repeated suffix (e.g. always `-domain` or always `-core`) stops carrying information the moment every folder has it — it becomes noise instead of a signal.

## Semantic sub-slices

- A bounded context splits into one subfolder per sub-slice — a cohesive domain concept, typically one aggregate plus everything that exists only to serve it (its value objects, events, errors, enums, types, and ports). The sub-slice folder is named with a single short word naming that concept from inside the bounded context, because the bounded context folder already supplies the qualifier: a lifecycle context holding a definition and its executions gets `definition/` and `execution/`, not a repeat of the context's own noun in front of each.
- There is no split by technical layer (no separate folder for the domain model versus the ports it exposes). Grouping by layer scatters one concept across two trees and forces every change to that concept to touch both; grouping by concept keeps everything that changes together in one folder.
- A shared-kernel-style bounded context (primitives shared across bounded contexts: base value objects, shared ids, shared domain errors) follows the exact same shape — its primitives are grouped into sub-slices by concept (e.g. everything about identifiers in one sub-slice), with no separate carve-out.
- Sub-slices are always a single level deep — a sub-slice never nests further subfolders. If a concept grows enough to want internal structure, that's a signal it's really two sub-slices side by side, not one with a nested tree.
- Every bounded context uses sub-slice folders, even one holding a single concept today, because deciding folder shape per context based on how many concepts it currently has is exactly the kind of ad hoc call that drifts silently as the context grows.

```
source/core/
  <bounded-context>/
    index.ts
    <subslice-a>/
      <subslice-a>.aggregate.ts
      <subslice-a>.vos.ts
      <subslice-a>.contracts.ts
      ...
    <subslice-b>/
      ...
```

## File naming inside a sub-slice

- Files are named `<subslice>.<kind>.ts`, where `<subslice>` matches the folder name, and `<kind>` is one of:

| Kind | Holds |
|---|---|
| `aggregate` | The aggregate root |
| `entities` | Entities owned by the aggregate that aren't the root |
| `vos` | Value objects, including the sub-slice's typed identifiers |
| `events` | Domain events the aggregate emits |
| `errors` | Domain errors the sub-slice raises |
| `enums` | Closed sets of literal values (a state, a tier) |
| `types` | Other type aliases/interfaces that fit no other kind (e.g. the shape of a persisted snapshot a reconstitution factory accepts) |
| `contracts` | Ports the sub-slice exposes outward: repository interfaces, request/response DTOs, published-event contracts |

- Only the kinds a sub-slice actually needs exist — a sub-slice with no domain events has no `events` file, and one with no ports has no `contracts` file — because an empty placeholder communicates nothing a missing file doesn't already communicate.
- The `<subslice>.` prefix is kept even though the folder already disambiguates, so that editor tabs, search results, and stack traces identify a file unambiguously without its path.
- A `contracts` file holds only genuine port/interface/DTO declarations. It never re-exports a concrete aggregate, entity, or domain-error class just to make it reachable from outside — the barrel already does that — so a sub-slice with no real ports simply has no `contracts` file rather than one filled preemptively.
- Files within a sub-slice import each other by relative path. A sub-slice that needs something from another bounded context imports that context through its barrel, never by reaching into one of its sub-slice folders.

## The barrel is the only public surface

- Each bounded context has an `index.ts` at its own root, acting as its single public entry point: it re-exports every file of every sub-slice via `export * from "./<subslice>/<subslice>.<kind>"` — one line per file that exports at least one symbol. Nothing outside the bounded context imports from a sub-slice folder directly, because that would let other contexts (or the application layer) couple to internal file organization that is free to change without notice.
- The `export` keyword inside a concrete file is the public/private gate, not the barrel — a symbol that must stay internal to the bounded context simply isn't exported from its own file, rather than being filtered out by hand in `index.ts`. This trades barrel-level curation for trusting that gate: once a file exports something, it flows through `export *` automatically, so `index.ts` only changes when a file is added or removed, never because a file gained a new export.
- Because every sub-slice's exports land in one flat namespace at the barrel, exported symbol names must be unique across the whole bounded context. Names carry their full domain noun (e.g. a definition sub-slice's id type is named after the full concept, not a bare `Id`) rather than relying on the folder for disambiguation, since the folder is invisible to importers.

## Aggregate immutability

- An aggregate favors `readonly` public fields over a private field paired with a getter, when the getter would do nothing but return that field — that getter is boilerplate, not encapsulation, since it adds a method without adding any actual guard or transformation.
- A state-changing operation on an aggregate returns a new instance rather than mutating the receiver in place, so a caller still holding a reference to the pre-change instance keeps a value that stays valid and unaffected by the change, instead of having it silently mutate out from under them.

---

## Non-goals

- This rule governs internal layering and file naming only. It does not decide which domain concepts belong to which bounded context, how a bounded context is carved into sub-slices, or where one aggregate's boundary ends and another's begins — those are per-bounded-context decisions made in that slice's own `spec.md`, not here.
