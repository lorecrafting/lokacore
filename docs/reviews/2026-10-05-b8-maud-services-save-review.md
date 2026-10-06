# B8 Maud services — independent save/protocol opinion

Exact source reviewed: `b183390acd6cc1662c4577eec567324dee02def2`, against integrated
C2/published Web base `65dabf5605bca7da3e0b6e35148986c3700d38ac`. This reviewer
has authored none of the B8 implementation. Review is independent and headless;
no owner save or native simulator is involved.

Governing [brief](../briefs/chapter-one/b8-mauds-services-brief-2026-10-05.md),
[mechanics](../system/mechanics.md#b8-mauds-immediate-services-selected-contract),
[declarations](../system/cartridge.md#b8-mauds-service-declarations),
[protocol](../system/protocol.md#b8-immediate-service-composition) and
[save recovery](../system/save.md#b8-service-recovery) require:

- Exact original actor/body/provider/service/quote admission; conserved payment,
  finite stock and capped settled MV or actor-scoped entitlement share the one
  existing changed-row/receipt transaction.
- Failed and either uncertain COMMIT preserve all prior or all next truth, fence
  work until reconciliation, and exact retry grants or charges nothing twice.
- Reopen proves revision-ordered causal payment/stock/benefit history, including
  cartridges without liquid vessels, while retaining lawful later movement,
  recovery, death, other payments and independent S1 behavior.
- Forged bounded state, wrong associations and missing/extra consequences refuse
  `save_corrupt` without rewriting; current integrated release/API/hash/IDs and
  schema/compiler/loader semantics agree without changing frozen predecessors.
- Reuse existing payment, resource/fact/liquid operations and history validation;
  add no service ledger, migration, separate effect interpreter or early adoption.

Verdict: **CHANGES REQUIRED**. No incorrect service save behavior was found at this
source head; the isolated history guard lacks its required red control, and
source-size policy is violated.

## Findings

- **B8S-01 — blocker**, `mobile/authority/local-story/service.test.ts:220`:
  the no-vessel control retains fuel, exchange and patrol metadata. Reverting
  `liquid-save.ts:20` to `if (!expected.length) return false` leaves all five
  new SQLite tests green because `exchangeSave` independently invokes history.
  A validated room-only cartridge with those triggers and their consumers
  removed then accepts a forged `paid=true` row as `open`; restored B8 refuses
  `save_corrupt`. Isolate the existing control rather than add overlapping
  coverage; demonstrate this exact mutant red and restored control green.
- **B8S-02 — blocker**, `kernel/ts/src/commands/actions.ts:1`,
  `kernel/ts/src/content/cartridge.ts:1`, `lib/loka/content/compiler.ex:1`,
  `lib/loka/content/checks.ex:1`: new source allowances admit 306/303/302 lines,
  and an existing allowance rises 380→420 for 404 lines. AGENTS explicitly
  forbids new/raised source allowances. Keep the prior limits through concise
  extraction into the existing module seams; no exception is recorded.
- **B8S-03 — nit**, `protocol/capability_registry.json:454`: the new entry
  duplicates the empty `service@1` placeholder at line328, producing duplicate
  generated documentation rows. Complete the existing entry and delete the
  duplicate. Current portability checks agree; no runtime mismatch was found.

## Independent verification

- Focused TS/schema/loader/kernel and real-SQLite service, commerce, liquid and
  training command: **33 passed**. Focused Elixir compiler/current-content and
  service wire fixtures: **8 passed**. Existing fault cases prove all-old/all-new
  COMMIT, fencing, retry, S1 and later same-body death/reopen.
- Omitted service payer debit: older commerce/liquid/resource tests **31 passed**;
  B8 literal test fails with `[20,13]` versus independently expected `[17,13]`.
  Service-only history mutant: committed B8 save suite **5 passed**, isolated
  forged-entitlement probe fails (`open` versus `save_corrupt`); restored probe
  passes. Both mutations were confined to a detached throwaway worktree.
- Nine file-backed corruptions (command/receipt/event actor, causation,
  correlation, fact scope, quest/release reference, missing receipt) all refuse
  `save_corrupt` with byte-identical files.
- Changed-schema sweep: **61 controls, zero survivors**. Generated contracts
  check passes. Full compiled artifact equals the candidate fixture; Python
  canonical SHA-256 is
  `c8bc55ca6aa55af4b7579e570b3e6f85fce370b80ebda766df16780fa8f8933a`.
  Independent regeneration is byte-identical, and all **111** IDs match.
  Frozen predecessor fixtures are unchanged.

Ponytail Review: existing transaction and receipt-history reuse are lean;
B8S-03 removes the redundant six-line registry entry. Save/protocol approval
awaits the listed dispositions at a corrected exact source head. Primary review,
publication checks and later browser evidence remain separate.


## Scoped fix round 1 — APPROVE

Exact corrected source: `552717d50af951d8f5cd4c43533e53b7102d45fd`, including
correction `1f651d89` and the integrated reviewed C2/Web predecessor. This checks
the listed dispositions, changed code and direct callers; the original review
above remains intact.

- **B8S-01 closed.** The existing room-only control now removes vessel/fuel and
  exchange/patrol history triggers together with their declaration consumers.
  It uses a real file-backed cold open and asserts both rows and SQLite bytes
  are unchanged on refusal. Independently reverting `liquid-save.ts:20` to
  `if (!expected.length) return false` makes that committed test fail with
  `open` versus `save_corrupt`; restored code passes. Mutation was isolated to a
  detached throwaway worktree, restored, and the worktree removed.
- **B8S-02 closed.** The four source files now contain 246/247/285/378 lines
  within their original 300/300/300/380 limits. Exact input/provider admission,
  installed-API checks and checked source/bed expansion move into their natural
  existing seams without changing service/payment/history semantics. No new or
  raised source-file allowance appears against the integrated pre-B8 base.
- **B8S-03 closed.** The original registry entry now owns `use_service` and
  service/bed definitions; exactly one `service@1` remains. Generated contracts
  check passes.

Independent commands: the scoped service/loader/wire/SQLite commerce/liquid run
passes **26 tests**; focused service/current-source Elixir compilation and wire
fixtures pass **6 tests**. Kernel typecheck and corrected TS/Book/Elixir size
checks pass. The complete current artifact still compiles to the independently
pinned fixture, and all **111** allocation answers pass. Cartridge source,
protocol wire schemas/fixtures, save/replay/recovery/transaction implementation
and candidate hash are unchanged from the reviewed B8 checkpoint.

Evidence head `125ce77740c6516294a8e36cc0a28f4533d6cf7f` changes only the
B8 evidence folder and is source-identical to the approved checkpoint. All
**32** evidence hashes verify; its corrected source/predecessor and
v025/API1.23/hash/111-ID claims agree with the independently checked source.

Ponytail Review: lean extractions preserve validation; no new complexity finding.
**APPROVE**, no open findings. Publication checks and browser/native evidence
remain separate from this headless save/protocol opinion.
