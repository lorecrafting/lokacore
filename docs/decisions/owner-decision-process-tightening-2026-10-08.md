# Owner decision: process tightening (self-review, mutants, retro) — 2026-10-08

Same day as [agent models and tooling](owner-decision-agent-tooling-2026-10-08.md); that record is not repeated.

## Self-review

(paraphrased) One self-review pass, `/code-review medium`. It replaces the earlier same-day "keep both"
and drops the separate `/ponytail-review`: Ponytail mode is active while the developer writes.
The Ponytail writing rule and the reviewer's over-engineering item stay. The reviewer checks that the
PR description reports the `/code-review` result; missing is a nit, run in the fix round.
Effect: [AGENTS.md Simplicity](../../AGENTS.md#simplicity-every-change-every-agent),
[developer](../../.claude/agents/developer.md), [reviewer](../../.claude/agents/reviewer.md).

## Efficient mutant sweeps

(paraphrased) Mutant sweeps run through `bin/mutate.sh` (save a copy, apply, test, restore from the
copy, one summary table, non-zero if a restore leaves a diff). Run each mutant against the test files
that import the mutated module first, the full suite only for survivors. Long commands run with
`run_in_background` and the agent waits for the completion notice, with no sleep or poll loops. An agent
past about 220k tokens hands remaining work to a fresh agent with a short brief.

(paraphrased) Long mutant runs only before a product release, and always announced to the owner first.
Full-suite sweeps therefore run only at release-candidate certification and the E3 gate on that same
candidate (E2's planted-defect claim is done). Everywhere else: a red control on the new test and an
"already caught?" triage against the test files that import the mutated module; reviewers sample 2-3
narrow mutants. Schema fixture sweeps stay (they rerun fixtures only). An agent that expects a run over
about 10 minutes (full-suite mutants, the 10,000-sequence simulator) stops and asks the PM, who tells
the owner before it starts. Effect: [WORKFLOW token hygiene](../WORKFLOW.md#token-hygiene),
[check lessons](../lessons/checks.md).

## Retro and housekeeping queue

(paraphrased) A retro at every handoff point, not only at session end: whenever the PM writes the
continuation handoff, it also writes up to 5 evidence-backed improvement candidates as Beads issues
labeled `housekeeping`. No scheduled weekly routine (the owner's weekly limits vary); a pattern retro
at each milestone gate instead (E3, release-candidate certification, release). The retro process and
the reminders go in the workflow and run automatically: `bin/session_status.sh` prints the open queue,
a "before you clear" reminder and a missed-retro note. Effect:
[Retro and housekeeping queue](../WORKFLOW.md#retro-and-housekeeping-queue).

## Claims, nit fixes, briefs and PR citations

(paraphrased) A "catches", "only here" or "every" claim and a `file:line` cite are backed by a check run
in the same turn and listed in the PR body; reviewers rerun two. Comment- or doc-only nit fixes are
verified by the PM without a re-review agent. Briefs are stored durably when drafted and link process
rules instead of copying them. Whenever a PR number is cited to the owner, its Beads issue and a short
description are cited too. Effect: [developer](../../.claude/agents/developer.md),
[reviewer](../../.claude/agents/reviewer.md), [workflow loop](../WORKFLOW.md#loop),
[token hygiene](../WORKFLOW.md#token-hygiene).

## Review records without an index

(paraphrased) Delete the review index and let the docs check find records in `docs/reviews`
(chosen over landing records on the housekeeping branch). `docs/reviews/README.md` keeps only a
static description; `bin/check_docs.exs` treats each record as reachable and checks its name.
Effect: [review records](../reviews/README.md), [CHECKS](../CHECKS.md),
[reviewer](../../.claude/agents/reviewer.md).
