# Review: Homestead batch A head (PR #398, loka-kgd.108)

- PR [#398](https://github.com/lorecrafting/lokacore/pull/398), branch `toolbox/batch-homestead-a`, exact head `a8648de242276322db40bda34241130ddd4c19c8`, base `origin/main`. Batch-head review: cross-slice composition, economy, floors, receipts, docs. Per-slice records: [hs-1](2026-10-15-hs-1-review.md), [hs-1 second opinion](2026-10-15-hs-1-second-opinion.md), [hs-5](2026-10-15-hs-5-review.md), [hs-5 second opinion](2026-10-15-hs-5-second-opinion.md), [hs-10](2026-10-15-hs-10-review.md), [hs-11](2026-10-15-hs-11-review.md).
- Governing: [mechanics.md Replenish on an event](../system/mechanics.md#replenish-on-an-event-homestead-hs-1), [Farming](../system/mechanics.md#farming-homestead-hs-2), [Fishing](../system/mechanics.md#fishing-homestead-hs-3), [Animals](../system/mechanics.md#animals-homestead-hs-4), [Cooking](../system/mechanics.md#cooking-homestead-row-hs-5), [Craft](../system/mechanics.md#craft-homestead-hs-10), [Skill trees](../system/mechanics.md#skill-trees-homestead-hs-11); [composition](../system/architecture.md#building-mechanics-by-composition); [WORKFLOW review stance](../WORKFLOW.md#review-stance), [Git hygiene](../WORKFLOW.md#git-hygiene); [AGENTS.md Writing tests](../../AGENTS.md#writing-tests-every-change-every-agent).
- Verdict: **APPROVE WITH NOTES** at a8648de2. One should-fix (an untested floor), no blocker.
- Written 2026-10-15 by anthropic/claude-fable-5-1.

## Must be true (written before the diff)

1. A craft (hs-10) and a `replenish.run` (hs-1) in one command over the same item do not fault `conflicting_write`: the step joins the root's group (`roots`).
2. `edible.applies` (hs-5) on the eater and the pen's `fed` on hens (hs-4) never cross: a status_applied/status_ticked reaction running `replenish.run` composes with an Eat.
3. Every 1.101 feature (replenish.run, craft, skill prerequisite, edible.applies) has a loader_floors refusal that pins that feature's floor in both kernels.
4. No mint: craft is custody-only; eggs (6), fish (5 and 4), turnips (3), spoons (2) are bounded; every loop has a sink or a cap.
5. Receipts replay for multi-line Eat narration and multi-move craft/replenish proposals.
6. `protocol/fixtures/invalid.json` is touched additively only.

Holds: 1, 2, 4, 5, 6. 3 fails for the craft floor (finding 1).

## Checks run

- Focused suites on the head, all green: `kernel/ts` craft, replenish, kitchen, pen, farm, fishing, decay, loader_floors, r9c_interactions (76 pass); Elixir content_craft, content_food, content_replenish, content_r9c_interactions, loader_floors (10 pass); mobile kitchen and food (5 pass).
- Scratch composition probes (not committed, scratch file removed): (A) craft_sampler with a `replenish.run` on the yield's `item_acquired` moving both sticks back from scrap, including the one the root consumed: accepted, one group, sticks in the workshop. (B) kitchen_sampler with a `status_applied fed` reaction running `restock`: Eat lands fed and the two escrowed fish return to the pond in the same command. (C) `consume.to === yield.from`: both carves accepted, spoon to body.
- Mutants (each reverted): drop `roots` in `kernel/ts/src/mechanics/containment/job.ts:94`: replenish sweep test and probe A red. `kept = craft.made` in `kernel/ts/src/mechanics/action_recipe/rule.ts:90`: craft test red. Receipt binds the last line in `mobile/authority/local-story/food-receipt.ts:23`: mobile kitchen reopen test red. Craft floor `1.101 -> 1.100` in `kernel/ts/src/content/cartridge_replenish.ts:27` and in `lib/loka/content/replenish.ex:68`: loader_floors and craft tests **stay green** in both kernels.
- PR claims rerun: `craft.test.ts:130` refuses the third carve with `craft.carve_spoon.needs`; `craft.test.ts:320` lesson offered unavailable and choose `invalid_state` after one failed carve; `pen.test.ts:207` nest `[0, 2, 2, 3, 3]` at C0+14399..57600. All backed.
- loader_floors.json union: four 1.101 cases present (replenish.run with edits, craft, skill prerequisite with edits, edible.applies); nothing dropped from the per-slice files.
- Economy: grain yard -> trough -> midden -> yard (daily); eggs larder -> nest -> eaten (6, then none); fish pond -> larder -> pond (hourly) and spoil -> midden -> larder (daily, cap 4); turnips larder -> furrow -> harvest (3); sticks -> scrap (sink), spoons store -> body (2). Only open faucet: a feather per hen replacement, documented at mechanics.md Animals known limits.

## Findings

1. **Should-fix.** The craft floor has no red control in either kernel. `protocol/fixtures/loader_floors.json` case "a craft" uses `cartridges/craft_sampler` unedited, which also carries `skills/carving.json` `prerequisite`; at 1.100 the prerequisite floor refuses first, so lowering the craft floor (`kernel/ts/src/content/cartridge_replenish.ts:27`, `lib/loka/content/replenish.ex:68`) keeps `loader_floors.test.ts`, `craft.test.ts`, `loader_floors_test.exs` and `content_craft_test.exs` green. Scenario: a later refactor drops the craft floor in one kernel; a 1.100 cartridge with `craft` loads there and is refused by the other, undetected. Fix: give the case an edit that removes `skills/carving.json` `prerequisite` (or a craft-only sampler edit), so the case pins craft alone.
2. **Nit.** PR body does not report the developer's `/code-review` result; add in the fix round.
3. **Nit.** `mobile/authority/local-story/food-receipt.ts:14` says "save.md binds only line 0"; `docs/system/save.md` has no such clause (the rule lives in mechanics.md Cooking). A reader of save.md could reintroduce the `length !== 1` check. Point the comment at the Cooking section or add the sentence to save.md.
4. **Nit.** `docs/MECHANICS-TOOLBOX.md:216-218` adds rows for .108.1, .108.3, .108.2 but none for cooking (.108.4), though mechanics.md calls it "Homestead row hs-5"; the toolbox catalog under-reports the batch by one content row.

## Disposition

Open: finding 1 (fix round, with a mutant line pasted), nits 2-4. Settled: composition of hs-1 with hs-10 and hs-5 with hs-4 (probes A, B), union of loader_floors.json, receipts (mutant red), economy loops bounded.
