# B5 Infirmary Herbs — save/protocol second opinion

Local draft PR: `chapter-one/b5-infirmary-herbs`; exact head
`802edd92c975295b0c83526d6e15a508979e366a`. Fresh independent reviewer; authored
none of the source or plan. Hosted PR/CI and native/browser proof: null.

## Requirements derived before the diff

- [Selected mechanic](../system/mechanics.md#s9-infirmary-herbs-b5-selected-contract)
  and [authored stock](../system/cartridge.md#b5-herb-and-bandage-stock): conserved
  exact identities, direct-custody readiness, distinct deterministic binding,
  actual positive faction contribution, and no reset on explicit repeats.
- [Composition](../system/protocol.md#b5-harvest-and-exchange-composition): terminal-only
  retirement of the exact prior quest/scope/instance followed by fresh activation
  in one writer; stale occurrence evidence cannot reward a new occurrence.
  Foundation semantics require independent known answers and TS/Elixir agreement.
- [Save recovery](../system/save.md#b5-stock-and-repeat-recovery): bounded original-revision
  receipt reconstruction must preserve saved RNG lineage, lawful later custody and
  B2 faction/B3 penny ordering, and current-row agreement. Missing or forged evidence
  refuses as typed corruption with intact storage.
- [Commit/reconcile](../system/save.md#commit-fence-reconcile): failed and both uncertain
  COMMIT outcomes, lost acknowledgement, cold reopen and exact retry expose all prior
  or all next truth, with no duplicate transfer, reward or implicit repair.
- [Contracts](../system/protocol.md#contracts): current v019/API1.17 artifact and all
  initial IDs have independent pins; changed contracts carry validating examples and
  controlled invalid cases.

## Verdict

**CHANGES REQUIRED.**

## Findings

- **B5-S1 — blocker:** `mobile/authority/local-story/exchange-save.ts:49`
  replays accepted trusted elapsed receipts through player `step`, which rejects
  `elapsed` (`kernel/ts/src/runtime/world.ts:100`). On the real v019 cartridge,
  advance controlled wall/monotonic clocks by 20ms: the pulse is ready,
  one elapsed receipt commits revision 1/clock 64801. Physically close the file-backed
  SQLite connection and reopen: `save_corrupt`, with that head and receipt intact.
  The first normal clock tick makes an otherwise lawful save unreopenable; an
  uncertain committed elapsed delivery also cannot reconcile through this loader.
  Replay trusted elapsed commands through their existing authority boundary and
  add a real elapsed cold-reopen regression.
- **B5-S2 — blocker:** `kernel/ts/src/runtime/invariants.ts:200` and
  `lib/loka/core/invariants.ex:114` replay retirement without independently requiring
  the immediate matching fresh activation. Give the existing
  `repeat-cannot-retire-without-fresh-activation` fixture a successful result that
  removes its exact resolved quest row: both `delta_preconditions_hold` checks
  return true, although composition correctly faults. The independent guard misses
  the new API1.17 atomic-repeat contract. Independently check the paired quest,
  scope, fresh ID and writer; retain a literal invalid-success control in both kernels.

## Verification

Focused kernel infirmary/contracts/composition and real SQLite infirmary/commerce/fault
suites: **57 passed**, 20.3s. This covers historical B2/S9 faction sequencing, active
custody loss/retrieval, retirement, genuine failed COMMIT, lost acknowledgement,
exact retry and corrupt current/receipt truth. File-backed elapsed probe above fails
lawful reopen independently. Both invariant probes reproduce B5-S2; the Elixir
probe loads the pure core modules directly because this worktree lacks Mix dependencies.

In a disposable detached checkout, removing composition's retirement pairing and
bypassing receipt reconstruction makes the two targeted existing tests fail;
restored source passes **2/2**. The checkout was restored and removed; no source fixes.
Independent ordinal/SHA-256 calculation and `newWorld` agree with all **86** v019 IDs,
API1.17 and artifact `de1588f1fdfb47e66ec09a3c8d6b78fb53589153fcc3a679028a49b5f93b5442`.
All **98** examples in the five changed command/delta/quest/room/dialogue schemas
validate. Broad schema sweep, full publication checks and hosted CI remain deferred
under the provisional lane; no native/browser proof claimed.

Ponytail Review: **Lean already. Ship.** No unnecessary machinery finding; correctness
findings above remain open. Recheck scope: their fixes and direct callers.

## Scoped fix recheck — 2026-10-05

Source fix `cbb11fcee8830930e05abb17c60a58b40e5748a1`; exact integrated head
`2df52d328adbfdea39a0cde623f6a9f34fffb186`. **APPROVE; B5-S1 and B5-S2 closed.**
The initial findings and verdict above remain historical.

- **B5-S1:** recovery now uses `stepElapsed` for trusted elapsed receipts and binds
  their run to the saved run. The new physical SQLite cold-reopen regression reaches
  the actual herb exchange afterward. Independent file-backed probes also confirm
  normal, genuinely failed COMMIT and successful lost-ack outcomes: cold reopen
  preserves clock 64800 or 64801 as appropriate, and exact retry leaves one receipt
  and one advance. Existing world/actor/domain-command validation remains in force.
- **B5-S2:** both independent precondition checkers require immediate activation of
  the same quest/scope, a fresh instance ID and the same writer. Both reject the five
  literal forged-success observations and accept the valid bound pair. The adjacent
  dialogue binding changes and direct lowering/projection callers preserve the
  accepted participant; the existing pinned-role and stale-custody regressions pass.

Focused composition, kernel infirmary, SQLite infirmary and two direct dialogue
caller tests: **28 passed**. In a disposable detached checkout, player-only elapsed
replay and removal of each kernel's pairing check fail their targeted controls.
Individually omitting quest, scope, fresh-ID or writer matching in either kernel
also fails its literal observation. Restored targeted Node tests pass **2/2**;
the five Elixir observations pass again. All source mutations were restored and
the checkout removed. Elixir controls load the pure modules directly.

The v019 manifest, artifact and all 86 initial ID pins are byte-for-byte unchanged
from the independently reviewed source. Ponytail Review: **Lean already. Ship.**
No open findings in this opinion; publication/hosted checks remain separate.
