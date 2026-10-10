# Review: toolbox row W24 second half, Journal countdown, sampler, mobile proof (loka-kgd.46, batch M5)

- Branch `toolbox/m5-w24b`, head `316e5126a0d342550f7ca859ae6a96b1cfa64667`, base `7feb46e1` (merge-base with `origin/toolbox/batch-m5`), 27 files. No PR; handoff in Beads `loka-kgd.46`. Record kept: the slice adds `QuestView.remaining` to `protocol/gameview.schema.json` and a save load check ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [row W24](../MECHANICS-TOOLBOX.md#ranked-toolbox); [mechanics.md W24](../system/mechanics.md#quest-deadlines-toolbox-row-w24-engine-half); [save.md Quest deadline recovery](../system/save.md#quest-deadline-recovery); carries from the [engine review](2026-10-10-toolbox-m5-deadlines-review.md).
- Hosted CI on the head: ci `38057167309` and book-e2e `38057167280`, both success (`gh run list --commit`).
- Trial merge into `origin/toolbox/batch-m5` `2a079ebe` (W6 merged): two conflicts, both generated (`docs/system-graph.gen.json`, `docs/toolbox.gen.json`): regenerate.
- Verdict: **APPROVE WITH NOTES**: no blocker, one should-fix, three nits.

## Must be true

1. Engine finding 1: a `begun` row with cause time != clock; `add(clock, after)` fails it.
2. Engine finding 2: a generic job row that names a quest without a deadline, another actor, or another quest's instance is `save_corrupt` at load; a legitimate row loads.
3. `remaining` = due - clock, at least 0, only for an open instance of a generic deadline with a pending job; legacy (Chapter 1) views unchanged.
4. The sampler fails `late` at acceptance + `after`, has an on-time path, and a `quest_failed` reaction penalises.
5. Real SQLite: cold reopen, replay, failed and lost COMMIT at expiry.
6. Engine nit 3 (row text `started_at`) corrected.

## Proof

- (1) M1 `lifecycle.ts:86` `add(world.state.clock, …)`: killed (`kernel/ts/test/quest_deadline.test.ts`, row `[100, [], 110]`).
- (3) M2 drop `!OPEN.includes` and M3 drop `d.fact ||` (`view/quest_journal.ts:91`): killed. M4 drop the clamp (`:95`): survives; equivalent: no adopted state holds an open instance's pending job past due (elapsed dispatch runs it; `begun` never schedules at or before the horizon). Not a finding.
- (2) M5 `deadline-jobs.ts:9` `return false`: killed (mobile `quest_deadline.test.ts`). M6 and M7 survive (findings 1, nit 1).
- (4), (5) baseline green: kernel `quest_deadline`, `quest_hints`; mobile `quest_deadline`. (6) row text at `docs/MECHANICS-TOOLBOX.md:114` fixed.
- Developer deviation (a row may outlive its instance): correct. `quest.retire` (`compose_quest.ts:17`) deletes a resolved instance row on a repeatable re-run (`lifecycle.ts:116`) and leaves its stale job pending; `quest/job.ts:20` completes it. Requiring the instance would make every such re-run `save_corrupt`.

## Findings

1. **should-fix**, `mobile/authority/local-story/deadline-jobs.ts:13`: mutant `(!!q &&` → `(true &&` passes. No mobile test holds a job row whose instance is gone. Failure: a regression there throws at load (`refString(undefined.quest)`) for a repeatable generic-deadline quest re-run, so a valid save cannot open. Not blocking: no shipped repeatable quest (`infirmary_herbs` ×2) declares a deadline. Fix: one more forge case deleting the instance's `quests` state row, expecting `open`.
2. **nit**, `deadline-jobs.ts:12`: mutant `job.actor_id !== world.character` → `false` passes; with the instance present the scope check repeats it, with it gone it refuses a row `job.ts:20` would complete. Add the paired case (instance gone + foreign actor) or drop the clause.
3. **nit**, `kernel/ts/src/mechanics/reaction.ts:247` `resolvedActor` still ignores `quest_failed` (engine nit 4, latent: one character per TS world). Carry.
4. **nit**: the developer's `/code-review medium` result is not in the Beads handoff.

## Questions put by the PM

- **Book units** (`mobile/app/book/model.ts:21`): consistent with the Conditions/bleeding lines (`model.ts:17`, `:22-27`), which also print logical units as seconds (cartridge.md "logical seconds"); W23 hints display no duration. The Book has a second convention: the D6 water countdown converts to real seconds from the rate in the authority ([book-ui.md D6](../system/book-ui.md#d6-water-exits-and-chapel-recovery), `view/water.ts:54`, `Body.tsx:49`). The 50× gap pre-exists for Conditions (`exposure_sampler` 9000 shows "150m" for 3 real minutes). Disposition: designer item (loka-x6t.14), choose one convention for the whole Book; not a slice should-fix.
- **Removing a deadline in a content update**: not reachable. A save opens on its pinned release (save.md, opening and pre-production compatibility), which still declares the deadline, or is refused `pinned_release_missing`. Not a finding.
