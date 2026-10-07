# Push keepalive lesson review

- PR #296, branch `docs/push-keepalive-lesson`, exact head `6d7d3f77ab0838418b871f22752cd00a16bb9412`, CI green.
- Scope: docs-only, one bullet in `docs/lessons/checks.md`; no mutation testing.
- Governing: [AGENTS.md Hard-won lessons](../../AGENTS.md#hard-won-lessons), [WORKFLOW step 7](../WORKFLOW.md).
- Verdict: **APPROVE WITH NOTES**.

## Must be true

1. Facts match git and the repo: pre-push runs after the remote connection opens; the hook runs `bin/check_all.sh`.
2. Each fact lives in one place in `docs/`.
3. It changes a future decision, survives code drift, and no check could enforce it instead.
4. Short, in the style of neighbouring bullets; no local paths or device identifiers.

## Checks

- Accuracy: `git push` reads the ref advertisement over SSH, then runs pre-push, then sends the pack, so the connection idles during the hook. Exit 141 = 128 + SIGPIPE (13). `.githooks/pre-push:26-27` execs `bin/check_all.sh`. ExUnit default test timeout is 60 s. Correct.
- Duplication: `ServerAlive`, `SIGPIPE`, `141`, `load average` appear nowhere else in `docs/`, `AGENTS.md`, `bin/` or `.githooks/` (reviews excluded).
- Check instead of lesson: a hook cannot change the already-open SSH session, and repo `core.sshCommand` is not versioned. A lesson is the right tool.
- Privacy: no paths, serials or host names; "the M1" is a hardware class only.

## Findings

- N1 nit `docs/lessons/checks.md:20-26`: 7 lines with two unrelated facts (SSH keepalive; load-induced ExUnit timeouts), against 3–5-line neighbours and the 2–4-line target. Scenario: a reader looking for the timeout fact skims past an SSH bullet. Split into two bullets or trim (for example, drop "after green checks" and "on the M1").
- N2 nit `docs/lessons/checks.md:22`: bare "PR #288" where each neighbour cites a permalink to a review or evidence record. Acceptable as is; a link would match the style.

Nothing blocks merge.
