# C2 simulator invariant coverage — scoped independent review

**Verdict: APPROVE.** Source `05bed5bee4c60745df2f320d73df126399a1128a`;
exact evidence/head `f1b5fa495a7ac079ccdd4f87e9a32df67f076d47`, branch
`fix/c2-sim-invariant-coverage`; base `6143fb74303b5dda9b8826ba1d15db2cef5288dc`.
Fresh independent review of this fix; reviewer authored none of its source or evidence.

Governing requirement: [per-step invariant coverage](../system/protocol.md#invariants).
Every registered portable delta invariant must be checked per simulator step even
when its operation family is absent from the frozen demo. Dedicated chapter/literal
fixtures retain responsibility for actual patrol transitions.

No findings. The only executable change adds `patrol_transitions_hold` to
`CHECKED.step`; the existing runner passes its state/delta/result observation to
that check. The adjacent comment is compacted without raising the source budget.
The spec precedes source. The evidence successor changes only docs/evidence;
no gameplay, frozen/demo artifact, regression seed, generator17 or release pin
changes occur anywhere in the reviewed diff.

Independent pinned-mise verification:

- Unmodified exact base: existing `every registered invariant` test fails at
  `kernel/ts/test/sim.test.ts:135` with missing `patrol_transitions_hold`, exit1.
- Disposable detached exact-head worktree: actually delete the entry; same test
  fails, exit1. Restore exactly; same test passes1/1, exit0, with empty source diff.
- Exact head: `node --test kernel/ts/test/sim.test.ts kernel/ts/test/patrol.test.ts kernel/ts/test/patrol_contracts.test.ts` passes **26/26**, exit0, including500 fresh simulator sequences and existing planted controls.
- Retained evidence manifest verifies in full, exit0; baseline/deletion/restored
  logs and stated counts agree with the independent reproduction.

**Ponytail Review:** lean already; one entry in the existing inventory, no new
checker or duplicate test. Normal review-record hook validates links. No source
edit, push or merge is included. Accumulated publication checks remain separate.
