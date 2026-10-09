# Beads Rust operations

Policy (who writes, labels, closure) is in the [workflow](WORKFLOW.md#beads-rust); this page is
the operations manual.

Install `br` (version 0.7.4) with
`brew tap dicklesworthstone/tap && brew install dicklesworthstone/tap/br`,
then use `br ready --brief --json`,
`br show <id> --json` and `br blocked --json`. Install the optional viewer with
`brew install dicklesworthstone/tap/bv`; run `bv` from a checkout with current
`.beads` data, then press `b` for the board or `g` for the dependency graph.
`bv` views the data on that checkout's branch, so use the main integration
checkout for the latest merged status. From another checkout, set
`LOKA_INTEGRATION_CHECKOUT` to the main integration checkout directory and run
`bv --db "$LOKA_INTEGRATION_CHECKOUT/.beads"`. This is read-only; it does not
change the branch or move tracker data. Agents can add `--robot-triage`; human
readers can use
the interactive board and graph. `br` mutates local
SQLite and exports Git-tracked JSONL. Beads Rust 0.7.4 auto-flushes mutations
and auto-imports newer JSONL on commands by default; use `br sync --status --json`
to inspect drift, `br sync --import-only` to recover an out-of-date index, and
`br sync --flush-only` before a tracker commit if the index is dirty. Review the JSONL diff
and verify it contains no local machine path; the installed release writes
`source_repo_path` on creation: create issues with `bin/br_create.sh <br create arguments>`,
which clears it, or clear it with `br update <id> --source-repo lokacore --source-repo-path ''`.
Avoid `-wisp-` in an issue ID: Beads Rust reserves it for ephemeral records,
even when the task itself is durable.

The [hook comparison](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-06-beads-hooks-pilot.md) set up repo-owned
`post-merge` and `post-checkout` imports only in the main integration checkout.
After `git config core.hooksPath .githooks`, opt in there with
`git config --local loka.beads.integrationRoot "$(pwd -P)"`; remove that setting
with `git config --local --unset loka.beads.integrationRoot`. The hook checks for
unexported local changes before importing and never stages, commits, pushes or
closes an issue. A failed import prints a recovery instruction; Git's completed
merge/checkout cannot be rolled back by a post-hook. Do not install Beads-provided hooks
or let the tracker rewrite `AGENTS.md`.
