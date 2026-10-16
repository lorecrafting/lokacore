# Review: M14 row FD10 companion remarks, NPC asides, kernel_api 1.107 (loka-kgd.147)

- Branch `toolbox/m14-fd10`, exact head `a5708bfc77daa885fa2877a5e8fbb95145139a9e`, base `dcd56c40` (batch `toolbox/batch-m14`). No PR yet.
- Governing: [mechanics.md FD10](../system/mechanics.md#companion-remarks-npc-asides-toolbox-row-fd10), [FD2 Asides](../system/mechanics.md#passive-skill-voices-toolbox-row-fd2), [W6 Variants](../system/mechanics.md#entity-description-variants-toolbox-row-w6), [cartridge.md voice declarations](../system/cartridge.md#voice-declarations), [Realm seams](../decisions/owner-decision-realm-seams-2026-10-13.md), [WORKFLOW review stance](../WORKFLOW.md). PM ruling: a perceived NPC's remarks stay visible in a dark room; room asides hide.
- Hosted CI at the head: `ci` and `book-e2e` success.
- Written 2026-10-16 by anthropic/claude-opus-5-5. First-pass verdict: approve with notes; final verdict after fix round 1 at the end.

## Must be true (written before the diff)

1. `NpcDefinition.asides`: 1 to 16 `Aside {when, text}`; refused on a spawn template (SCHEMA_VIOLATION) in both kernels.
2. Floor 1.107 in both kernels, first in the floor chain (not shadowed by 1.102 to 1.106 tiers); a loader_floors case.
3. Text keys and `when` references walked and expanded in both kernels, with exact paths.
4. Reader: each living NPC the actor sees in its room; NPC as policy target; the viewing actor as actor; holding asides in authored order; absent when none.
5. Dark room: a listed (perceived) NPC keeps its asides (PM ruling).
6. `EntityView.asides`: array of TextKey, minItems 1, emitted only on room NPC rows; schema admits exactly that.
7. Visit tiers at the exact boundaries 1, 2, 3.
8. Seam 1 (view actor) and seam 5 (per-player visit counts and pair facts).
9. Book: one Note block after the people, before the items; NPC page after the description; not pressable.
10. No state writes, no event, no RNG.

Holds: 1, 2, 3, 4, 6, 7, 9, 10 (tests green; M1 to M4 and M7 red). 8 holds by code: today no second embodied viewer exists, so it cannot be tested yet (question 1). Open: 5 (implemented and documented at `mechanics.md:3698`, untested, finding 1).

## Test the tests (scratch worktree, each reverted)

| Mutant | Result |
| --- | --- |
| M1 `view.ts:174` target `id` not passed | red, `remarks.test.ts` |
| M2 TS floor `'1.107'` to `'1.106'` (`cartridge_variants.ts:30`) | red, `loader_floors.test.ts`, `remarks.test.ts` |
| M3 Elixir `[1, 107]` to `[1, 106]` (`variants.ex:39`) | red, `content_remarks_test.exs` / `loader_floors_test.exs` |
| M4 `lines.tsx:138` room Asides block removed | red, `polish_style.test.ts` |
| M5 `view.ts:174` `actor` replaced by `world.character` | green, but equivalent today: `bodyOf` (`decision.ts:185-186`) gives no body to any other actor, so no other viewer lists an NPC |
| M6 `rule.ts:71` `of.dark_description &&` dropped (every aside hidden in the dark) | **green**: `remarks`, `voices`, `light`, `light_contracts`, `showcase_world`, `deep_fen` |
| M7 `EntityView.asides` `minItems` dropped (`contracts.gen.ts:398`) | red, `validate.test.ts` (`entity_view_asides_empty`) |

Handback claims rerun: kernel_api 1.107 confirmed (`world.ts:108`); no sibling collision (35e at 1.105, batch at 1.106). "20 mutants red": the four brief mutants rerun (M1 to M4) are red; M5 and M6 were not in the list.

## Findings

1. should-fix, `kernel/ts/src/mechanics/description_variant/rule.ts:71`: the PM's dark-room ruling is untested (M6 green). The brief's "no case: no dark room" exemption assumed the guard hides NPC remarks. The ruling reversed that. Scenario: someone hides every aside in the dark to "match" FD2. A perceived companion in a dark crypt then goes silent, and no test fails. Fix: one dark case with a `perception`-discovered NPC.
2. nit, `docs/system/mechanics.md:2203`: the W6 **Variants** clause the brief asks for ("an NPC's `asides` read it as the target too (FD10)") is missing.
3. nit: no `/code-review` result is reported (no PR body yet). Put it in the PR body.

## Questions

1. Seam 1 (`view.ts:174`): today nothing tests that the asides read uses the viewer's `actor` (M5 is equivalent because only `world.character` has a body). When the Realm's admitted set gives a second character a body, does the PM want a test that views the crypt as that character, in the crypt, not joined: Hal listed with no `asides` and Bram's hum shown?

## Fix round 1 re-check (head `032dd825eb5a159777dadf6428ea7469e32d1be3`)

Scope: fix commit `032dd825e` and merge `25cdd330c` (batch `70aedd284`, row 35). Settled parts not reopened.

1. Finding 1, fixed: `kernel/ts/test/remarks.test.ts` "in a dark crypt the room's aside hides and perceived Bram's remark shows" turns on light, makes the crypt dark and gives Bram a `perception` fact. It expects `place` undefined and Bram's `remark.bram.hum`. M6 rerun (`of.dark_description &&` dropped, `rule.ts:71`): red on this test. New M8 (guard `(of.dark_description || target) && dark(...)`, NPCs hidden in the dark): red on this test.
2. Nit 2, fixed: the W6 Variants bullet (`mechanics.md:2203`) names FD10.
3. Designer text: `book-ui.md:1048` and the `BOOK-UI-COMPONENTS.md` Room page cell match the engine. A dark room has no `place.asides`, and a perceived NPC's asides show.
4. Merge: both sides touched only docs and generated files (`MECHANICS-TOOLBOX.md`, `system/mechanics.md`, `system-graph.gen.json`, `toolbox.gen.json`). There is no shared code in standing or fresh. `mix run bin/contracts.exs --check` exits 0. TS `remarks`, `trial`, `loader_floors`, `voices` and `standing`: 25 pass. Elixir `content_trial`, `content_remarks` and `system_graph`: 18 pass. Not rerun: the 8 floor mutants (1.105 to 1.107).
5. Nit 3 (`/code-review` in the PR body) stays open until the PR exists.
6. Hosted CI at `032dd825e`: `ci` and `book-e2e` were in progress at writing; the merge gate is their success.

Verdict: **APPROVE**.
