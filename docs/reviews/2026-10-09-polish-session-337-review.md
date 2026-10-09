# Review: live polish session lane and session/preview scripts (PR #337)

- PR #337, branch `chore/polish-session`, head `99d47ebe`. Beads loka-x6t.1 (epic loka-x6t).
- Governing: [WORKFLOW Live polish session](../WORKFLOW.md#live-polish-session), [Git hygiene](../WORKFLOW.md#git-hygiene) (stop by PID, loka-hg7), [web preview](../web-preview.md#storybook), [decision record](../decisions/owner-decision-live-polish-session-2026-10-09.md).
- Verdict: **CHANGES REQUIRED** (B1, S1).

## Must be true

1. Servers are stopped only by the PID that listens on their port, never by name. They start detached, so the caller's exit does not stop them.
2. `npm ci` runs only for a changed lockfile. A second run restarts nothing.
3. Close refuses a dirty tree and pushes through the pre-push hook (no `--no-verify`). It opens or reuses the PR, then serves the preview again. No failure path leaves the owner without a Storybook.
4. Tests never touch 6006, 19006, 8081 or `~/dev/lokacore-preview`.
5. The lane text matches the owner's words and the PM's model routing. The quotes are verbatim.

## Proof

- Baseline harness (ports remapped to 7106-7199, scratch worktree): exit 0.
- Mutants (each restored afterwards):
  - Cksum stamp dropped: FAIL `preview_update again`.
  - Session guard (`preview_update.sh:13-14`) dropped: FAIL `during-session`.
  - PR claim rerun, closed-session guard dropped: FAIL `after-close: exit 0, want 1`. Holds.
  - PR claim rerun, a busy port skips the preview cases with a FAIL line. Holds.
  - Expo-only-if-running dropped: **green** (B1).
- Detachment checked by hand: the served PID has PGID equal to its PID and no TTY.
- `after_merge.sh:26,50` removes the session worktree by branch, so "start refuses a closed session" can end.
- The quotes match `.beads/issues.jsonl` exactly. The decisions README line is first, newest first.
- The routing text matches the PM ruling: Sonnet for nits, Fable for design, the `fable:`/`quick:` prefixes, a Fable skim at 5+ nits, one Opus reviewer at close, batches kept open liberally, and out-of-scope items go to Beads.
- Push failure (`polish_session.sh:47`) dies before Storybook stops, so the session stays served.

## Findings

- **B1 blocker**, `bin/preview_update.sh:29`, `bin/integration_red_controls.sh:287`. The harness starts an Expo decoy before the first case and keeps it up throughout, so the "Expo only if it was running" guard is never exercised. Mutant `[ -z "$expo" ] ||` removed: suite green. Scenario: the owner is not running Expo, a regression starts `expo start --lan` on 8081 (exposed on the LAN) on every update, and the suite stays green.
- **S1 should-fix**, `bin/polish_session.sh:52-53`. Close stops Storybook, then `preview_update.sh` can die:
  - `:12` dirty preview checkout;
  - `:15` fetch failure;
  - `:18` checkout failure, whose message says "the servers were not touched";
  - `:22-23` `npm ci` failure after every server has been stopped. This path also hits a plain `preview_update`.
  
  Reproduced with a dirty preview at close: close exits 1 and prints "has local changes; nothing changed", and nothing listens on the Storybook port. The other ports were still up. The owner is left with no Storybook. Dropping `:52` alone does not fix it, because the `:13` guard would then refuse.
- **nit**, `bin/integration_red_controls.sh` (`run`'s failure branch). Every run where a `run` exit code check failed aborted with rc 134 (a BSD `sed` assertion), in 3 of 3 cases. The later cases and the cleanup at `:317` are skipped. Stubs then linger for 120 s, and the next run reports busy ports.
- **nit**, `bin/integration_red_controls.sh:276-277`. The busy-port check loops over literal numbers, not the exported `LOKA_*` values. A typo in the export line silently falls back to 6006, 19006 and 8081. Checking `$LOKA_SB_PORT` and the other variables would let `set -u` catch it.
- **nit**, PR body: "close restarts only Storybook" holds only if main has not moved since the last preview sync. Otherwise `preview_update.sh:20-22` restarts the web preview and Expo as well, and the harness never moves main before close.
- `/code-review medium` result: reported in the PR body.
