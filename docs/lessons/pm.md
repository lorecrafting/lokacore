# PM lessons

Lessons from PM sessions (merging, batches, spawns, hosted CI), moved out of the handoff on 2026-10-28
([harness patterns](../decisions/owner-decision-harness-patterns-2026-10-28.md)), grouped by topic.

## Hosted CI and timing

- Runners are two-speed (~280 s vs ~540 s on the same code): compare sim times across several runs, never blame one slice on one run.
- A content-only change can create a performance cliff (the first concealment status timed out `sim`; fixed in `status/shared.ts`): compare the showcase sim test time with main when a slice adds a status.
- Showcase walks must not depend on anything landing inside a few real seconds (a Quench step raced the wall clock at rate 50).
- Showcase slices turn hosted CI red on pins outside their own tests (flows.test.ts populations, view_actor.test.ts exits, loader_floors): grep tests for the hub and district counts a slice changes before marking ready.
- A developer pushed a stale generated file and a hook switch broke hand-written React test shims, both red after review (`loka-u58`, `loka-mluq`).

## Briefs and batches

- At high usage, show the owner a descoping matrix before drafting a batch (a ~300k Fable draft was cut).
- Split an M engine + save + content row at brief time (one such brief cost a developer ~650k, `loka-3jhb`).
- Fable plans can contradict docs/system; the developer's STOP point catches it.
- Give `/code-review` the exact branch target; developers ran it in the main checkout (`loka-aa75`, `loka-7p2w`).
- Blocks deps between batch slices stop `br update --status in_progress` (`loka-gfgr`).
- Parallel slices append to the same fixture and doc spots: hand-merge hand-kept files; for regenerated families, take theirs and run `sh bin/regen.sh`; it rebuilds the compiled hash fixtures (`value` ones included) and re-pins the transcripts, while a frozen or hand-kept hash fixture stays a hand-merge ([CHECKS](../CHECKS.md)).
- Before a parallel batch that edits the corpus, check that `sh bin/regen.sh` rebuilds every fixture family the slices move: its shape filter skipped 48 of 49 hash fixtures, and each C3 merge of C, A and V into the moving batch head cost 20-30 min re-pinning 30-50 hashes by script (`711ac2123`, `18c66e328`, `e1cfcaa4c`; fixed by `loka-tb31`).
- A timebox stated only in a brief is not kept (C2 final review 1h53; C3 final sweep about 90 of 45 min, and #495 waited 4 h 55 min after its last slice merge `684787658`): put the limit in the tool (`bin/mutate.sh` `MUTATE_MINUTES`, `loka-tafk`).
- Cutting the next batch from the previous batch's head during its final review saves the wait: C3 slice R started on `simplify/c2-kinds` during #493's Fable review and needed one `main` merge (`a8d42475c`), no rework. Do it when the next batch does not depend on that review's fixes.
- Batch merge order: a rename that touches every later file first and alone (C3 R), then the parallel slices, then one slice for cross-slice fixes (X) before the docs sweep (Z). A slice that loosens checks for later slices to tighten (C3 P) blocks the batch PR until they land: name that gate in the plan, not at handback.
- An item loop table in every content brief found the hidden faucets batch A missed (`loka-vro5`).
- A fix round that answers a developer's own open question can add a blocker: rule on such questions as follow-ups unless the owner already decided.

## Review and tests

- Before a PM ruling on Book wording or placement, grep `docs/system/book-ui.md` for the case: on #477 a PM
  ruling on deaths outside a fight contradicted `book-ui.md:111` and a pinned test, and was withdrawn.
- Before sizing a split or rename, count references and parsers (`grep -rl`, generators in `bin/`): the audit
  rated the `mechanics.md` split M, but 463 files and two generators depend on it (loka-u15o).
- A slice that changes a protocol schema needs a review record even in a toolbox batch (`loka-1qa2`).
- A save-path or `runtime/proposal.ts` change in a fix round gets a second opinion.
- Tests passed while the GameView they built failed the schema: validate the view in view tests (`loka-x3i0`).
- A loader_floors case was shadowed by another feature at the same floor three times: after a merge that adds a feature to a shared sampler, rerun that sampler's other floor mutants (`loka-59uu`).
- Showcase mutants must edit the compiled hash fixture or recompile: tests read `protocol/fixtures/toolbox_showcase_hash.json`.
- Playtests and Book e2e rows catch what kernel tests cannot (the NPC page never drew an NPC's Held list).
- Presentation keeps no gameplay clock: a draining ring is a display-only tween between views.

## Tools

- Regenerated families (`*.gen.*` and the `{description, canonical, sha256}` hash fixtures, toolbox_showcase_hash.json among them) after a merge: take theirs, then `sh bin/regen.sh`; it rebuilds those that carry `value` too, but not the frozen or hand-kept ones, which `bin/merge_resolve.py` leaves unmerged ([CHECKS](../CHECKS.md); `loka-tb31`).
- `br` "WAL index recovery already failed ... database is busy": run `br doctor migrate-schema recover`, then retry.
- `git cherry-pick -q` printed a usage error and picked nothing: use plain `git cherry-pick <sha>`.
- Agents share one scratchpad and delete files: keep PM working files under a `pm_` prefix (`loka-xmvu`).
- `bin/pm_merge.sh` stops on stacked additive conflicts (`mechanics.md`, the gen files): merge by hand keeping both sides, then `elixir bin/contracts.exs`, `bin/review_index.sh`, focused tests.

## Cloud sessions

- In a cloud container only: `gh` works over REST only (no `gh pr create`/`merge`; use the GitHub MCP tools); `gh auth status` misreports; branch deletion is blocked, so the owner deletes merged branches. Locally `gh pr merge` and `bin/merge_pr.sh` work.
- `br` 0.7.4 has no reachable release asset; build it from the `v0.7.4` tag with cargo (13 minutes).
- The disk fills after about seven worktrees (2.2 GB each); remove merged worktrees first.
- Never run `git worktree prune` while another agent's worktree is in use.
