# Review: scene@1 opening scene, `on {start: true}` (PR #622, loka-g5hh.3)

- PR: [#622](https://github.com/lorecrafting/lokacore/pull/622), branch `toolbox/opening-scene`
- Reviewed commit: `6476cab6bfb52965be46b497d859bdb621102b5f`
- Governing: [mechanics.md scene@1](../system/mechanics.md#scene1-mechanicsscenerulets) (:588, :612 opening paragraph), [D11](../system/mechanics.md#d11-character-choice-selected-contract) (:372), [book-ui.md Chapters, scenes and recovery](../system/book-ui.md#chapters-scenes-and-recovery) (:678-686), [composition record](../system/architecture.md#building-mechanics-by-composition), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit 6476cab6b...`): ci success, book-e2e success.
- `/code-review medium`: reported in the PR body.

## Must be true (written before the diff)

1. `start` is a modal-only trigger with no `outcome`; at most one per cartridge; the compiler refuses two.
2. `newWorld` seeds `scene_<k> := 1` through the same fact.assign path as initial knowledge, with no event, receipt or story point; genesis for a cartridge without an opening is byte-identical to main.
3. Save: reopen before Continue shows line 1, mid-scene the persisted line, an ended (−1) scene never replays.
4. While the fact is in 1..n the ActionSet is only `continue`; D11 ruling: the ancestry choice comes after the opening scene.
5. Book ruling: chapter 0 title page, then the opening scene, then the start room.
6. kernel_api 1.157 with consistent regen; tests per AGENTS.md "Writing tests"; the composition record names no other mechanic or content.

## Checks that held

- 1, 2, 3, 6: `protocol/scene.schema.json` (`exactlyOneRequired` + `dependentRequired`), `scenes.ex:144,152-156,171,278`, `fresh.ts:44-58` (existing `assigned()` writer, `'scene'` owner), `authority.ts:166-186` rebuilds through `newWorld`; `opening_scene.test.ts` covers reopen at 1, mid-scene and after −1. Smallest correct design: no new event or receipt. No fixture or hash file touched. `bin/regen.sh` at the head: tree clean. Composition record clean.
- Compiled content cannot reach `fresh.ts:44` without `scene@1`: `scenes.ex:94,105` (`owned`) refuses a scene without the capability, so the missing capability check there is not a finding.
- Cites rerun: `scene.test.ts` 8 pass; `test/loka/content_scenes_test.exs` 8 pass; `fresh.ts:55 1 -> 2` red (sweep row).

## Mutants

`bin/mutate_diff.sh origin/main` in a fresh detached worktree: 7 mutants, 3 run; `fresh.ts:46` (two) and `:55` red-narrow (the handback's BASELINE-RED rows run clean here), `scenes.ex:152-153` NO-TESTS (4) as in the handback. Hand mutants against `content_scenes_test.exs`: `:153 kind == "start" -> !=` red, `:153 or -> and` red, `:152 == 1 -> >= 1` SURVIVED (two trigger kinds on one scene; the schema's `exactlyOneRequired` already refuses it, author-side, no finding).

## Findings

1. **Should-fix** (PM ruling b, D11 order), `kernel/ts/src/commands/actions.ts:148-149` and `:226-227`, `mobile/app/book/Body.tsx:91-101`. Probe (derived sampler with `ancestries` plus an opening scene, `newWorld`): `gameView` carries `scene` index 1 and `ancestry_choices`, actions `['choose_ancestry']`; `continue` is refused `invalid_state` until the choice; after the choice the scene is still on line 1. The player sees the ancestry page before the dream. This follows the written spec (`mechanics.md:372` "No ordinary player command is admitted before selection"), so the spec must be amended first (D11 and the scene@1 opening paragraph), then `composed()` checks `scene.running` before `needsAncestry`, admission lets `continue` through while the choice is pending, and `Body.tsx` draws the scene before the ancestry page. Logic change: not a small should-fix.
2. **Should-fix** (PM ruling a, book order), `mobile/app/book/Body.tsx:101-102`, `mobile/app/book/Book.tsx:187-190`. A cartridge with chapter 0 and an opening shows dream, then the chapter title, then the room. The code follows `book-ui.md:679-686` ("a chapter title reached with a scene waits until that scene ends"), which contradicts the ruling (title, then scene, then room). Amend `book-ui.md` first, then swap the order. Not covered by this PR's tests; a presenter test is needed with the fix.
3. Nit (author-side, owner rule), `lib/loka/content/scenes.ex:152-156`, `protocol/scene.schema.json`: `start` with `outcome`, `room` or `detail` compiles; the extra keys are ignored. Ruled: nit, no fix round.

## Verdict

APPROVE WITH NOTES. Findings 1 and 2 are ruling-versus-spec conflicts outside this PR's diff; the PM decides whether they are a fix round here (spec amendment first) or a Beads follow-up before the prologue ships with ancestries or a chapter 0.
