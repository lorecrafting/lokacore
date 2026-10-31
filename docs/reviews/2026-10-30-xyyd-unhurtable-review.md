# Review: an NPC with no hp of its own cannot be hurt, PR #518 (loka-xyyd, kernel_api 1.126)

- PR [#518](https://github.com/lorecrafting/lokacore/pull/518) `fix/xyyd-unhurtable` at `e2dd2d15bce1c3aff3a15f534fb406ec60b09a26`, diff `origin/main...e2dd2d15b` (main `d96295868`, kernel_api 1.125 after #517).
- Governing: the brief in `br show loka-xyyd`; release-pin rule in `br show loka-ewtx` (strictly above main at merge); [mechanics.md combat@1](../system/mechanics.md); [protocol.md RefusalCause](../system/protocol.md); book-ui.md Unavailable actions; AGENTS.md "Writing tests".
- Reviewer: independent; authored none of the work.
- Verdict: **CHANGES REQUIRED** at `e2dd2d15bce1c3aff3a15f534fb406ec60b09a26`; fix re-check at `6d11c9cc2db3243c7798de7a5cdabe40e6bdb1ba`: **APPROVE** (below).

## Must be true (written before reading the diff)

1. An hp-less NPC is offered Attack unavailable with a generic cause through the shared admission query (`attackRefused`), so view and execution cannot disagree.
2. Execution refuses with the same code and cause; the world is unchanged.
3. No encounter opens on an hp-less NPC from any entry point (attack, retarget, hostile engage on entry, spell fight-back, expedition hound, population), so `round_attack.ts:77` NaN is unreachable.
4. A foe with hp stays attackable.
5. kernel_api strictly above main's (1.126), with the pin test showing a save at the previous version refused with Start over.
6. Schema enum, protocol.md and the spec amended.
7. The Book shows the grayed card and a refusal sentence (brief: "You can't hurt the shopkeeper.").

Results: 1-4 and 6 hold; 5 and 7 do not.

## Findings

1. **should-fix** `mobile/authority/local-story/release_pin.test.ts:44-47`: not touched; it still pins a 1.122 save (main's moved to 1.124 in #517). Requirement 5 asks for the previous version. Scenario: the merge round leaves the row at 1.124 (or showcase `at_least` at 1.125); a real 1.125 save from main reopens under 1.126 and nothing goes red. Fix: on merging main, move the row to 1.125 and keep world.ts/showcase at 1.126, hashes regenerated on top of main.
2. **should-fix** `mobile/app/book/words.ts:96-121,239`: only CAUSE gains `cannot_be_hurt`; no SENTENCE entry. A refused Attack logs "You can't do that—cannot be hurt.", which reads as the player being unhurtable. The brief asks for the sentence and a Book reason story; deferred as a follow-up without a ruling.
3. **question** `kernel/ts/src/mechanics/combat/shared.ts:42`: the hp check precedes `not_present`, so an hp-less NPC in another room answers `cannot_be_hurt` rather than `not_present`. Consistent with the existing invalid_target-before-not_present order; not a finding unless the spec orders them.

Head is `CONFLICTING` (`git merge-tree` against `origin/main`: showcase `cartridge.json` and 40+ transcripts).

## Evidence

- Entry points: `combat/rule.ts` decide and retarget, `scripted_action/spell.ts:116` fightBack and `expedition/sequence.ts` openHound use `attackRefused`; `position/rule.ts:44` and `movement/sequence.ts:141` reach `disposition.ts:123` (now `npc.hp`); population members require hp (`lib/loka/content/population.ex:220`). No other `encounter.open` producer.
- `bin/mutate_diff.sh origin/main` (MUTATE_MINUTES=20): 8 run, red-narrow 6, SURVIVED 2 (`disposition.ts:123` `&&`->`||` #2, #3; one-hop narrow set). Cleared by hand with `bin/mutate.sh` against `test/fear.test.ts`: both `||` swaps, dropping `npc.hp &&`, and `action_lists.ts:236` ignoring the object code all red-narrow.
- PR claims rerun: cites `shared.ts:42`, `disposition.ts:123`, `fear.test.ts:229/270` accurate; "no authored cartridge has an NPC with attack but no hp" holds (180 `cartridges/*/npcs/*.json`, none with `attack` or `disposition.engage` lacking `hp`).
- Fixtures: showcase transcripts, `stories/live/*.sql`, `protocol/fixtures/toolbox_showcase_hash.json` change hash and version only (normalized diff).
- PR body reports `/code-review medium`.
- CI at head (`gh run list --commit e2dd2d1…`): graph-diff success; ci and book-e2e in_progress.

## Fix re-check at `6d11c9cc2db3243c7798de7a5cdabe40e6bdb1ba`

Scope: commits `01efd2399` and `6d11c9cc2` only. Verdict: **APPROVE**.

- Merge: one merge of main (`eadb1b0f3`, #517 at 1.125); `kernel/ts/src/runtime/world.ts:108` and showcase `cartridge.json` `at_least` stay 1.126; PR mergeable. `transcripts/food.jsonl` against main: 4 lines changed, identical after normalizing hash and version.
- Finding 1 fixed: `release_pin.test.ts:43-47` now refuses a 1.125 save with Start over; green at head. Red control: showcase `at_least` set to 1.125 and the fixture regenerated (`bin/regen_hash_fixture.sh`) makes it fail (`not ok 1`); restored.
- Finding 2: ruled by the PM; the sentence goes in the polish batch (`reasons.ts` on the session branch), stated in the PR body. Not a finding.
- This record is carried at `5d94b8b0c`, the same content as the original review commit.
- CI at head: graph-diff success; ci and book-e2e in_progress.
