# Beads Rust pilot review

Exact source head: `6791cc2d302dd60ab70542fad3383efad9bd4571` on `ops/br-pilot`, based on `21c44e27a8bcc676d84913208cccebb0bb4fa6a7`.

## Verdict: CHANGES REQUIRED

- **BRP-1 — medium — `docs/WORKFLOW.md:162`**: The pilot relies on a human diff review to catch `source_repo_path`, even though Beads Rust 0.7.4 wrote that field on creation and the current clean JSONL required manually clearing it. A later `br sync --flush-only` can re-export an absolute path and commit it if the reviewer misses it. Add a deterministic repository check that rejects machine-specific paths or a nonempty `source_repo_path` in `.beads/issues.jsonl`, and make the check part of the tracker commit path. This can be a small existing-check integration; it does not need a Beads hook.

## Verified

- All seven JSONL rows parse, all `external_ref` brief paths exist, and none of the exported values contain a local machine path. The issue set accurately reflects active C3/D2/B9, unbuilt D1/D4/D5, and D9 blocked by C3/D1/D2/D4. `br ready --brief --json` returns D1/D4/D5; `br blocked --json` returns D9 with those four blockers. D9's stored status remains `open`, with blocked status derived from dependencies.
- The workflow gives Claude Code and Codex the same PM-writer rule, sync directions, status-update point, read commands, and two-source-merge evaluation. Roadmap status/completion, brief scope, review findings and Git history remain authoritative. Rollback is practical: retire `.beads/` in a reviewed change; the linked Git records remain.
- No workflow conflict found. The path cleanup procedure is explicit, but manual review does not prevent recurrence (BRP-1).
- Ponytail review: no unnecessary abstractions or machinery in this docs/config/data change. The seven-row pilot is bounded and the existing Git records remain the durable evidence.
- Read-only `br ready --brief --json`, `br blocked --json`, and `br list --json` succeeded after cold import. No source code or test changes reviewed.

## Scoped fix re-review

Exact fix head: `478f1b3269e5f180aff537d64ded9331eb87833b` (parent `421f92442dd61c1238d18d380d67a93048fdbfd4`).

### Verdict: APPROVE

- **BRP-1 closed.** `bin/check_beads_export.py` rejects nonempty `source_repo_path`, invalid JSON rows, and local-path patterns in nested JSON string values. The pre-commit hook passes `--staged`, which reads `git show :.beads/issues.jsonl`; CI and `check_all` run the same checker on the checkout. The red controls cover both a nonempty relative `source_repo_path` and a machine path in a nested value.
- Independently staged a bad JSONL blob while leaving the worktree copy unchanged; `python3 bin/check_beads_export.py --staged` exited 1 with `Beads export row 1 contains a local path`. Restored the original index blob afterward. The clean export check and `bin/beads_red_controls.sh` passed; `git diff --check 421f9244..478f1b32` passed.
- The fix stays within the requested scope and adds no Beads hook or new dependency. No further scoped finding.
