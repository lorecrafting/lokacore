# M2-A: position recovery

Status: vertical implementation, focused validation complete; publication checks and independent review pending. Reviewed source base
`6d9712ef2b0ea12be537e4ef4c826a6d04e155af`, containing M1-B2 merge
`e1b90dca77303dbdbd5bc58284fb67282c3f21e6`; authority is the
[PM adoption](../decisions/pm-decision-m2-a-position-recovery-2026-10-04.md).

Implement the active resource, position, composition, final adoption and cartridge
clauses. Preserve frozen legacy fixtures and numeric-v1. Resource rows settle the old
stored rate at the committed base clock, preserve fractions while below full, clear
credit at cap, and write rate metadata even for zero-amount position adjustments.
Portable composition and independent invariant twins remain domain-neutral. The RPG
checks touched player rates and all opted pools on a player position assignment before
accepted return; loaded/reconciled worlds repeat the narrow agreement check.

The literal opted supplement supplies independent answers for old-rate settlement,
spending/fraction retention, cap reset, zero rate, same-writer overlays, clock-zero
birth, long absence and malformed metadata. Separate real position controls and
public admitted/adopted wrong-but-authored-rate controls cover the writer and guard.

The current sampler release authors MV min0/max82/start82/gain18, every3600,
rates18 standing/sitting and36 resting/sleeping, movement MV1 and pool-specific bands.
API1.2 was rechecked at the reviewed source baseline and generated through established
tooling. The independent Python sampler oracle yields
`16bec961e62e3fa737899fc47b10747d64477c22b014b15a3f79444a51f87845`.
Legacy composition/position suites ran before the opted controls.

The real rollback-journal SQLite tests cover Rest64803 → reopen → Stand64805 →
query64808=2 with exact stored fractions, receipt replay without changed rows,
malformed/missing/wrong-but-authored rates on load and reconciled adoption, genuine
SQLITE_FULL and failed deferred-FK COMMIT atomicity. The actual bundle paysMV1,
recovers one point in2 real seconds resting versus4 standing, preserves HP bands,
and moves Bram to his authored19:00 room without NPC resource rows. Direct compiled
artifact callers reject installedAPI1.1 and load under1.2. These are automated headless
proofs; native preview remains batched with carrying.

Both independent contract validators kill all17 removed new required entries/bounds
against hand-written error literals. The safe-integer numeric profile already bounds
`every`; its schema adds only the positive minimum. Restored controls pass after18 observed core/guard mutations, including unsafe full-product
precision loss and advancing-clock settlement. Normal prepush and independent reviews remain
required before merge.

Composes with movement costs, elapsed time, position facts and atomic changed-row
commits. Stop for frozen fixture/profile changes, API collision, NPC/body ambiguity,
old-save migration or unexpected shared ownership; PM settles routine choices.

Committed direct-caller audit (source only): `mechanics/schedule/rule.ts:21–41` handles
NPC `run_job` with direct transfer plus complete/schedule and `entered`; it never calls
Move, position queries or resource payment. Player Move resolves `bodyOf` before standing
and `fare` (`mechanics/movement/rule.ts:34–44`); `runtime/decision.ts:159–160` currently
resolves only the player. Therefore opted player-only rows do not affect Bram's scheduled
departure. Preserve that job behavior; the actual current-sampler headless proof above preserves departure; native preview
remains deferred. Actor-specific NPC pools stay with M5.

The MV100% band uses `mv_ready` because the existing global `ready` catalog entry
 describes HP health; `steady`/`tired`/`exhausted` cover75/25/0. HP/MA keep their labels.
Resource arithmetic and independent replay occupy small modules to retain source-size
limits; no new timer, whole-state copy, generic validator or dependency was added.

Developer self-review: Ponytail removed redundant fixture validity flags in favor of
hand-written exact errors; no further simplification preserves the required trust guards.
Correctness review fixed rule purity through the existing resource seam, retained typed
position rates, and kept independent arithmetic separate from composition. Source-size
checks, focused kernel/mobile type checks, opted/legacy behavior, compiler/peer/API and
all mobile authority/App tests pass. The final broad check is the required prepush hook.

Actual first prepush failed at generator14 seed1791136864905 because its drained opted MV
row discarded birth rate/remainder. The [PM scope amendment](../decisions/pm-decision-m2-a-position-recovery-2026-10-04.md)
permits only preserving the opted birth metadata while changing value, plus the existing
regression-seed record. Legacy authoring, draws, order and generator version stay unchanged.
The existing regression test passes with the fix, fails EXIT1 with the old
`{value,at:0}` authoring, and passes after restoration; typecheck also passes.
The narrow fix receives a justified normal prepush retry. The failed run remains evidence, not a flake or a validation exemption.
