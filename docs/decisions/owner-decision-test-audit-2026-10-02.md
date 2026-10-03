# Owner decision: test audit trim, CI-only 10k simulator run, dot reporter — 2026-10-02

Relayed by the PM (Claude Code), **(paraphrased)**: the wording is smoothed, not quoted. No checker
can verify it against the chat.

An audit of the whole test suite (`test-audit.md`, r78, outside this repository) tested the claim
that unit tests lock in slop, slow agents and waste tokens. It found the suite mostly sound: 92 to 96
percent of cases are contract or behavior tests. Two causes dominate cost: the simulator's 10,000
fresh sequences (about 100 of the 191 seconds of `bin/check_all.sh`) and the test reporter's output
(about 40 KB per run of both TypeScript suites). The owner said yes to all three recommendations:

- **Trim.** Delete the cases the audit proved dead or duplicate (about 315 lines; each proved with a
  real mutant that another test still catches), and add four rules to AGENTS.md "Writing tests":
  the mutant a header names must fail the test; one test per break per layer; no test of logic the
  test defines itself; storage faults keyed by operation, not SQL text.
- **Simulator.** The 10,000 fresh sequences run only in CI (`CI` set). Locally (`npm test`,
  `bin/check_all.sh`, pre-push) a small count runs; regression seeds run everywhere.
- **Reporter.** `node --test` uses the dot reporter in the agent-facing check line; failures still
  print in full.

Out of scope, left open: the audit's "should be rewritten" sites, its optional items, the
`faults.test.ts` seed count and the shared test-support restructure.

Effect: [AGENTS.md](../../AGENTS.md) Writing tests; [CHECKS](../CHECKS.md) simulator and reporter lines.
