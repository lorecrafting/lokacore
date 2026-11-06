# Review: Editor E6c part one, Rules block (PR #660, loka-wfrgk.5)

- PR: [#660](https://github.com/lorecrafting/lokacore/pull/660), branch `editor/e6c-rules`
- Reviewed commit: `90ff30f6c171bf620df0123f3e1019a16b93bef6`
- Governing: [gui-editor design §4.5, slice G4](../rnd/gui-editor-design-2026-11-04.md), [cartridge.md Rules block](../system/cartridge.md), [mechanic composition](../system/architecture.md#building-mechanics-by-composition), [E6b review](2026-11-05-e6b-npc-item-review.md) (the bar: a block that writes a value the compiler refuses, or cannot express what it accepts, is not a nit; an author-error guard is a nit), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at the reviewed head (`gh run list --commit 90ff30f6...`): ci success, book-e2e success, graph-diff success.
- `/code-review medium`: reported in the PR body (9 findings, rerun 8).
- Out of scope by brief: the Reaction and Action cards (part two, filed); the 12 `Rules.tsx` NO-TESTS rows (panel harness loka-wfrgk.41).

## Verdict: CHANGES REQUIRED (one blocker, two should-fixes)

## Must be true (written before the diff)

1. Every edit goes through `useCard` (`POST /change`, `/undo`); the block holds no logic, which lives in tested `card.ts` functions.
2. A branch switch writes the new tag and keeps only the fields the new branch declares with the same shape.
3. The block offers only values the compiler accepts in that place, and it can express everything the compiler accepts there (§4.5: Trigger filters with definition pickers; Steps over the ops; Policy leaves with ref pickers).
4. The baseline shrinks by exactly the five paths, and each is drawn by the block.
5. Every new `card.ts` branch has a test that fails when it breaks.

## Checks that held

- Real Chrome walk on `toolbox_showcase`, light and dark, each commit with a real Tab:
  - Check (`fish`): luck to threshold kept `key`, dropped `chance`; with difficulty and resource filled it compiled.
  - Trigger (`cellar_rearms`): clock_hour to `rested` with room `larder` compiled. The hold before the room was filled is correct: `source.ReactionRule`'s `else` requires `room` for `rested` without `zone`.
  - Steps: `value` false to true compiled. Policy (`cook_stew`): `at_least` 1 to 2 compiled.
  - Undo restored the trigger ("Preview unchanged").
- All five rows (`actions.check`, `actions.policy`, `reactions.on`, `reactions.when`, `reactions.steps`) are drawn by the block; the baseline diff is exactly those five.
- `rules-block` red control: on its planted violation it prints five "generic but not in the baseline" errors, one per row.
- Cites rerun: `steps.ex:14` is `@ops %{`; `policies.ex:26` is the `owned(...)` line.

## Mutants

`bin/mutate_diff.sh origin/main` at the head: 43 rows, 31 red-narrow, 12 NO-TESTS (`Rules.tsx`), no SURVIVED, no TIMEBOX. It differs from the PR's table (44 rows, 32 run, one survivor at `:287` cleared by hand).

Hand mutants against `card.test.ts` and `ui_schema.test.ts`:
- `branchOf` drops `?? {}`: red, only on "a tagless or unknown value keeps its fields". The developer's dispute holds: that assertion is the sole control and stays.
- `tagOf` order swapped: green, equivalent (no union carries two tag kinds).
- `shape` keeps `description`: green (29 pass). See finding 1.
- `PICK_NAMES` drops `plan`: green. See nit 7.

## Findings

1. **Blocker: `kernel/ts/play/card.ts:304`, the description strip in `shape` has no test.** Removing it leaves both suites green. Real schemas share 19 fields with the same shape but a different description across branches (Check `attribute`; Step `fact`, `item`, `npc`, `quest`, `room`, `plan`, ...; Policy `fact`, `npc`, `with`, `tag`, ...). Without the strip, switching a step from `npc.move` to `item.move` drops `room`, which is the behaviour cartridge.md promises to keep. Fix: one `start` case with two branches that differ only in a field's description.
2. **Should-fix: the Trigger filters have no definition pickers.** At `card.ts:160-165`, `PICK_NAMES` has no `victim`, `attacker`, `target` or `witness`, so `pickKind` returns the field name and the datalist is empty: no valid id can be picked. §4.5 requires "that event's filters with definition pickers". Failure, walked: on `entity_died`, `victim` accepted `nosuch_npc` and wrote it; the compile failed with "Nothing defines the npc `nosuch_npc`" (`cellar_rearms.json:4`). This differs from E6b nit 6 (free-text fallback): §4.5 names definition pickers for exactly these filters; the typo itself is author error. Fix: map the filter names (and `kind`) to their kinds (from `source.ReactionRule`'s refs) with a `pickKind` row each.
3. **Should-fix: Steps offers ops the compiler refuses in a reaction (deviation 1).** The block lists all 35 ops; `steps.ex:14` allows a reaction only part of them. Failure, walked: `damage` (fire, 2) in `cellar_rearms` wrote, then "reactions/cellar_rearms.json:13 `op` is not valid here. Not compiled." It can never compile there, so this meets the bar. Fix: filter the op branches by the path's context in `card.ts`, now or as a Beads issue carried by part two before its Reaction card lands.
4. **Nit, deviation 2: Policy leaves are not limited by capability** (`policies.ex:26`). A leaf whose owning capability is undeclared is refused at the field, and declaring the capability makes it valid. It is an author-error guard, as in E6b finding 4.
5. **Nit (open item), `card.ts:290`:** a kind-less value shows the first branch with its fields. Author-side only; the compiler refuses it.
6. **Nit (open item), `Rules.tsx:39`:** the remembered pick goes stale after Undo. `Rules.tsx:18` (labels per render) is not a finding; `ui_schema.ts:93` (`blocks/` path guard) is acceptable.
7. **Nit, `card.test.ts:566`:** no `plan` to `population` row; the mutant that drops it stays green.
8. **Nit, `Rules.tsx:57`: the `wait` step branch is labeled "option 2"** in the Step picker (no `ui:title`); walked on `cellar_rearms`.
9. **Question, registry rows:** the five `blocks/Rules.tsx` rows do not change drawing: the block is routed by schema shape, so `dialogues.policy`, still in the baseline, is drawn by it too. Should the baseline drop `dialogues.policy`, or the route read the registry?

Walk observation, not from this diff: an incomplete branch shows the first branch's error (".check.chance must have required property 'chance'", ".steps.0.fact ...") and the required star is missing on required DefinitionRef fields.
