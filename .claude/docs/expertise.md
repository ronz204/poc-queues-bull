# Distributed Coordination — Expertise

General engineering knowledge behind the four mechanisms this project is built to practice. This describes how each pattern works and why, independent of this project's current implementation state — see `structure.md` for how they map onto this system's architecture and `approach.md` for when each lands.

---

## Recurring jobs with deterministic identity

A repeatable/recurring job scheduler that supports an explicit, deterministic job identifier (derived from the entity being scheduled, not a random ID) lets multiple scheduler instances register "the same" recurring job safely: registering an already-registered repeatable job with the same identity is a no-op or an update, not a duplicate. This is what makes it safe for every process that can write schedules to attempt registration on startup or on every edit, instead of requiring a single elected leader to own scheduling. Editing the recurrence expression for an existing schedule is handled the same way — deregister the old schedule under that identity and register the new one — never by leaving both active.

## Distributed locks with fencing tokens

A distributed lock alone is not sufficient to guarantee mutual exclusion of an *effect* (like a write), only of the *attempt* — a process can hold a lock, stall past its TTL for any reason (GC pause, scheduling delay, network partition), have the lock expire and get reacquired by another process, then resume and act as though it still holds it. That resumed process is a "zombie": correct from its own point of view, wrong from the system's.

The fix is a fencing token: a monotonically increasing number issued every time the lock is successfully acquired (a simple atomic increment works). The token is not just carried alongside the lock — it must be checked again at the moment of the guarded write, against the highest token any prior writer has already used. A write presenting an older token than one already recorded is rejected, full stop, regardless of whether the writer still believes it holds the lock. This is what actually prevents the zombie scenario: the zombie's write is rejected not because its lock was invalid (it doesn't know that), but because a newer token already won.

The TTL on the lock itself is a liveness mechanism (so a genuinely dead process doesn't block the resource forever), not a correctness mechanism — correctness comes entirely from the fencing-token check at write time.

## Versioned cache-aside with event-driven invalidation

A cache-aside read model can use two different invalidation strategies for two different kinds of upstream change, and conflating them is a common mistake:

- **Passive, version-in-key invalidation** — when the *definition* of what's being cached changes (a config edit, a version bump), encode that version in the cache key itself rather than deleting the old entry. The old key is never read again because new reads ask for the new version's key; it simply expires on its own TTL. This avoids a delete-then-recompute race and tolerates being slightly behind — nothing reads the stale key, so it doesn't need to be gone immediately.
- **Active overwrite invalidation** — when a *new result* becomes available for the *same* definition version (a recomputation completes), the entry for that version must be overwritten immediately, because reads for that exact key are expected to reflect the newest result and TTL-based staleness is not acceptable here. This is exactly the write path that needs the fencing-token check above, since multiple recomputations of the same version can race.

The distinction is about what kind of change triggered the write: a definition change orphans a key passively; an execution result overwrites a key actively and must be guarded against out-of-order writers.

## Idempotency via deterministic identity

In any at-least-once delivery system (retry-on-failure, duplicate delivery, redelivery after a crash), the only reliable way to get exactly-once *effects* on a data store is to derive a stable identifier for "this attempt" from inputs that don't change across retries — never from a value generated fresh at execution time. When that derived identifier already exists in the store, the write is treated as already done rather than duplicated. This pushes deduplication into the data layer (an existence check or a unique constraint on the derived identifier) rather than relying on the delivery system to guarantee single delivery, which no realistic queue actually does.
