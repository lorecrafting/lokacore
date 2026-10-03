# Review: owner decision on review tools (`/code-review`, advisor) — 2026-10-02

PR #121 (`workflow-code-review`), commit reviewed `f610b09`. Docs only; no tests to break.

**Verdict: APPROVE WITH NOTES**

## Must be true (written before reading the diff)

1. WORKFLOW step 3, developer.md step 2 and the decision record give the same rule: run `/code-review medium` only when the diff changes code or bulk-edits docs, always on a named target (PR number or branch), by hand otherwise.
2. The advisor and reviewer parts change no other workflow text (reviewers unchanged).
3. Evidence for #116, #118, #119 matches the PR records.
4. No live doc still makes `/code-review` unconditional.

## Checks

- Evidence: #116 body "`/code-review medium`: 2 findings, both fixed in 89e3ba7"; #119 body finding 4, relink script rewrote bracketed non-links, fixed in 9dfedd8; #118 body "the skill reviewed the wrong diff". All match. "Found nothing on tiny diffs" names no PR; not checked.
- `git grep -i code-review` outside `docs/archive` and review records: only the four changed files. No live doc says always.
- Index line in `docs/decisions/README.md:92` matches the record title.

## Findings

- **should-fix F-1** `docs/decisions/owner-decision-review-tools-2026-10-02.md:8`: "Skip it on a tiny diff" contradicts `docs/WORKFLOW.md:55` and `.claude/agents/developer.md:27-29`, which run it on any diff that changes code. Scenario: a 3-line code fix; WORKFLOW says run, the record says skip. The brief's rule ("only on a diff that changes code or bulk-edits docs") matches WORKFLOW. Fix: change the record to "Skip it on docs-only notes", or add "tiny" to both rule sites.
- **nit N-1** `docs/WORKFLOW.md:55`, `.claude/agents/developer.md:27`: "on the PR number" at self-review, but the PR is opened after it (WORKFLOW:58, developer.md step 3). Only the branch is available then; harmless, the branch option covers it.
- **nit N-2** `.claude/agents/developer.md:27-29` restates the condition with no link to the record, while WORKFLOW links it. The restatement is the existing pattern for the agent file; a link would let a later change touch one source.

## Fix round 1: `35ae38e`

**Verdict: APPROVE**

- F-1 closed: `docs/WORKFLOW.md:55` and `.claude/agents/developer.md:28` now say "non-tiny diff". This matches the record's "Skip it on a tiny diff and on docs-only notes".
- N-1 closed: all three docs now name "the branch" as the target.
- N-2 closed: `.claude/agents/developer.md:29` links the record. The relative path `../../docs/decisions/...` resolves.
