# Clean Code & Design Principles

Language-agnostic. Applies to every file in the repository, on top of whichever more specific rule also applies to a given file's stack or layer. This rule is about how a system is *shaped* — at the domain level, the module level, and the process used to get there — not which syntax it uses. State every principle below abstractly enough to hold regardless of which project or runtime the file being touched belongs to; don't anchor an example to one specific stack if the principle itself is general.

---

## Domain-Driven Design

Applies before SOLID does — SOLID shapes a module once you already know what the module is responsible for; DDD is how you decide that in the first place.

- **Ubiquitous language.** Use the vocabulary domain experts actually use — the same term for the same concept in code, docs, and conversation. If the business renames a concept, the code's naming should follow, not carry the old name forward as an internal implementation detail nobody re-derives.
- **Bounded contexts.** Each business module owns its own model of a concept, even when two modules use the same word for it. Don't force a single shared entity across module boundaries just because the name matches — translate at the boundary instead of merging the models. A concept crossing from one module into another is a signal to map it explicitly, not to assume it's the same shape on both sides.
- **Entities vs. value objects.** An entity has identity that persists through change (something that still "is the same thing" after an attribute changes). A value object is defined entirely by its attributes and is interchangeable with any other instance holding equal values (a date range, an amount, a coordinate). Don't give every concept a generated identity out of habit — a value object gains nothing from one and loses easy equality/comparison by reference instead of by value.
- **Aggregates and invariants.** Group the entities/value objects that must change together under one consistency boundary, with a single entry point that enforces the invariant across all of them (e.g. a job and the state transition it records commit together or not at all). External code should go through that entry point rather than reaching in to mutate one internal piece directly — a change that bypasses the aggregate root is how invariants silently rot.
- **Anti-corruption layer at the edges.** Where a domain concept crosses into an external system's shape — a third-party API response, a queue message's raw payload, a legacy format — translate it into the domain's own vocabulary and types immediately at that boundary. Never let a foreign shape leak past the boundary and spread through the core model; the translation step is what keeps an external system's redesign from becoming an internal rewrite.
- **Domain service vs. application service.** Logic that doesn't naturally belong to one entity — a calculation or rule spanning several of them — is a domain service, and should stay a pure, I/O-free operation. Orchestration (fetch state, invoke the domain logic, persist the result, trigger a side effect) is an application-layer concern. Keep the two distinct so the domain logic stays testable without needing a database, network, or queue in the loop.

## Spec-Driven Development

A change is *specified* before it's implemented — not because process is a virtue in itself, but because a spec is the cheapest place to catch a wrong assumption, before it's baked into a diff.

- **Write down intent before code, scaled to risk.** For a change that touches a cross-cutting concern, an existing invariant, or more than one module, write a short spec first: what the change does, its boundaries, and what it deliberately does *not* do. For a small, obviously-reversible change, a sentence of stated intent is enough — the bar scales with blast radius and reversibility, not with line count.
- **A spec is a contract for review, not a ritual.** Write enough that someone else — or the same person, later — could check the finished code against it and say whether it was satisfied. If a spec is too vague to be contradicted by any possible implementation, it wasn't specific enough to be worth writing.
- **Put the spec where it will actually be checked later.** A decision with lasting weight (an architectural choice, a convention that must hold on every future change of a certain kind) belongs in the durable knowledge base, not in a chat message that scrolls away. A one-off implementation plan for a single change can stay lightweight and doesn't need to outlive the change itself.
- **Divergence between spec and code is a signal, not noise.** When the shipped result no longer matches what was specified, that's a decision waiting to be made — either the code drifted and needs fixing, or the spec was wrong and needs updating. Never leave both versions standing as separate, silently conflicting truths.

## SOLID

- **Single Responsibility.** A module/class/function changes for one reason. A function that both parses input and performs I/O, or a file that mixes configuration parsing with business logic and with a specific delivery mechanism, is a signal to split it — one axis of change per unit.
- **Open/Closed.** Prefer extension points (a new strategy implementation, a new handler, a new case in an already-designed extension seam) over editing a stable core to bolt on a variant. Don't over-apply this pre-emptively — see Non-goals below.
- **Liskov Substitution.** If something is typed as a base/interface, every concrete implementation must be usable anywhere the base is expected, with no surprising narrowing of behavior — e.g. an abstraction with several providers behind it should not have one provider that silently behaves differently for the same call.
- **Interface Segregation.** Depend on the slice of a type/module actually used, not the whole surface. A function that needs one field from a large configuration object shouldn't take the entire object out of convenience if a narrower parameter is cheap to pass instead.
- **Dependency Inversion.** High-level flow depends on an abstraction, not a concrete implementation, wherever there's a real reason to swap the implementation later — a storage abstraction instead of calling a specific database driver's API directly from business logic; a messaging abstraction instead of a specific queue client's calls scattered through handlers. Don't invert a dependency that will only ever have one implementation — that's indirection with no payoff.

