# D6 water depths — independent PM adoption review

Exact adopted-docs head `d7a357099138377357bb4fc8301a437f5a425e1b`, after the
[approved provisional plan](2026-10-06-d6-water-depths-plan-review.md).
Fresh independent reviewer; authored none of this adoption.
Verdict: **CHANGES REQUIRED** for D6-A1. No source work is approved.

Requirements derived before the diff: [D6 adoption](../decisions/pm-decision-d6-water-depths-2026-10-06.md),
[C1 acquisition](../system/mechanics.md#c1-training-and-armed-defense-selected-contract),
[D1 skill declaration](../system/cartridge.md#d1-ferry-and-isle-declarations),
[existing fatal sequence](../system/mechanics.md#death1--corpse-custody-and-same-body-return-m5-b-foundation),
[Legend recovery gate](../decisions/pm-decision-legend-mechanics-reconciliation-2026-10-04.md#reachable-death-recovery-and-reading),
and [delivery requirements](../WORKFLOW.md). The adoption must settle qualification,
exact view/admission bindings, positive-to-zero HP death ownership, ordinary custody
and safe return, while retaining pending D1/source gates.

## D6-A1 — should-fix — active D1 still requires the abandoned CON threshold

`docs/system/cartridge.md:981` says D6 must re-pin its provisional CON threshold
before implementing underwater admission. The newly adopted D6 clause at
`docs/system/cartridge.md:1223` instead retains vacuous skill qualification and
requires acquired swim plus current load/MV, explicitly without CON or DEX.

A developer following the still-active D1 prerequisite can add a CON qualification
or block D6 assignment for an absent CON declaration, contradicting the selected
D6 consumer and D11's inherited-swim proof. The new D11 warning correctly resolves
its side of this dependency, but the normative D1 cross-reference remains stale.
Replace that pending-CON requirement with a link to D6's selected acquired-swim,
load and MV admission; retain the historical D1 decision record unchanged.

## Remaining review

- The selected Down/Up offers use existing `move`, empty targets and literal
  direction inputs. One exact-edge query serves view and execution. Free surface
  explicitly bypasses ordinary standing/fare checks and remains available at zero
  MV, excess load, missing swim or light. Following-Wren descent refuses.
- Chapter settings consistently specify 6000g maximum entry load, 10 MV entry,
  5 MV drain every150 seconds and free return. Against installed standing
  recovery18/3600, independent integer arithmetic gives MV10 after entry, then
  MV5/remainder2700 at64950, MV1/remainder1800 at65100 and MV0/remainder900 at65250.
  The brief pins the initial clock/remainder and requires dependency revalidation.
- Inspected existing `deathSequence` accepts nullable killer/credited character
  and requires validated positive-to-zero HP loss already applied to its world.
  D6 selects that producer path, typed drowning, one writer group and no combat
  credit; it does not pretend an MV-only death interface already exists.
- Chapel recovery binds the actual owned nonempty corpse and transfers existing
  held/worn roots once, preserving descendants and the empty corpse. Forced overload,
  foreign/empty refusal, failed/unknown COMMIT, replay and historical-custody validation
  are explicit across mechanics/protocol/save/Book. No duplicate recovery ledger or
  general remote Take is proposed.
- D11 uses inherited swim through the same water consumer and cannot cite D6 as
  a CON consumer. D1 source/lesson proof and exact merged dependency re-pin still
  block D6 assignment; successor/source/API/hash/IDs/PR remain null.

Ponytail Review: lean; existing movement, fractional resources, pure death sequence,
custody and receipts carry the proposed consumer. No complexity finding.
`mise exec -- elixir bin/check_docs.exs` passes: **638 documents, zero broken links,
zero unreachable**. Diff whitespace check passes. Docs-only review: no source
mutation, runtime certification, preview, native work, owner-save access or
publication claim.

## Scoped fix re-review — APPROVE

Corrected adoption head `95431041505f8349fdc76f37793b3416e55cbf97`.
**APPROVE**; D6-A1 is closed, with no open adoption finding.

The sole contract correction replaces D1's pending-CON prerequisite with a link
to the adopted D6 clause and explicitly states acquired swim plus current load/MV,
without an attribute floor. This agrees with D6 mechanics, cartridge tuning and
D11's inherited-skill consumer; the historical D1 decision is untouched. The
source/lesson/dependency re-pin gates remain in force.

Diff whitespace check and the normal documentation commit hook pass. Ponytail
Review: one corrected cross-reference, no added machinery. This approves the
adopted documentation only; no implementation, source test, owner-save, native,
preview or publication proof is claimed.
