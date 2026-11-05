# Second review: consume contract and save effect, PR #605 (loka-kgd.209)

- PR [#605](https://github.com/lorecrafting/lokacore/pull/605) `consume/one-effect` at `6eb1ea654cfb5c1743d965de68b955860e5b761a`.
- Scope: contract and save side ([WORKFLOW review count](../WORKFLOW.md#review-count)): `consume` replacing `eat`/`drink` (`command.schema.json`, `capability_registry.json`), status `ticks`, `AppliedStatus`, the optional edible restore and the liquid effect fields, kernel_api 1.154, generated contracts, fixtures and hashes, story saves, save replay, the later-end refresh. Mechanic correctness is the engine reviewer's.
- Governing: [mechanics.md Consume](../system/mechanics.md#consume-loka-kgd209), [save.md pin rule](../system/save.md), [contracts lessons](../lessons/contracts.md), [AGENTS.md Writing tests](../../AGENTS.md).
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): ci success, book-e2e success, graph-diff success.
- `/code-review medium` is reported in the PR body.

## Must be true (written before the diff)

1. 1.154 is set only at `INSTALLED.kernel_api` (`kernel/ts/src/runtime/world.ts:110`), one above main (1.153), and a showcase `at_least` that needs it.
2. A 1.153 save is refused at the pin (`pinned_release_missing`, Start over), never replayed, so no old `eat`/`drink` receipt or hunger/thirst row reaches 1.154 code.
3. The generated contracts and story saves equal a fresh regeneration.
4. Each changed hash fixture is explained by a content change; no conformance fixture (`docs/spec/conformance/`) changes without an IMPORT.md amendment.
5. The registry gives `consume` one owner (food@1); no cartridge that drank before loses Drink.
6. The later-end refresh changes no scripted `status.apply` outcome unless a longer consumable duration set the row.
7. Contract descriptions stay true of what the kernel sends.

## Checks that held

- (1) `git show origin/main:kernel/ts/src/runtime/world.ts` is 1.153; the diff's only other 1.154 is `cartridges/toolbox_showcase/cartridge.json` `at_least`.
- (2) `mobile/authority/local-story/authority.ts:100` compares kernel_api by equality; `saves.test.ts:130` reads `INSTALLED.kernel_api` (no hard-coded version). All `mobile/app/stories/live/*.sql` pins are 1.154 with hash `9511cb35…`.
- (3) `sh bin/regen.sh` at the head leaves the tree clean.
- (4) Only `toolbox_showcase_hash.json` changed (showcase content: well_fed, refreshed added; hunger, thirst, needs_enter, their resources removed). buffs, farm and use samplers have no hash fixture. `docs/spec/conformance/` is untouched and names no `eat` or `drink`.
- (5) Every cartridge with liquid@1 (buffs, farm, needs, toolbox, use) declares food@1. No `"eat"`/`"drink"` command name is left in `lib`, `kernel/ts/src`, `protocol` (the `drink` service step is another op), `mobile/authority` or `docs/spec`.
- (6) The Step schema's `status.apply` has no `duration`, so a scripted apply's end is always now plus the status's duration, never earlier than the row's own end except after a consume override. Only the showcase transcripts were re-recorded.
- Targeted tests green: TS `contracts`, `transcripts`, `food`, `liquid`, `status`, `cartridge_food`, `cartridge_liquids`; Elixir `content_food`, `content_liquids`, `content_status` (11/11).
- PR cites rerun: `status/shared.ts:153` is the later-end line; `cartridge.schema.json:2927` is `maxItems: 16`. Both hold.

- Mutants: `bin/mutate_diff.sh origin/main` (30 min): 153 mutants, red-narrow 25, SURVIVED 10, NO-TESTS 15, NOT-UNIQUE 4, TIMEBOX 99 (most of `status/job.ts`, `status/shared.ts`, `view/`, `status.ex`, Book and authority rows unrun). The survivors and NO-TESTS rows match the PR's hand-cleared and equivalent list. By hand (`bin/mutate.sh`), each red-narrow: `food/shared.ts:61` `length > 0` to `>= 0` (an at-maximum consume admitted with nothing landing); `status/shared.ts:153` `>` to `>=` (kitchen, status); `narration.ts:190` dropping `d.outcome !== 'drank'` (liquid, food authority tests).

## Findings

**should-fix** `protocol/gameview.schema.json:2857` (ConditionView description): it still says "ends_at minus duration is the last application, since a reapplication refreshes ends_at to now plus duration". Under this PR neither half holds. `view/resources.ts:72` sends the status's own duration, while `applies {status, duration}` sets the end (`status/shared.ts:151`), and a shorter repeat keeps the later end (`:153`).
- Scenario: a stew eaten at t sets well fed's `ends_at` to t+7200. The view sends `duration` 3600, so a client reading the contract computes the last application as t+3600, which is in the future. The PR lists the ring effect as an open item, but the contract text is left false.
- Fix: amend the sentence (for example "duration is the status's authored duration; a consumable may set a longer end"), or send the applied duration. Either is one line plus regen.

**nit** (author-side) `protocol/entity.schema.json:1453` ItemEdible and `protocol/liquid.schema.json:80` LiquidDefinition: no `dependentRequired` for `resource`/`amount`, and `protocol/fixtures/food_contracts.json:78` "edible missing amount" is now `valid: true`.
- Only the compiler (`food.ex`) enforces "both or neither" (mechanics.md Consume).
- Scenario: an artifact that does not come from the compiler, with `resource` but no `amount`, loads in TS, and `food/shared.ts:87` `Math.min(amount!, ...)` adjusts by NaN.

**nit** `protocol/gameview.schema.json:2906` ConditionView.ticks: "present exactly when resource is absent" is not enforced (no `oneOf`/`not`), and there is no `maxItems` (the cartridge side has 16).
- Scenario: a view with both `resource` and `ticks` validates.

## Verdict

APPROVE WITH NOTES. One should-fix (ConditionView description no longer true; one-line amendment); two nits. Pin, regeneration, hashes, registry and the refresh change hold.
