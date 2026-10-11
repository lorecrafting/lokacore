# Review: toolbox row 19a, tool-gated harvest (loka-kgd.84)

- Branch `toolbox/m8-harvest`, head `df06cbcef2cfab56c1ca84588d1750da5f7fa0a7`, diffed against merge-base `0b7ac2a3` with `origin/toolbox/batch-m8` (24 files). No PR (batch model). Contract slice: `room.schema.json` `harvest.tool`, kernel_api 1.52 (the 1.50/1.51 line conflict at merge is expected, keep 1.52).
- Governing: [tool-gated harvest](../system/mechanics.md#tool-gated-harvest-toolbox-row-19), [harvest tool declarations](../system/cartridge.md#harvest-tool-declarations), [B5 Harvest](../system/mechanics.md#s9-infirmary-herbs-b5-selected-contract), [G4 use X on Y](../system/mechanics.md#use-x-on-y-toolbox-row-g4), [composition](../system/architecture.md#building-mechanics-by-composition), Beads `loka-kgd.84` (PM split: 19a gate and depletion; regrowth is `loka-kgd.85`).
- Hosted ci and book-e2e green on the head (`gh run list --commit`, reviewer).
- Verdict: **CHANGES REQUIRED** (one blocker, one should-fix, one nit).

## Must be true

1. The gate refuses ordinary and careful harvest of a gated detail unless a tagged item is held; a floor item does not count; nothing moves on refusal.
2. Rule and GameView offer return the same code (one shared `harvest()`).
3. "Held" agrees with the other held/in-reach rules (G4 tool reach, equipment, containment), or the difference is stated.
4. Depletion is B5 unchanged: lowest EntityId, no RNG, no new state or save row.
5. Both compilers refuse `tool` below 1.52 and without tags@1; the schema refuses `{}` and unknown tags.
6. Cartridges without `tool` keep their bytes (Chapter 1 unchanged).

## Proof

- Focused baseline green in a scratch worktree with its own `_build`: `kernel/ts/test/harvest_tool.test.ts` (4/4), `test/loka/content_harvest_tool_test.exs` (1/1).
- Mutants on `harvest_tool.test.ts` (`containment/harvest.ts`): `reach(..., false)` red; `wearing` short-circuit removed red; refusal code `not_present` red; gate skipped when `method` is set **green** (finding 1).
- Red controls: TS floor 52 to 51 (`cartridge_exchange.ts`) red; Elixir floor `[1, 51]` (`exchanges.ex`) red; Elixir `tools/1` returning `[]` (`room_parts.ex`, tags@1 ownership) red; `required: ["tag"]` removed from `room.schema.json` turns `test/loka/core/contracts_test.exs` red on the new `tool: {}` fixture.
- Chapter 1: `ashmere_missing_child` compiled with head `lib/` and with merge-base `lib/` is byte-identical (cmp, sha1 `6a0ad2a2`).
- Parity: Elixir has no harvest runtime; parity is the compile checks (1.52 floor, tags@1 path `rooms/mine.details.seam.harvest.tool`), both kernels tested at the same paths.
- Claims rerun: `noticeOffer` (`view/action_lists.ts:293`) offers every harvest action on every harvest detail, so a per-action policy cannot gate one seam; `has_tag`'s target reads only items (`mechanics/policy.ts:143`). Both hold; "why not content" stands.
- Save and determinism: the diff touches no save schema, state type or job; `selected()` (`containment/stock.ts`) is unchanged, so depletion stays lowest EntityId with no RNG; `toolHeld` only reads, over a sorted walk. A tagged item in a containment cycle would fault the harvest even with a held tool, unreachable in a valid state (developer accepted).
- `/code-review medium` result and dispositions are in the Beads notes (no PR body: batch model).

## Findings

1. **blocker**, `kernel/ts/src/mechanics/containment/harvest.ts:36`: mutant `const tool = !method && detail.harvest.tool && ...` stays green. Failure: a gated seam with a `careful` method is mined with empty hands via `harvest {method: "careful"}`, against `mechanics.md:2285` ("ordinary or careful"). The sampler has no `careful` and no test sends `method`. Fix: one careful case (refused without the tool, the code the offer shows) on a gated detail.
2. **should-fix** (by code reading), `docs/system/mechanics.md:2285` with `kernel/ts/src/mechanics/action_recipe/shared.ts:34`: harvest "held" is a superset of G4's (`reach` heldOnly refuses a slot holder; harvest adds `wearing`). Failure: a wielded `sharp` knife mines a gated seam, but a G4 use recipe with `tool {tag: sharp}` refuses the same wielded knife `not_present`. Precedent is mixed (D2 Read excludes worn-only; B4 light includes the light slot), so align or state the divergence and its reason in both sections. Same rule: an item in an open container held in a slot counts for neither (`opened` is false on a slot holder), while the same container carried counts.
3. **nit**, `docs/system/mechanics.md:2285`: "listed unavailable with the code step returns" is false in a large world: the GameView shares one `query_steps` budget across offers (`view/action_lists.ts:56`) and each gated offer walks every entity, so the offer can show `budget_exceeded` while `step` (fresh budget) accepts. G4 states this as a known limit; copy that sentence.
