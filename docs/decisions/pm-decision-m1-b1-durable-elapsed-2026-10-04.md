# PM adoption: M1-B1 durable elapsed host — 2026-10-04

The root PM adopts the [B1 brief](../briefs/m1-b1-clock-driver.md) under the
[owner’s mechanics delegation](owner-decision-autonomous-mechanics-2026-10-03.md).
The reviewed M1-A merge is `78425930581cede4ebfe8269beff66dac193734e`.
Astra driver advice informed planning; it is not independent implementation review.

- Driver-managed elapsed saves use `loka-save-v2` with one STRICT host checkpoint:
  durable run, accounted wall milliseconds, fractional remainder and fixed logical target.
  Low-level explicit-target authority conformance without OS clocks may remain v1; managed
  elapsed sessions require actual clocks and v2 initialization before play. Direct trusted
  advance on v2 raises target to at least its confirmed head in the same transaction, preserving
  wall/remainder. Debt is target minus confirmed head. Legacy play-time saves remain v1. Only a v1 save
  pinned to the same installed elapsed release may upgrade, with no earlier time credit.
  A v2 save missing or carrying a malformed/mismatched checkpoint is corrupt.
- Positive elapsed segments commit the checkpoint, changed rows, head and receipt together.
  Initialization, fractional accounting and negative-wall rebases use a guarded metadata-only
  transaction, without gameplay receipt/revision/trace. Unknown outcomes fence both paths;
  only after closing the transaction may exact prior/candidate checkpoint plus durable run
  witness a failed/confirmed account. Unexpected evidence is recovery, never guessed success.
- Active time uses floored absolute monotonic milliseconds; resume uses positive wall gaps,
  persisting a negative-gap rebase without clearing remainder/debt. Host clocks are separate
  from latency. Exact checked Number arithmetic decomposes milliseconds/rate at base 1000;
  nonnegative terms and final target must be safe integers. No dependency/profile change.
- Settle one captured horizon at earliest pending due boundaries, at most 16 committed
  segments per turn. Retain debt and candidate after failures. Already-due jobs require
  recovery rather than skipping or a zero-length command.
- Input preflights fences, identity, receipts and freshness before sampling, then privately
  reserves its original identified intent/run behind one finite horizon. Resolve the same
  targets after settlement; its own elapsed revisions do not invalidate its original token.
  Different retained intent conflicts; replacement cancels the reservation. No durable queue.
- Shared Game notifications are typed state or terminal reserved-attempt completion, carrying
  stable invocation identity and settled prior projection. Immediate replies emit no completion.
  Catching up is distinct from unknown-save pending. B2 owns native lifecycle/UI consumption.
- Fresh single-header local elapsed traces bind every record/payload run to the recorded
  header before trusted replay. Ordinary commands remain player commands; no clock sampling,
  inferred run or measurement flag grants authority. Capped/nonfresh/fault-rich limits remain.

This host composes with M1-A receipts/trust, changed-row SQLite adoption, ordered schedule
recurrence, ordinary invocation resolution and derived trace recovery. B2 completes the
actual lifecycle/UI/sampler consumer; B1 alone does not complete M1-B.

Both gameplay and administrative reconciliation check durable run before receipt access.
After a transaction is proved closed, malformed/missing/unexpected same-run checkpoint
evidence is terminal host `save_corrupt`, not permanent pending. The managed Game pauses
clock/input continuation, retains the last confirmed projection as blocked, surfaces typed
recovery status/reply, and permits only explicitly confirmed Start over after closing the
transaction. Low-level explicit authority entry may propagate the one local typed recovery
error. Actual SQLite read/rollback failures retain pending/unknown semantics. A valid different
durable run invalidates the old session as stale/replaced; it never corrupts or overwrites
that replacement or accesses its receipts through the old continuation.
