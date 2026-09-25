---
paths:
  - "*/app/**"
---

# Application Use-Case Layering Conventions

This governs the internal folder and file layout of the application layer, which orchestrates use cases over the domain's bounded contexts. It covers how use cases are grouped, which files a use case holds, what each one may depend on, and how a use case records the domain events its aggregates raise. It doesn't cover the domain layer's own layout (that has its own rule) or any single use case's behavior (that belongs to its bounded context's spec).

---

## Folder shape

- The application layer mirrors the domain's **bounded contexts**, but not their sub-slices: one folder per bounded context, named exactly as in core, so a use case's owning context is obvious from its path.
- Inside a bounded context, each use case gets its own folder, named verb-noun in kebab-case after what it does (create a definition, not "definition service"). This avoids mirroring sub-slices because many use cases cross more than one aggregate of the same context, such as listing definitions with their last execution, or forcing a recomputation that loads a definition and creates an execution. A sub-slice folder would have no natural owner for them.
- Use-case folders are one level deep and never nest. A use case that seems to need internal structure is really two use cases.

## Files inside a use-case folder

Files are named `<use-case>.<kind>.ts`, with the prefix kept for the same reason as in core: tabs, search results, and stack traces identify the file without its path. Only the kinds a use case actually needs exist.

| Kind | Holds |
|---|---|
| `schema` | The runtime validation schemas for the use case's input and output. Their static types are inferred from them and never declared by hand, so the runtime check and the type can't drift. |
| `handler` | The use-case class: it receives the parsed input, orchestrates stores and ports, and returns the output. It is the entry service a transactional run resolves, with its own DI token. |
| `errors` | Orchestration errors that aren't domain rules, e.g. a requested aggregate that doesn't exist. Domain errors stay in core. |
| `plugin` | The HTTP-framework plugin that exposes this use case's route, reusing the same schemas for the request and response. Present only for use cases reachable over HTTP. |

- Schemas validate **shape only**: types, formats, presence, and conversion from wire values (e.g. an ISO string to a date). A business invariant is never re-checked in a schema, even if that would be easy, because it already lives in the aggregate. Two copies of one rule drift apart silently.
- Tests don't live inside a use-case folder. Keeping them out keeps each folder limited to what ships.

## HTTP plugins and the public surface

- Each bounded context has one plugin of its own that composes its use cases' plugins and sets their shared route prefix. The api entrypoint mounts only these per-context plugins, never a use case's plugin directly, so adding a use case touches its own context and nothing outside it.
- The HTTP framework is imported **only** in plugin files. Handlers, schemas, and errors never depend on it, because the worker process runs the same handlers without any HTTP involved.
- Each bounded context has a barrel at its root re-exporting its use cases' handlers, schemas, and errors, but **never their plugins**. The worker imports handlers through that barrel, and an `export *` of a plugin would make the worker load the HTTP framework it never uses. The per-context plugin imports its use cases' plugins by relative path, and the api entrypoint imports the per-context plugin directly. This is the one deliberate exception to the barrel being a context's only public surface.

## Domain events

- A handler that changes an aggregate takes the domain event the aggregate returned and appends it to its bounded context's outbox, through the outbox store, in the same transactional run as the aggregate write. It never publishes to a queue, a bus, or any other system directly. A direct publish either announces a change that later rolls back or loses the event if the process dies right after the commit. The outbox makes the event commit with the change or not at all.
- A handler never calls the scheduler or cache ports in reaction to its own write. Those effects belong to the domain-event consumers, which receive the event from the outbox, so they happen after the commit and survive a crash.

---

## Non-goals

- Doesn't decide which use cases a bounded context exposes or what they guarantee — that's the bounded context's own spec.
- Doesn't govern the outbox relay or the event consumers — those are infrastructure, not application-layer files.
