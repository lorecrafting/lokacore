# M5-A entity-specific persisted NPC HP review

PR: [#165](https://github.com/lorecrafting/lokacore/pull/165). Reviewed source:
`b8d0d5f51fd144b885f8967e333cadb417622445`. Fresh independent primary reviewer;
authored none of the implementation. Verdict: **APPROVE**. No findings or open items.

## Requirements

Derived from the active contracts and first-encounter decision before implementation review;
checked against the PM-supplied private M5-A brief and independent literal proof table.

- [Resource mechanics](../system/mechanics.md#resource1-kerneltssrcmechanicsresourcets):
  exact entity-resource overrides precede pool defaults; each explicit NPC HP override has
  a required birth row even at clock zero; queries, exact adjustments and ordered costs use
  its complete independent spec. Zero gain preserves wounded/zero HP under elapsed time.
- [Composition](../system/protocol.md#composition): both portable twins and independent
  precondition twins resolve the exact canonical resource target. Same-writer overlays and
  whole-proposal faults remain intact; the immutable spec map is outside persisted State.
- [Compiler/loader](../system/cartridge.md#compiler): the four-field optional NPC HP shape,
  numeric and cross-field validation, existing resource ownership and additive API1.4 gate.
  Earlier releases, absent overrides and frozen legacy answers retain their contracts.
- [Save loading](../system/save.md): derive specs from the pinned release, reject missing or
  malformed required rows without repair, and preserve transaction/receipt/reconciliation
  boundaries through the existing changed-row store.
- [First encounter](../decisions/pm-decision-first-encounter-2026-10-03.md): five passive
  HP6 rats in lantern_cellar, player HP10/MV100, unchanged inherited player recovery and
  adopted MV fractions/rates. This prerequisite introduces no attack or death producer;
  dynamic corpse identity and live combat remain later consumers.

## Evidence and assessment

Inspected all changed source/test hunks, schema/generated changes, sampler authoring and
independent oracle, portable composition/resource/precondition implementations, fresh/base
map propagation, and the existing real SQLite fault adapter. The active specification changes
are in the implementation PR; the planned encounter oracles remain unchanged. Compiler
resource ownership already supplies resource@1, and loader ownership validates the required
existing HP pool. The override never inherits the player's position-recovery table.

Reviewer verification used the pinned toolchain in an isolated detached worktree:

- `mise exec -- node --test kernel/ts/test/npc_hp.test.ts kernel/ts/test/compose.test.ts mobile/authority/local-story/npc-hp.test.ts`: initial and restored EXIT0, **19 passed**.
- `mise exec -- mix test test/loka/core/entity_resource_test.exs test/loka/content_sampler_test.exs test/loka/cartridge_cross_kernel_test.exs`: EXIT0, **7 passed**;
  restored repeat with `--force`: EXIT0, **7 passed**.
- Five independently applied mutations were killed: resource-only lookup replacing the exact
  target in TypeScript composition (EXIT1) and Elixir composition (EXIT2); pool-only lookup
  replacing independent effective-spec resolution in TypeScript (EXIT1) and Elixir (EXIT2);
  omitted required-override save validation (EXIT1). Each failed its intended behavioral
  test. Elixir mutants used `mix test --force`; every source file was restored exactly.
- `python3 test/loka/cartridge_sampler_hash.py` reproduced the committed new fixture with
  no diff. The preserved `sampler_v006_hash.json` is byte-identical to the prior current
  sampler fixture. The existing API1.3 consumer check now uses that preserved release.
- Compiler-resolved `mix xref callers` confirms resource adjustment is consumed by
  composition and independent resource replay by the invariant module. Final `git diff
  --check` and restored source status were clean before writing this record.

The literal resource supplement independently checks both twins, including same-writer
writes, resource-specific identity, min/max faults, absent/malformed required rows, zero HP,
zero gain and legacy fallback. The real adopted adjustment is committed, closed/reopened and
receipt-replayed with rat/player values and bounds checked separately. Genuine SQLITE_FULL
and deferred-foreign-key COMMIT failure keep prior rows/head/receipts; lost acknowledgement
stays pending until reconciliation adopts the complete saved result. These are headless
conformance results, without a claim of native combat acceptance.

The developer reports 11 killed code mutants and 13 non-equivalent schema mutants per kernel;
this review independently reproduced the five behavioral mutants listed above, rather than
claiming those developer runs as reviewer evidence. The PM verified all six source-head CI
checks green; normal review-record hooks provide their own subsequent validation.

Ponytail Review: **Lean already. Ship.** Existing resource targets/rows, schema seams,
independent checkers and transactions are reused. No new dependency, mutable spec table,
whole-state action-path copy, unused stat framework or content-specific portable rule.

## Separate Sol second opinion

Independent read-only second review of the same source head, appended verbatim:

```text
APPROVE — b8d0d5f51fd144b885f8967e333cadb417622445

No actionable findings. Entity-specific birth rows, effective bounds, composition/precondition twins, changed-row persistence, pinned reopen, malformed-row rejection, and unknown-COMMIT reconciliation align with the amended specification.

Validation: 24 targeted tests passed at the exact head across:
- kernel/ts/test/npc_hp.test.ts
- kernel/ts/test/compose.test.ts
- mobile/authority/local-story/npc-hp.test.ts
- mobile/authority/local-story/resource-recovery.test.ts

Includes real SQLite FULL, failed COMMIT, lost acknowledgement, and M2 movement recovery coverage.

Ponytail review: no unnecessary machinery identified.
Owner checkout preserved; no edits or review record created.
```
