# Review: per-item equip words, engine (loka-x6t.20 6a, PR #447 row 4a, kernel_api 1.116)

- Branch `toolbox/batch-polish-engine-1`, range `570ef0e88..649476992eb9fc5c846b0b273514bb7d0c37aa87` (6 commits, row 4a), plus the row 3 fixes `f85076268`, `4ac289d0e`, `570ef0e88`.
- Governing: Beads `loka-x6t.20` brief "6a Engine" (kernel_api reassigned to 1.116), [equipment@1](../system/mechanics.md#equipment1-kerneltssrcmechanicsequipmentrulets), [Item affect declarations](../system/cartridge.md#item-affect-declarations), [Review stance](../WORKFLOW.md#review-stance).
- Reviewer: anthropic/claude-opus-5-5, independent, authored none of the work.
- Verdict: **APPROVE WITH NOTES** (one nit).

## Must be true (written before reading the diff)

1. `ItemDefinition.equip` is `{wear, remove, worn, removed}`, all four TextKeys required when present; no other entity kind admits it.
2. Both loaders refuse `equip` below kernel_api 1.116 (KERNEL_API_RANGE_INVALID), without `slot`, and with a key outside the text catalog; a `loader_floors.json` case is red in both kernels.
3. The engine Wear card (inventory) and Remove card (worn) read `equip.wear` / `equip.remove`, else `action.<verb>`; a cartridge action keeps its own label.
4. An accepted wear or remove narrates `[{key: equip.worn|removed}]` when present, else no narration. No new op, event or save impact.
5. No cartridge, hash or frozen fixture changes; docs in mechanics.md equipment@1 and cartridge.md.

All five hold.

## Findings

1. **Nit**, `kernel/ts/src/view/action_lists.ts:270`. `649476992` dropped the `equip(a)` guard, so `worded` now runs for every engine verb with any `id`, and the `as ItemDefinition` cast hides a missing entity. Failure: an engine verb listed in the notice scope on a detail (`id` not in `world.entities`) without a harvest patch would throw a TypeError while the GameView is built. This cannot happen today: an engine `harvest` on a detail always takes `patch.label` (`:196`), and `expedition` is not an engine verb (`commands/actions.ts:97`). Fix if touched again: `world.entities[id]?.`.

Disputed self-review items, judged:
- `action_lists.ts:270` has no item kind check. **Accepted.** `equip` exists only on `ItemDefinition` (`contracts.gen.ts:141`; no other contract declares it), so an NPC reads `undefined` and gets `a.label`.
- `rule.ts:39` does not guard `equip[outcome]`. **Accepted.** `entity.schema.json:200` requires all four keys, and the loader validates the schema before the rule runs.

Row 3 fixes ([record](2026-10-22-x6t-30-skipped-turn-review.md)): finding 1 is **closed**. `4ac289d0e` is a pure move: the removed and added lines differ only in the header comment and in three imports. `shared.ts:4` is back to `allow 323` (307 lines), and the lint allowlist adds `../status/bars.ts`. Finding 2 is **closed**. `570ef0e88` adds the fleeing-goblin case (`fear.test.ts`) and the skipped key outside the catalog (`status_readers.test.ts`).

## Checks run

- Focused tests pass on head: TS `equipment`, `loader_floors`, `status_readers`; Elixir `content_derived_test`, `loader_floors_test` (9/9). Hosted `ci` 39904707807 passes on 649476992; book-e2e was still running.
- My own mutants all fail and the tree was clean afterwards: worn and removed swapped (`rule.ts`); the Remove label read as `equip.wear` (`action_lists.ts`); the `a.engine` guard set to `true`; TS floor `'1.116'` changed to `'1.72'` (fails `loader_floors` and `equipment`); Elixir `equip_texts` without `worn` (fails `content_derived_test:162`).
- PR claims rerun: "view engine guard -> same test" and "Elixir catalog -> same test" both hold.
- Fixtures: only `loader_floors.json` changes, with one case added at the end; no file under `cartridges/` and no hash fixture changes.
- The PR body reports `/code-review medium`.