## High cohesion, low coupling

- **Cohesion**: everything inside a module/file should be there because it serves the same purpose. A file mixing configuration parsing, request handling, and message formatting is low cohesion even if each piece is individually clean.
- **Coupling**: a change in one module shouldn't force edits in unrelated modules. Cross-module communication goes through a narrow, explicit surface (a function signature, a typed return value) — not shared mutable state, not reaching into another module's internals.
- **Law of Demeter.** Talk to your immediate collaborators, not to what they happen to expose. Ask an object to do something rather than reaching through it (`a.b.c.d()`) to pull out a piece and act on it yourself — a chain like that couples the caller to every intermediate shape on the path, not just the one it actually needed.
- Module boundaries exist to keep these properties real, not just cosmetic. A new file should live under the boundary that matches what it actually does, not wherever's convenient — a boundary that stops meaning anything is worse than not having one.

## DRY, precisely

- **Unify duplicated knowledge, not duplicated text.** Two places that encode the same business rule (the same tax rate, the same validation condition) should have exactly one source of truth — when the rule changes, there should be exactly one place to change it.
- **Coincidental similarity isn't duplication.** Two pieces of code that look alike today but represent different rules — likely to change for different reasons, owned by different parts of the domain — should stay separate. Merging them creates a false shared abstraction that has to be split back apart the moment one of the two rules changes and the other doesn't.

## Immutability and explicit state change

- **Prefer returning new values over mutating shared ones.** A function that takes data and produces a result should default to leaving its input untouched — the caller can still rely on what they passed in, and the result is traceable to one call instead of an in-place edit that could have happened anywhere.
- **When mutation is genuinely needed, keep it local and visible.** Scope it to the smallest region that needs it, and make it obvious at the call site that state is changing — never bury a mutation of a caller-owned object inside a function whose name or return type doesn't advertise it.

## Predictable behavior and failure handling

- **Principle of least astonishment.** A function or module should do what its name and signature promise, nothing more — no hidden side effects, no behavior that depends on call order unless that's the explicit contract. Surprising behavior costs more than it saves, however clever the reason.
- **Signal failure, don't swallow it.** An error either gets handled meaningfully at that level or propagates — never caught and discarded, never turned into an ambiguous sentinel (`null`, `-1`, an empty result) that looks like a valid value to whatever reads it next. For a failure mode that's a normal, expected outcome of a call, prefer a signal the caller is forced to handle (a typed error/result, a checked exception) over one they can silently ignore; reserve unchecked exceptions/panics for conditions that genuinely shouldn't happen.
- **Hard-to-test is a design signal, not just friction.** A unit that needs heavy mocking or elaborate setup to test is usually one with too many collaborators or too little separation between logic and I/O — treat that resistance as feedback on the design, not a problem to route around with more test tooling.

## Practical rules

- Small functions, one level of abstraction per function body. If a function mixes "what" (business intent) and "how" (low-level detail), extract the "how" into a named helper.
- Guard clauses over nested `if`/`else` pyramids — return/throw early.
- Prefer pure functions (same input → same output, no side effects) wherever the logic doesn't inherently need I/O or mutation. Push side effects to the edges (handlers, adapters, delivery mechanisms), keep the core logic in between pure and testable.
- Composition over inheritance. Inheritance is for genuine is-a relationships with shared behavior; default to composing smaller pieces otherwise.
- Naming carries intent: a reader shouldn't need to open a function to guess what it does from its name. Prefer a slightly longer, precise name over a short, ambiguous one.

## Non-goals

- Don't introduce an interface, factory, or abstraction layer for a hypothetical second implementation that doesn't exist yet (YAGNI). Three near-identical lines beat a premature shared abstraction.
- Don't split a cohesive, small function into multiple files/functions just to "apply SRP" — SRP is about reasons to change, not line count.
- Don't carve out a bounded context, aggregate, or anti-corruption layer for a module with one entity and no invariant worth enforcing separately — DDD's ceremony pays for itself against real domain complexity, not by default.
- Don't chase immutability into a hot path where copying has a real, measured cost — mutate locally and explicitly there instead of forcing a copy nobody needed.
- Don't demand a written spec for a trivial, obviously-reversible change — that's process for its own sake, and the fastest way to make the practice resented and skipped when it actually matters.
- These principles don't override a more specific rule. If another rule states a concrete convention for the file being touched, that convention wins over a generic pattern preference here.
