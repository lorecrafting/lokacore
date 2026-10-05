# B6 all-hours Wisp — independent plan review

**Verdict: CHANGES REQUIRED.** Exact local planning head
`53071bda3434a7c21e76bb4f484f303c8607c842`, against inspected dependency base
`98cc60b1647d031eed790ca085681bbe62af9d73`. PR: null.
Fresh reviewer; authored none of the plan. Docs-only review, not implementation,
playability, durability or publication proof.

Requirements derived before the diff from the owner no-wait and
[chapter reward decision](../decisions/owner-decision-chapter-one-content-2026-10-02.md),
[composition](../system/architecture.md#building-mechanics-by-composition),
[B4](2026-10-05-b4-light-plan-review.md), [B5](2026-10-05-b5-infirmary-herbs-plan-review.md)
and the governing B6 clauses:

- Reciprocal, all-hours, gear-free marsh access and return to the actual public
  Aldric; narrow shared dark visibility and effective carried-light admission.
- Equality-passing immutable perception check, explicit one-shot actor-owned S4,
  three wrong answers closing only a sitting, immediate reset and unchanged
  unlimited Q2 retry; malformed input and receipt replay consume no attempts.
- Atomic correct resolution and exactly scoped narrative/ward facts, an actual
  independently selectable Aldric dialogue, and no spell/resource/main-quest reward.
- Exact actor/source/quest/prior-count binding, portable literal fixtures and
  differentials, historical receipt reconciliation, real SQLite faults/reopen,
  confirmed Book history and typed corruption refusal without repair/deletion.
- Small consumed extensions under existing writers; unknown dependency/successor
  pins remain null until actual source integration and independent re-pinning.

## Finding

**B6-R1 — should-fix — `docs/system/cartridge.md:825`: return route omits North Gate.**
The normative path says Village Green → Chapel Steps, but the existing world
has Village Green north → North Gate and North Gate north → Chapel Steps.
A literal implementation or route walk following this contract attempts a
nonexistent edge, or introduces an unplanned shortcut. Insert North Gate in the
specified path and preserve the existing edges. Evidence:
[Village Green](../../cartridges/ashmere_missing_child/rooms/village_green.json),
[North Gate](../../cartridges/ashmere_missing_child/rooms/north_gate.json), and
[Chapel Steps](../../cartridges/ashmere_missing_child/rooms/chapel_steps.json).
Disposition: open.

## Review evidence

Reviewed all twelve changed documentation files per file; traced the existing
return-route room definitions, original Aldric and his debt/bell dialogues, and
current dialogue selection/answer behavior. The exact dialogue selector addresses
an actual first-eligible-key conflict. The selected light exception, sitting
counter and topic lowering retain shared admission and existing writers. The
acceptance requires independent literal portable outcomes, realistic red controls,
unchanged Q2 retry and real SQLite fault/reopen evidence rather than claiming it.

Ponytail Review: Lean already. Ship. No complexity finding.
`git diff --check` passes. No gameplay tests, mutations or full code-check run
for this docs-only plan. Normal review-record hook results are reported at handoff.

## Scoped fix re-check

**Final verdict: APPROVE** at exact planning fix head
`8e221b49c981ce102f70800d923b0a8044475494`. B6-R1 closed; no open findings.
The sole fix inserts North Gate into the normative Aldric return path. A
controlled traversal of the eight literal existing route edges at that exact
head confirms every edge and its reciprocal, including Village Green ↔ North
Gate ↔ Chapel Steps. The B6 brief and PM adoption link to this route clause and
introduce no competing path. No source or other planning behavior changed.
The initial CHANGES REQUIRED verdict above remains the historical review.

Validation: exact fix diff and direct route references reviewed; reciprocal
route assertions pass. Normal review-record commit hook results are reported at
handoff. Approval remains docs-only, without gameplay or durability proof.
