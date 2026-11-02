# Review: trace refused replay, PR #580 (loka-vduxr.41)

- PR [#580](https://github.com/lorecrafting/lokacore/pull/580) `fix/trace-refused-replay` at `0d5fee86112732a48036fcd422f4a2960bcb6593`.
- Governing: [ADR-075 §4](../archive/decisions/adr-075-observability-proposal.md) (commit matrix, Derived never authority, the 2026-11-01 amendment); [cartridge.md](../system/cartridge.md) (Transcript coverage, Rule explainer).
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): ci, book-e2e, graph-diff completed, success.
- `/code-review` is reported in the PR body (two runs). `bin/mutate_diff.sh` was not run, per the brief. Six targeted mutants are listed below.
- Verdict: **CHANGES REQUIRED**.

## Must be true (written before the diff)

1. A refusal replays as recorded under both §4 rows: host `committed` (empty events, revision unchanged) and terminal `unavailable`.
2. The decision is still recomputed. A recorded rejection the kernel now accepts, or the reverse, still differs.
3. Replay, coverage and Why share one definition, and it carries coalesced-tick revisions (#578).
4. No `kernel_api` bump, no cartridge hash change, no fixture regenerated.
5. Each changed path has a test that goes red without the change.

## Checks that held

- (1)(3) Real host trace (elapsedHost: coalesced ticks, three refusals, moves, a refused talk). `main --replay` reports 12 identical, coverage exits 0, and Why is correct at every ordinal. Real terminal trace (`unavailable`, three refusals): the same. At origin/main the host trace differs at ordinal 2.
- (2) Six one-edit forgeries (rejection now accepted, acceptance now refused, events planted on a receipt, another error code, a rejection rewritten to `unavailable`, an acceptance rewritten to `unavailable`). Replay, coverage and Why each reject every one. Reading the recorded state hides no divergence.
- (4) Diff stat: no protocol, fixture or manifest file.
- Mutants on `run.ts`, all killed: drop the state read (2 red), receipt `revision + 1` (2 red), drop the `rejected` guard (transcripts red), drop `at` in `replayEntry` (coalesce red).
- The ADR amendment's wording is consistent with the §4 table.
- Agree with loka-vduxr.42: replay cannot reproduce an uncontrolled storage failure.
- PR claims rerun:
  - The `decideReplay` caller list holds.
  - "No test goes red without it [why.ts]" holds, but its reason ("never prints") is refuted below.

## Findings

**blocker** `kernel/ts/play/why.ts:104`: the fix has no red test, and the PR's reason for skipping one is wrong.

- Mutant: change the line back to `decideReplay(r, e.data.command)`. why, coverage, transcripts, trace_refused, live and todo all stay green (17/17, 10/10).
- The revision does reach Why's output. A dream choose payload carries the host's `dream.expected_revision`. `compose_choice.ts` checks it against the `opened_revision` that the walk stamped.
- Failure scenario, a real host trace: the dream fixture with `real_elapsed`, idle ticks between `rent_room`, `move`, `rest`, three `dream_next` and `choose`. Coverage passes. Why at ordinal 14 prints `outcome: rejected` with exit 0, but the host recorded `choice_resolved`.
- Fix: one test that runs Why on that trace and expects `choice_resolved` at the choose.

**nit** `kernel/ts/play/why.ts:85`: equivalent to the old code. The explained step's decision does not depend on the receipt form or on `at` for a non-elapsed step, and the mutant gives the same output. Keep it for uniformity; no test is needed.
