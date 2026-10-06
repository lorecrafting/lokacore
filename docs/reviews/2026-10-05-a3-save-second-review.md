# A3 Green finale: independent save/protocol second opinion

Reviewed integrated head `6a8be6d157d4287148673c36e8c546022534adc1`, source
`9327b56eb7af4fcec1274ee1d184ad56b2e9be6a`, against base `ec3ab73d`.
Fresh reviewer authored none of the implementation. Verdict: **CHANGES REQUIRED**.

Requirements derived before reading the diff: [Green finale recovery](../system/save.md#green-finale-recovery-planned-a3)
requires receipt-backed acknowledged bell and Begin provenance, lawful intermediate
reopening, atomic final memories/marker/report, and corruption refusal.
[Continue admission](../system/protocol.md#actionset-and-admission) and the
[A3 brief](../briefs/chapter-one/a3-green-finale-sol-brief-2026-10-05.md) require bound
shown-line input, exact replay, current contract pins and compiler/loader parity.

## Findings

- **A3-S1 — blocker:** `mobile/authority/local-story/finale-save.ts:126` accepts the
  bell's `-1` fact without requiring its accepted Continue chain or terminal
  `scene_ended` receipt. In a real SQLite completed lost/prior run, deleting all
  three accepted `bell_rung` Continue receipts leaves cold open successful at
  chapter index 1. The Ring receipt proves scene start, not final acknowledgement.
  Validate the bell acknowledgement chain before accepting a begun/completed
  epilogue; truncated proof must yield `save_corrupt` without altering the save.
- **A3-S2 — blocker:** `mobile/authority/local-story/finale-save.ts:195` checks the
  selected Continue sequence without checking its revision relationship to Begin
  and the saved head. In the same real SQLite route, changing Begin's receipt
  revision to `head.revision + 1` still cold-opens successfully at chapter index 1.
  Require valid committed revisions and strict Begin-before-Continue order bounded
  by the head, including bell-end-before-Begin provenance. A receipt from after
  the saved head cannot justify current scene facts.
- **Shared primary finding:** unbound direct Continue still advances `bell_rung`
  and `bell_silenced` under v0.0.17 (`scene/rule.ts:14`,
  `protocol/command.schema.json:552`). Independently reproduced for all five
  ending routes; the primary reviewer owns its finding and fix proof.

## Verification

Focused kernel/SQLite finale tests: 3 passed. Existing real-SQLite faults,
elapsed-resume, story-point and scene tests: 39 passed. Mix missing-child source
and contract schema tests: 70 passed. The two damaged-save probes above reproduced
successful opening rather than the required refusal; source was not modified.

Compiler/loader type-parity concern was disproved: a scene-end assignment outside
the declared memory enum returns `FACT_TYPE_MISMATCH` at the authored assignment.
Reviewed generated schema changes and preserved older fixture files; current
artifact/source hash check passes. No native/browser verification claimed.
Ponytail Review: **Lean already. Ship.** The correctness blockers remain open.

## Scoped fix recheck — 2026-10-05

Reviewed integrated head `05e72a3cb831b9facf50c05b08f54581ce7d0c1c`, source fix
`65ed200630786e324d3b9177e56e2651454462a1`. Verdict: **APPROVE**; A3-S1 and
A3-S2 closed, no open findings. Scope was the fixes, their tests and direct callers.

- A3-S1: the save boundary now requires the selected bell's accepted start, every
  bound Continue assignment, and its actor/context/correlation-bound terminal
  `scene_ended` event before Begin. The missing-bell-receipts SQLite probe refuses
  with `save_corrupt`. Independently deleting that proof block in a disposable
  detached checkout made the finale test fail with `Missing expected exception`.
- A3-S2: `store.load` supplies the saved head; the bell start/acknowledgements,
  Begin and finale acknowledgements must have strictly increasing positive safe
  integer revisions no greater than that head. The future-Begin SQLite probe
  refuses with `save_corrupt`. Independently deleting the revision guard made the
  finale test fail with `Missing expected exception` at that probe.
- The shared primary Continue gap is fixed: schema requires both bindings and the
  scene rule checks them for every modal scene. Current transcript/direct callers
  were updated; only two literal invalid-fixture expected-error lists changed.

Focused scene/finale/bell kernel and SQLite authority tests: 22 passed. Mix
contract fixtures/schema tests: 77 passed. `elixir bin/contracts.exs --check`:
exit 0. Both independent guard mutants exited 1; the disposable checkout was
restored and removed. No change to artifact hashes or allocated-ID fixtures in
the fix. Ponytail Review: **Lean already. Ship.**
