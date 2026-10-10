# Review: standing and disposition, toolbox rows 15 and G11 (loka-kgd.54)

- Branch `toolbox/m6-standing`, head `df351925377e095f2015c68874c70f7a3e873c10`, diff `origin/toolbox/batch-m6...df351925` (51 files); no PR yet (batch M6). Kernel contract change (reaction step `fact.adjust`, `NpcDefinition.disposition`, `buy_discount.friendly`, schema `exactlyOneRequired`, diagnostic code `HOSTILE_QUEST_SPEAKER`), so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [toolbox rows 15 and G11, slice process, traps 7, 8 and 12](../MECHANICS-TOOLBOX.md#toolbox-slice-process), [W2 subjects](../system/mechanics.md#entity-and-pair-facts-toolbox-row-w2), [reaction@1](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts), [C4](../system/mechanics.md#c4-hound-response-pack-assistance-and-flight-selected-contract) and its [PM decision](../decisions/pm-decision-c4-hound-behavior-2026-10-05.md), brief and PM rulings in Beads `loka-kgd.54`.
- Hosted CI on the head: ci success (38075598717); book-e2e failure (38075598781: `e2e` cancelled at its 15-minute timeout, `storybook` success).
- Verdict: **CHANGES REQUIRED** (book-e2e red on the head; four surviving mutants on G11's guards).

## Must be true

1. A reaction `fact.adjust` clamps to the fact's bounds, lowers to a `fact.assign` with `expected` and `value` in the delivery's writer group (replay re-decides the same op), and writes at W2's subject: the named `npc`/`item`, else the event subject (an `item_acquired` holder); the player's body is never a subject.
2. Disposition is derived when read from facts (a W2 pair fact plus a faction instance fact), never stored; hostile wins over friendly; undeclared is wary, today's behavior.
3. Hostile refuses talk and trade and makes a guard attack; friendly gives the discount; the price on the shelf and the buy check agree.
4. Opt-in, `kernel_api` 1.47 in both kernels; Chapter 1 and corpus bytes unchanged; every new field has compiler and loader checks.
5. Trap 8: gates stay on quest facts (PM ruling: HOSTILE_QUEST_SPEAKER warning, not a refusal). Trap 12: the engage cue is a text line.
6. C4's "no hostile room entry" and "required journeys free of unsolicited combat" still hold.

## Proof

- Baseline (trial merge, below): TS `standing`, `reactions`, `reactions_sampler`, `scoped_facts`, `commerce`, `commerce_contracts`, `practical_skills_contracts`, `practical_skills`, `dialogue`, `facts`, `combat`, `combat_actions` pass; Elixir `content_standing`, `content_practical_skills`, `content_reactions_sampler`, `content_scoped_facts`, `core/contracts` pass (15).
- Schema red control: deleting `exactlyOneRequired` from `buy_discount` (`protocol/entity.schema.json`, gens regenerated) fails TS `standing.test.ts` row 5 (the skill+friendly NPC loads) and `practical_skills_contracts.test.ts`, and Elixir `content_standing_test.exs`. Both validators enforce the keyword (`kernel/ts/src/foundation/validate.ts:124`, `lib/loka/core/contracts.ex:113`); their `requiredUnless` skip (`validate.ts:62`, `contracts.ex:89`) does not apply, as `buy_discount` has none. Removing the loaders' skill exclusion is safe.
- Developer's red controls rerun, both killed: `standing.ex` without `receive` in the matched keys; keyed on `friendly`.
- Read, not run: dropping the hostile check from `exchange` or `spokenBy` fails `standing.test.ts`'s third case, which asserts both refusals.
- Replay: `reaction.ts` `assignment` emits `fact.assign {expected, value}` in the rule's `group`; `mobile/authority/local-story/facts-save.ts` is structural (no value witness), so a gift save reopens; a discount shop triggers full `receiptHistory` (`exchange-save.ts:20`).
- Documented limits match the code: `hostileAt` reads the pre-move world (`disposition.ts:83`); only `movement/rule.ts` and `combat/flee.ts` call `moveSequence` (transport arrivals do not engage); `choose` never calls `spokenBy` (an open conversation runs on); `running(world, actor)` stops a fight during a scene.
- Developer item 3 (engage loads without combat) is moot: `kernel/ts/src/content/cartridge_combat.ts:31` refuses an NPC `attack` without `world.combat`, and `engage` requires `attack`.
- C4 confirmed: [the decision](../decisions/pm-decision-c4-hound-behavior-2026-10-05.md) line 17 ("C4 does not ... add hostile room entry") scopes what C4 adds; line 18 (required journeys free of unsolicited combat) holds because G11 is opt-in and Chapter 1 declares no disposition; row G11 itself requires "low standing makes a guard attack".
- HOSTILE_QUEST_SPEAKER on `disposition.hostile` only: accepted; only `spokenBy`'s hostile branch refuses, a friendly-only NPC never does.
- Chapter 1 and corpus: all 49 cartridges other than the sampler compile byte-identical at batch `fc610ef0` and on the trial merge.
- Trial merge onto `origin/toolbox/batch-m6` `23276c6e` (moved during review; contains `fc610ef0`): conflicts in `docs/system/mechanics.md` and `docs/system/cartridge.md` (adjacent new W3 sections: keep both, blank line before `## Rumour`) and the gens (`contracts.gen.ts`, `system-graph.gen.json`, `toolbox.gen.json`: regenerate); then `bin/contracts.exs --check` and `tsc` exit 0. No `size: allow` raised. Fixtures: `invalid.json` additions only.

## Findings

1. **blocker**, book-e2e red, at `mobile/app/tests/steps.ts:36` (`begin` taps "Fey-touched"): on this head the web Book never shows the character choice; book, c4_pack, character_choice, crows and deer each wait 60 s for the button, then the job hits its timeout (run 38075598781). The previous head `1f54a18e` fails the same way, so it is not a flake ([Git hygiene](../WORKFLOW.md#git-hygiene)). Green on base `73abdead`, batch `fc610ef0` and `23276c6e`, and siblings `m6-rumour`, `m6-recap`, `m6-persuade`; the branch touches nothing under `mobile/`, `kernel/ts/src/view/` or `kernel/ts/src/runtime/`. Ruled out in Node CJS only: a babel CommonJS require harness loads every kernel module first, then the index, `missing_child_v042_hash.json` and `gameView`, all without error. Unconfirmed lead: the branch adds the import cycle `disposition.ts` → `scene/shared.ts` → `dialogue/shared.ts` → `dialogue/selection.ts` → `disposition.ts` (the mechanics cycle grows from 13 to 19 modules) and `cartridge_refs.ts` ↔ `cartridge_standing.ts`; Metro's import order may differ. Fix: reproduce in the [web preview](../web-preview.md) and read the browser console (the runner hides Metro and console output; the cancelled job uploaded nothing).
2. **blocker**, G11 guards with no test (narrow mutants green on `standing`, `combat`, `combat_flee`, `commerce`, `dialogue`, 43 tests; Elixir `content_standing_test.exs`):
   - `kernel/ts/src/mechanics/disposition.ts:30` friendly read before hostile. Failure: an NPC whose friendly (trust 1) and hostile (standing -2) both hold sells at the discount and talks instead of refusing (mechanics.md G11 "hostile while hostile holds, else friendly").
   - `kernel/ts/src/mechanics/movement/sequence.ts:61` `true` for `outcome === 'moved'`. Failure: fleeing into a hostile guard's room opens a new encounter (Limits: "a flight into its room engages no one").
   - `disposition.ts:84` sanctuary guard removed. Failure: a hostile NPC in a sanctuary engages on walk-in ("never in a sanctuary").
   - `kernel/ts/src/content/cartridge_standing.ts:31` and `lib/loka/content/standing.ex:39` spawn-template refusal removed. Failure: a pack hound template with hostile and engage loads; walk-in opens an encounter without `active_ids`, which `combat/saved.ts:39` `encountersValid` rejects, so reopen is `save_corrupt`.
   Fix: one TS case per rule on test-local sampler changes, and one loader row and one compiler row for a spawn template.
3. **nit**, `protocol/cartridge.schema.json:1161`: HOSTILE_QUEST_SPEAKER cites "mechanics.md NPC disposition"; the section is "Standing and disposition". A reader following it finds no section.
4. **nit**, `kernel/ts/test/e1_obligations.ts:421`: a reaction `fact.adjust` witness accepts any value. No Chapter 1 reaction adjusts today; a future one with a wrong clamp would pass the E1 witness.
5. **nit**, process: the developer's `/code-review medium` ran on the main checkout, not this tree; run it on `origin/toolbox/batch-m6...HEAD` in the fix round and report it.

Accepted, no finding: disposition read up to three times per shop offer (`commerce/shared.ts`, cheap, same result); the floor parse repeated per toolbox module (existing pattern).
