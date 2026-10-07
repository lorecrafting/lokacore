# E1 bounded recorder independent review

**CHANGES REQUIRED** at source `8d2841d92e605cdf2be2895138de62bf24d0e7d2`, branch `slice/chapter-one-e1-r9-certification`, against published `5102a9500179a8d9ce633e69c1ed13df73115af7`. The reviewer authored none of the source. This is a recorder checkpoint review; E1 certification remains pending.

## Required behavior

Derived before reading the diff from the [active E1 proof policy](../system/architecture.md#e1-exact-candidate-proof-policy), [E1 brief](../briefs/chapter-one/chapter-one-e1-r9-certification-brief-2026-10-05.md), [storage lessons](../lessons/storage.md), and [workflow](../WORKFLOW.md): the fixed recorder must use the real authority and SQLite; record five fresh terminal variants with literal answers; observe thirty adopted days at every hourly commit with invariant, clock, RNG, population and provenance checks; retain real fault/reopen/retry evidence; replay against the exact candidate and source; and refuse certification while obligations remain incomplete.

## Open finding

**E1-R1 — should-fix — `kernel/ts/test/e1_world.ts:77–101`.** The horizon observer requires clocks to increase, sees 720 elapsed commits, and checks the final clock, but never requires commit *n* to have clock `64800 + 3600*n`. A split hour that adds one nonhourly commit and a later skipped hourly boundary could satisfy the count and final-clock assertions; the destination check runs only when the clock happens to be divisible by 3600. Thus the retained case would claim 720 hourly boundaries without observing each required boundary. Assert the literal expected clock at every elapsed commit, then retain the count/final assertions. Update the evidence claim after the corrected case runs.

## Verification and limits

- Baseline focused `e1_cases.test.ts`: pass. In a throwaway detached worktree, removed the replay fault-schedule checks: the focused test failed, as required; mutation restored. The existing controlled fault test therefore detects that specific realistic regression.
- Read the source diff, five ending recipes, thirty-day observer, real SQLite full/failed/lost recipes, recorder and semantic replay. Fault recipes check durable receipts, cold reopen, duplicate replay, changed-intent conflict and unchanged memory before resolution. Replay is explicitly semantic; it does not claim to re-execute storage faults.
- Ponytail Review: Lean already. Ship after E1-R1. No new dependency or speculative abstraction found in this bounded checkpoint.
- Current case CLI exits 2, has no certification verdict, and leaves 648 authored obligations pending. This review does not close remaining path coverage, final candidate pin, selected 10,000 sequences, E2/E3 browser proof or the independent final gate.
