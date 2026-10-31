# Review: a seen NPC shows its worn items, PR #517 (loka-oc5i, kernel_api 1.125)

- PR [#517](https://github.com/lorecrafting/lokacore/pull/517) `feat/oc5i-npc-worn` at `c91704826c91f28c00c999dd5cf50a9c40d4efa2`, diff `origin/main...c91704826` (merge base `0bc1d5607`; main now `a5c390aa6`, #514 merged, kernel_api 1.124).
- Governing: "BRIEF loka-oc5i" with PM ruling B (`br show loka-oc5i`); epic `loka-ewtx` notes (kernel_api by merge order); [protocol.md](../system/protocol.md) GameView entities, NPC holdings (amended `:375-380`); [mechanics.md](../system/mechanics.md) equipment@1 (`:104`) and theft row 33 (`:3308`); [forward development](../decisions/owner-decision-forward-development-2026-10-05.md) (release-pin refusal, Start over); AGENTS.md "Writing tests".
- PM positions taken as settled: slot-declaration limit until loka-0vrs; `worn` ignores the NPC get lock.
- Reviewer: independent; authored none of the work.
- Verdict at `0d4bad9f0`: **APPROVE WITH NOTES** (fix re-check below). Original verdict at `c91704826`: **CHANGES REQUIRED** (two should-fix, both small; one open merge item for the PM; one nit; no blocker). The branch cannot merge as is (conflicts), and after the merge no test guards a main-release save.

## Must be true (written before reading the diff)

1. A visible living NPC's `worn` = its direct custody items whose definition declares `slot`, as ContentViews; absent when empty; shown with or without theft.
2. `contents` unchanged: theft-gated, get-lock filtered.
3. Worn actions come from the same `actions.of` query; without theft `take` is unavailable, `not_present` (ruling B).
4. A slotted item at depth 2 (inside a held container) is never worn.
5. Schema: optional `worn`, ContentView items, `minItems: 1`; `contracts.gen.ts` regenerated.
6. kernel_api strictly above main's at merge; `world.ts:108`, showcase `at_least`, hash fixture and transcripts move together; a save from main's release is refused at the pin (Start over).
7. protocol.md states the rule before the code.
8. An unseen NPC stays absent.

Results: 1-5, 7, 8 hold; 6 holds against main at review time (1.125 > 1.124) but its save test pins the wrong release (finding 1).

## Findings

1. **Should-fix, `mobile/authority/local-story/saves.test.ts:555-561` and `:1`.** The new pin test duplicates main's `release_pin.test.ts` (#514) and pins `1.123`. Main's saves are now `1.124`, so after the merge no test opens a main-release save at 1.125: a regression that leaves kernel_api at 1.124 (the "keep the higher version" merge collapse that blocked #514) passes both tests. The size allowance also rose 560 -> 570 for it. Fix (PM ask): drop the test, set `release_pin.test.ts` to `1.124` (and its comment), revert the allowance to 560.
2. **Should-fix, `kernel/ts/src/view/invariants_view.ts:204-211`.** The brief says worn actions are covered by `gameview_agrees_with_admission`; `entityView` searches entities, inventory, their `contents` and equipment, never `worn`. A worn-only entry (every worn item without theft; under theft a worn item the NPC's get lock filters out of `contents`) has its `take` unchecked. Demonstrated: theft sampler without theft, slotted badge on the merchant; admission refuses the take `not_present`; a view with that worn take set `available: true` still passes `gameview_agrees_with_admission` (true). Failure: a later change that offers a worn `take` admission refuses passes every invariant run. Fix: add `...(e.worn ?? [])` to the flatMap; with it the same planted view returns false (probe green).
3. **Open item for the PM (not a code finding): merge with main.** `git merge-tree` conflicts in `cartridges/toolbox_showcase/cartridge.json`, `kernel/ts/src/runtime/world.ts`, `protocol/fixtures/toolbox_showcase_hash.json`, the showcase transcripts and `mobile/app/stories/live/*.sql`, all pins or generated. Resolve by keeping 1.125 and running `bin/regen.sh`; 1.125 > main's 1.124.
4. **Nit, `kernel/ts/src/view/view.ts:173-178`.** Without theft every NPC's direct holdings are viewed (`viewOf` plus `actions.of`, query steps) and the unslotted ones dropped. No current content comes near `LIMITS.query_steps` (theft cartridges pay the same today; prices_sampler's NPCs hold 4 items). Accept; revisit with loka-0vrs holders.

Judged, no finding:
- Theft lifts a worn item (`showcase_combat.test.ts` combat impact): not a spec break. mechanics.md:104 `not_present` is for equipment@1 slot holders; an NPC's slotted item is in direct custody and row 33 (`:3308`) admits its take; protocol.md:376-377 says worn ones show in `contents` under theft. Inside the accepted loka-0vrs limit.
- `worn` ignores the get lock: PM position. Vault NPCs hold a currency pool, not items, so no locked item leaks in current content.
- Elixir: not applicable, no GameView projection in `lib/`; no lib or content-schema change.
- Composition record: not applicable (a projection, not a mechanic); no capability code names content.

## Evidence

- `bin/mutate_diff.sh origin/main` at the head (Elixir deps linked; a first run without them was all BASELINE-RED, environment only): 4 mutants, `view.ts:188` `>`->`>=` and `&&`->`||` red-narrow; `view.ts:174` `===`->`!==` and `view.ts:188` `0`->`1` SURVIVED (one-hop tests do not include theft or showcase_combat). Same as the handback table, which clears both with hand mutants.
- Hand mutants, each alone against `kernel/ts/test/theft.test.ts`, reverted:
  - H1 `view.ts:174` `e.kind !== 'npc'` (clears the SURVIVED row): tests 1 and 9 fail.
  - H2 `view.ts:175` drop `direct` (PR claim "drop direct: theft 1, theft 9 red"): tests 1 and 9 fail; claim backed.
  - H3 `view.ts:178` worn only under theft (PR claim "gate worn on theft: theft 9 red"): test 9 fails; claim backed.
- Invariant probe (finding 2): scratch copy of `theft.test.ts` plus one test; at the head the planted view returns true; with the one-line fix false. Scratch file removed.

- `/code-review medium` reported in the PR body (9 findings).
- CI (`gh run list --commit c91704826c91f28c00c999dd5cf50a9c40d4efa2`): ci success, book-e2e success, graph-diff success.

## Fix re-check at `0d4bad9f01343e2af7fd183fae45904ab3a8e9a6`

Scope: `28c51cbb4` (merge of origin/main, keep 1.125, `bin/regen.sh`) and `0d4bad9f0` only. The head merges cleanly with main `e61a02d35` (#516; main kernel_api still 1.124).

- Finding 1, fixed. `saves.test.ts` equals origin/main (allowance 560, pin test gone). `release_pin.test.ts:2-3,43-47` pins `1.124`: green at head. Red controls, each alone, reverted: showcase hash fixture `at_least` 1.125 -> 1.124 fails 1; `world.ts:108` INSTALLED -> `1.124` fails 1.
- Finding 2, fixed. `invariants_view.ts:210` adds `...view.entities.flatMap((e) => e.worn ?? [])`; theft test 9 now checks `gameview_agrees_with_admission` true on the honest view and false on the drift view. With the line deleted test 9 fails (7/8); restored 8/8.
- Finding 3, resolved. One transcript checked: `transcripts/commerce.jsonl` differs from origin/main only in `content_hash` (`d9fdc5c1…` -> `e3c09776…`); the diff with hashes normalised is empty.
- Note (nit, PR body): lines 15 and 21 still describe the dropped `saves.test.ts` 1.123 pin test; update it to point at `release_pin.test.ts`.
- CI (`gh run list --commit 0d4bad9f0…`, seen once): graph-diff success; ci and book-e2e in_progress.

Re-check verdict at `0d4bad9f0`: **APPROVE WITH NOTES** (one PR-body nit).
