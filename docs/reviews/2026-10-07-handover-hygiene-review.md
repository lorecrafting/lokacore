# Handover hygiene review — PR #292

- PR: [#292](https://github.com/lorecrafting/lokacore/pull/292), branch `chore/handover-hygiene`
- Reviewed: `983d3292` (paraphrase commit on top of `74126853`); independent Opus reviewer
- Governing: [owner decision](../decisions/owner-decision-claude-only-auto-merge-2026-10-07.md),
  [WORKFLOW merge step and review count](../WORKFLOW.md#loop), [owner rules](../system/owner-rules.md),
  [decisions README](../decisions/README.md) (verbatim or marked paraphrased)
- **Verdict: CHANGES REQUIRED** (two small should-fix items; merge needs nothing open)

## Must hold

1. Records keep every meaning of the owner's messages and add no owner decision.
2. No live Codex/Astra/Sol instruction; one-reviewer default, second-opinion triggers,
   owner-reserved and exact-head CI gates unchanged.
3. `--auto` merges only after every CI job is green on the reviewed head.
4. The pre-push skip fires only for a tree a full `check_all.sh` pass saw clean.
5. The export check still refuses drive and machine paths and accepts URLs.
6. `session_status.sh` is read-only and cannot fail a session.

## Findings

**S1 should-fix** `docs/WORKFLOW.md:118`, `docs/decisions/owner-decision-claude-only-auto-merge-2026-10-07.md:21`,
`docs/system/owner-rules.md:233`: they say `main` requires the CI jobs. It does not:
`gh api .../branches/main/protection` returns 404 and `allow_auto_merge` is false. `gh pr merge --help`:
"If required checks have not yet passed, auto-merge will be enabled". If nothing is required,
the PR already meets its requirements and the merge happens at once. Failure: the first
slice merged under this text lands before CI finishes, which breaks step 7 ("every job started
on that head has completed successfully"). The order is in the PR body only. Fix: make the
docs conditional (`--auto` only once `main` requires every CI job, i.e. `changes`, `elixir`, `lint`,
`sim`, `typescript`, `browser`; until then wait for green and merge without `--auto`). If only
some jobs are required, `--auto` fires while an unrequired job is still running.

**S2 should-fix** `docs/system/owner-rules.md:239`: the rewritten Reviews bullet also deleted two
rules that have nothing to do with Codex: "Opus drafts briefs" and "the PM keeps one persistent worktree"
([source](../archive/decisions/owner-decision-review-rules-2026-10-01.md), §PM's persistent
worktree). `WORKFLOW.md:99` still relies on `../lokacore-pm`. Failure: the index of owner rules
no longer lists an in-force owner rule. The owner gave no direction to remove it. Fix: keep a
short clause with its record link.

**Q1 question** `docs/WORKFLOW.md:119` "a later push makes the merge fail": under `--auto`, a push by
a user with write access leaves auto-merge enabled. This review did not verify that the
`--match-head-commit` given when auto-merge is enabled still blocks a later head. If it does not,
a push after the verdict merges unreviewed once the required CI passes. Verify on the first use,
or have the docs say `gh pr merge --disable-auto` before any push after the verdict.

**N1 nit** `docs/ROADMAP.md:24`: the link text still says "Beads Rust pilot".

**N2 nit** `bin/check_all.sh:13`, `.githooks/pre-push:23`: `git status --porcelain` follows
`status.showUntrackedFiles=no` and `assume-unchanged`. With either, the push skips the checks
although the working tree differs (demonstrated below). The hook had the same blind spot before
(it always checked the working tree). `--untracked-files=all` would close the config case.

## Evidence

- Item 1: the paraphrase keeps yes-to-all-three, the merge permission, adapt-useful-Codex-workflow,
  board→Beads Rust plus removal of `loka-board`, and delete Codex sessions/packages plus turn off the app.
  Move-forward: the branch purge, the lean-to-discard rule, lessons first and the delegated
  fixture choice are all kept. Dropped: "do you understand", "10gb", "for repo cleanup". None adds a decision.
- Item 2: no Codex/Astra/Sol/Luna text remains in WORKFLOW, owner-rules, CHECKS, AGENTS or the
  agent prompts, apart from the retirement sentences. The review count and second-opinion triggers are intact
  ("another fresh reviewer"). CI jobs skip via `if:` (a skipped job counts as passing a required check), with no workflow path filter.
- Pre-push stub (the real hook, plus the PR's marker lines in a stub `check_all.sh`, run in a throwaway repo). Skip on
  a clean tree that passed; full run after a new commit, an edited tracked file or an untracked file; no marker after
  `--metadata`, `--no-ts` or a failing run; an amended commit with the same tree skips (correct, same content);
  a linked worktree has its own marker (`.git/worktrees/<n>/`) and reran. Hidden untracked file and assume-unchanged edit: skip (N2).
  Pushing a ref other than HEAD skips, the same class as before.
- Export regex probes: refused `C:\Users\x`, `D:/work`, quoted, after a space, `(`, `,`, `=`, `1`, `_`, `\\?\C:\`,
  `file:///C:/x` and the machine paths; accepted https, http, ftp and `regex:/a/`. Only `pathC:\y` (glued to a word) passes.
  Red: the old regex fails the https control; removing the drive pattern fails the drive control.
- `session_status.sh` in an isolated repo with a copy of `.beads`: exit 0; tracked JSONL unchanged (only
  ignored DB files appear); "gh unavailable" fallback prints. `.claude/settings.json` parses as JSON.
- `mise exec -- bin/check_all.sh` exit 0 (2m21s) and wrote a marker matching `HEAD^{tree}`;
  `elixir bin/check_docs.exs`: 269 docs, 0 broken, 0 unreachable.
