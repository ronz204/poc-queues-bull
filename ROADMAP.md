# Roadmap

This roadmap tracks Cerve's build progress toward its base system, phased from scaffolding through hardening.

---

## Overview

**Overall progress: 6 / 35 tasks — 17%**

| # | Step | Status | Progress |
|---|---|---|---|
| 1 | [Scaffolding](#1--scaffolding) | 🔄 In progress | 3/4 — 75% |
| 2 | [Domain & persistence](#2--domain--persistence) | 🔄 In progress | 3/7 — 43% |
| 3 | [Real scheduling](#3--real-scheduling) | 🔲 Not started | 0/7 — 0% |
| 4 | [Distributed locking & fencing tokens](#4--distributed-locking--fencing-tokens) | 🔲 Not started | 0/3 — 0% |
| 5 | [Versioned cache-aside](#5--versioned-cache-aside) | 🔲 Not started | 0/3 — 0% |
| 6 | [Event-driven invalidation](#6--event-driven-invalidation) | 🔲 Not started | 0/3 — 0% |
| 7 | [Idempotency & hardening](#7--idempotency--hardening) | 🔲 Not started | 0/5 — 0% |
| 8 | [Stretch: cross-report dependencies](#8--stretch-cross-report-dependencies) | 🔲 Not started | 0/3 — 0% |

Status legend: 🔲 Not started · 🔄 In progress · ✅ Done (only once every task under it is checked).

---

## 1 — Scaffolding

Prove the job loop runs at all, with no coordination mechanism yet.

- [x] Local infra via Docker Compose (Postgres + Redis ×2: queues/locks, cache)
- [x] Hexagonal folder structure scaffolded
- [x] Synthetic sales dataset seeded via DI-backed seeders inside a single Drizzler transaction
- [ ] Single hardcoded report definition recomputing on a fixed interval, no lock, no cache

## 2 — Domain & persistence

Report definitions and executions as real aggregates, backed by real persistence, with every aggregate change recording its domain event in the outbox. No locks, no cache, no event consumers yet.

- [x] Report definition aggregate modeled with its real invariants
- [x] Report execution aggregate modeled with its real invariants
- [x] Definition store behind the Drizzler transactional boundary (writes only resolvable inside a run)
- [ ] Definition raises an event on every lifecycle change: created and archived join the existing changed event
- [ ] `reports.outbox` table + outbox store port (shared kernel) and adapter, appending inside the caller's transaction
- [ ] Application layer scaffolded per bounded context, one folder per use case (schema, handler, errors, plugin), with per-context plugin composition
- [ ] Real CRUD for report definitions through the API (create, edit, archive, list), each write recording its event in the outbox in the same transaction

## 3 — Real scheduling

One recurring job per report definition, safe under multiple concurrently running workers, driven by the outbox.

- [ ] Outbox relay polling pending rows with `for update skip locked`, enqueuing one domain-events job per (event, consumer) with a deterministic job id
- [ ] Job scheduler port + BullMQ adapter (register/remove under a deterministic identity)
- [ ] Recurring-job reconciler consuming definition events: read → apply → re-read until stable
- [ ] One recurring job per report definition
- [ ] Job rescheduled automatically on cron edits
- [ ] Deterministic job identity
- [ ] Verified safe under multiple concurrently running worker processes

## 4 — Distributed locking & fencing tokens

Hand-rolled first, so the mechanism is understood before evaluating a library alternative.

- [ ] Distributed lock acquired before a worker recomputes a report
- [ ] Monotonically increasing fencing token tied to the lock
- [ ] Demonstrated against a simulated worker-failure (zombie) scenario

## 5 — Versioned cache-aside

The cached read model, with a fallback for the no-snapshot case.

- [ ] Cached read model for a report's result
- [ ] Fresh cache served without touching the primary datastore
- [ ] Synchronous-compute fallback when no cached snapshot exists yet

## 6 — Event-driven invalidation

The two invalidation strategies wired to their respective domain events.

- [ ] Definition-change event passively orphans the old cache key
- [ ] Execution events recorded in the outbox in the same transaction as the execution's terminal state
- [ ] Execution-result event actively overwrites the current version's key, guarded by the fencing token

## 7 — Idempotency & hardening

Deterministic execution identity, retries, live-looking data, and basic observability.

- [ ] Deterministic execution identity so a retried/duplicated job can't produce a duplicate execution record
- [ ] Retry handling for recomputation jobs
- [ ] Synthetic data feed simulating continuous ingestion
- [ ] Basic observability of which worker ran which execution
- [ ] Retention policy for published outbox rows

## 8 — Stretch: cross-report dependencies

Explicitly non-blocking for the base system.

- [ ] Cascading-recalculation graph across reports that depend on each other's results
- [ ] Metrics endpoint surfacing lock acquisitions, cache hit/miss ratio, and execution durations
- [ ] Minimal read-only view of report state as an alternative to calling the API directly

---

## Adding a new step

Append a new `## N — <name>` section with its own task checklist, add its row to the Overview table, and recompute **Overall** as the new total checked/total across every step. Never mark a step "Done" while an unchecked task remains under it — split the step instead of rounding up.
