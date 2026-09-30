# Review: five pstack rules (handback fields, timebox, fix restatement, two-strike, CI flake, lesson filter)

- PR: #61 (`docs-pstack-rules`)
- Commit reviewed: `42acddb`
- Reviewer: `reviewer` subagent (Opus), independent; docs-only slice, short review, no mutation testing.
- Verdict: **APPROVE WITH NOTES**

## What must be true (from the brief, before reading the diff)

1. Each new rule is stated once across `docs/WORKFLOW.md` and `.claude/agents/developer.md`
   (AGENTS.md: each fact in one place).
2. Nothing contradicts existing text: 250/300-word rules-shaped returns, never force-push /
   never `--no-verify`, at most two fix rounds then the owner, merge rules, reviewer independence.
3. The CI flake rule cannot justify merging over a red check or weaken "every CI job started
   on the head has finished green".
4. The lesson filter agrees with AGENTS.md "Hard-won lessons" and `docs/lessons/`.
5. PM triage of codex findings is not adopted.

## Checks run

- `elixir bin/check_docs.exs` at `42acddb` in a detached worktree: 148 docs, 0 broken, 0 unreachable.
- Grepped AGENTS.md, WORKFLOW, agent definitions, `docs/lessons/`, `docs/CHECKS.md` for
  rebase, flake, timebox, fix-round and lesson rules.
- Items 3, 4, 5 hold: the flake rule only says rerun and diagnose; the merge rule
  (`docs/WORKFLOW.md:63-65`) is unchanged and still requires green. The lesson filter is
  stricter than, and consistent with, AGENTS.md:45 and the gate tidy pass
  (`docs/WORKFLOW.md:87-88`, "now enforced by a check"). No codex-triage text added.
  Word caps and reviewer independence untouched.

## Findings

1. **should-fix** `docs/WORKFLOW.md:103`: "check for a stale base (rebase)". The PR branch is
   already pushed, so rebasing it on `main` needs a force-push, which `docs/WORKFLOW.md:55` and
   `.claude/agents/developer.md:32,34` forbid. Scenario: CI fails in untouched code; the developer
   runs `git rebase origin/main`, the push is rejected as non-fast-forward, and the only way on is
   the forbidden force-push (or a hook bypass). Fix: "update the branch from `main` (merge, not
   rebase)".
2. **should-fix** `.claude/agents/developer.md:36-37`: "test that before a third try" sits
   under the review-findings paragraph, so "fix attempt" reads as a fix round; a third round
   contradicts "At most two fix rounds; anything still open goes to the owner"
   (`docs/WORKFLOW.md:61-62`). Scenario: a finding survives rounds 1 and 2; the developer, following
   this line, pushes a third fix instead of the PM taking it to the owner. Fix: scope it to attempts
   within one round, or say that after round 2 it goes to the PM for the owner.
3. **nit** `docs/WORKFLOW.md:36` and `.claude/agents/developer.md:28-29`: the timebox stop rule is
   stated in both files; keep the stop rule in developer.md and the "brief has a timebox" item in WORKFLOW.
4. **nit** `docs/WORKFLOW.md:42-44` vs `.claude/agents/developer.md:27-28`: the handback field
   list is duplicated (pre-existing) and now diverges: WORKFLOW says "commands actually run with
   output", developer.md "the commands you actually ran". Keep one list, link from the other.
5. **nit** `docs/WORKFLOW.md:53-54`: the inserted sentence leaves "It runs `git pull --rebase`"
   with "a resumed agent" as nearest antecedent; say "The developer runs". Also
   `.claude/agents/developer.md:29` and `docs/WORKFLOW.md:54` were not reflowed.

## Open items

Findings 1 and 2 for the developer; nits at the developer's discretion.
