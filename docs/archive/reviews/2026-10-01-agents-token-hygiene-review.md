# Review: agents token hygiene (developer.md, reviewer.md)

PR #87, commit reviewed: `56a61d3`. Config/docs-only slice; no mutation testing (WORKFLOW "Review stance").

Verdict: APPROVE

## Must be true
- The line matches docs/WORKFLOW.md "Token hygiene" (lines 85-90) with no contradiction.
- It points to WORKFLOW and restates only what a spawned agent acts on.
- Placement does not split an existing numbered list or rule.

## Check
- Scratchpad file named for the slice, read exit status, failures and tail, diffs per hunk: all match WORKFLOW. "pre-push output" is a faithful instance of "push run". Return-size limits (250/300) are not restated, so they cannot drift.
- developer.md:33 sits after the numbered handoff list, before the `--no-verify` rule: sensible.
- reviewer.md:30 sits after step 7 and before the findings-format paragraph: sensible.

## Findings
- nit: the line omits "Batch independent tool calls" and "never by tail" for diffs; acceptable, the per-hunk wording covers the latter and batching is a PM concern. No action.
