# PM handoff

The PM's session handoff, in the repo so any harness (local Claude Code, Claude Code in the cloud,
Pi) can take over. Live status stays in Beads and GitHub; this file holds only what they do not:
the next steps, the standing owner rules that the repo does not yet state, and open owner
questions. Rewrite it at each stable checkpoint (a merge, a review verdict, a pushed fix) and before
the session ends; commit and push it with the Beads export.

Written 2026-10-14 UTC by Claude Code (Opus 5.5) at the end of cloud session
01FtwqZjvGA5A9sL3d8WjiJz (credits ran out), for a local Claude Code session to continue.

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

One lane: the mechanics toolbox only (epic `loka-kgd`, [MECHANICS-TOOLBOX.md](MECHANICS-TOOLBOX.md));
Storybook polish (`loka-x6t`) stays paused ([record](decisions/owner-decision-one-lane-mechanics-2026-10-12.md)).
The PM decides mechanics calls itself, records them in Beads notes, and keeps going batch after batch.

Done this session: #380 (loka-kgd, mechanics batch M10) and #381 (loka-kgd, mechanics batch M11)
merged to `main`. The owner approved the Fable depth and UX audit
(report `docs/rnd/depth-and-ux-2026-10-13.md`) and the rule that rows from M12 on add no new
single-player assumption (Realm seams record `docs/decisions/owner-decision-realm-seams-2026-10-13.md`,
seams audit `docs/rnd/realm-seams-audit-2026-10-13.md`). Both records and the report reach `main` with the
M12 batch PR (they are on `toolbox/batch-m12`).

Batch M12: branch `toolbox/batch-m12`, head `c5fccf72` (worktree `worktrees.noindex/m12-batch`).
State 2026-10-14 (local session): briefs live in each issue's Beads notes.

1. Merged into the batch: 37a raid spawn `.131` (reviewed `924c18b2`, 1.84) and the two-shop save
   fix `.149` (reviewed `e7cc58ac`, main + save second opinion approve).
2. W13 tracks `.136`, `toolbox/m12-tracks` (1.85): both reviewers APPROVE WITH NOTES on `03101ac0`
   (records `review-m12-tracks`, `review-m12-tracks-2nd`); fix round 1 running (facts_typed must require a
   room subject for trail facts; revert a `lockStage` reformat). PM rulings: a hunter holds when any
   body is in its room; an out-of-area hunter parks; player trails are instance scope.
3. Building: 37b + 38 `.132`/`.133` (`toolbox/m12-aftermath`, content), W12 `.135`
   (`toolbox/m12-populations`, 1.86; prey hunt deferred until W13 merges).
4. Briefed, not started: 39 `.134` (1.87), FD8 `.145` (content, Sonnet). Still to brief: FD1 `.138`
   (1.88, after 37b; delays in logical units, not real minutes, per seams rule 4), FD3 `.140` (after
   37b), FD4 `.141` (after W13: both touch `fact.ts`), and bug `.151` (Chapter 1 deer
   `conflicting_write` on one long advance; found by the 37a recheck).
5. Close M12 as M10 and M11 closed: toolbox table edit, one Fable batch review, green CI, PR, merge with
   the head pinned, close issues.

Order from here: the owner adopted the Fable priority plan on 2026-10-14 ("keep going, follow the fable priority plan"; `docs/briefs/toolbox-priority-plan-2026-10-14.md` on `toolbox/batch-m12`). M12 rest: FD4, FD1, `.151`; FD3 moves to M13; W12 prey hunt, 43b, 48a-c and RS-7 are deferred; row 38 runs with RS-4; S2 is cut (it duplicates Built rooms slice 2). Plan defaults the PM takes unless the owner objects: one Book word-bar slice after RS, Built rooms after M15, Balance gates on the showcase only.

Owner answers 2026-10-14 (paraphrased): defer carry-over 48a-c and RS-7; Settle per the PM recommendation (S1 into Homestead, S2 merged into Built rooms, S3/S4 after Homestead on a yes); Built rooms between M13 and M14; Balance gates fail on the showcase only; keep W9 "sleep provokes"; loka-b60 at the release candidate. Then (owner, 2026-10-14: "yes to word bar, put mounts after 43a in M14"): one Book word-bar slice (loka-x6t.39) runs in the mechanics lane after the Realm seams batch; 43b mounts runs right after 43a in M14.

Then the Realm seams batch (`loka-kgd.150`, slices RS-1 to RS-8; RS-7 deferred to the Realm), before
M13. Then M13 to M15. Settle (S1 to S4) waits for an owner yes.

Merge mechanics: `bin/pm_merge.sh <batch-worktree> <batch-branch> <slice-branch> <review-branch>
"<subject>" <reviewed-sha>` works only when nothing conflicts. Slices in one batch always conflict on
the `kernel_api` line in `kernel/ts/src/runtime/world.ts` (keep the highest), on
`protocol/fixtures/invalid.json` (take the union of both sides' new cases, keep `json.dumps(indent=2)`
formatting, never prettier), on `docs/system/mechanics.md` end-of-file sections (keep both) and on the
generated `docs/toolbox.gen.json` and `docs/system-graph.gen.json` (run `elixir bin/contracts.exs`).
After a manual merge run the same checks `pm_merge.sh` runs before pushing. Never `git add -A` a
directory that holds a `node_modules` link (`168811a` committed one; untracked on the M12 batch).

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

## Open owner questions

1. W9 sleep, provisional "sleep provokes" (a hostile NPC in the room fights the sleeper): shipped in
   #380; still the owner's call to keep or reverse.
2. Balance 3 `loka-kgd.107.3`: do balance gates fail CI on the showcase only, or on every sampler?
   PM default: showcase only.
3. Settle tier (S1 to S4): part of "finish the toolbox"? PM default: after M15, with S2 (runtime rooms)
   behind a design record the owner approves.
4. RS-7 (receipt digests, save v3) refuses old device saves; deferred to the Realm unless the owner
   pulls it forward.

## Parked (polish lane)

- Open PR #372 (`loka-x6t`, combat playtest findings into the Book spec), branch
  `design/playtest-combat`.
- [Give action plan](plans/loka-x6t.31-give-action.md) for `loka-x6t.31` (Book never offers Give),
  drafted by Pi on 2026-10-13, not reviewed. Known gap: it offers Give to every NPC in the room
  without an engine check that the recipient accepts.
- Book UX from the Fable audit (`loka-x6t.39` to `.52`, word bar first) waits in the paused polish lane.
