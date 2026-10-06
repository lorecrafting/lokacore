# Beads Rust hook pilot comparison

The [pilot decision](../decisions/owner-decision-beads-rust-pilot-2026-10-06.md)
authorizes an opt-in Git hook for the main integration checkout. The tracked
`.beads/issues.jsonl` and reviewed merge history remain the durable record;
the local SQLite index is rebuildable. The two source-merge observations below
compare the hook with the earlier manual-sync practice. Do not count other
source review or CI time as tracker maintenance.

| Observation | Before hooks: observed 2026-10-06, 15:58 UTC | With hooks: first source merge (C4) | With hooks: second source merge (D3) |
| --- | --- | --- | --- |
| Beads version | `br 0.7.4` | `br 0.7.4` | `br 0.7.4` |
| Repo Git hooks | `pre-commit` and `pre-push`; no post-merge or post-checkout import | Opt-in `post-merge` and branch `post-checkout` import, after reviewed publication | Selected main integration checkout ran `post-merge` on the published D3/status merge; it printed `Beads index refreshed from reviewed JSONL.` |
| Chapter 1 tasks | 33 in SQLite and JSONL; 19 closed, 4 in progress, 10 open, 0 ready | After PM closure: 33 total, 20 closed, 3 in progress, 10 open; C5 and D7 became ready | After PM D3 closure: 33 total, 21 closed, 2 in progress, 10 open; `br ready` returns C5 and D7 |
| Sync health | `br sync --status --json`: healthy, dirty 0, JSONL/DB each 33, no coverage drift or anomaly | Healthy, dirty 0, JSONL/DB each 33, no coverage drift or anomaly after C4 merge and closure | Healthy, dirty 0, JSONL/DB each 33, no coverage drift or anomaly after actual changed-JSONL import |
| Tracker commits | Four JSONL commits between 15:30 and 15:58 UTC: `822c1c06`, `0a3673f9`, `525eaa23`, `615e66a5` | `bf2471b7` records PM-owned C4 closure with roadmap status | `046342df` records PM-owned D3 closure with roadmap status; integration merge `a893f726` imported it locally |
| Manual intervention, stale viewer, hook latency | Not measured; do not infer counts or time saved | No import or recovery needed: C4 source merge did not change tracked JSONL. Viewer staleness and hook-only elapsed time not measured. | No manual `br sync --import-only` was needed after D3 status changed JSONL. The immediately queried Beads DB matched the reviewed JSONL; hook-only elapsed time and time saved were not measured. |

The pre-hook snapshot proves a healthy tracker, not a performance baseline.
Measure the same 33-task coverage and sync status after each source merge.
Keep semantic issue closure PM-owned: an import only refreshes the local index.

The first live source merge integrated [PR #239](https://github.com/lorecrafting/lokacore/pull/239)
(C4 hound aggression, pack assistance and flight) into the selected main checkout.
The opt-in post-merge hook was installed; tracked JSONL was unchanged, and the subsequent real `br` status
had 33/33 coverage and no drift. The PM then closed C4 and published the
status-only commit `bf2471b7`. This observation does not show a speed gain or
test an import caused by a changed JSONL.

The second source merge integrated [PR #243](https://github.com/lorecrafting/lokacore/pull/243)
(D3 western Ashmere mill, Hob and readable clues) and PM closure commit
`046342df`. The selected main integration checkout merged published main as
`a893f726`; `post-merge` imported the newer tracked JSONL. Immediately after,
`br sync --status --json` reported healthy, dirty 0, 33/33 coverage, no drift or
anomaly, and no newer JSONL/DB. `br ready --json` returned the two dependency-ready
slices C5 bleeding/bandage and D7 deer. No manual import or issue mutation was
needed. Only its pre-existing untracked local files remain in the integration checkout;
no owner save or source branch was touched. This is a correctness/convenience observation,
not a measured latency or time-saving claim. [PM retention decision](../decisions/pm-decision-beads-hooks-retain-2026-10-06.md)
keeps the hook opt-in for Chapter 1.

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
were functional controls; the actual integration-checkout import is recorded
above. Hook latency remains unmeasured.
