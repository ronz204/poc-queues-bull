# Motor de Reportes Analíticos — Overview

Vision and domain scope for the reporting engine. Architecture and stack live in `structure.md`; the build roadmap lives in `approach.md`; engineering mechanisms live in `expertise.md`.

---

## Vision

The system maintains recurring aggregate reports over a synthetic transactional sales dataset, and keeps those results fast to read regardless of how expensive they are to compute. The point of the project is not the reports themselves — it's a domain with genuine, non-forced reasons to need scheduled recomputation, worker coordination, distributed locking, and cache invalidation all at once, so those four mechanisms can be practiced together instead of in isolation.

## Domain concepts

| Concept | Description |
|---|---|
| Sale transaction | The source event: a single sale with a product, a region, an amount, and an occurrence time. Inserted continuously by a simulated feed. |
| Report definition | User-created configuration: which aggregation to compute, over which time window, grouped by which dimension, and how often to recompute (a cron expression). Carries a version number for optimistic concurrency. |
| Report execution | One concrete run of a report definition: when it started and finished, whether it succeeded, and its computed result. |
| Report snapshot | The cached read model — the most recent aggregate result for a report definition, servable without touching the primary datastore. |

## Report-to-report dependencies

A report may depend on another report's result (for example, a margin report depending on a revenue report and a cost report). This relationship is explicitly deferred — it is not part of the current domain model and introduces a cascading-recalculation concern that is out of scope until the base system is done.

---

## Non-goals

- No polished dashboard UI — this is an API-first system, not a product.
- No authentication or authorization.
- No multi-tenancy.
- No real OLAP query engine — aggregation is scoped to the bounded, synthetic dataset this project generates itself, not a general analytical query surface.
