# PM lessons

Lessons from PM sessions (merging, batches, spawns, hosted CI), moved out of the handoff on 2026-10-28
([harness patterns](../decisions/owner-decision-harness-patterns-2026-10-28.md)). Newest first.

## 2026-10-21 (session c5ed3619)

- The new hosted `walk` job caught a broken walk step on its first run (a Quench step racing the wall clock at
  rate 50). Showcase walks must not depend on anything landing inside a few real seconds.
- Fable plans can contradict docs/system (NPC status lines): the developer's STOP point caught it; the owner chose
  "Line now, page later (Recommended)".
- Rebuilding toolbox_showcase_hash.json after a merge: `mix loka.compile cartridges/toolbox_showcase <out>`, then
  split `{"cartridge":<canonical>,"content_hash":"<sha>"}` into the fixture's canonical and sha256 (loka-kjky).
- Agents share one scratchpad and delete files: keep PM working files under a `pm_` prefix (loka-xmvu).

## 2026-10-16 (session c5ed3619)

- Hosted runners are two-speed (~280 s vs ~540 s on the same code): compare sim times only across several runs,
  never blame one slice on one run (the PM wrongly blamed #414; the diagnosis cost ~30k).
- `br` can stop with "WAL index recovery already failed ... database is busy": run
  `br doctor migrate-schema recover`, then retry; `bin/after_merge.sh` reruns cleanly.
- `git cherry-pick -q` printed a usage error and picked nothing: use plain `git cherry-pick <sha>`.

## 2026-10-16 (session 93636711)

- Showcase slices turn hosted CI red on pins outside their own tests (flows.test.ts populations,
  view_actor.test.ts inn exit count, loader_floors): before marking ready, grep tests for the hub and
  district counts the slice changes.
- A content-only change can create a performance cliff: the first concealment status made every
  visibility check sort all statuses and the hosted `sim` job (10 min) timed out; fixed in
  `status/shared.ts`. Compare the showcase sim test time with main (77 s) when a slice adds a status.
- Showcase mutants must edit the compiled hash fixture or recompile: tests read
  `protocol/fixtures/toolbox_showcase_hash.json`, not the cartridge source (E2 reviewer).
- The Book NPC page never drew an NPC's Held list (spec said it should): theft worked only in tests.
  Playtests and Book e2e rows catch what kernel tests cannot.
- Use `bin/br_create.sh`, never bare `br create` (it writes source_repo_path, the export check refuses).
- Fable drafted G10 (~300k) that the owner then cut: at high usage, show the owner a descoping matrix
  before drafting a batch.

## 2026-10-15 (sessions b5fe9338, 8c186cca, fc1e2fd7, 01da56d0)

- Designer spawns are Fable, never Sonnet (owner: "wait sonnet should never be a designer, wasn't it
  fable designer?"); Sonnet only for a live-session picker nit.
- `/code-review` read the main checkout 5 times even with the brief line (retro `loka-aa75`); the
  reviewer's full read covered each miss.
- A slice that changes a protocol schema needs a review record even in a toolbox batch (retro `loka-1qa2`).
- Blocks deps between batch slices stop `br update --status in_progress` (retro `loka-gfgr`).
- One brief for an M engine + save + content row (hs-9) cost the developer about 650k tokens before
  review: split such rows at brief time (evidence on `loka-3jhb`).
- A developer pushed with a stale generated file (hs-9 `state-sections.gen.json`), and a hook switch
  broke six hand-written React test shims (x6t-65b): both turned hosted CI red after review (`loka-u58`,
  `loka-mluq`).
- Book UI rules: the ring drains smoothly but presentation keeps no gameplay clock (display-only tween
  between views).
- Content slices hid a faucet every time in batch A; with an item loop table in every brief, batch B
  found none (retro `loka-vro5`).
- A loader_floors case was shadowed by another feature at the same floor three times (batch A craft,
  hs-14 merge over hs-12's build step): after any merge that adds a feature to a shared sampler, rerun
  the floor mutants of that sampler's other cases (retro `loka-59uu`).
- Tests passed while the GameView they built failed the schema (hs-7 price 0, hs-14 empty choices):
  validate gameView against the schema in view tests (retro `loka-x3i0`).
- Developers ran /code-review in the main checkout (hs-7, hs-14): give the exact command with the
  worktree and range (retro `loka-7p2w`).
- A fix round that answers a developer's own open question can add a blocker (hs-14 round 2): rule on
  such questions as follow-ups unless the owner already decided.
- A save-path or `runtime/proposal.ts` change in a fix round gets a second opinion.
- Parallel slices append to the same fixture and doc spots: expect a hand merge (retro `loka-0fhi`).

## Cloud sessions

- `gh` works over REST only (GraphQL blocked: no `gh pr create`/`merge`; use the GitHub MCP tools);
  `gh auth status` misreports. git and REST branch deletion are blocked: merged branches
  `toolbox/m10-*` and `toolbox/m11-*` remain on GitHub; the owner deletes them locally
  (`git push origin --delete <branch>`).
- `br` 0.7.4 has no reachable release asset; build it from the `v0.7.4` tag with cargo (13 minutes).
- The disk fills after about seven worktrees (2.2 GB each); remove merged worktrees first.
- Agents must never run `git worktree prune` while another agent's worktree is in use.

## Merge mechanics

Merge mechanics: `bin/pm_merge.sh <batch-worktree> <batch-branch> <slice-branch> <review-branch or the
sha> "<subject>" <reviewed-sha>` (refuses a non-green sha). It stops on stacked additive conflicts in
`loader_floors.json`, `mechanics.md`, `MECHANICS-TOOLBOX.md` and the gen files (retro `loka-0fhi`):
merge by hand, keep both sides, run `elixir bin/contracts.exs`, `bin/review_index.sh`, focused tests,
push. Make the batch worktree with `git worktree add ../worktrees.noindex/batch-m15 origin/toolbox/batch-m15 -b toolbox/batch-m15` if absent. `bin/after_merge.sh` now works with the
owner's untracked `scripts/`.
