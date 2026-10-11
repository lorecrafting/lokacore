# Review: toolbox row G4, use X on Y (loka-kgd.76)

- Branch `toolbox/m8-useon`, head `7f0b1c6a77be21d01519ce2503f28923c5e1444c`, diffed against merge-base `52790db9` with `origin/toolbox/batch-m8` (49 files). No PR (batch model). Contract slice: `RecipeTarget` oneOf, `UseTool`, `status.cure`, `perform.item_id`, kernel_api 1.49.
- Governing: [Use X on Y](../system/mechanics.md#use-x-on-y-toolbox-row-g4), [use declarations](../system/cartridge.md#use-declarations), [composition](../system/architecture.md#building-mechanics-by-composition), [protocol step 4](../system/protocol.md), toolbox rows G4 and W22, Beads `loka-kgd.76`.
- Hosted ci and book-e2e green on the head (`gh run list --commit`, reviewer).
- Verdict: **CHANGES REQUIRED** (one blocker, two should-fix, three nits).

## Must be true

1. One authored recipe covers every (tool, target) pair by properties; no item id in content or capability code (G4 "nobody authored the pair").
2. Rule, step admission and GameView refuse the same pairs with the same code; a pair the view lists is accepted, a cooldown pair carries the code step returns.
3. Tool held, target in reach, ids distinct; a detail recipe refuses an `item_id` (`mechanics.md:2237`).
4. `status.cure` ends only the named status, on the target, at most once; no RNG or new save row; cartridges below 1.49 keep their bytes.
5. Both kernels refuse: use target below 1.49, cure off a use recipe, rating-opposed check on a use recipe, unknown liquid or status.
6. The GameView pair walk is bounded by `query_steps`.
7. W22 (water cures burning) needs no engine code.

## Proof

- Focused baseline green (`use.test.ts`, `validate.test.ts`, `tags.test.ts`; `content_use_test.exs`, `contracts_test.exs`). A scratch merge with `origin/toolbox/batch-m8` (writer groups, traps) passes `use`, `writer_groups`, `traps_sampler` and `targets` tests; only the two `*.gen.json` files conflict (regenerate).
- Chapter bytes: `ashmere_sampler` and `ashmere_chapters` compile byte-identical with the base and head `lib/` (cmp).
- Parity, run: unknown `tool.liquid` ("milk") and cure status ("smoke") give UNRESOLVED_REFERENCE in both kernels at the same paths. The opposed-with-`npc` clause precedes `rated?` in Elixir (`recipes.ex:122`), as in TS.
- Mutants on `use.test.ts`: swapped `target_ids` (red, 4), tool `reach` without the held flag (red), `done` forced false (red: double cure faults), `tool === target` guard dropped (red). Reviewer red control: `invariants_view.ts` comparing `target_ids[0]` to `item_id` fails the gameview_agrees test.
- Survivors: target `reach` dropped (`shared.ts:35`) is equivalent through step: `accepts` already confines `target_id` to room floor or inventory (`action_input.ts:73`). See findings 1 and 4 for the others.
- Claim cites: `shared.ts:23` (`useRefused`) and `view/use.ts:13` (`useActions`) resolve.

## Findings

1. **blocker**, `kernel/ts/src/mechanics/action_recipe/rule.ts:117`: mutant "drop `p.item_id !== undefined ||`" stays green on `use`, `recipes`, `target_present` and `checks` tests. Failure: a forged `perform {action: <detail recipe>, item_id: <any visible item>}` passes step (`item_id` is no `accepts` input, `hiddenTarget` checks only visibility) and is accepted with a stray tool id in the receipt, against `mechanics.md:2237`. Confirmed with a throwaway test (the ferry probe's `coil_rope` with `item_id` the lantern): `invalid_target` on the head, `accepted` under the mutant. Not committed. Fix: one assertion (`invalid_target`) on a detail recipe performed with an `item_id`.
2. **should-fix**, `protocol/fixtures/invalid.json:10419`: replacing old entry `{}` (expected `/detail`, `/kind`, `/room` missing) with `/kind` only drops all coverage of the detail variant's `required`. Red control: removing `"room"` from the detail branch's `required` keeps `contracts_test.exs` green. Fix: add `{"kind":"detail"}` with `/detail` and `/room` `missing_property`.
3. **should-fix**, `kernel/ts/src/content/cartridge_recipes.ts:71` and `lib/loka/content/recipes.ex` use clause of `target/4`: the brief's "both kernels enforce liquid ref" has no test. Deleting the TS line keeps `use`/`recipes` tests green. Failure: a misspelt liquid compiles into a recipe that never fits any tool. Fix: one unknown-liquid row in each kernel's loader test.
4. **nit**, `docs/system/mechanics.md:2237`: "the target in reach (`reach`)" overstates it. A burning item in an open crate on the floor is refused `unsupported_capability` by `accepts` (`action_input.ts:73`) and never offered. Say "on the floor or carried", or widen the target scope.
5. **nit**: "the use consumes no liquid (a pour from the vessel is a later step)" (`mechanics.md:2238`) has no Beads id. It is acceptable for W22: none of W22's checks needs consumption. PM to file it.
6. **nit**: no PR body or handoff reports the developer's `/code-review` result. Commit `019a0176` cites a non-existent `action_recipe/use.ts`.

## Questions

- W22 says "fire opens a wooden door … water puts it out". Barriers have no EntityId (known limit), so G4 cannot quench a burning door, only items. Confirm that W22's fire lives on items.
- GameView cost is that of Put: one whole-world walk for each fitting (tool, recipe) pair, plus about 5 to 10 steps for each item's refusal, all from one shared `query_steps` (32768). The showcase has 24 items. When it runs out, the later offers in the same `lists` call degrade. This is acceptable now and a known limit for a large Realm.
