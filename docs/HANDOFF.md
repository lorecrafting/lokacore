# PM handoff

The PM's session handoff, in the repo so any harness (local Claude Code, Claude Code in the cloud,
Pi) can take over. Live status stays in Beads and GitHub; this file holds only what they do not:
the next steps, the standing owner rules that the repo does not yet state, and open owner
questions. Rewrite it at each stable checkpoint (a merge, a review verdict, a pushed fix) and before
the session ends; commit and push it with the Beads export.

Written 2026-10-15 UTC by Claude Code (Opus 5.5) in local session b5fe9338, for an owner-requested
clear. State at writing: see "In flight at the clear" below.

## Start of a session

1. Tools: `mise install` (pins in `mise.toml`), `br` 0.7.4 ([BEADS.md](BEADS.md)), `gh`
   authenticated for `lorecrafting/lokacore`. A cloud container may lack `br` and `gh`: install them
   first, and confirm `gh auth status` before any step that merges or waits on CI.
2. Beads: `beads.db` is not in Git; `.beads/issues.jsonl` is. Run `br sync --import-only` once, then
   read with `br ready`, `br show <id> | head -5`.
3. Read [WORKFLOW.md](WORKFLOW.md) (Loop) and this file once. `bin/session_status.sh` prints the live
   board.

## Beads sync (every checkpoint; required in the cloud: the container is thrown away)

- `beads.db` is local only; `.beads/issues.jsonl` on `main` is the shared copy (local Claude Code and
  Pi write it too). Do Beads writes from a `main` checkout.
- Before Beads writes: `git pull --ff-only origin main`, then `br sync --import-only`.
- After each checkpoint (a merge, a review verdict, issues created or closed): `br sync --flush-only`,
  check the JSONL diff has no machine path, commit `.beads/issues.jsonl` (and this file when changed)
  on `main`, push.
- Push rejected: `git pull --rebase origin main`; on an `issues.jsonl` conflict run `br sync --merge`,
  then flush and commit again. Never commit `beads.db`.

## End of a session

1. Do the Beads sync above, with this file rewritten.
2. Every branch with work is pushed. Nothing may live only in the container.
3. File the [retro](WORKFLOW.md#retro-and-housekeeping-queue) items in Beads.

## Lane and next steps

Mechanics toolbox (epic `loka-kgd`, [MECHANICS-TOOLBOX.md](MECHANICS-TOOLBOX.md)) is the build lane;
Storybook polish (`loka-x6t`) stays paused. The PM decides mechanics calls itself and records them in
Beads notes. Owner product order (2026-10-15, record pending, see below): **no Chapter 1 yet**; finish
all showcases (placeholders where lore is missing), then UI polish, then worldbuilding, then the
official Chapters 1-3; temporary test cartridges or showcases are welcome any time.

Done this session (b5fe9338), on `main`:
- #393 (`loka-j64e`, recipe `reason` text: a learned spell shows why it cannot be cast; kernel_api 1.100).
- #394 (`loka-tx2h` + 9 retro items, housekeeping: pm_merge refuses a non-green reviewed sha, prepush
  per-run logs, after_merge ignores untracked files, sampler-hash checks, Agent load-gate hook,
  developer.md push/code-review/mutate rules, Fable brief rule, Homestead skill-path decision record).
- #395 and #396 (`loka-ikch`, worldbuilding): `docs/worldbuilding/` stub tree (260 lore stubs in 27
  areas, `notes/` with the opening line), mechanics stubs parked in `docs/game-design/` (36, the
  future GDD), Koster research in `docs/rnd/koster-design-lessons-2026-10-15.md`.

In flight at the clear (check each first):
1. **#398 Homestead batch A** (`toolbox/batch-homestead-a`, head a8648de2, main merged in): hs-1
   `replenish.run` (1.101), hs-10 craft, hs-11 skill prerequisites, hs-2 farming, hs-3 fishing
   (`rod` tag), hs-4 animals, hs-5 `edible.applies` + mobile meal receipt (line 0 only). Every slice
   reviewed on its head (records `docs/reviews/2026-10-15-hs-*`). A **Fable batch-head review** was
   started; if its record (`review-398` local branch, `docs/reviews/2026-10-15-homestead-a-batch-review.md`)
   is missing, rerun it (prompt pattern: cross-slice composition, faucets across the batch, the 1.101
   floor cases, save/replay on the combined head, doc contradictions). Then fix, green CI, merge.
