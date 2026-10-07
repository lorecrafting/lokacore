# Browser SQLite worker deadline independent review

- Source: `fix/web-sqlite-sync-deadline`, exact `fb618a293a5b1f0ff139596edc50ccff2d2087af`.
- Base: `747c252dc25b37046d482c4a51493d16d70e0378`.
- Reviewer authored none of the source; separate review worktree.
- Governing requirements: [save commit/fence/reconcile](../system/save.md#commit-fence-reconcile),
  [save refusal](../system/save.md#opening-a-story), [browser preview](../web-preview.md),
  and [storage lessons](../lessons/storage.md).

**APPROVE. No findings.**

## Required behavior and inspected boundaries

Healthy delayed worker replies must survive fast CPUs; a missing reply must stop on
elapsed time in both pause and fallback modes. Patch application must be version/source
guarded and idempotent. A timeout must retain unknown-COMMIT fencing and receipt
reconciliation, without SQL retries, automatic save reset or weakened pin refusal.

`mobile/app/patch-sqlite-web.cjs:40` uses a monotonic five-second deadline and preserves
polling of the request's own shared lock. The periodic check at line 47 replaces both
iteration caps; it retains the SDK fallback for browsers without `Atomics.pause`.
The exact replacement checks at line 57 finish before the sole file write at line 62.
Late replies retain their original request buffers. The bridge neither repeats the
request nor changes the existing transaction/rollback/reconciliation path.

`mobile/app/sqlite-web-worker.test.ts:20` runs the actual patch twice, compiles the copied
installed Expo bridge and exercises its exported functions through real worker threads.
The literal reply and elapsed bounds at line 84 observe behavior, including real
`Atomics.pause` and its absence. The independent watchdog catches an unbounded loop.
No source-text assertion substitutes for those behaviors.

## Independent verification

- Pinned Node: `node --test --test-reporter=dot sqlite-web-worker.test.ts
  sqlite-web.test.ts ../authority/local-story/faults.test.ts
  ../authority/local-story/saves.test.ts ../authority/local-story/recovery.test.ts`
  from `mobile/app`, through `mise exec`: exit 0, **50 tests passed**. Includes real
  SQLite failed/unknown COMMIT, recovery/replay and byte-preserving pin/format refusals.
- In disposable dependency copies, restored the SDK iteration loop: exit 1; the new
  pause test rejected a healthy reply at about 91 ms, and fallback hit the eight-second
  watchdog. Removed the deadline condition: exit 1, both modes hit that watchdog.
- Independent version drift (`57.0.4`), duplicate-loop and changed-loop controls each
  refused patching with exit 1 and exactly unchanged worker bytes.
- All three retained [evidence](../evidence/2026-10-06-web-sqlite-sync-deadline/README.md)
  hashes verify. Inspected the developer's 14/14 disposable browser results, including
  saved movement/reload and current chapter routes; these were not rerun by this reviewer.
- Actual diff correctness and Ponytail Review: **Lean already. Ship.** No new dependency,
  retry layer, save migration or speculative abstraction. `git diff --check` passes.

## Limits and remaining delivery gates

Controlled delay/silence proof is Node execution of the installed bridge, not browser
OPFS fault injection. Synchronous waits still occupy the foreground thread, and the
4096-spin clock interval is not a real-time scheduling guarantee. Native verification
and owner-save access did not occur. The separately serialized broad gate and required
publication checks remain PM-owned; this approval does not claim those gates passed.
