# C4 portable foundation second opinion

Independent provisional review of source `252eb45624a27d5eb90c89a2eff7159e09f9b613`,
evidence `11fa757947061b4fa077847d85c3a05b1cb100cf`, branch `chapter-1/c4-hound-behavior`.
Authored none of the implementation. Verdict: **CHANGES REQUIRED**.

Requirements derived before inspecting the diff: [C4 mechanics](../system/mechanics.md#c4-hound-response-pack-assistance-and-flight-selected-contract),
[portable composition](../system/protocol.md#c4-pack-encounter-and-flight-composition),
[save recovery](../system/save.md#c4-pack-and-flight-recovery) and the
[C4 brief](../briefs/chapter-one/chapter-one-c4-hound-behavior-brief-2026-10-05.md).
Admission must bind the attacked hound and exact bounded roster; initial cursor is
that attacked hound. Advances preserve legitimate membership, exact rotation and
whole-roster closure. A flight stamp proves an actual same-group departure at its
occurrence clock. Equal-time dispatch preserves ordinary conflict rules, and
historical receipts must remain legal after later movement, death or replacement.
Both portable implementations must match independent answers.

## C4-A1 — blocker: optional pack fields bypass admission guards

At `kernel/ts/src/foundation/compose_encounter.ts:24`, pack mode depends on the
operation's optional roster, rather than the admitted hound's declared plan.
The same bypass exists at `lib/loka/core/compose_encounter.ex:14`,
`kernel/ts/src/runtime/invariants_encounter.ts:55` and
`lib/loka/core/invariants_encounter.ex:110`.

Controlled reproduction: use `exact-two-member-pack` from the literal C4 fixture,
remove both `active_ids` and `next_opponent_id`, and compose the complete proposal.
Both composers accept and both independent `delta_preconditions_hold` checks accept
the claimed success. On the loaded provisional chapter, make the same change to
an ordinary accepted Attack decision and call final `adopt`: it accepts, but
`encountersValid` rejects the resulting world. This permits a producer regression
to commit an encounter that cold recovery refuses.

The same admission seam accepts `next_opponent_id` equal to the other roster member
instead of `npc_id` (`compose_encounter.ts:79`, `compose_encounter.ex:51`). Both
portable checks and loaded-world final adoption accept that wrong initial cursor.
Require the plan-selected pack shape and exact initial attacked-ID cursor in both
composers and independent checks. Preserve ordinary non-pack NPC admission.

## C4-A2 — should-fix: a stationary transfer can mint a flight stamp

At `kernel/ts/src/foundation/creation.ts:190`, the flight exception requires one
same-group transfer with nonnull source, but never requires departure. This is
mirrored at `kernel/ts/src/runtime/invariants_creation.ts:136`,
`lib/loka/core/creation.ex:165` and `lib/loka/core/invariants_creation.ex:149`.

Controlled reproduction: take the transfer and slot operations from literal
`flight-removes-one-member`, set transfer destination equal to its source, and
submit those two operations as a complete proposal. Both composers return changes
and both independent checks approve. Loaded-world final adoption likewise accepts
an unchanged room plus `last_flight_at = 64800`. The timestamp then suppresses a
same-clock population wander despite no successful flight. Require actual
departure when admitting the stamp, preserving valid proposal prefixes and the
same-clock conflict protection; no new history ledger is needed.

## Verification and scope

- Independent focused baseline: **22 TypeScript/SQLite tests** and **12 Elixir
  tests** pass, covering C4, encounter/population composition and spawned bundles.
  Elixir was independently compiled. The malformed inputs above therefore expose
  missing controls in otherwise green suites; their claimed successful results
  agree across both kernels, not merely their error codes.
- Examined whole-roster conflict/closure, strict prior encounter rows, rotation,
  current-generation provenance, fatal stamp retention/new-generation reset,
  both same-clock orders, historical save checks and prefix/final composition.
  Runtime proposal source is unchanged. Save validation allows lawful pending
  pruning and retains ordinary receipt replay rather than demanding historical
  rows still describe current positions.
- Structural sharing remains: only written state sections are copied; rosters and
  slot scans are bounded. Ponytail Review: no actionable over-engineering finding.
  The existing lifecycle, movement, population and delta seams suffice. Independent
  invariant implementations and literal rows serve the required portable contract.
- No production source mutation, owner save, browser or native run was performed.
  Developer mutation results are recorded separately in the linked evidence;
  this review independently used controlled malformed proposals and final adoption.

The chapter is intentionally still provisional v029/API1.25. The evidence honestly
records a failed full gate at the stale content pin; that is not a passing final
gate. Published D1 integration, independent successor pins, complete full gate and
scoped review carryover remain required. Primary gameplay and save reviews remain
separate from this second opinion.
