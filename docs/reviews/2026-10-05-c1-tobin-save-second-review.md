# C1 Tobin training — independent save/protocol second opinion

**Verdict: CHANGES REQUIRED.** Reviewed exact local source head
`e8bf456ece3ca07df37b8014082d1a8174cb9186` on
`chapter-one/c1-tobin-training`, against corrected B5 base
`2df52d328adbfdea39a0cde623f6a9f34fffb186`. This reviewer authored none of
that source. Primary mechanics/Book review remains separate.

## Requirements derived before the diff

The [adopted brief](../briefs/chapter-one/chapter-one-c1-tobin-training-brief-2026-10-05.md),
[save contract](../system/save.md#c1-learned-skill-and-lesson-recovery),
[composition contract](../system/protocol.md#c1-training-and-defense-composition),
[mechanics](../system/mechanics.md#c1-training-and-armed-defense-selected-contract)
and [contract lessons](../lessons/contracts.md) require:

- Exactly one command/continuation/dialogue/role-bound grant per true acquired fact;
  all linked grant and gift events retain their world, scope and root correlation.
- Historical lesson/shop/S2 transfers reconcile at their own revisions; later
  equip, drop, storage and death custody remain lawful.
- COMMIT uncertainty fences input and elapsed work until complete prior/next rows
  are confirmed. Reopen/retry never grants, charges or draws twice.
- Defense prevention implies `hit:false/loss:0`; reserved facts reject ordinary
  writers, including scene endings. New schema guards have independent red fixtures.
- Current source hash and initial IDs match independent answers; unavailable pins
  refuse without rewriting the save.

## Findings

**C1-S1 — blocker — `mobile/authority/local-story/dialogue-receipt.ts:122`
and `:253`.** After a lawful paid swords Choose, alter only the retained
`choice_resolved` or `item_acquired` event's `world_context_id`, player `scope`, or
`correlation_id` to a different valid identity. All six file-backed probes reopen
as `open`, preserving the acquired fact, payment and sword despite contradictory
linked evidence. These checks bind actor/payload but omit those event fields.
Expected: typed `save_corrupt`. Corresponding `fact_changed` mutations and a
missing grant correctly refuse. Open preserved file bytes in every probe.

**C1-S2 — blocker — `protocol/gameview.schema.json:1834`, `:1866`,
`protocol/cartridge.schema.json:1401`, `protocol/entity.schema.json:473`.**
`SkillView`, `AttributeView`, `SkillDefinition` and `WeaponProfile` have no
examples. The actual shared TypeScript contract suite fails with
`AttributeView has no examples`; its Elixir counterpart fails the same required
examples check with `MatchError` on `nil`. Add independent examples and regenerate;
focused training tests do not satisfy the shared fixture contract.

**C1-S3 — blocker — `protocol/cartridge.schema.json:1315` and `:1321`;
`kernel/ts/test/training_contracts.test.ts:20`.** Removing any one of dodge's
required `skill`, required `chance`, minimum `0` or maximum `100` leaves the training
contract/loader and shared invalid-fixture tests green. For example, removing
maximum `100` admits chance `101` without a regression failure. A 25-case in-memory
schema sweep killed 21 mutants and retained these four. Add independent missing-field
and -1/101 vectors with observed red controls under both validators, as required by
the contract lessons. The current guards themselves correctly reject all four inputs.

## Verification

- `mise exec -- node --test` on authority `training`, `faults`, `combat`,
  `commerce`, `saves`, `recovery`: **67 passed**, exit0.
- `mise exec -- mix test` on `content_training`, `content_missing_child`,
  `core/contracts/schema`, with `--force`: **74 passed**, exit0.
- Restored kernel/authority training suites: **13 passed**. Authority training
  against newly compiled actual source: **6 passed**.
- Shared `kernel/ts/test/validate.test.ts`: **9/10 passed**, exit1.
  Elixir `core/contracts_test` plus `core/combat_contracts_test`, `--force`:
  **9/10 passed**, exit2. Both failures are C1-S2.
- `mise exec -- elixir bin/contracts.exs --check`: exit0. Independently calculated
  canonical SHA-256 matches compiled source and v020 fixture:
  `78ade4fab1341f1781262ce6327ca8a77ea4e4c0a01fa5279abe7ba874735d3e`.
  All **92** independently SHA-derived initial IDs match actual hydrated runtime IDs.
- Separate literal oracle: **24 schema vectors pass in each kernel**, including
  every new named contract's required fields and dodge 0/100/-1/101/missing fields.
- File-backed lesson and defended-round controls each pass real failed COMMIT,
  unknown-not-committed and unknown-committed: full head/state/receipt snapshots
  remain prior-or-next; input and elapsed stay pending while fenced; reopen and
  exact replay preserve the complete committed state. Missing-pin refusal preserves
  file bytes. Existing tests also cover trained death and exact corpse-held recovery.
- In-memory mutations removing grant-command binding, defense conjunction, and
  scene-ending reserved-write checks each fail their named existing test; normal
  restored tests pass. No checked-out production source was edited.

Ponytail Review: **Lean already. Ship.** No complexity finding or deletion proposed.
Full accumulated-head publication, hosted CI, browser and native proof were not run
by this second opinion. C1-S1/S2/S3 remain open.