2. **#397** (`loka-uh5u`, worktree_setup clones node_modules so slice worktrees run the Book in a
   browser): approved at f344bf79; merge when ci and book-e2e are green on that sha.
3. **hs-12 self-build** (`loka-kgd.108.9`, open): not started (no code). Branch `toolbox/hs-12` sits at
   the batch-B base a8648de2 (`toolbox/batch-homestead-b` was cut from batch A's head); worktree
   `../worktrees.noindex/hs-12` kept. Code map in its Beads notes. After #398 merges, merge `main` into
   `toolbox/batch-homestead-b`, then spawn hs-12 with its brief.

Next, in order:
1. Batch B (all briefs in Beads notes, "BRIEF loka hs-N"): hs-12 self-build (`.108.9`), hs-13
   self-cooking (`.108.10`, owns hearth, hearty stews, feast), hs-6 furnishing (`.108.6`), hs-7 gifting
   and barter (`.108.5` + `loka-kgd.70`), hs-8 Give in the Book (`loka-x6t.31`, designer consult; needs
   #397), hs-14 skill tree screen (`.108.11`), hs-9 raze (`loka-otn4`, save: second opinion) last.
2. A docs PR with decision records for: no Chapter 1 yet (order above); worldbuilding decoupled from
   game mechanics (`docs/game-design/` is the parked GDD); Homestead professions rulings (failed craft
   loses inputs; coin fee per skill box, XP never spent; several hidden elites possible).
3. Then Settle S3 `loka-mytp` / S4 `loka-oxgk` (Fable briefs first), M14, M15.
4. Follow-ups: `loka-kgd.108.12` (claim emits no item_acquired), `.108.13` (spoil restarts on retake);
   older: `loka-trex`, `loka-z4cp`, `loka-kgd.157`, `.158`, `.154`-`.156`, `loka-ynfo`, `loka-3wwm`.

Merge mechanics: `bin/pm_merge.sh <batch-worktree> <batch-branch> <slice-branch> <review-branch or the
sha> "<subject>" <reviewed-sha>` (refuses a non-green sha). It stops on stacked additive conflicts in
`loader_floors.json`, `mechanics.md`, `MECHANICS-TOOLBOX.md` and the gen files (retro `loka-0fhi`):
merge by hand, keep both sides, run `elixir bin/contracts.exs`, `bin/review_index.sh`, focused tests,
push. Batch worktree: `../worktrees.noindex/batch-homestead-a`. `bin/after_merge.sh` now works with the
owner's untracked `scripts/`.

Session lessons (2026-10-15, b5fe9338):
- Content slices hid a faucet or exploit every time (re-sow, drop-retake spoil, corpse feeding, an
  honest receipt refused); probe item loops in every content brief (retro `loka-vro5`).
- Handback check tables were wrong in four slices; reviewers must rerun 2 claims (retro `loka-zgqt`).
- A save-path change in a fix round (hs-5 receipt) needed a second opinion that found a new blocker;
  a `runtime/proposal.ts` touch in a fix round (hs-1) triggers one too.
- Parallel slices at one kernel_api floor all append to the same fixture and doc spots.

## Standing owner rules not yet written elsewhere in the repo

- Merge a reviewed PR without asking once its exact head is green; do not ask permission for normal
  workflow steps. Stop only for spending money, `--no-verify` or force pushes, destructive or
  outward-facing actions beyond PRs and merges, and product or spec conflicts.
- Owner-facing text: every PR number carries its Beads id and a short description, for example
  `#379 (loka-kgd, mechanics batch M9b)`. Status and step reports use ASD-STE100 (short sentences,
  active voice); design choices and risks use plain English.
- Beads: short reads (`| head -5`), quiet writes (`br -q`), notes of one or two lines. Create issues
  with `bin/br_create.sh`. Mark an issue `in_progress` when work starts.
- Models: developers Opus (Sonnet for bounded docs or content); reviewers fresh Opus; Fable only for
  the one review per mechanics batch head, E-gates and the release-candidate audit
  ([WORKFLOW.md](WORKFLOW.md) routing table).
- Fable drafts briefs for new modules, contract changes (save, protocol, world graph), Realm-sensitive
  rows and new interaction patterns, one Fable run per batch; Opus or Sonnet brief rows that follow
  an existing pattern, S rows and content (owner 2026-10-14: "yes record the fable brief rule").
- Load gate: run `uptime` in its own call before each spawn; spawn only below load 8; at most 5
  agents, at most 3 running tests.
- Budget: the weekly Claude allowance resets Wednesdays 05:00 HST; Fable draws the same pool faster.
  Near the cap, keep to 1 or 2 agents and Sonnet for bounded work.
- Jev (TypeSafe): spend approved (owner, 2026-10-14: "yes to this approve to allow spend"); briefs and cartridge text may leave the machine, redacted first, never saves or player words, and Jev is advisory only, never a gate (owner, 2026-10-14: "yes to both, briefs can leave the machine"). Pi keeps its $2/day cap. A decision record goes in the next housekeeping PR.
- Pi work is marked (commit trailer `Harness: pi (...)`, a `Written ... in the Pi harness` line,
  `[Pi · model · session]` on tracker comments). Claude Code work uses the normal co-author trailer.

## Cloud session lessons (if the next session is in the cloud again)

- `gh` works over REST only (GraphQL blocked: no `gh pr create`/`merge`; use the GitHub MCP tools);
  `gh auth status` misreports. git and REST branch deletion are blocked: merged branches
  `toolbox/m10-*` and `toolbox/m11-*` remain on GitHub; the owner deletes them locally
  (`git push origin --delete <branch>`).
- `br` 0.7.4 has no reachable release asset; build it from the `v0.7.4` tag with cargo (13 minutes).
- The disk fills after about seven worktrees (2.2 GB each); remove merged worktrees first.
- Agents must never run `git worktree prune` while another agent's worktree is in use.

## Owner answers this session

- 2026-10-15 (session b5fe9338, paraphrased unless quoted): cloud compute no longer needed
  (`loka-2of` closed). Retro items: approved as recommended ("go with your recs"), `loka-8lkq` and
  `loka-iqga` rejected. Homestead: the skill path replaces NPC cooking and building; a paid NPC gives
  only a beginner tier; SWG-style skill trees for many professions ("yes SWO skilltrees sounds good"),
  several hidden elite professions; "GO with all your recs" on: skill tree screen in batch B, a failed
  craft loses its inputs, a skill box costs a trainer coin fee with XP never spent.
- Worldbuilding (`loka-ikch`): our own cosmology and lore from the ground up; it replaces the Ashmere
  setting (new content uses generic names); a Jedi-like order of cosmic wardens is one hidden elite;
  folder `docs/worldbuilding/`, loose notes in `notes/`; the game opens with "In the beginning of this
  great eon..."; worldbuilding is story and canon only, mechanics and balance live apart (future GDD).
- Chapter 1: not now; showcases first (placeholders for missing lore), then UI polish, then
  worldbuilding, then the official Chapters 1-3; temporary showcases or cartridges to test things are
  fine.

## Open owner questions

- Worldbuilding, first five decisions (not urgent: worldbuilding comes after showcases and UI polish):
  premise and pillars; cosmology shape; magic hardness and cost; hidden-elite secrecy (Koster's Jedi
  lesson: phone data will be mined; secret vs discoverable path); Story vs Realm canon.
- Approve or reject retro items from 2026-10-15 (b5fe9338): `loka-0fhi` (merge_resolve unions
  additive fixture and doc conflicts), `loka-ujau` (bin/push_slice.sh prints the real push status),
  `loka-vro5` (content slices hand back an item loop table), `loka-zgqt` (check table rows paste the
  failing mutant line).

## Parked (polish lane)

- Open PR #372 (`loka-x6t`, combat playtest findings into the Book spec), branch
  `design/playtest-combat`.
- [Give action plan](plans/loka-x6t.31-give-action.md) for `loka-x6t.31` (Book never offers Give),
  drafted by Pi on 2026-10-13, not reviewed. Known gap: it offers Give to every NPC in the room
  without an engine check that the recipient accepts.
- Book UX from the Fable audit (`loka-x6t.40` to `.52`) waits in the paused polish lane (`.39` word bar
  shipped in #391; `loka-x6t.31` Give is now Homestead hs-8).
