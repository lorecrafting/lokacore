# Pre-production CI scope — independent review

Reviewed `ops/docs-only-gates` at `0e3f49a1` against `3d51587b`.
Verdict: **CHANGES REQUIRED**.

Requirements derived from the [owner decision](../decisions/owner-decision-preproduction-ci-scope-2026-10-06.md),
[checks](../CHECKS.md) and [review workflow](../WORKFLOW.md): metadata may skip
only after the relevant green ancestor; mobile changes still run the browser;
unknown inputs and API errors run broadly; skipped browser jobs cannot establish
a green baseline; local classification must retain docs/tracker guards. New checks
must fail when their guarded behavior is broken, and the new decision must appear
in the active owner rules.

## Findings

- **CI-S1 — blocker — `bin/docs_only_red_controls.sh:45`.** The fake GitHub command
  ignores the supplied `--jq` expression and returns precomputed counts. Removing
  `.conclusion == "success" and` from the browser predicate in `bin/ci_base.sh:9`
  leaves this suite green (exit 0), including its purported nonpassing-browser
  control at line 53. With real skipped-browser JSON evaluated through the actual
  query, that mutant selects the skipped ancestor and skips browser work on the
  next metadata commit. Make the fixture exercise the supplied filter against
  success, skipped and failed job data, then demonstrate this mutant fails.
- **CI-S2 — should-fix — `docs/decisions/owner-decision-preproduction-ci-scope-2026-10-06.md:9`.**
  The new check-cadence decision is indexed under decisions but has no active line
  in `docs/system/owner-rules.md`, contrary to AGENTS' specification rule. An agent
  following that canonical process index still sees publication after full checks
  at `docs/system/owner-rules.md:207` without the new scoped-lane amendment. Add a
  concise link to the new decision in that existing process rule.

## Independent checks

- `mise exec -- bin/docs_only_red_controls.sh`: exit 0 on the reviewed source.
- The same command with only browser success filtering removed: exit 0 (surviving
  mutant, CI-S1). Mutation restored; source branch untouched.
- Controlled Git repository and actual `jq` evaluation of skipped-browser JSON:
  correct selector returns no base; the mutant selects the parent and its
  metadata-only successor says `skip`.
- Controlled pre-push invocations: metadata selects `--metadata`; code, empty diff
  and unknown base select the full lane. All four pass.
- Workflow inspection: browser has a real job-level skip; relevant-job predicates
  are correct on this head; generated Markdown, code renames and unknown paths
  remain conservative. No current unsafe skip found in those paths.
- Ponytail Review: lean already; no simplification finding.

The developer's full-gate report was supplied as context, not independently rerun.
Hosted execution is still publication evidence to obtain. Both findings remain open.

## Scoped fix recheck — APPROVE

Reviewed fix `596588d4` as integrated at `92b0c864`; limited to CI-S1, CI-S2
and their direct callers. Both findings are closed; no open review findings.

- **CI-S1 closed:** the fake GitHub command now evaluates the actual supplied jq
  predicate over literal successful, skipped and failed job records. The retained
  selector suite passes (exit 0). Independently removing only the browser success
  condition makes the suite fail (exit 1) on both skipped-browser and failed-browser
  controls. Restoring the condition restores green (exit 0).
- **CI-S2 closed:** the Process section of the active owner rules now links the
  pre-production CI scope decision and states the relevant green-ancestor condition.
- Docs check: 682 documents, zero broken links, zero unreachable documents.
  Ponytail recheck: no simplification finding. Source mutations were confined to
  the reviewer checkout and restored; hosted publication evidence remains separate.
