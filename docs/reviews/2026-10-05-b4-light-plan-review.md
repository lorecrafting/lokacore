# B4 useful light — independent plan review

**Verdict: APPROVE.** Local planning head `dbae3bb8f7fe79cc32570d5953e1861ffc1dceac`
against provisional B3 base `340025a0ef5d3644e84ac23634b74dfa6d20d459`.
Fresh reviewer; authored none of the plan. Docs-only approval, not implementation
or publication proof.

Requirements derived before the diff: the first light consumer must remain optional;
[composition](../system/architecture.md#building-mechanics-by-composition) must add only
the missing typed fuel history; [recovery](../decisions/pm-decision-legend-mechanics-reconciliation-2026-10-04.md#reachable-death-recovery-and-reading)
must not depend on lost gear; cartridge tuning and exact B3 identities remain owned
by content; portable composition and historical save reconciliation need independent
literal proof.

No findings. The [selected mechanics](../system/mechanics.md#b4-light-and-darkness-selected-contract)
settle the prior burn interval, preserve custody-independent history and atomically
conserve refill supply. The [wire contract](../system/protocol.md#b4-fuel-composition)
requires exact prior rows and both-kernel fixtures/differentials. The
[save contract](../system/save.md#b4-fuel-and-dark-recovery) binds historical clock,
participants and custody, with cold-reopen, real COMMIT faults and retry acceptance.
Darkness shares projection/admission checks, retains public egress and exempts only
owned corpses with ordinary lid/load checks. Book offers require confirmed supply.

The [brief](../briefs/chapter-one/b4-light-fuel-recovery-brief-2026-10-05.md)
correctly labels B3 pins provisional and requires incorporating its review fixes
before independently re-pinning the actual build base; later B3 fix merge `9c7e537`
does not invalidate that obligation. Fuel tuning stays in the cartridge. Ponytail
Review: lean scope; no liquid framework, new supply route or replacement gear.

Validation: reviewed all ten changed documentation files, governing workflow,
composition/recovery clauses and relevant lessons. No runtime tests or mutations
for this docs-only plan; implementation acceptance remains outstanding.
