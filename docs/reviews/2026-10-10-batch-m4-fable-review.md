# Review: mechanics batch M4 (PR #358, epic loka-kgd), Fable batch review

- PR [#358](https://github.com/lorecrafting/lokacore/pull/358), branch `toolbox/batch-m4`, head `bb7a62ec6a4b974bcd6dad1b70909ab1c4d54f79`, diff `origin/main...bb7a62ec` (118 files). Save, protocol and kernel_api contracts change (`VisitedRoom.count`, `visit.record.from`, room/policy/entity/gameview/delta schemas, kernel_api 1.45), so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)); one Fable review per batch head ([review models](../WORKFLOW.md#review-stance)).
- Governing: [toolbox rows 10, 11, 30, 31, W5, W7](../MECHANICS-TOOLBOX.md#ranked-toolbox); mechanics.md [row 11](../system/mechanics.md#hidden-passages-and-search-toolbox-row-11), [row 10](../system/mechanics.md#time-windows-hour-and-moon-gates-toolbox-row-10), [row 30](../system/mechanics.md#rope-and-climb-toolbox-row-30), [W7](../system/mechanics.md#narration-variety-and-visit-tiers-toolbox-row-w7), [row 31](../system/mechanics.md#derived-sky-weather-season-and-tide-toolbox-row-31), [G1 leaf set](../system/mechanics.md#property-tags-and-the-policy-leaf-set-toolbox-row-g1); [composition](../system/architecture.md#building-mechanics-by-composition); per-item records `2026-10-10-toolbox-m4-{hidden,time,rope,variety,sky}-review.md`.
- Hosted CI on the head: ci 38040718559 and 38040682124, book-e2e 38040718542 and 38040682143, graph-diff 38040685255, all success.
- Verdict: **APPROVE WITH NOTES** (two nits, no blocker).

## Must be true (written before the diff)

1. A face that is both hidden and a climb is `not_found` before any fall (no HP change, no narration); hound flight and refuge skip hidden and climb faces; a patrol leg refuses both, an expedition edge refuses hidden only.
2. `sky` takes exactly one of four fields in both kernels; `opens_when` runs after the barrier state checks and only for `open`.
3. The W7 pick (`<command id>:<key>`) and the weather draw (`weather:<world id>:<day>`) are distinct hash domains; neither draws the authority RNG, so world state is equal with and without alternates.
4. Every new field (`hidden_until`, `climb`, `opens_when`, `sky` and the row 31 tables, `alternates`, `visited_count`) floors at kernel_api 1.45 in both kernels, each alone.
5. A `visited_rooms` row without `count` (old save) composes as 1 and its next entry writes `count: 2`; a stale or skipped count is refused by both composers.
6. Chapter 1 compiles byte-identical to `origin/main`.
7. The PM's conflict merges (f9c6177a, 9118e2bf, e9ef509e) kept both sides: `policy.ts` has the `sky` and `visited_count` cases, `invalid.json` has the row 31 and W7 rows, mechanics.md and cartridge.md have all five sections.

## Proof

- Focused tests at the head, `nice -n 10`: TS `hidden_passage`, `hidden_passage_npc`, `climb`, `climb_flee`, `time_windows`, `sky`, `variety`, `knowledge_composition`, `tags`, `calendar`, `barriers`, `d10_knowledge`, `validate` (65 pass); Elixir `content_{climb,hidden_passage,sky,time,variety}_test`, `core/knowledge_composition_test`, `core/contracts_test` (22 pass).
- Item 1: scratch probe (hidden sampler, hall east face given a `climb` with no held item): forged Move `rejected not_found`, no narration, HP unchanged; after `search_panel` the Move lands in the study, narrates `fell`, loses 4 HP. Hound flight and deer refuge over both face kinds, and the player's Flee over a hidden face, are in `hidden_passage_npc.test.ts:40-102`; the Flee fall in `climb_flee.test.ts`. Patrol and expedition refusals are in both kernels' content tests.
- Item 2: `policy.ts:55-58` one `find` over the four fields (schema `exactlyOneRequired`); `barrier/rule.ts:90-94` gate after `from !== need`, `type === 'open'` only. Time windows per-item mutants M1 and M6 cover it.
- Item 3: `variety.test.ts:62-80` pins the pick to a node `crypto` oracle and `encode(state)` equal with and without alternates; the weather oracle (`weather:<id>:<day>`) is in `sky.test.ts`. Prefixes differ and command ids are UUIDs, so no collision between the two domains.
- Item 4: TS `cartridge_knowledge.ts:40` (hidden, climb), `cartridge_calendar.ts:84-90` (sky leaves, row 31 tables, opens_when), `cartridge_variety.ts:28-30` (alternates, visited_count); Elixir `barriers.ex face_floor`, `calendar.ex floor`, `variety.ex floor`. TS `nodes()` walks every schema `VersionedPolicy` site (actions, policies, recipes, variants, quests, reactions, skills, dialogues, barriers `opens_when`), the same set `Calendar.policy_nodes` and `Variety.leaf?` reach.
- Item 5: fixture `later-visit-counts-one-more` has a `from` row without `count`; mutant ME (Elixir composer default 1 to 0) and MD (TS composer default 1 to 0) both fail it. Host rows are JSON values (`mobile/authority/local-story/knowledge-save.ts:8`), so `count` persists without a migration.
- Item 6: `mix loka.compile cartridges/ashmere_chapters` at `origin/main` (cf508651) and at the head: `cmp` identical, sha1 `ee93f779` (PR claim rerun).
- Item 7: `invalid.json` is additions only (578 insertions, 0 deletions) with sky 8, weather 5, season 2, tide 2, climb 2, visited_count 2, hidden_until 1, opens_when 1 rows; `validate.test.ts` and `core/contracts_test.exs` pass on it. `mix xref graph --format cycles` names no Checks/Exits cycle (d7978157 claim rerun).
- Mutants, all red: MA `visited_count` `>=` to `>` (`policy.ts:59`; variety.test); MB weather day without `+ 1` (`calendar.ts:52`; sky.test); MD TS composer `(count ?? 1)` to `(count ?? 0)` (`compose_knowledge.ts:30`; knowledge_composition, variety); MC `hidden_until` dropped from `Exits.field` expansion (`exits.ex:11`; content_hidden_passage_test); ME Elixir composer `Map.get(before, "count", 1)` to 0 (`compose_knowledge.ex:43`; knowledge_composition_test).
- Composition: capability code names the `exposed` tag (`light/shared.ts:28`) and the `hp` pool (`movement/shared.ts:78`) where the spec requires them; no chapter or NPC is named. The duplicated NPC exit filter (`combat/behavior.ts:121-122`, `population/behavior.ts:205-206`) is already filed as `loka-kgd.32`.

## Findings

1. **nit**, `kernel/ts/src/content/cartridge_knowledge.ts:24,47-53`: `climb()` always returns `true` only so the caller can write `hasClimb = climb(...)`; `hasClimb = true` beside the call and a void helper is the same code with one less indirection. No failure scenario.
2. **nit**, PR body: the `/code-review medium` result is "not recorded" for rows 11 and 30 ([reviewer.md](../../.claude/agents/reviewer.md): a missing self-review result is a nit, run in a fix round or recorded in Beads).

## Disposition

No blocker or should-fix; nothing to re-check. Known limits stay open as written in mechanics.md (wandering population members and the crow over hidden or climb faces; weather word wording pending the designer).
