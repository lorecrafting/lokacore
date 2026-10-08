# Review: merge gate on GitHub required checks (loka-0a4)

- PR #315, branch `chore/merge-via-required-checks`, head `24f195d559c38d5777fc6f38e8ec8a2fcf8d0fe8`, base `81fc17c2`.
- Reviewer: fresh independent Opus. Process/CI slice, proportionate review, no app-code mutation sweep.
- Governing: [WORKFLOW step 7](../WORKFLOW.md#loop), [CHECKS](../CHECKS.md), the brief, owner decision 2026-10-08 (paraphrased): branch protection with required checks and auto-merge, admin backdoor for quick pre-production work.

## Must be true (written before the diff)

1. Each gate reports even when a need fails (`if: always()`), fails on any `failure`/`cancelled` (timeouts included), fails when `changes` skipped (draft), passes when scoped jobs skip.
2. Arming auto-merge after the verdict lands only the reviewed head; a later push cannot merge unreviewed code.
3. The backdoor is bounded: never unreviewed code, never past a red check.
4. No dangling references to the queue or guard; the remaining red controls still test something.
5. Docs say protection (both checks required, `enforce_admins` off) must be applied right after merge.

## Verdict: CHANGES REQUIRED

## Findings

1. **blocker**, `docs/WORKFLOW.md:119` and `docs/decisions/owner-decision-required-checks-merge-2026-10-08.md:13`: "a later push invalidates it" is unproven. GitHub's auto-merge docs say: "Auto-merge is disabled if someone without write permissions pushes new changes". A push by someone with write access (every agent here) leaves it armed. The GraphQL `expectedHeadOid` description ("The expected head OID of the pull request.") does not say it is checked again at merge time. Scenario: the verdict lands on `A`, the PM arms auto-merge, the developer pushes fix `B` before re-review, and GitHub merges `B` when its gates go green. The deleted script refused that case. Fix: prove the claim on a throwaway PR, or add a rule to disarm auto-merge (`--disable-auto`) before any push after arming, re-arming on the new head after re-review.
2. **should-fix**, `docs/WORKFLOW.md:117-125`, the decision record "Effect": item 5 is missing. Nothing says protection must be applied right after merge with `ci-green` and `book-e2e-green` required, `enforce_admins` false and repository auto-merge allowed. Scenario: the next PR follows step 7 before protection exists. `--auto` on a clean PR then either merges immediately without waiting for CI or errors out. "Branch protection does not bind admins" (`:123`) is true only while `enforce_admins` is off. Fix: state the setting and the order in step 7 or in the decision record.
3. **nit**, `docs/decisions/owner-decision-claude-only-auto-merge-2026-10-07.md:24` still says "`main` has no required checks". The record is superseded and linked from the new one, so this is acceptable as history. A "superseded by" pointer would help.

## Verified, no finding

- Gate expression (`ci.yml:159-166`, `book-e2e.yml:86-94`): the gate passes when everything succeeds or skipped by scope. It fails when any need has `failure` or `cancelled` (a timed-out job reports one of those, so it fails either way) and when `changes` is not `success` (draft). With `if: always()` the gate still reports when a need fails. A gate that times out or is cancelled is not a success, so it blocks. `needs` lists every job in each workflow. Both workflows run on every PR event type (no path filters). `bin/ci_base.sh` selects jobs by name, so the gates do not change it.
- What is lost: the automatic rerun of a cancelled run. This is stated in `docs/lessons/checks.md:28-29` and in WORKFLOW `:121`. A workflow that has not registered yet now shows as an expected required check, which is equivalent to the old two-`changes` wait.
- Backdoor (`WORKFLOW.md:123-125`, `owner-rules.md:192-196`): bounded by "never for unreviewed code or to bypass a red check".
- No `merge_queue`/`guard_merge` references outside the archive, reviews and Beads. `bin/integration_red_controls.sh` at the head exits 0 and still holds the integrate_batch cases. It still runs from `ci.yml:92` and `check_all.sh:37`.
- Open item for the PM, not a repository finding: the memory index still says "never `--auto`".

## Fix round 1 at `e99ee343`: APPROVE WITH NOTES

Scope: only the dispositions and the text they touched (`docs/WORKFLOW.md:117-136`, the decision record "Effect", the claude-only record `:26`).

- Blocker 1 **fixed**. The invalidation claim is gone. `WORKFLOW.md:117-128` now states that GitHub keeps auto-merge armed after a later push. It allows only the PM to arm, and only after the final APPROVE or APPROVE WITH NOTES on the exact head. Once armed, only the PM's post-verdict commits may land; any other push first runs `--disable-auto`, goes back to the reviewer and is re-armed after the new verdict. The decision record says the same. This is a prose rule nothing enforces, which the owner chose by deleting the guard.
- Should-fix 2 **fixed**. `WORKFLOW.md:130-136` and the record now have the one-time setup: protection on `main` requiring `ci-green` and `book-e2e-green`, `enforce_admins` off and auto-merge allowed, applied right after this PR and before the next merge. The backdoor is tied to `enforce_admins` off.
- Nit 3 **fixed**. The superseded pointer is at `owner-decision-claude-only-auto-merge-2026-10-07.md:26`.
- New nit, `WORKFLOW.md:121-123`: the step no longer says what happens to an armed auto-merge after a PM post-verdict commit moves the head away from `--match-head-commit <sha>`. GitHub then either merges the new head or leaves auto-merge stuck. Neither is unsafe, but a stuck PR would wait silently. One clause would cover it: re-arm on the new head if it does not merge.
