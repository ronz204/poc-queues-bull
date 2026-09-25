# Expertise

How the non-trivial mechanisms this project depends on actually work, independent of where they're used in this system's architecture (that's `modules.md`/`structure.md`'s job) or when each lands (that's `approach.md`'s job).

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

## Transactional outbox

A change that must update a database *and* notify another system (a queue, a scheduler, a cache) is a dual write: two systems, no transaction spanning both. Publishing inside the database transaction can announce a change that later rolls back; publishing after commit loses the notification if the process dies between the commit and the publish. Neither ordering is safe.

The outbox removes the second write from the critical path. The event is inserted as a row in an outbox table *in the same transaction* as the change itself, so the event exists if and only if the change committed. A separate relay then reads pending rows and delivers them, marking each as published once it's been handed off.

- **Delivery is at-least-once, never exactly-once.** The relay can deliver a row and die before marking it, so the row is delivered again on the next poll. Consumers must therefore be idempotent. Deduplicating on a delivery identifier derived from the outbox row narrows the window, but it only holds for as long as the downstream system remembers that identifier.
- **Several relay instances can run safely** if each claims rows with row-level locking that skips rows another instance already holds (`for update skip locked`): every instance gets a disjoint batch, with no blocking and no double claim within one polling round.
- **The relay should only move rows, not run reactions.** A relay that executes reactions itself has to rebuild retries, backoff, poison-message handling, and partial-failure handling across several reactions to the same event. Handing each (event, consumer) pair to a job queue as its own job lets the queue provide all of that, and a failed reaction is retried alone without repeating the ones that succeeded.
- **Latency is bounded by the polling interval**, which is the price of not needing any change-data-capture infrastructure.

## Level-triggered reconciliation

Consumers of at-least-once events can receive them duplicated and out of order: two events for the same entity processed concurrently can finish in either order, and "apply this event's payload" lets the older one win. Guarding with a stored version number only works when the destination supports an atomic compare-and-set; when it doesn't, the check and the write are two steps another consumer can interleave.

Reconciliation changes what the event means. Instead of "apply this change", it becomes "this entity changed; make the destination match the source of truth":

```
loop (bounded attempts):
  desired = read the entity's current state from the source of truth
  apply desired to the destination            # idempotent upsert/remove
  check   = read the entity's current state again
  if check yields the same desired state: done
  otherwise: loop                             # it changed while we were applying
attempts exhausted: fail, so the queue retries with backoff
```

This converges without locks. Take the last write to the destination: whoever made it re-read the source after writing and saw the state it had just applied, or it would have looped. A source change after that check raises its own event, whose consumer writes later, which contradicts it being the last write. So the destination's final state always matches the source's final state, regardless of duplication, ordering, or a consumer stalling mid-write.

The comparison must be over the *derived desired state* (what the destination should look like), not over a single version field, since a change that doesn't bump the version (a status flip, for example) still alters what the destination should hold. This is the same model a Kubernetes controller follows: events only wake the reconciler, and truth is always read from the source.
