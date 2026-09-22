# Overview

Vision and domain scope. Architecture, stack, and infrastructure live in `structure.md`; per-component behavior lives in `modules.md`; the build roadmap lives in `approach.md`; engineering mechanism explanations live in `expertise.md`.

---

## Vision

The system maintains recurring aggregate reports over a synthetic transactional sales dataset, and keeps those results fast to read regardless of how expensive they are to compute. The point of the project is not the reports themselves — it's a domain with genuine, non-forced reasons to need scheduled recomputation, worker coordination, distributed locking, and cache invalidation all at once, so those four mechanisms can be practiced together instead of in isolation.

## Scope & non-goals

The system owns: defining and scheduling recurring aggregate reports, executing and coordinating their recomputation across multiple worker processes, and serving their results from a fast, versioned cache. It does not own: a polished dashboard UI (this is an API-first system, not a product), authentication or authorization, multi-tenancy, or a general-purpose analytical query engine (OLAP) — aggregation is scoped to the bounded, synthetic dataset this project generates for itself, never an open-ended query surface.

A report may conceptually depend on another report's result (for example, a margin report depending on a revenue report and a cost report). This relationship is explicitly deferred: it is not part of the current domain model and is out of scope for the base system, since it introduces a cascading-recalculation concern that would otherwise inflate the initial scope.

## Domain concepts

| Concept | Description |
|---|---|
| Sale transaction | The source event: a single sale with a product, a region, an amount, and an occurrence time. Inserted continuously by a simulated feed. |
| Report definition | User-created configuration: which aggregation to compute, over which time window, grouped by which dimension, and how often to recompute (a cron expression). Carries a version number for optimistic concurrency. |
| Report execution | One concrete run of a report definition: when it started and finished, whether it succeeded, and its computed result. |
| Report snapshot | The cached read model — the most recent aggregate result for a report definition, servable without touching the primary datastore. |

---

## Non-goals

- No polished dashboard UI — this is an API-first system, not a product.
- No authentication or authorization.
- No multi-tenancy.
- No real OLAP query engine — aggregation is scoped to the bounded, synthetic dataset this project generates itself, not a general analytical query surface.
- No report-to-report dependency graph in the base system — explicitly deferred as a stretch goal, not a phase of the base build.
