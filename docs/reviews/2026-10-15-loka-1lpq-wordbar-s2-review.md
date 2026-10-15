# Review: word bar S2 (loka-1lpq), GameView spell_words and speech.phrases

- Branch `toolbox/wb-s2`, exact head `4fd81aca22c727b7d97906cdcf8882a2e9f32203`, base `43ee6605` (diff `43ee6605...4fd81aca`). No PR (batch model).
- Governing: brief in `br show loka-1lpq`; [mechanics.md row 29a and speech](../system/mechanics.md), [cartridge.md Spells/Speech](../system/cartridge.md), [realm seams checklist](../decisions/owner-decision-realm-seams-2026-10-13.md#brief-checklist) (seams 1, 5, 6, 8), [contracts lessons](../lessons/contracts.md), [reviewer stance](../../.claude/agents/reviewer.md).
- Verdict: **CHANGES REQUIRED** (finding 1).
- Written 2026-10-15 by anthropic/claude-opus-5-5.

## Must be true (written before the diff)

1. Every spell target has a required `learned` (bool fact ref); missing, unresolved or non-bool is refused by both kernels; floor 1.98.
2. `spell_words` lists exactly the spells whose learned fact is true for the viewing actor; availability and reason come from the same admission that a cast uses.
3. An unlearned cast is refused with the same code and reason as an unknown word; an unlearned word is never projected.
4. `phrases` are speech@1 Words in authored order; both loaders refuse invalid ones; floor 1.98.
5. Every `kernel_api (at least) 1.N` in `protocol/*.schema.json` has a loader_floors case.
6. Cartridges without spells or phrases are unchanged.

Items 1, 2, 4, 5 and 6 hold. Item 3 holds in the code, but no test guards the cast path (finding 1). Elixir has no GameView or cast runtime, so the leak check covers the TS runtime and both compilers.

## Findings

1. **Blocker.** `kernel/ts/src/mechanics/action_recipe/shared.ts:80`. If the `learned` clause is deleted from `spellOf`, the suite stays green (mutant m1). The leak test at `kernel/ts/test/spells.test.ts:237` casts ward, and ward's policy still gates on `fact_compare ward_taught`, so it passes either way. noctis also gates on `noctis_known`. Failure scenario: a spell whose policy does not repeat its learned fact can be cast by a player who never learned it, and no test fails. Fix: apply the PM ruling to drop noctis's `fact_compare`, then assert that casting unlearned noctis gives the same decision as `xyzzy`.
2. **Should-fix.** `shared.ts:80`, seam 1. If `actor` is replaced with `world.character`, the suite stays green (mutant m2). The `char:other` case at `spells.test.ts:251` checks only the view. Failure scenario: in a Realm, a second actor can cast ward when only the first actor learned it. Fix: cast ward as `char:other`.
3. **Nit.** `docs/system/mechanics.md:2584` and `test/loka/content_spell_effects_test.exs:8,10` still say effect steps need 1.55. The 1.55 check and its floor case are gone, because every spell now needs 1.98, so the wording misleads authors.
4. **Nit.** The handback has no check table and no `/code-review medium` result (the brief asks for both).

## PM rulings: not yet met (status only, not findings)

I probed these by compiling a scratch copy with `mix loka.compile` and loading it with TS `loadCartridge`.

- A learned fact with `scopes: ["instance"]` is accepted by both kernels.
- A `per_subject` learned fact is accepted by Elixir and refused by TS (FACT_SCOPE_UNSUPPORTED).
- Phrases without speech@1: neither kernel has a check (the diff adds none).
- `cartridges/spells_sampler/recipes/noctis.json` still has its `fact_compare`.

## Accepted deviations

- lux shows as `insufficient_resource` at start. This is correct, because listing it as available would break view-to-invocation.
- Size allowances: view.ts 308, compiler.ex 351.
- `minItems` 1 on `phrases` and `spell_words`, which are omitted when empty.
- `spell_words` follows recipe key order, which is the canonical decode order.

## Floors

`loader_floors` passes in both kernels at head. 1.55 is no longer in any schema or loader. The 1.51 case was retargeted to `level_compare`, which covers `cartridge_levelling.ts:19` and `levelling.ex:40`. No floor is left uncovered.

## Check table (each mutant reverted; tree clean)

| Mutant | Result |
|---|---|
| m1 `shared.ts:80` drop learned | **survived** |
| m2 `shared.ts:80` `world.character` | **survived** |
| m3 `view/spells.ts:22` drop learned filter | killed (spells.test spell_words) |
| m4 view: drop `refusal` | killed |
| m5 view: drop `admission` | killed |
| m6 `cartridge_recipes.ts:79` drop FACT_TYPE_MISMATCH | killed (loader row) |
| m7 `cartridge_recipes.ts:77` drop `named(learned)` | killed |
| m8 `cartridge_recipes.ts:149` drop `c.speech` | killed (phrases, loader_floors) |
| m9 `spells.ex` drop speech disjunct | killed (content_speech, loader_floors) |
| m10 `spells.ex:39` drop FACT_TYPE_MISMATCH | killed |
| m11 `spells.ex:46` drop `Refs.reference` | killed |
| m12 `checks.ex:52` drop expand clause | killed (3 tests) |
| s1 schema: `learned` not required (contracts regenerated) | killed (both loaders, invalid fixtures) |
| s2 schema: drop `phrases` minItems | killed (both) |

The GameView `spell_words` and `phrases` constraints are pinned by rows in `protocol/fixtures/invalid.json` (23412-23480).
