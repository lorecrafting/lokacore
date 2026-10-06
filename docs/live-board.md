# Live Chapter 1 board

`bin/board` is the canonical repository command. It reads local `main`'s
[completion plan](MISSING-CHILD-PLAN.md) and [roadmap](ROADMAP.md), Git worktrees,
and explicit operational reports. The installed global `$board` skill remains
read-only and uses its older on-demand implementation.

Run from any checkout containing this command, pointing `--repo` at the local
integration checkout (the PM currently uses `tmp/loka-main-integration`):

```sh
python3 bin/board --repo tmp/loka-main-integration --watch
```

Open that checkout's `tmp/chapter-board.html` in a browser. The command rewrites
it atomically every five seconds and the page reloads, including through `file://`;
no web server is required. Stop with Ctrl-C. Omit `--watch` for one snapshot;
`--output` selects another HTML destination. The default without `--repo` is the
current checkout, so use the same explicit integration checkout for every report.

Report the actual work unit, phase, agent activity and measured check time:

```sh
python3 bin/board --repo tmp/loka-main-integration --note A3 \
  --phase checks --agent developer \
  --description 'Voluntary Green finale and acknowledged exports' \
  --activity 'Focused verification and final self-review; no blocker' \
  --check '40 focused Node tests' --seconds 5.4
```

Add `--head` with the exact checked commit when known. Leave unknown values out.
Use a new report for each phase/check or blocker; the history retains check times.
A report command appends notes without replacing the page. A running watcher picks
it up on its next refresh; without a watcher, rerun `bin/board` for a new snapshot.
Phases: `plan`, `build`, `checks`, `provisional`, `reviews`, `fixes`,
`local complete`, `publication`. A unit can be a chapter slice or a supporting
work unit. Reports are stored in ignored `tmp/chapter-board-status.jsonl` in the
selected checkout. They are operational notes, not durable review records: the
[workflow](WORKFLOW.md) still governs provisional integration, independent review,
fixes, local completion and publication.

The board shows **last reported activity**, never whether an agent process is
running. Changed files and commit subjects are Git facts, not approval. Explicit
phase reports can be stale; inspect their UTC timestamp and exact head. Phase
start/end times, unreported check times and approval are unknown. Local completion
and remote publication remain distinct. The cached `upstream/main` is the publication
baseline when available; otherwise `origin/main` is used and a filesystem origin is
explicitly labelled as a local mirror with publication unknown.
Slice IDs group work by chapter area; they are not execution order. Dependencies
decide when source work can start. `candidate` means planned but not locally
complete, `no report` means no activity has been logged for that slice, and
`unknown` means an exact pin, check duration or publication fact has not been
reported. None of those labels means a slice was skipped. The pipeline reports
show the latest phase for each unit, including plans approved while source work
waits on a dependency.
The board never fetches or changes refs. Update remote refs through the normal PM
workflow before relying on their freshness.

Add `--github` to query the most recent 40 GitHub PRs and their check timestamps
with the installed authenticated `gh` CLI. PR titles supply one-line descriptions;
checks retain their individual outcomes and measured durations. Failed or absent
queries remain unavailable. This is a recent PR window, not a complete PR history;
watch mode re-queries it each refresh and may be slower or rate limited. A PR's
checks alone do not certify the accumulated local `main`. Local paths and common
device/signing identifiers are redacted; avoid putting secrets in operational notes.

Focused verification: `python3 bin/test_board.py`. The controlled Git test catches
false active-work claims from a dirty checkout; the report test catches lost valid
notes, duration loss, path leakage and executable activity markup.
