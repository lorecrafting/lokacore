# Review: batch C2 final head (loka-ivjq.3 F3 F5 F6, .7 .8 .11 .12)

- PR #493, branch `simplify/c2-kinds`, reviewed head `cdb07869934a0c3b4509bdffefdcb8dde99db124` against `main` (merge base `d42f47774`; 2,202 files, +14,283/−19,171).
- Governing: `br show loka-ivjq.3` (F3 drop `{policy_version, root}`; policy optional, absent = always), `.5` (delete single-use kinds policies/, population_bundles/, story_points/), `.6` (one `name` field), the C2 plan notes, AGENTS.md, [WORKFLOW review stance](../WORKFLOW.md), [two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md), [cartridge](../system/cartridge.md), [BUILDERS-GUIDE](../BUILDERS-GUIDE.md).
- Reviewer: anthropic/claude-fable-5-1, independent, authored none of the work; the slice records (a, b1, b2, c1, d, e, f, z) were read after the must-be-true list.
- CI on the head (`gh run list --commit cdb07869…`): graph-diff success (40923896830), ci success (40923881961), book-e2e success (40923882260).
- Verdict: **APPROVE WITH NOTES** (no code change made; follow-ups below for the PM).

## Must be true (written before reading the diff)

1. No `policy_version`/`root` wrapper survives in a schema, a compiler, a kernel or a cartridge.
2. An absent gate holds and an absent trigger never fires, in both kernels, at every `holds` site; the `&&`/`||` guard shapes are unchanged from main.
3. The source kinds `policies`, `population_bundles`, `story_points` exist nowhere: compiler kind list, `schemas/source`, loader, cartridge dirs, live docs, Book.
4. The compiled `story_points` map still reaches the kernel (derived, not authored).
5. Save, GameView, delta, event and command schemas are unchanged; live saves and transcripts differ from main only by hashes and the planned bundle/role/population changes.
6. D's `name` rename is complete: no `label|title|short` definition key left in any cartridge; both kernels read `name`.
7. No test file now asserts nothing; no frozen fixture was hand-edited (regen on the head is a no-op).
8. Nothing orphaned: no export in a changed file lost its last importer; no `size: allow` raised without a reason.

## Evidence

1. `protocol/policy.schema.json` at main had `VersionedPolicy`; at head only `Policy`. `rg -n 'policy_version|VersionedPolicy' protocol lib kernel/ts/src cartridges schemas` is empty. Holds.
2. TS: `kernel/ts/src/mechanics/policy.ts:48` `if (!p) return true;`. Gates pass the optional policy straight in (`dialogue/shared.ts:94`, `quests`, `action_recipe`, `skills`), `when` sites likewise (`view/quest_journal.ts:55`, `schedule/daily.ts:46`, `description_variant/rule.ts:53`, `senses.ts:115`, `speech/shared.ts:73`, `population/settle.ts:55-56` `!when ||`); triggers stay guarded (`reaction.ts:152` `rule.when &&`, `barrier/rule.ts:99` `def.opens_when &&`, disposition `hostile`/`friendly`, `prerequisite`). The diff vs main at each site is only `.root` dropped and `.short`→`.name`. Elixir has no evaluator; `lib/loka/content/policies.ex:9` walks nodes and `nodes(nil, _) -> []`; lint `lib/loka/content/lint.ex:91` flags an authored always-true `policy|when|qualification` (`content_lint_test.exs:205-237`). Docs agree: `docs/BUILDERS-GUIDE.md:29`, `docs/system/cartridge.md:201`. 12+ sites sampled. Holds.
3. `schemas/source/` has 28 files, none for the three kinds; the compiler `@dirs` lists 20 kinds; `find cartridges -type d -name 'policies|population_bundles|story_points'` is empty; `mobile/` diff touches no Book component (only `authority/local-story/*`, `practical-host.ts`, `elapsed.ts`, live sql). Live-doc mentions remain only in dated records (`docs/evidence/2026-10-06-…:79`, `docs/rnd/built-rooms-2026-10-11.md:39`) and the plan line in `docs/HANDOFF.md:25`. Holds.
4. `protocol/cartridge.schema.json:207` keeps compiled `story_points`, derived by `lib/loka/content/dialogues.ex` `points/2` from choice `story_point` and scene `on_end`; `claim/2` (`:164-170`) refuses two sites claiming one outcome. Holds.
5. `protocol/{gameview,delta,event,command,identity}.schema.json` are byte-identical to main; the 14 changed protocol schemas are action, capability_registry, cartridge, dialogue, entity, liquid, policy, quest, reaction, relation, room, scene, service, transport. `mobile/app/stories/live/*.sql` vs main: 64-hex hashes, spawned origin `bundle` dropped, roles hunter/prey/loot, quest `hound_population`→`population` (exactly the c2-c1 record line 16 list). 53 transcripts differ only by hashes. Holds.
6. A JSON walk over every `cartridges/*/*/*.json` definition for top-level `label|title|short`: 0 hits. Holds.
7. Only `test/loka/content_deer_test.exs` loses asserts (−3 +1): the removed ones targeted the deleted `population_bundles/willow_deer.json loot_role`; the survivor asserts the plan's `npc`/`corpse` refs. `bin/regen.sh` on the head exits 0 with a clean tree. Holds.
8. Exports without importers in changed TS files (`UseTarget`, `Disposition`, `TERRAIN`, `firstClock`, `statusHolder`) are equally orphaned at main. `size: allow` diff over `kernel lib mobile bin`: line shifts only, `water.test.ts` allowance removed, `lib/loka/content/source.ex:1` 311→320 with the reason in the marker. Holds.

