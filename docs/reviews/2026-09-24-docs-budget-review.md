# Review: docs budget (PR #3)

- PR: [#3](https://github.com/lorecrafting/lokacore/pull/3), branch `docs-budget`
- Commit reviewed: `910b6a6`
- Reviewer: fresh Opus agent, authored none of the work. Docs/tooling slice, short review.
- Verdict: **APPROVE WITH NOTES**

## What must be true (written before reading the diff)

1. CI fails when AGENTS.md exceeds the budget, and the run points to the fix.
2. A red control proves the check fails on a planted violation.
3. The red control can never leave AGENTS.md modified, even when it is interrupted or fails.
4. The budget leaves headroom now but binds before AGENTS.md becomes a catch-all.
5. The new rule and gate step don't contradict AGENTS.md or docs/WORKFLOW.md and add no
   new ceremony (no new agent, config knob or schedule).

## Evidence

- `mise exec -- elixir bin/check_docs.exs`: 51 docs, 0 broken, 0 unreachable, exit 0.
- `mise exec -- elixir bin/red_controls.exs`: all five controls `ok`, including
  `docs: AGENTS.md over its word budget`; exit 0; worktree clean afterwards.
- CI runs both scripts (`.github/workflows/ci.yml:37-38`).
- Interrupting the red control: SIGTERM while AGENTS.md was padded left the file restored.
  **SIGKILL left AGENTS.md modified** (`M AGENTS.md`, 4,951 words: 3,000 × "padding"
  appended). Ctrl-C followed by `a` in the BEAM break menu also halts the VM without
  running `after`.
- Budget: AGENTS.md is 1,951 words (about 2.5k tokens), so 2,500 leaves about 28% headroom.
  That is room for several lessons, but it still binds before the file doubles. Sensible.

## Findings

1. **should-fix** `bin/red_controls.exs:65-74`. The red control rewrites the tracked
   AGENTS.md, and `try/after` only restores it when the script ends normally or raises. A
   hard kill (SIGKILL, a CI timeout, BEAM break-menu abort, a laptop sleep that kills the
   session) during the roughly one-second `check_docs` run leaves 3,000 "padding" words in
   AGENTS.md. The next agent then loads a padded AGENTS.md, and `git commit -a` could commit
   it. The owner's requirement was that this can't happen. Fix without touching the tracked
   file: let `check_docs.exs` take the budgeted file from an optional argument, defaulting
   to AGENTS.md (for example `System.argv()`), and have the red control pad a copy in
   `System.tmp_dir!()` and pass its path. That is about two lines. The default path stays
   covered by the green CI run.
2. **nit** `AGENTS.md:183`. "2,500 words" is also stated in `bin/check_docs.exs:56`, so
   the new one-fact-one-place rule is broken in the same PR. If the budget changes, the
   prose will drift. The failure message already prints the budget, so the AGENTS.md line
   can say "within its word budget".
3. **nit** `bin/red_controls.exs:78`. The control only checks that the output contains
   "budget". That matches, but "over its word budget" or the `"AGENTS.md is "` prefix
   would be as specific as the other controls' expected strings.

No contradictions found. The one-fact rule fits the existing reachability and link rules,
and the gate tidy pass excludes `docs/spec/` (amendment-only) and the history records,
which matches WORKFLOW.md. It adds no agent, schedule or config knob.
