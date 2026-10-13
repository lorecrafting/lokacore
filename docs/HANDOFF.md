# PM handoff

The PM's session handoff, in the repo so any harness (local Claude Code, Claude Code in the cloud,
Pi) can take over. Live status stays in Beads and GitHub; this file holds only what they do not:
the next steps, the standing owner rules that the repo does not yet state, and open owner
questions. Rewrite it at each stable checkpoint (a merge, a review verdict, a pushed fix) and before
the session ends; commit and push it with the Beads export.

Written 2026-10-13 UTC by Claude Code (Opus 5.5), from the Pi handoff of 2026-10-12 (Pi session
01a12efa) and the local Claude Code memory.

## Start of a session

1. Tools: `mise install` (pins in `mise.toml`), `br` 0.7.4 ([BEADS.md](BEADS.md)), `gh`
   authenticated for `lorecrafting/lokacore`. A cloud container may lack `br` and `gh`: install them
   first, and confirm `gh auth status` before any step that merges or waits on CI.
2. Beads: `beads.db` is not in Git; `.beads/issues.jsonl` is. Run `br sync --import-only` once, then
   read with `br ready`, `br show <id> | head -5`.
3. Read [WORKFLOW.md](WORKFLOW.md) (Loop) and this file once. `bin/session_status.sh` prints the live
   board.

## End of a session (do not skip in the cloud: the container is thrown away)

1. `br sync --flush-only`, then commit `.beads/issues.jsonl` and this file on `main` (a PM
   status-only commit) and push.
2. Every branch with work is pushed. Nothing may live only in the container.
3. File the [retro](WORKFLOW.md#retro-and-housekeeping-queue) items in Beads.

## Lane and next steps

One lane: the mechanics toolbox only (epic `loka-kgd`, [MECHANICS-TOOLBOX.md](MECHANICS-TOOLBOX.md));
Storybook polish (`loka-x6t`) is paused until the owner reactivates it
([record](decisions/owner-decision-one-lane-mechanics-2026-10-12.md)). The PM decides mechanics calls
itself, records them in Beads notes, and starts the next row without asking
([record](decisions/owner-decision-autonomous-mechanics-2026-10-03.md)).

Batch M10: branch `toolbox/batch-m10`, head `b6156e83`, hosted CI green, `kernel_api` 1.76. Merged
into it, each reviewed and re-checked: G8 group `loka-kgd.115`, 19b replenish `loka-kgd.85`, 6b gear
budget `loka-kgd.107.17`, 22a hireling orders `loka-kgd.116`, 9 random encounters `loka-kgd.117`,
22b hireling wages `loka-kgd.118`, W9 sleep `loka-kgd.119`, balance 2 flows `loka-kgd.107.2`,
balance 7 fight matrix `loka-kgd.107.7`. Their issues stay open until the batch merges to `main`.

Wave 4 (briefs are in each issue's Beads notes; coding stopped when the API credit ran out):

1. Row 32 fast travel `loka-kgd.120` (S, no engine change: a transport route gated by
   `visited_count`). Branch `toolbox/m10-fast-travel`, head `7938460b` (sampler and test, WIP). To do:
   docs (`docs/system/mechanics.md`, `cartridge.md`), tests green, self-review, review, recheck,
   merge into the batch.
2. Row 41 decay `loka-kgd.121` (M, `kernel_api` 1.77, new `item.move {room}` reaction step). Branch
   `toolbox/m10-decay` from the batch head. Corpse decay is split off as `loka-kgd.122`.
3. Balance 8 friction report `loka-kgd.107.8` (M, `kernel/ts/play/friction.ts` and a `flows.ts`
   hook). Branch `toolbox/m10-balance-8` from the batch head.
4. Then on the batch: regenerate `docs/toolbox.gen.json` and `docs/system-graph.gen.json`; update the
   MECHANICS-TOOLBOX table (add 19b, move 41 to M10, split 22 into 22a and 22b); one Fable batch
   review on the final head, fix, Fable recheck; green hosted CI; PR to `main`; merge with
   `--match-head-commit`; close the issues; delete the slice branches.
5. Next batches: M11 (G7 locks, W26, 24, 20a, 20b, W11), then M12 to M15 per the toolbox table and
   `br ready`. Balance 3 `loka-kgd.107.3` waits on owner question 2.

Per slice: brief in Beads notes, developer, CI on the head (`bin/wait_ci.sh <sha>`), fresh Opus
reviewer, fix round by the same developer, reviewer recheck, then `bin/pm_merge.sh <batch-worktree>
toolbox/batch-m10 <slice-branch> <review-branch> "<subject>" <reviewed-sha>` (merges the reviewed head slice and review record, runs
the touched checks, pushes the batch only when green). Developers do not wait on CI; the PM watches
it. Put worktrees outside the main checkout; locally under a `.noindex` folder, so Spotlight skips them.

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
- Load gate: run `uptime` in its own call before each spawn; spawn only below load 8; at most 5
  agents, at most 3 running tests.
- Budget: the weekly Claude allowance resets Wednesdays 05:00 HST; Fable draws the same pool faster.
  Near the cap, keep to 1 or 2 agents and Sonnet for bounded work.
- Pi work is marked (commit trailer `Harness: pi (...)`, a `Written ... in the Pi harness` line,
  `[Pi · model · session]` on tracker comments). Claude Code work uses the normal co-author trailer.

## Open owner questions

1. W9 sleep, provisional "sleep provokes": an accepted Sleep calls G11 engage, so a hostile NPC in
   the room opens a fight on the sleeper. Reversible until the M10 batch PR.
2. Balance 3 `loka-kgd.107.3`: do balance gates fail CI on the showcase only, or on every sampler?
   PM default: showcase only.

## Parked (polish lane)

- Open PR #372 (`loka-x6t`, combat playtest findings into the Book spec), branch
  `design/playtest-combat`.
- [Give action plan](plans/loka-x6t.31-give-action.md) for `loka-x6t.31` (Book never offers Give),
  drafted by Pi on 2026-10-13, not reviewed. Known gap: it offers Give to every NPC in the room
  without an engine check that the recipient accepts.
