# Paired job completion invariant — independent review

- Source: `c9a19d5519d3ff6024ccfc144198509f22e7a150`, branch `fix/job-complete-owned-run`.
- Base: `06f6df80`; fresh independent Codex reviewer, authored none of the change.
- Verdict: **APPROVE**. No findings or open review items.

## Governing requirements

[Schedule](../system/mechanics.md),
[the invariant registry](../../protocol/invariants.json),
[delta contract](../../protocol/delta.schema.json),
[C5 pairing](../system/protocol.md#c5-bleed-and-bandage-composition) and
[D9 suppression](../system/protocol.md) require:

1. A completion belongs to its own due `run_job`, outside root writer group 0.
2. Current equal-due round/bleed pairs and population/resume pairs can share a
   group; unrelated deliveries retain their ordinary conflict checks.
3. The observer must accept lawful decisions while refusing root-group and
   beyond-target completions. Save replay and production composition stay intact.

## Correctness and simplicity

`kernel/ts/src/runtime/invariants.ts:102` removes only the unsupported uniqueness
inference. The remaining non-root and due-target comparisons remain unchanged.
`kernel/ts/src/runtime/proposal.ts:249` still selects pending due jobs in canonical
order and constructs each job's own command. Its group assignment at line 276,
`proposal_bleed.ts:9`, and `populationDeadlinePairs` at line 223 explain why
multiple lawful completions can share a group. No producer or composition rule changes.

`kernel/ts/test/job_completion_invariant.test.ts:20` uses the existing controlled
C5 fixture and actual accepted elapsed decisions. Its literal two-completion
answer binds group 1 and due time 65250 to a round and a bleed. Lines 40 and 52
forge the root group and target 65249 independently; they exercise retained guards.
No expected answer is obtained from the invariant under test. The old direct
invariant call sites contain no focused job-completion test; the root-group
simulator control at `kernel/ts/test/sim.test.ts:270` is a broad integration control,
which the repository explicitly excludes from same-layer test redundancy.

The simulator invokes this check for each observation in
`kernel/ts/test/sim.ts:254`; correcting it prevents a lawful pair from becoming a
false simulation failure. `mobile/authority/local-story/receipt-history.ts:37`
still compares complete replayed decisions, including groups, and line 41 compares
final state/revision. This diff changes no save loader, receipt, release pin,
protocol fixture or production decision behavior.

Ponytail Review: lean already; deletion of an invalid quadratic inference is the
smallest fix. The three tests cover three distinct breaks and reuse existing setup.
Correctness review found no further issue.

## Independent verification and limits

`mise exec -- node --test --test-reporter=spec kernel/ts/test/job_completion_invariant.test.ts`
passed **3/3**. In the detached isolated review checkout, each reversible mutation
exited 1 with exactly its corresponding test failing:

- Restore one-completion-per-group: lawful pair fails.
- Remove `writer_group > 0`: forged root-group completion passes incorrectly.
- Remove the due-target comparison: future completion passes incorrectly.

Restored focused suite: **3/3**, exit 0; production source diff clean.

An additional prior non-simulator suite run with the original invariant reached
739 passing tests, but 13 files could not start because this fresh checkout lacks
Mix dependencies needed to compile their content fixtures. The attempted existing
`deer_bleed_recovery.test.ts` also stopped at that compiler setup; its combined run
still passed the three new tests. These attempts do not independently establish the
reported 806-test baseline or SQLite recovery result, and were not repeated.

The developer/PM handoff reports a serialized full gate, 10,003 simulator sequences
and 327,217 steps, plus the accepted/invariant-true/open-recovery 68400 SQLite witness
and four recovery tests. It retains the first concurrent-load ContentServicesTest
60-second timeout. Those broader results were not rerun or independently verified
by this reviewer. No full gate, broad simulator, browser or device claim is made here.
