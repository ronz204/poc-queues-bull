---
paths:
  - "*/app/**"
---

# Application Use-Case Layering Conventions

This governs the internal folder and file layout of the application layer, which orchestrates use cases over the domain's bounded contexts. It covers how use cases are grouped, which files a use case and its bounded context hold, what each one may depend on and receive by injection, and how a use case records the domain events its aggregates raise. It doesn't cover the domain layer's own layout (that has its own rule) or any single use case's behavior (that belongs to its bounded context's spec).

---

## Folder shape

- The application layer mirrors the domain's **bounded contexts**, but not their sub-slices: one folder per bounded context, named exactly as in core, so a use case's owning context is obvious from its path.
- Inside a bounded context, each use case gets its own folder, named verb-noun in kebab-case after what it does (create a definition, not "definition service"). This avoids mirroring sub-slices because many use cases cross more than one aggregate of the same context, such as listing definitions with their last execution, or forcing a recomputation that loads a definition and creates an execution. A sub-slice folder would have no natural owner for them.
- Use-case folders are one level deep and never nest. A use case that seems to need internal structure is really two use cases.

```
<context>/
├── index.ts                  # barrel: handlers, schemas, errors, dock (never plugin/processor)
├── <context>.dock.ts         # handler tokens + their bindings
├── <context>.plugin.ts       # composes use-case plugins, route prefix, error → status
├── <context>.processor.ts    # composes use-case processors, job name → processor
└── <use-case>/
    ├── <use-case>.schema.ts
    ├── <use-case>.handler.ts
    ├── <use-case>.errors.ts
    ├── <use-case>.plugin.ts
    └── <use-case>.processor.ts
```

## Files inside a use-case folder

Files are named `<use-case>.<kind>.ts`, with the prefix kept for the same reason as in core: tabs, search results, and stack traces identify the file without its path. Only the kinds a use case actually needs exist.

| Kind | Holds |
|---|---|
| `schema` | The runtime validation schemas for the use case's input and output. Their static types are inferred from them and never declared by hand, so the runtime check and the type can't drift. |
| `handler` | The use-case class: it receives the parsed input, orchestrates stores and ports, and returns the output. It is the entry service a transactional run resolves. |
| `errors` | Orchestration errors that aren't domain rules, e.g. a requested aggregate that doesn't exist. Domain errors stay in core. |
| `plugin` | The HTTP-framework plugin that exposes this use case's route, reusing the same schemas for the request and response. Present only for use cases reachable over HTTP. |
| `processor` | The queue-framework job processor that invokes this use case from the worker, parsing the job payload with the same input schema. Present only for use cases a job triggers. |

- Schemas validate **shape only**: types, formats, presence, and conversion from wire values (e.g. an ISO string to a date). A business invariant is never re-checked in a schema, even if that would be easy, because it already lives in the aggregate. Two copies of one rule drift apart silently.
- A `processor` is an entry into a use case, not a reaction to a domain event. A job that runs a use case (a cron tick or a queued recomputation) gets a `processor` beside that use case. A domain-event consumer (rescheduling, cache overwrite) is infrastructure and never lives here.
- Tests don't live inside a use-case folder. Keeping them out keeps each folder limited to what ships.

## Dependency injection

- Each bounded context has one dock module of its own. It declares every handler's DI token and binds it to its class together with the store and port tokens the handler depends on. Keeping the token in the dock rather than beside the class keeps handlers free of the DI library. Keeping the dock per context, rather than in the project-wide dock, means adding a use case touches only its own context. Each process loads the infrastructure dock plus the per-context docks it needs.
- A handler receives by injection **only** the stores and ports it orchestrates, never the transactional boundary. The boundary resolves the handler inside a run's child scope, after the transaction executor is bound, so every store the handler receives already writes through that run's transaction. A handler that also received the boundary could only open a second, independent transaction, which breaks the atomicity of the aggregate write and its outbox event.
- Handler bindings are never singletons. A handler holds executor-bound stores, so a singleton would keep the transaction of the first run that built it, and that transaction is already closed by the next run.
- The entry files, `plugin` and `processor`, receive the transactional boundary as a factory argument and open the run themselves: resolve the handler's token, then call it with the parsed input. They use a factory rather than DI resolution because the boundary itself is built from the container.
- **Exception: a use case that needs several commits.** Some use cases can't hold one transaction for their whole duration, such as a recomputation that marks an execution running, computes for a long time, then records the terminal state. Its handler receives the transactional boundary instead of stores, is resolved outside any run, and opens one sequential run per commit. Each of those runs resolves its own run-scoped entry. The runs never nest, because an inner run is an independent transaction, not a nested one. This is the only case where a handler sees the boundary.

## HTTP plugins, queue processors, and the public surface

- Each bounded context has one plugin of its own that composes its use cases' plugins and sets their shared route prefix. The api entrypoint mounts only these per-context plugins, never a use case's plugin directly, so adding a use case touches its own context and nothing outside it.
- The per-context plugin maps errors to HTTP status codes in one place, both domain errors and the context's orchestration errors. Mapping them per use case would repeat the same translation in every route and let identical errors drift to different statuses.
- Each bounded context that has job-triggered use cases has one processor of its own. It routes each job name to its use case's processor and maps errors to the queue's retry semantics in one place: retry a transient failure, fail permanently on a domain or orchestration error that a retry can't fix. The worker entrypoint registers only these per-context processors.
- The HTTP framework is imported **only** in plugin files, and the queue framework **only** in processor files. Handlers, schemas, errors, and docks depend on neither, because both processes run the same handlers and each one must load only its own framework.
- Each bounded context has a barrel at its root re-exporting its use cases' handlers, schemas, and errors plus its dock, but **never their plugins or processors**. An `export *` of either would make the process that doesn't use that framework load it anyway. Per-context plugins and processors import their use cases' entry files by relative path, and each entrypoint imports the per-context file it needs directly. This is the one deliberate exception to the barrel being a context's only public surface.

## Domain events

- A handler that changes an aggregate takes the domain event the aggregate returned and appends it to its bounded context's outbox, through the outbox store, in the same transactional run as the aggregate write. It never publishes to a queue, a bus, or any other system directly. A direct publish either announces a change that later rolls back or loses the event if the process dies right after the commit. The outbox makes the event commit with the change or not at all.
- A handler never calls the scheduler or cache ports in reaction to its own write. Those effects belong to the domain-event consumers, which receive the event from the outbox, so they happen after the commit and survive a crash.

---

## Non-goals

- Doesn't decide which use cases a bounded context exposes or what they guarantee — that's the bounded context's own spec.
- Doesn't govern the outbox relay or the event consumers — those are infrastructure, not application-layer files.
