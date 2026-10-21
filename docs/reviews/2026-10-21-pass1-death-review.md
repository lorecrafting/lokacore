# Review: pass-1 GE4, death and round receipts lost in a cast-started fight (loka-y6yg.45)

- Branch `showcase/pass1-death` (no PR; merges into batch `showcase/pass1`), exact head `772195229e305e61847385590749449783a61a5c`, base `origin/showcase/pass1`.
- Governing: [save.md Commit, fence, reconcile](../system/save.md#commit-fence-reconcile) (03 §15); [save.md Narration on reopen](../system/save.md#narration-on-reopen); the frozen Lantern known answers (`mobile/authority/local-story/lantern.test.ts`, 06 §43 note at :325-326); [WORKFLOW review stance](../WORKFLOW.md); AGENTS.md "Writing tests".
- Hosted CI at the head: `ci` run 39662371176 failure (one failing test, below); `book-e2e` 39662371172 success.
- Written 2026-10-21 by anthropic/claude-opus-5-5.

## Must be true (written before the diff)

1. Every round line and the death line of a cast-opened fight reach the Combat log, including rounds a press drains before it finishes.
2. Narration is read from committed receipts only; memory never serves a state the store did not confirm.
3. Each line is shown once (no duplicate from the drain and the clock).
4. No protocol or save format change (brief scope trigger).
5. Frozen known answers (Lantern traces and the adverse cases) stay unchanged.
6. The repro is red at the base and green at the head.

## Checks run

- Repro `mobile/app/book/cast_death.test.ts`: red at base (only the bolt line), green at head.
- Mutants on `narration.ts:24` (at `772195229`; removed by the fix) (drop `s.fence ||`; `||` to `&&`): `local_story.test.ts` red. But with only `narration.ts` reverted to the base, the :319 assertion fails by a throw from `isInTransactionSync` on the closed fault database (`local_story.test.ts:58`), not by served narration.
- Guard for the kept line `session.ts:154`: `cast_death.test.ts` is red at the base and green with only `session.ts` changed (`narration.ts` at the base).
- Cites rerun: `invocation.ts:96` is the press drain pulse; `session.ts:154` is `lastNarration`. Both hold.
- No duplicate: `onAdvance` fires only per committed clock segment, and the presenter skips a seen narration id.

## Findings

1. **Blocker**: `mobile/authority/local-story/narration.ts:24` `s.fence ||` (at `772195229`) breaks the frozen adverse case `choice-unknown-commit-committed` (`lantern.test.ts:334`, case at :430). Scenario: an unknown COMMIT that really committed, settled externally with the transaction closed. The frozen answer expects the stored narration (`[proof-choice:talk:outcome]`) while `s.fence` is still set; the head returns `[]`. Hosted `ci` is red on this case alone; reproduced locally. The frozen comment (:325-326) gives the contract: no narration only while an unknown COMMIT keeps the transaction open, and `narration()` reads the store, so it does not serve memory. Fix: revert `narration.ts` to the base and drop the `local_story.test.ts:319` assertion; keep `session.ts:154`. Verified: with that revert, `lantern.test.ts` and `cast_death.test.ts` pass, and only the :319 assertion fails. Requirement 5 fails.
2. **Should-fix** (disposed by 1): `local_story.test.ts:319` (at `772195229`) contradicts the frozen answer above, and its red control is an I/O throw on a closed database, not a fence leak (the second opinion found this too).
3. **Nit**: the handback cites the developer's `/code-review` "disputed items 3-4", but they are in no Beads note, commit message or branch file. Forward them or record them as none.

## Rulings on open items

- **Open item 1** (`save.ts` `block()` clears the fence; add `s.blocked ||`?): no, not in this slice. After fix 1, `narration()` has no fence gate, so a blocked gate would be a new rule. It is not a repair. It is also pre-existing: a blocked recovery is a terminal reply, so the old `pending()` gate was open there too. And the Book does not read narration it never adopted, because `presenter.ts:60` reads only on a token change. A future gate must keep the frozen Lantern answers; no follow-up needed.
- **Open item 2** (`chronicle()` at `narration.ts:62-63` has no fence gate): pre-existing; the slice does not touch it. It reads committed rows and already refuses while a transaction is open. A fence gate there risks the same frozen-answer conflict as finding 1. No follow-up.
- **Browser observation** (rounds advanced only on the next press): not this slice. A probe `pulse('active')` with no press narrated both rounds at both base and head. Not loka-3w3q (engine death outside a round) and not loka-x6t.26 (Book routing of non-combat death). The likely cause is the web clock loop, but this is inferred and not reproduced. Leads: `mobile/app/App.tsx:130` cancels the loop on any status other than ready or catching_up and reschedules only on `recovered.notify(true)`; the `booked` gating at :173; or a background or throttled browser-use tab, since AppState background pauses the clock. Follow-up needed: repro in a foreground tab first.

## Verdict

CHANGES REQUIRED

## Fix round 1

- Range `772195229..bcaabc7ac56bc6fe82a2abaf7732525f6b86c8b3` (this record was cherry-picked as `555fe7c8e`). The round-1 `narration.ts:24` and `local_story.test.ts:319` cites refer to `772195229`; after the fix, neither line differs from the base.
- Finding 1: resolved. `mobile/authority/local-story/narration.ts` is identical to `origin/showcase/pass1`, and `session.ts:154` `lastNarration: story.narration` is kept (only its comment changed). `lantern.test.ts`, `cast_death.test.ts` and `local_story.test.ts` all pass under nice.
- Finding 2: resolved. `local_story.test.ts` is identical to the base.
- Finding 3: resolved. The developer found no disputed items; recorded as none.
- Guard re-run: with the old `pending()` gate restored at `session.ts:154`, `cast_death.test.ts` is red.
- Direct callers of `lastNarration`: `presenter.ts:69` reads only on a projection token change. `logs.ts:69` (restore) reads the store on reopen. `logs.ts:94` via `received.ts:90` and `updates.ts:97` read only after a `saved` reply. None reads narration for a press the store did not confirm.
- Hosted CI at `bcaabc7ac`: `ci` 39664699811 and `book-e2e` 39664699715 were in progress at commit time; the PM checks before merge.
- Open: the web-clock follow-up for the browser observation, unchanged and outside this slice.

## Verdict (fix round 1)

APPROVE

## Fix round 2

- Range `bcaabc7ac..d833dfe7a59951c61716289b0737e177084746af` (only `mobile/authority/local-story/session.ts`). This record continues the round-1 copy on `ff33ef144`. That copy is not on the slice branch.
- Why: hosted `ci` 39664699811 at `bcaabc7ac` failed 4 remount-during-uncertain-Read tests (`no such table: unavailable_elapsed_reads`). The ungated `lastNarration` at `session.ts:154` (at `bcaabc7ac`) read the store while an invocation was held.
- Must be true: (a) while an invocation is held after a pending or catching_up reply, `lastNarration` reads nothing, as at the base; (b) rounds that a press drains inside its own attempt still narrate; (c) the flag cannot stay set after a throw or a nested attempt.
- Gate `session.ts:126` `unsettled = held && !attempting`: outside an attempt it equals the base `pending()` gate; inside one it equals the round-1 read, which was already reviewed. Only the flag lifetime is new.
- Tests under nice at the head: `cast_death`, `lantern`, `local_story`, `presenter`, book `polish`, book `priory`, authority `priory` and `session` pass. Hosted `ci` 39666835277 and `book-e2e` 39666835387 at `d833dfe7a` succeeded.
- Mutants (each restored, tree clean):
  - Drop `&& !attempting`: `cast_death` fails (only the bolt line remains). Requirement (b) is pinned.
  - `unsettled = () => false` (the round-1 behaviour): fails all 4 hosted-CI tests (book `priory.test.ts` 2, `polish.test.ts` 1, authority `priory.test.ts` 1). Requirement (a) is pinned.
  - `attempting = outer` changed to `= false` (re-entry): stays green.
  - try/finally removed (throw): stays green.
- Re-entry: unreachable today. The only subscriber (`mobile/app/book/updates.ts:37`) re-enters only through `shell.recovered`, and that schedules through `setTimeout` (`mobile/app/App.tsx:119-121`, `:186-188`). Neither the presenter nor the test harness calls `invoke` or `pulse` from a listener. No test needed.
- Lost COMMIT inside an attempt: acceptable. The press's own lost COMMIT returns pending and ends the attempt, so later reads are gated. A lost round COMMIT makes `advance` return before `changed` (`elapsed.ts:131`). The one emit after a lost COMMIT is `metadata()` followed by `changed(status)` (`elapsed.ts:148-150`). It leaves `token()` (`save.ts:119`, run and revision only) unchanged, so `presenter.ts:60` returns before reading. Even if it did read, the read would be a closed-transaction store read, which the frozen Lantern case allows, and `presenter.ts:68-72` catches a throw.

### Findings (fix round 2)

1. **Nit** `mobile/authority/local-story/session.ts:112-123`: no test pins the `finally` (the throw mutant stays green). Scenario: a later edit drops the `finally`. `attemptStory` (`session.ts:215`) rethrows a non-recovery error. `pulseOf`'s catch keeps the session with the invocation still held, so `attempting` stays true, and narration is then read while held, which is the hosted-CI failure again. The code is correct now. A test is optional.

## Verdict (fix round 2)

APPROVE
