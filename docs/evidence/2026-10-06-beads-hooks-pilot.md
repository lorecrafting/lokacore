# Beads Rust hook pilot comparison

The [pilot decision](../decisions/owner-decision-beads-rust-pilot-2026-10-06.md)
authorizes an opt-in Git hook for the main integration checkout. The tracked
`.beads/issues.jsonl` and reviewed merge history remain the durable record;
the local SQLite index is rebuildable. Compare this hook with the earlier
manual-sync practice at the next two source merges. Do not count other source
review or CI time as tracker maintenance.

| Observation | Before hooks: observed 2026-10-06, 15:58 UTC | With hooks: first source merge (C4) |
| --- | --- | --- |
| Beads version | `br 0.7.4` | `br 0.7.4` |
| Repo Git hooks | `pre-commit` and `pre-push`; no post-merge or post-checkout import | Opt-in `post-merge` and branch `post-checkout` import, after reviewed publication |
| Chapter 1 tasks | 33 in SQLite and JSONL; 19 closed, 4 in progress, 10 open, 0 ready | After PM closure: 33 total, 20 closed, 3 in progress, 10 open; C5 and D7 became ready |
| Sync health | `br sync --status --json`: healthy, dirty 0, JSONL/DB each 33, no coverage drift or anomaly | Healthy, dirty 0, JSONL/DB each 33, no coverage drift or anomaly after C4 merge and closure |
| Tracker commits | Four JSONL commits between 15:30 and 15:58 UTC: `822c1c06`, `0a3673f9`, `525eaa23`, `615e66a5` | `bf2471b7` records PM-owned C4 closure with roadmap status |
| Manual intervention, stale viewer, hook latency | Not measured; do not infer counts or time saved | No import or recovery needed: C4 source merge did not change tracked JSONL. Viewer staleness and hook-only elapsed time not measured. |

The pre-hook snapshot proves a healthy tracker, not a performance baseline.
Measure the same 33-task coverage and sync status after each source merge.
Keep semantic issue closure PM-owned: an import only refreshes the local index.

The first live source merge integrated [PR #239](https://github.com/lorecrafting/lokacore/pull/239)
(C4 hound aggression, pack assistance and flight) into the selected main checkout.
The opt-in post-merge hook was installed; tracked JSONL was unchanged, and the subsequent real `br` status
had 33/33 coverage and no drift. The PM then closed C4 and published the
status-only commit `bf2471b7`. This observation does not show a speed gain or
test an import caused by a changed JSONL. Record the next source merge before
judging whether to retain the hook.

## Controlled hook proof before live use

In a temporary Git repository with a fake `br`, the hook skipped an unconfigured
checkout, a checkout with another selected root, a file checkout, a non-main
branch and a dirty local index. On a selected main-branch checkout with newer
JSONL, it called `br sync --status --json` followed by `br sync --import-only`.
Removing the root comparison caused the wrong checkout to import (red control);
restoring it made that case skip again. Python compilation, shell syntax,
whitespace and the docs link check passed. This proves routing only; real Beads
import and latency remain to be observed after publication.

Creating a separate worktree exposed a post-checkout edge: Git invoked the
new hook while the destination branch did not yet contain its Python helper.
The shell wrapper now exits successfully when the helper is absent. The actual
separate worktree passed this control after the fix. No tracker file in that
worktree was changed.

An independent reviewer also used real `br 0.7.4` in isolated repositories:
two successive newer JSONL generations imported to healthy sync status, while
a dirty local index with newer JSONL was preserved and import skipped. These
are functional controls, not yet a measured integration-checkout merge.
