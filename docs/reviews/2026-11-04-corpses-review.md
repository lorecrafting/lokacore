# Review: corpses name their victim, decay and spill, PR #593 (loka-kgd.203)

- PR [#593](https://github.com/lorecrafting/lokacore/pull/593) `death/corpses` at `0f4f1ac497fd0bf21cb5674d7d8a400f10832838`.
- Governing: [mechanics.md death@1](../system/mechanics.md) (decay), [cartridge.md Corpse decay declarations](../system/cartridge.md), [owner decision](../decisions/owner-decision-corpses-respawn-2026-11-02.md).
- Reviewer: independent; authored none of the work. Companion record: [second review](2026-11-04-corpse-decay-second-review.md) (save/delta side).
- CI at this head (`gh run list --commit`): graph-diff success; ci and book-e2e queued (elixir, lint, sim showcase passed; kernel, mobile, sim fresh, e2e, storybook, walk pending).
- `/code-review medium` is reported in the PR body.

## Must be true (written before the diff)

1. With no setting there is no job, and bytes are unchanged.
2. The JobId is minted after the corpse EntityId; due = death clock + units; same writer group.
3. When due: direct children spill to the room in EntityId order, the corpse goes to consumed, the job completes, and no event is emitted.
4. A corpse not in a room only completes the job.
5. The compiler refuses decay without schedule@1 and food@1; the minimum is 1.
6. Only an NPC corpse's view carries `victim`.
7. TS and Elixir compose and invariants agree.
8. Reopen keeps the state.

## Checks that held

- (2) `sequence.ts` calls `decayJob` right after the corpse create. Every deathSequence caller sets the clock to the step time.
- (5) `death.ex` refuses the setting with UNDECLARED_CAPABILITY. The schema minimum is 1.
- (6) `view.ts` `victimView` covers NPC victims only.
- Mutants (worktree at head):
  - `compose.ts:280` room flipped: red 3/5 in `corpse_decay.test.ts`.
  - `compose.ts:278` consumption check to `true`: green in TS, red 1/2 in Elixir `corpse_decay_compose_test.exs` via `agree`. This contradicts the companion record's nit.
  - `job.ts:35` guard to `if (room)`: red 2.
- PR claims rerun:
  - The "room guard" row is backed.
  - "Elixir nil `corpse_id` refused by ... Invariants" is not backed (see finding 1).

## Findings

1. **should-fix**: TS and Elixir disagree on `corpse_id: null`.
   - `kernel/ts/src/foundation/compose_job.ts:151` uses `'corpse_id' in op`, so TS compose writes a row with `corpse_id: null`, and `invariants_encounter.ts:196` (`!== undefined`) passes it.
   - `compose_encounter.ex:267` faults on the same input. `invariants_encounter.ex:263` returns true.
   - Shown by probe: TS composes; Elixir compose faults and the Elixir invariant is true.
   - Fix: `!= null` / `!= nil` at the three sites, and a test that asserts the invariant itself.
2. **should-fix**: the spill order is unpinned.
   - `kernel/ts/src/mechanics/death/job.ts:45`: replacing `.sort(cmp)` with `.reverse()` leaves `corpse_decay.test.ts` green, because only one item is ever spilled.
   - The spec clause "in EntityId order" has no test.
   - Fix: a test that spills two items.
3. **concur** with the companion record's should-fix on `compose.ts:279`.
   - `decayed` reads the base `ctx.state`, and writes land in `ctx.overlay`.
   - So a corpse created earlier in the same proposal fails the exemption.
4. **nit**: `mechanics.md` decay says "spill, consumed, then completes". `job.ts:51` emits `job.complete` first, which is the runner convention. Align the spec wording.
5. **nit**: the PR body cites `death/job.ts:105`; the file has 53 lines.

## Mutation sweep

I reran `bin/mutate_diff.sh origin/main` and stopped it after about 7 minutes; it printed no table. The author's run had also timed out (66 of 72 unrun).

The three narrow mutants above stand in for it. The PR's "`compose.ts` exemption not run" row is now covered: the TS run is red for the room flip, and the Elixir `agree` test is red for the consumption check.

## Verdict

CHANGES REQUIRED (two should-fix, plus the companion's two).
