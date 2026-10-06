# B4 useful light — save/protocol second opinion

Local branch `chapter-one/b4-light`; exact source head
`909082b08680cba197839e0a83696f5606af3e35`. Fresh independent reviewer; authored
none of the source or plan. Hosted PR/CI and native/browser proof: null.

## Requirements derived before the diff

- [Selected mechanic](../system/mechanics.md#b4-light-and-darkness-selected-contract)
  and [tuning](../system/cartridge.md#b4-well-and-fuel): exact fuel intervals survive
  later custody, exhaustion, commerce and death; source gain conserves supply debit.
- [Portable composition](../system/protocol.md#b4-fuel-composition): full prior-row
  equality, declared instance, bounds/time and unlit supplies; conflicting writers
  and failed preconditions adopt nothing. Both kernels independently validate them.
- [Save recovery](../system/save.md#b4-fuel-and-dark-recovery): replay original
  revision/clock/custody with bound command, actor, source/supply and full decisions;
  authored light-only and orphan saved fuel activate validation. Forgery refuses
  as typed corruption without repair. COMMIT/retry preserves all prior or all next
  rows, and lawful later custody/corpse recovery remains available.
- [Review discipline](../WORKFLOW.md#review-stance) and [test rules](../../AGENTS.md#writing-tests-every-change-every-agent):
  independent guards need behavioral red controls. Current successor hash and all
  94 runtime identities require independent answers and actual consumer proof.

## Verdict and finding

**CHANGES REQUIRED.**

- **B4-S1 — blocker:** `test/loka/core/fuel_test.exs:10` supplies the independent
  invariant only valid successful results or composer faults, for which the
  success-only invariant holds vacuously. Replacing the fuel guard at
  `lib/loka/core/invariants.ex:180` with `true` leaves **all 159 core tests green**.
  With that mutation, the existing literal `excess-charge` input (capacity8,
  stored2, replacement9 at100) plus a forged successful fuel change makes
  `delta_preconditions_hold` return true; the restored guard returns false.
  Thus deletion of the new independent bounds/supply/time validation can ship
  undetected. Add the minimal invalid-success assertions using the existing
  literal fixtures, as the TypeScript table already does, and demonstrate a red
  control when this guard is bypassed. No production fix is requested.

## Verification

Pinned mise commands: focused Node fuel/contracts/SQLite light checks **8 passed**;
Elixir fuel/contracts/compiler/current chapter checks **9 passed**, including 200
seeded differential cases after literal agreement; kernel light/94-ID checks
**7 passed**; SQLite commerce/Infirmary neighbors **15 passed**. Contract generation
`elixir bin/contracts.exs --check` passes.

An independent real-SQLite probe rejects **40** command, receipt, prior-row,
source/supply, narration, event-cause/correlation/actor, revision/scope and stored-row
forgeries across light-only and actual chapter inputs. Each returns `save_corrupt`
and preserves all saved rows. Lawful stored-lit exhaustion reopens without restart.
The focused suite independently exercises real failed and both unknown COMMIT
outcomes, exact retry, file-backed cold reopen, sold/bought/nested history and a
second real lethal occurrence with retained prior corpse and exact recovered roots.

Four restored mutants are red: omitted light-only replay, ignored orphan fuel,
and ignored exact prior row in each composer. Existing same-layer suites pass those
mutants; the focused controls fail. The fifth independent Elixir guard mutant
survives the whole core suite, producing B4-S1. All mutations were restored;
focused Node8/Elixir9 checks passed again, followed by restored Elixir fuel2.

Independent Python canonical SHA-256 and numeric-profile UUID derivation match
`ashmere_missing_child@0.0.21`, API1.19, hash
`a274bb1c6b22306718648bbcb1b967ee017e0420b62589afe10e1009434dbbfa` and all94
pinned IDs. Actual source compilation matches the fixed payload; `newWorld`'s
rooms, details, subjects, jobs and holders match the entire ID answer.

Ponytail Review: **Lean already. Ship.** No unnecessary machinery finding; B4-S1
remains open. Full publication checks/schema sweep/hosted CI and native/browser
gates are unclaimed. Recheck scope: the missing invariant control and its mutant.

## Scoped fix recheck — 2026-10-05

Exact fix source `a3f9897643b01f53707d04a62f51b4073eadcc25`.
**APPROVE; B4-S1 closed.** The initial finding and verdict remain historical.

The existing Elixir literal table now gives independently invalid fuel inputs
forged successful changes and requires the invariant to reject them. No production
logic, fixture, framework or duplicate test was added. Independently bypassing the
fuel guard still passes the original **159-core** suite, then fails the new fuel
assertion on `excess-charge` (exit2). The mutation was restored; fuel2 passes.

Scoped save/protocol inspection of the primary fixes found no new issue.
Optional `AdvertisedAction.command` supplies semantic wording/ownership while the
invocation retains its authored action key and ordered exact participants; it
adds no persisted fuel writer or row. A real-SQLite Book `top_up` alias probe
commits source7200/supply7197, cold reopens, and retries without another debit.
Compiler and loader require API1.19 for actual fuel/darkness fields while allowing
an unused reserved light lock at1.18; their controlled boundary tests pass.

Focused Node fuel/wire/SQLite/Book checks **11 passed**; Elixir
fuel/wire/compiler/current-source checks **10 passed**, including seeded portable
differential; actual fresh94-ID consumer **1 passed**. Contract generation is
clean. The current hash and 94-ID fixtures are byte-identical to `909082b0`, and
current source compilation still matches their fixed payload. Ponytail Review:
**Lean already. Ship.** No open findings in this opinion; accumulated publication,
schema sweep, hosted CI and browser/native gates remain separate.
