# Review: housekeeping 2026-10-08 (session 2)

PR #318, branch `chore/housekeeping-2026-10-08b`, head `63d9fa92`. Fresh independent reviewer,
proportionate (docs plus one script). Governing: [WORKFLOW step 7](../WORKFLOW.md), [routing](../WORKFLOW.md#work-routing),
`.gitattributes` union indexes, [record](../decisions/owner-decision-agent-tooling-2026-10-08.md).

Must be true: `sync_pr.sh` merges (never rebases or forces), refuses any real conflict and leaves the
tree clean, rebuilds the review index as main's list plus own lines, pushes only after the docs check;
its red controls fail when each of those breaks. Explore is read-only on Haiku. Step 7 keeps #315's
arm/disarm rules. Paraphrase marked; tracker commit touches only `.beads/issues.jsonl`.

**Verdict: CHANGES REQUIRED**

Mutants on `bin/sync_pr.sh` (throwaway worktree, `bin/integration_red_controls.sh`): `-X ours` red,
docs check ignored red, no `merge --abort` red, no own-line append red; **no index rebuild green**.

- **Blocker** `bin/integration_red_controls.sh:116`: deleting the rebuild (`git show origin/main:$idx > $idx`,
  `bin/sync_pr.sh:18`) stays green. The union merge yields `- own - m1 - m2`, the script then appends
  `- own`, and `tail -n 3` still reads `- m1 - m2 - own`. That is the exact break the comment at :112 claims
  to catch. Compare the whole file (`# i - m1 - m2 - own`).
- **Should-fix** `bin/sync_pr.sh:15`: after a docs-check or push failure the local merge commit stays; a
  rerun sees origin/main in HEAD, prints "already has origin/main" and exits 0 with nothing pushed, so the
  PR sits without CI (the case the script exists to prevent). Test against `origin/<branch>`, or say
  "push by hand" in the failure messages.
- **Nit** `bin/sync_pr.sh:17`: `docs/decisions/README.md` keeps union order (branch line above main's). With
  different dates this breaks "newest first"; `check_docs` does not check order, and `.gitattributes` asks
  the PM's merge to keep it.
- **Question** `.claude/agents/Explore.md:2`: does a project agent named `Explore` override the built-in?
  Frontmatter shape, `tools: Read, Grep, Glob` and `model: haiku` are correct.

Checked, no finding: step 7 text agrees with #315 (arm after final verdict, disarm before other pushes,
re-arm note); routing rows; plugin line; record marked (paraphrased), index and owner-rules lines;
`63d9fa92` touches only `.beads/issues.jsonl`. CI was still running at review time (elixir, sim, lint pass).

## Fix round 1: `69252b7b`, `8a8a7e02` (head `8a8a7e02`)

**Verdict: CHANGES REQUIRED** (one should-fix in the new item 5 text; every earlier finding is closed).

- Blocker: fixed. The whole-file check is at `bin/integration_red_controls.sh:116`. Deleting only the rebuild
  line (`git show origin/main:$idx > $idx`) now fails with "index not exactly main list + own line"; the
  unmodified head passes.
- Should-fix: fixed. `bin/sync_pr.sh:17` treats the sync as done only when `origin/<branch>` has main; a
  rerun skips the merge, runs the docs check and pushes. Restoring the old `HEAD` early exit fails with
  "sync_pr rerun: not pushed".
- Nit: fixed by the script comment and the step 7 sentence (check the order by hand).
- Question: closed (docs link added).
- Item 5, **should-fix** `docs/WORKFLOW.md:100` and `.claude/agents/developer.md:53`: both still say
  "`git pull --rebase` (the review record is on the branch)". Under the new rule (`WORKFLOW.md:294`,
  `.claude/agents/reviewer.md:41`) the record is never pushed, so the pull does not bring it. The
  developer's fix push then goes out without the record, and the round 2 reviewer appends to a file that
  is not there. The text also never names how the sha reaches the developer, or the ref that keeps it
  reachable once the worktree is removed (the PM now asks for `git branch review-<N>`; WORKFLOW does not
  say this). Fix: step 5 and developer.md cherry-pick the reviewer's sha (or merge `review-<N>`) before
  fixing, and the git-hygiene bullet names the ref.
- Item 5, **nit** `docs/system/owner-rules.md:210` and the record bullet "After each merge to `main`": both
  still say to sync after each merge, while step 7 and the new record bullet say once after the last of
  several close merges.

Delivery lanes text and step 7 do not contradict each other: the shared draft branch is the default, and
Hosted is kept for a slice that must merge alone.

## Fix round 2: `d10a1bb7` (merge `336d469b`, record cherry-pick `85fc001a`)

**Verdict: APPROVE WITH NOTES**

- Cherry-pick `85fc001a` has the same content as the round 1 record `41a45f76`.
- Merge `336d469b` (parents `85fc001a`, main `7a1b0bf9`): every file it brings in has main's content,
  except `docs/CHECKS.md` (only this branch's two `sync_pr.sh` lines) and `docs/reviews/README.md`. Commit
  `d10a1bb7` then moves this branch's index line last, after main's #317 line.
- Should-fix (record not pushed): fixed. `docs/WORKFLOW.md:100` (PM passes the sha kept as `review-<N>`,
  developer cherry-picks it, otherwise the PM's sync or merge push carries it, PM deletes the ref after the
  merge), `.claude/agents/developer.md:53`, `docs/WORKFLOW.md:294` and `.claude/agents/reviewer.md:41`
  agree with each other.
- Nit (sync after each merge): fixed in `docs/system/owner-rules.md:210` and the decision record bullet.
- **Nit** `.claude/agents/reviewer.md:41` and `docs/WORKFLOW.md:294`: `git branch review-<N> HEAD` fails
  with "already exists" in a re-check round, because the ref lives until the merge. The PM's round 2 brief
  used `git branch -f`. The sha is still returned, so nothing is lost.
