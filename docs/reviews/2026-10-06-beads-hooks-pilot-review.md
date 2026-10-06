# Independent review: Beads Rust Git hook pilot

- Branch: `ops/beads-hooks-pilot`
- Reviewed commit: `2c7a9751`
- Verdict: **APPROVE WITH NOTES**

## Requirements

The owner approved an opt-in import hook for the selected main integration checkout. It must refresh only the local Beads index after Git advances that checkout, preserve unexported local changes, leave issue closure and source gates with the PM, and work the same way for Claude Code and Codex. The before/after record must distinguish observed facts from results pending real merges. The documented lifecycle must close a slice only after its reviewed source reaches `main`.

## Evidence

At the reviewed head, the hook checks the selected checkout's resolved root and `main` branch, skips file checkouts, and leaves Git operations and issue statuses untouched. In disposable repositories with installed `br 0.7.4`, two successive real Beads JSONL generations imported into the selected checkout. With a dirty local index and newer JSONL, the hook preserved the index and printed its recovery instruction. An independent routing red control showed that a wrong checkout kept its newer JSONL under the real hook but imported it when the root comparison was removed. A separate linked worktree at the pre-hook commit, where the helper is absent, was created and removed successfully. Shell syntax, Python compilation and `git diff --check` passed. The documented `br update`, `br close --reason` and `br ready --brief --json` commands are supported by the installed version.

For each real import control, `br update <id> --title ...` generated the newer JSONL, `br --no-auto-import sync --status --json` reported `jsonl_newer: true`, the hook ran `br sync --import-only`, and the next status reported `jsonl_newer: false` with `dirty_count: 0`. For the local-change control, `br --no-auto-flush update <id> --title ...` left `dirty_count: 1`; after newer JSONL arrived, the hook printed the preservation message and both `dirty_count: 1` and `jsonl_newer: true` remained.

## Findings

No open findings. The real worktree creation failure found before the final candidate was fixed by the shell wrappers' helper-presence checks. Actual post-merge latency, operator intervention and viewer freshness remain pending the two source merges named in the comparison record; the record makes no speed claim.

Ponytail Review: **Lean already. Ship.** The two small shell guards and one Python helper use existing Git and Beads commands without a new dependency or abstraction.
