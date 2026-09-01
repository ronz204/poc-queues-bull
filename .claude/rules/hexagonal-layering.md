---
paths:
  - "services/**"
---

# Hexagonal Layering Conventions

Applies to any application source under a service's own tree. This is Bun/TypeScript code following Hexagonal Architecture + DDD tactical patterns — no linter enforces these boundaries, so they only hold if every touch of these files respects them.

---

## Layer boundaries

- Domain code (aggregates, value objects, domain events, domain invariants) never imports an infrastructure library, because the domain layer has to stay testable and reasoned-about without a database, cache, or queue running — coupling it to one silently defeats that.
- Application code (use cases) depends only on ports (interfaces), never on a concrete infrastructure adapter, because a use case that imports a concrete adapter can no longer be swapped or tested against a fake without editing the use case itself.
- Application code contains no business logic — invariants and business rules live in the domain layer. A use case orchestrates: load via a port, ask the domain to do something, save via a port.
- Adapters are the only layer allowed to import a concrete infrastructure library (a persistence client, a cache/queue client, an HTTP framework), because that's what keeps a stack swap (or a test double) a one-adapter change instead of a scattered one.

## Event-driven cache invalidation

- Application/use-case code never talks to the cache directly, even to invalidate it. A write that needs to invalidate or update a cached read model raises a domain event instead, and a dedicated event handler (itself an adapter-layer concern) reacts to it. This keeps the use case ignorant of caching as a concern entirely, so caching strategy can change without touching use-case code.

---

## Non-goals

This rule does not prescribe which port belongs to which adapter, nor the specific invalidation strategy used — those are documented facts (see the project's structure and expertise docs), not layering rules.
