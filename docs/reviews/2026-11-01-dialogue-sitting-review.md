# Review: dialogue sitting, end_talk, scene from a choice, PR #576 (loka-vduxr.11)

- PR [#576](https://github.com/lorecrafting/lokacore/pull/576) `engine/dialogue-sitting` at `8c413c8c34cbf36c9287c0e6bb3dea162de40c4b`.
- Verdict: **CHANGES REQUIRED**.
- Governing: [mechanics.md Branching dialogue](../system/mechanics.md), [storage lessons](../lessons/storage.md), [composition](../system/architecture.md#building-mechanics-by-composition), [writing the game](../guides/writing-the-game.md); notes of `loka-vduxr.10`, rows 8, 11, 13.
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): ci, book-e2e, graph-diff completed, success.
- `/code-review medium` is reported in the PR body. `bin/mutate_diff.sh` not run (brief); nine targeted mutants below.

## Must be true (written before the diff)

1. Whatever the compiler accepts, the kernel plays and the save reopens: no accepted decision may leave a save that cold open calls corrupt.
2. A hub filtered to nothing closes; it never soft locks.
3. A mid-sitting row survives save and kill, and `openable` lets only `sitting` ids be missing, in written order.
4. `end_talk` closes only the acting player's talk, and does nothing with no talk open.
5. A scene from a choice never runs over an open talk and cannot replay; lawful content is not refused.
6. No existing cartridge hash changes; `kernel_api` is main+1; no player prose.

## Findings

**blocker** `lib/loka/content/reactions.ex:136` (advised at `lib/loka/content/explain.ex:131`, `docs/guides/writing-the-game.md:225`): `end_talk` on `choice_opened` compiles with no diagnostic and the save is lost. Reproduced on a compiled `speech_sampler` through the real SQLite authority: `reactions/cut.json` `{on:{event:"choice_opened"},steps:[{op:"end_talk"}]}`; Talk is accepted with ops `choice.open, choice.close` and committed; the next cold open returns `save_corrupt`, from `openEvidence` (`mobile/authority/local-story/riddle-save.ts:90-119`). The talk also never shows. No PR test plays `choice_opened`. Fix: drop it from `@own_acts`, the explain row and the guide; nothing useful can come of closing a talk as it opens.

**blocker** `lib/loka/content/hub.ex:58`, `:60`: the suite stays green with `o["patrol"]` or `d["riddle"]` replaced by `nil` in `sitting/5`, and both are reachable: at head, `sitting` on `continue` of the patrol fixture's `tobin_watch` and on a choice of `guard` with a `riddle` each give only `sitting_no_return`; under the mutants both compile with no warning, and the choice silently stays. `sitting_no_return` is asserted only in `test/loka/content_dialogue_sitting_test.exs`, whose table has neither. Fix: two table rows.

**should-fix** `lib/loka/content/dialogues.ex:153-157`: `forked` refuses a lawful fork. Two quest-less outcome choices, each gated `not decided` and setting `decided`, close each other, yet `story_point_two_outcomes` fires because it reads no gates. The offered remedy, a `quest`, adds a journal chapter the writer did not ask for. Run on `persuade_sampler` with `decided` in `facts.json`: `story_point_two_outcomes` is the only diagnostic. Fix: skip when all outcome choices self-gate on one shared fact, or state in the guide that this form needs a quest.

**nit** `lib/loka/content/hub.ex:56`: `o["then_failed"]` is unreachable (mutant survives): `dialogue_links.ex:45` already requires a `check`, listed two lines down. Delete it.

**nit** `kernel/ts/src/mechanics/dialogue/behavior.ts:84`: the rewrapped doc comment runs past the line width.

## Pre-existing, not this PR's

`choice_opened` plus `fact.assign` on `persuade_sampler` (unchanged paths) also ends in `save_corrupt`: same `openEvidence` root. Needs its own Beads issue; the first blocker's fix does not cure it.

## Checks that held

- (2) All choices sitting, and a sitting choice with a gated remainder, close cleanly; `SITTING_SPENT` warns.
- (3) Compiled plus authority: choosing reopens the remainder, cold open shows the same row, a spent choice is rejected. Order: the row is filtered by identity, so Elixir's sorted ids (`loka-vduxr.31`) cannot change which choices show.
- (4) `choice_resolved`, `action_completed`, `check_passed`, `check_failed`, `story_point_reached` played on compiled samplers, with cold open after each; no talk open gives no op; two rules give one close. In `persuade_sampler` the check paths close anyway, so the rule's effect there is not separately visible.
- (5) The guide's `.scene` `once` plus sidecar, `.cut`, `.json` compiles with no warnings and plays: talk closes, scene shows, cold open mid-scene holds, Talk during it is rejected, no replay. Refusal wording in `explain.ex` is clear.
- (6) `git diff origin/main...HEAD --stat -- cartridges test/fixtures` is empty; `kernel_api` 1.148 against main's 1.147.
- Mutants red: `scened` guard, `openable` sitting clause, `forked` `> 2`, `point_refusal` sitting, `@own_acts`. The `reaction.ts:188` mutant (`world`, `world.character`) survives; with one character per world and no earlier op that can open a row, it is equivalent today.
- PR claims rerun: no cartridge or fixture change; the `dialogue_sitting.test.ts:19` `openable sitting` mutant is red.

## Not checked

`end_talk` in combat: Talk and `choose` returned `invalid_state` in a fight, and `kernel/ts/src/commands/actions.ts:173-185`, `:247` read as the guard, but the peace control returned `not_owned`, so no run showed a working `choose`; `action_completed` with a talk left open during an encounter; a `then` to another hub through the authority (played at kernel level only); `hand_over` on a quest-less `once`.

## Re-check at `53af400730c105654ef79019e626b7204aef3748`

Scope: the fix commit `0c58a8e37`'s findings. `riddle-save.ts` belongs to the second reviewer and was not reviewed. CI at this head (`gh run list --commit`): ci, book-e2e, graph-diff completed, success.

Verdict: **APPROVE WITH NOTES**. Two should-fixes, one nit.

Dispositions:

- `end_talk` on `choice_opened`: fixed. Kept in `@own_acts`; compiles; `dialogue_end_talk_save.test.ts` passes 5/5. Dropping it from `@own_acts` turns that file red (4 pass, 1 fail).
- Sitting refusal rows for patrol and riddle: fixed. Mutants `o["patrol"]` to nil and `d["riddle"]` to nil each go red (10/11).
- `forked`: fixed. The original case (a and b gated on one self-set fact, c plain, on `persuade_sampler`) compiles. Played: choose a closes the talk, the next talk's `b` is rejected `invalid_state`, cold open holds. `intersection` to `union` goes red (9/11).
- Writer walk: `once: sitting` compiles, and warns `SITTING_SPENT` when nothing is left. The guide's `end_talk` example compiles on `choice_resolved` and `choice_opened`. The guide's scene from a choice compiles with `once` and one outcome, and with two outcomes gated in the sidecar. `sitting_no_return`, `story_point_two_outcomes` and `end_talk_event` wording reads true against those runs.

Findings:

- **should-fix**, `mobile/authority/local-story/__tests__/dialogue_end_talk_save.test.ts:175`: the title "in a fight no act can fire end_talk" is false, so the developer's claim is not confirmed. `cast` is kept in a fight (`kernel/ts/src/commands/actions.ts:181`). Probe: a fight, an open talk, a `lux` spell and `end_talk` on `action_completed`. The cast is accepted, emits `action_completed`, and its delta has `choice.close`, so the talk row is gone. `flee` is then accepted and cold open holds, so this is safe play and no blocker. Failure scenario: a later change that makes this close fault passes the test, which tries only `choose` and `perform`. Fix: retitle, add the cast row. `docs/guides/writing-the-game.md:225` needs no change.
- **should-fix**, `lib/loka/content/explain.ex:130`, `docs/guides/writing-the-game.md:211`: "gate every outcome's choice on one fact" does not name the only form `self_gates` accepts (`not` around `fact_compare equals v`, with a step assigning `v`). Probe: a and b gated `fact_compare decided equals false`, stepping `decided` to true, behave the same, but the compile refuses them with "Add `once`". Writer `once` on both gets the two-outcomes message, which sends them back to gating: a loop. `writing-the-game.md` shows no gate; only `dialogue-cookbook.md` uses the `not` form. Fix: name the form in both places, or accept the positive form.
- **nit**, `lib/loka/content/dialogues.ex:154`: a fork can still reach a second outcome. Probe: a, b as above, plain c with steps setting the fact false. Choose a, Talk, c, b: both accepted, `story_point_reached` twice, cold open holds. The writer has to clear the fact on purpose, and the guide says "gated on one fact it sets", so no change is required.

Not checked: `riddle-save.ts`; the whole of `bin/mutate_diff.sh` (brief). Cast with a rolled check in a fight was not played; only `action_completed` was.
