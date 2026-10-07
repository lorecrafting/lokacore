# E3 authority CI scope independent review

**APPROVE** exact source `cb77af0f4884792853ab4cb630b98f3ff5bd65a1`, branch `fix/e3-authority-ci-scope`, against base `37a2af0c`. The reviewer authored none of the source. No open findings. This approval covers the classifier correction and its records; it does not certify E3 or any hosted check.

Requirements were derived from AGENTS.md, the [pre-production CI scope owner decision](../decisions/owner-decision-preproduction-ci-scope-2026-10-06.md), [active owner rules](../system/owner-rules.md), [checks](../CHECKS.md), [workflow](../WORKFLOW.md), and [evidence lessons](../lessons/evidence.md). Save changes retain the broad code lane, app-only changes may skip it, browser checks remain active for both, and native work remains paused.

## Verification

- Independent `mise exec -- sh bin/docs_only_red_controls.sh`: exit 0. Existing metadata/app/browser, mixed-source, generated-Markdown, rename, missing/nonancestor/empty-base and API-error cases pass alongside the new authority case.
- Independent red control temporarily restored the base classifier and base controls in the review checkout: the old suite passed (exit 0). Restoring only the new controls against the old classifier failed (exit 1), with `FAIL ci_scope local-story save change runs code: want run, got skip`. Restoring the corrected classifier passed (exit 0). Source and controls were restored byte-for-byte before recording this review.
- Independent controlled pre-push execution used a disposable Git repository and a check-line stub reporting the selected lane. An actual `mobile/view.tsx` commit selected `--metadata`; an actual nested `mobile/authority/local-story/nested/store.ts` commit selected the full line. Both hook executions exited 0. These probes verify selection, not execution of the broad engine suite.
- `sh -n bin/ci_scope.sh bin/docs_only_red_controls.sh .githooks/pre-push`: exit 0. `git diff --check`: exit 0.
- Inspected both hosted workflow consumers: code jobs use `ci_scope.sh` with the code lane; the Book workflow uses the browser lane. The exclusion applies only to the code-lane mobile exception, so authority edits select broad code jobs and continue to select browser work. The existing conservative missing-base/API behavior is unchanged.

## Correctness, scope and simplicity

The single classifier predicate excludes the whole local-story directory, including nested code, from the app exception. It preserves the established Markdown metadata rule and uses the existing conservative changed-file/ancestry logic. The new planted save-file comparison catches a specific unsafe skip the prior controls missed, with a literal expected lane independent of the classifier. The owner record clarification follows its existing save rule and is linked from active owner rules and CHECKS; it introduces no new native lane or reduced chapter gate.

The evidence amendment attributes the prior broad-mobile behavior as historical and records the correction separately. Its red/green claim was independently reproduced. No new private device identifiers or private home/scratch/worktree paths appear in the diff. The amendment is a prose audit summary, not retained raw output, and makes no new timing claim.

Ponytail Review: Lean already. Ship. One predicate and controlled case reuse existing tools; no dependency, parallel classifier, configuration or abstraction was added. Correctness self-review found no in-scope failure.

## Limits

No source branch changes or publication were performed. This focused review did not run full Elixir, kernel, simulator or browser suites; those jobs remain the exact-head publication gate where selected. Native checks remain paused. E3 and final chapter certification remain separate and pending.