Record claims rerun: (a) c2-c1 "both kernels default `member_role` to hunter": `lib/loka/core/compose_population.ex:66` and `kernel/ts/src/foundation/compose_population.ts:70`, same expression. (b) c2-f "two sites one outcome is DUPLICATE_DEFINITION at `claim/2`, pinned by the scenes test": hand mutant M2 below goes red at `content_scenes_test.exs:149`. Both hold.

## Tests of the tests

- `bin/mutate_diff.sh origin/main` (niced, one sweep): NO-TESTS 19, NOT-UNIQUE 12, SURVIVED 130, red-narrow 127. Survivors sit in rename-heavy files (`invariants_creation.ex` 20, `creation.ex` 18, `population.ex` 14, `schedule/daily.ts` 12, `compose_encounter.ex` 11) where the mutated line is a renamed key read with the same shape as main. The one survivor on a policy site is `dialogue/shared.ts:94` (drop the `if`), already recorded as the c2-b2 follow-up. `barrier/rule.ts:99` both mutants survive: no kernel test opens a barrier with `opens_when` (pre-existing at main).
- Hand mutants in a detached worktree at the head, each reverted:
  - M1 `policy.ts:48` `return true`→`return false`: `test/quests.test.ts` 2 pass / 11 fail. Red.
  - M2 `dialogues.ex:167` skip the duplicate-outcome check: `content_scenes_test.exs` 6/7, fails at `:149`. Red.
  - M3 `lint.ex:91` drop `when` from the always walker: `content_lint_test.exs` 18/19. Red.

## Findings

1. **Should-fix (not applied; logic test, exceeds the in-place rule).** `kernel/ts/src/mechanics/dialogue/shared.ts:94`: deleting the `holds` refusal survives the whole kernel suite. Scenario: a dialogue whose `policy` fails (wrong room, missing item) still runs the exchange; the showcase hash cannot catch it because no transcript exercises a refused dialogue. Already filed as the c2-b2 follow-up; close it with one `dialogue.test.ts` case that plants a failing policy and expects `invalid_state`.
2. **Should-fix (pre-existing, not C2).** `kernel/ts/src/mechanics/barrier/rule.ts:99`: both `opens_when` mutants (drop the guard, invert `!holds`) survive. Scenario: a barrier with `opens_when` opens for an actor whose policy fails. File with 1 or fold into loka-kl1u.
3. **Nit.** PR #493 body reports no `/code-review` result (AGENTS.md Simplicity); note it on the PR at merge.
4. **Nit.** `bin/mutate_diff.sh` on a rename batch reports 130 SURVIVED where the mutated line is a renamed key read; the output is noise for this kind of slice. Covered by the C1 final follow-up (two-hop import option).
5. **Question.** `cartridges/items_sampler/transcripts/containment.jsonl` `ids.content_hash` does not equal `protocol/fixtures/cartridge_items_hash.json` `sha256`, at head and at main; the other 14 pinned cartridges match. Either the fixture value is not the live cartridge or the transcript is from another build; loka-tb31 may already cover it.

## Follow-ups for the PM

- Finding 1: one `dialogue.test.ts` refused-policy case (c2-b2 follow-up, now evidenced by mutate_diff).
- Finding 2: `barrier/rule.ts:99` `opens_when` kernel test (pre-existing gap).
- Finding 5: items_sampler transcript hash vs fixture; check against loka-tb31.
- c2-d open note: `short_variants` stem name after the `short`→`name` rename.
- loka-zeyz: the 31 behaviour rows stay as recorded.
