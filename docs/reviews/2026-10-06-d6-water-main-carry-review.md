# D6 water depths — published-main carryover review

Exact local merge head `e372ed802f199aae88b10e4a5c9e056abb0ad6d1` (reviewed provisional D6 `a357f641` plus published main `e9db5bdf`). Independent reviewer authored none of the source or merge. **Verdict: CHANGES REQUIRED** for one feature-index regression; no runtime finding in this scoped carryover.

## Requirements derived before the merge diff

The [selected D6 brief](../briefs/chapter-one/d6-water-depths-brief-2026-10-05.md), [mechanics](../system/mechanics.md#d6-water-depths-and-owned-corpse-recovery-selected-pending-implementation), [protocol](../system/protocol.md#d6-water-movement-and-corpse-selection), [save](../system/save.md#d6-water-and-owned-corpse-recovery) and prior [primary](2026-10-06-d6-water-primary-review.md)/[save](2026-10-06-d6-water-save-second-review.md) approvals require the same exact Down/Up admission, one bound deadline and captured Surface, conserved underwater corpse recovery and typed save refusal after D4/C4 joins. The merged capability registry and generated contracts must own both D4 `eat` and D6 `recover_corpse`, while C4 pack and D4 food composition stay live. The feature source and generated matrix must retain the D6 recovery module/contract/fixture alongside published food. D3, successor pins, browser proof, accumulated gate and hosted exact-head CI remain separate later work.

## Finding

**D6-CARRY-R1 — should-fix — `docs/features.json:148`.** The merge restores `recover_corpse` to `protocol/capability_registry.json` and generated `Owned`, but replaces the reviewed provisional containment feature row with the older published row. It drops `CorpseRecoveryView`, `kernel/ts/src/mechanics/containment/recovery.ts` and `protocol/fixtures/water_contracts.json` from containment's contract/module/fixture lists; `docs/features.gen.md:16` repeats the omission. Scenario: a maintainer follows the generated feature matrix for the newly owned recovery command and misses its actual admission owner and fixture. Restore those three source entries and regenerate the matrix. The generator check currently passes because it checks the incomplete source faithfully.

## Scoped proof

- Merge conflict inspection confirms both `food@1` and `water@1`, both `eat` and `recover_corpse`, and water/food/pack composition hooks survive. `git diff --check a357f641 e372ed80` passes.
- Independent focused Node water/food/SQLite run: 31 passed, zero failed. Independent focused Elixir water/food/C4 composition run: 10 passed. Contract and feature generator checks pass. All ten retained carryover evidence hashes verify.
- In a discarded detached checkout, removing only `recover_corpse` ownership and regenerating contracts makes kernel typecheck fail with TS2367 in `mechanics/containment/rule.ts:33`; the unmodified merged source typecheck passes. This demonstrates the registry conflict's direct guard. No mutant source is retained.
- Ponytail Review: lean already. The merge reuses the existing registry, generators and composition hooks; no new abstraction or dependency is warranted. The missing feature entries are a correctness finding, not complexity.

This record approves no final D6 successor pin or publication. D3 reconciliation, independent final release/API/hash/ID derivation, isolated browser Book proof, accumulated active checks, hosted CI and the final exact-head review gate remain pending. The owner save and native/mobile pause were untouched.
