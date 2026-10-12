# Review: balance tool 6b, gear_budget and intended_level, over-budget list (loka-kgd.107.17)

- Branch `toolbox/m10-gear-budget`, head `52d58cc62a2de71188ad3af0a6c35964e592455c` (spec `8a9984fe`, code `52d58cc6`), diffed against `eb848f076f57f971d6cf304ce0cfaf763072d1d2` (`toolbox/batch-m10` at branch time). No PR (batch model).
- Governing: [Item affect declarations](../system/cartridge.md#item-affect-declarations) and [Content reports](../system/cartridge.md#content-reports) (both amended in `8a9984fe`), [study](../rnd/balance-diagnostics-2026-10-11.md) §1 I2, §12 L5; brief and PM defaults in Beads `loka-kgd.107.17` Notes.
- Hosted ci and book-e2e were in progress on the head at review time (PM watches).
- Verdict: **APPROVE WITH NOTES** (no blocker, no should-fix; one nit, one question).
- Written 2026-10-12 08:24 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer).

## Must be true

1. Schema: `world.gear_budget {per_slot, per_level}` closed, both required, SlotKey keys, integers 0..2147483647; `ItemDefinition.intended_level` optional integer 1..2147483647; a fixture per required entry and bound.
2. Compiler and loader twins refuse the same three things at the same paths: gear_budget without attributes@1, intended_level without affects, either field under 1.72.
3. The runtime never reads either field (scope trigger); both stay in the compiled artifact; numbers live in the cartridge.
4. Report: `budget` only with gear_budget (otherwise `{levels, items}` unchanged); signed `affect_total` from `itemSheet`; `allowed = per_slot + per_level × (L − 1)`, saturated; over when `>`; missing slot unbudgeted, never 0; sheet order; items without affects in neither list.
5. Expected values hand-derived, not computed by the code under test.

## Proof

- Runtime reads: `gear_budget|intended_level` appears only in `play/power.ts`, `content/cartridge_derived.ts`, `lib/loka/content/derived.ex`, the schemas, `contracts.gen.ts` and tests. kernel_api 1.72 in `runtime/world.ts:107`; no Elixir-side version constant exists.
- Twins: `cartridge_derived.ts:28-29,53-65` and `derived.ex:57,78-87` match code and path; the Elixir SCHEMA_VIOLATION carries no detail, as its `identified` twin (`derived.ex:114`).
- Test literals hand-checked (`power.test.ts:178-191`): ring 2 > 1; ring2 2 = 1 + 1; belt +1 −1 = 0 = 0; helm 6 > 3 + 2 = 5; boots feet absent → slot; cap no level → intended_level; order feet < finger < head.
- End to end: scratch copy of `affects_sampler` with `per_slot {finger 1, waist 5}, per_level 2`, belt level 1, ring_left level 2; `mix loka.compile` then `power.ts`: over = belt (6 > 5), unbudgeted = ring_right, ring_spare (intended_level); ring_left 2 ≤ 3 absent. Matches hand values; the compiled artifact keeps both fields.
- Focused runs at head: `power.test.ts affects.test.ts validate.test.ts` exit 0; `mix test test/loka/content_derived_test.exs` 4 pass.
- Mutants re-run by the reviewer, all red: `>=` for `>` (power.test); missing slot as 0 (power.test); TS floor ignores intended_level (affects.test); schema `propertyNames` dropped with contracts regenerated (validate.test, `per_slot/tail`); Elixir owner check dropped, floor ignores intended_level, intended guard never fires (each `mix test --force`, 3/4). Survivor: finding 1.
- `per_slot` repeats the SlotKey list as a `propertyNames` pattern: `propertyNames: {$ref: SlotKey}` makes `bin/contracts.exs` exit 1 (`propertyNames: invalid`), so the copy is forced; not a finding.

## Findings

1. **Nit.** `kernel/ts/play/power.ts:106-107`: with both `intended_level` and a budgeted slot missing, the spec order reports `missing: "intended_level"`; swapping the two branches stays green (no fixture item lacks both). Fix: add one item in an unbudgeted slot without `intended_level` (e.g. hands) to `budgeted()` with its literal row.
2. **Question.** `protocol/cartridge.schema.json:1361`: the brief said per_slot holds 1..13 entries; the schema has no `minProperties` and the spec says "possibly none". `per_slot: {}` loads and lists every affects item as missing "slot". Unclaimed departure: PM accepts the spec wording, or the fix adds `minProperties: 1` and an invalid.json row.

## Departures

- Elixir `check`/`floor` split into `api_floor`, `tables`, `gear_budget` for credo: accepted; behavior-preserving (the `tables` head matches the only valid `derived` shape, an object), and the reviewer's three Elixir mutants are red after the split.
- TS budget checks in a `gearBudget` helper for the 40-line limit: accepted; same order of diagnostics as before plus the new ones.
- Open question (no real cartridge declares gear_budget): acceptable for a report tool. The loader and compiler tests mutate `affects_sampler`, the report test uses a hand-written literal, and the scratch end-to-end run above passes; a sampler waits for a consumer (`loka-kgd.107.10` or a chapter's numbers).
