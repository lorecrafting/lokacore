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

**blocker** `lib/loka/content/hub.ex:58`, `:60`: the suite stays green with `o["patrol"]` or `d["riddle"]` replaced by `nil` in `sitting/5`, so `sitting` on a patrol choice or in a riddle could compile and do nothing. `sitting_no_return` is asserted only in `test/loka/content_dialogue_sitting_test.exs`, whose table has neither. Fix: two table rows.

**should-fix** `lib/loka/content/dialogues.ex:153-157`: `forked` refuses a lawful fork. Two quest-less outcome choices, each gated `not decided` and setting `decided`, close each other, yet `story_point_two_outcomes` fires because it reads no gates. The offered remedy, a `quest`, adds a journal chapter the writer did not ask for. Observed on a scratch cartridge whose other diagnostics were unresolved fact references from my setup; `forked` reads neither. Fix: skip when all outcome choices self-gate on one shared fact, or state in the guide that this form needs a quest.

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
- Combat: a talk cannot open (`invalid_state`) and an open talk cannot `choose` (`invalid_state`) during an encounter, so `choice_resolved` cannot fire there.
- Mutants red: `scened` guard, `openable` sitting clause, `forked` `> 2`, `point_refusal` sitting, `@own_acts`. The `reaction.ts:188` mutant (`world`, `world.character`) survives; with one character per world and no earlier op that can open a row, it is equivalent today.
- PR claims rerun: no cartridge or fixture change; the `dialogue_sitting.test.ts:19` `openable sitting` mutant is red.

## Not checked

`action_completed` with a talk left open during an encounter; a `then` to another hub through the authority (played at kernel level only); `hand_over` on a quest-less `once`.
