# PM handoff

The PM's session handoff, in the repo so any harness (local Claude Code, Claude Code in the cloud,
Pi) can take over. Live status stays in Beads and GitHub; this file holds only what they do not:
the next steps, the standing owner rules that the repo does not yet state, and open owner
questions. Rewrite it at each stable checkpoint (a merge, a review verdict, a pushed fix) and before
the session ends; commit and push it with the Beads export.

Written 2026-10-14 UTC by Claude Code (Opus 5.5) at the end of local session
01DvPym9pzaxaCbY2Ycszv9f (after batch M12), for the next session to continue.

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
Batch order: the owner-adopted [priority plan](briefs/toolbox-priority-plan-2026-10-14.md)
(2026-10-14), with the owner's answers below.

Done this session: #382 (loka-j945, prepush checks and the pm_merge conflict resolver) and #383
(loka-kgd, mechanics batch M12: 37a, 37b, W13, W12, 39, FD4, FD8, two-shop save fix; `kernel_api` 1.89).

Next, in order:

0. First, in a fresh session: prove the compaction-plugin fix (`loka-bwfo`): run
   `python3 -I dangling-parents.py <agent transcript>` on one compacted subagent
   (expect 0; the script and the bug report text are in the
   `loka-bwfo` notes). Then file the report at tamaratran/fast-jev-compaction and anthropics/claude-code.
   The patched hook is in the plugin cache (`hooks/fast-jev.ts`, original kept as `.orig-0.3.0`); a
   marketplace update reverts it.
1. Long-wait slice: `loka-kgd.152` (P1, one long wait faults `nonfuture_job`, `compose_job.ts:17`),
   `loka-kgd.151` (Chapter 1 deer `conflicting_write` on one long advance) and FD1 delayed reactions
   `loka-kgd.138`, all jobs inside one long advance. FD1 is built on `toolbox/m12-delayed` at
   `afe53bee` (kernel_api 1.88; records on `review-m12-delayed`, `-2nd`, `-recheck`, `-2nd-recheck`,
   `-recheck2`) and is not merged: a delayed step that throws leaves its job pending forever, and
   delayed jobs should share the proposal's holder map (pass `p.holders` into `runDelayed`, loka-akl7)
   instead of per-op special cases. Details in the `.138` notes. Brief it as one engine slice (split
   engine and content if large, `loka-3jhb`), main review + second opinion (proposal.ts).
2. Realm seams batch `loka-kgd.150` (RS-1, RS-4 + row 38 `loka-kgd.133`, RS-2 + RS-3, RS-5, RS-6,
   RS-8; RS-7 deferred), then the Book word bar `loka-x6t.39` in the mechanics lane.
3. M13 (FD3 storylets first), Built rooms `loka-kgd.109`, M14 (43b mounts right after 43a), M15,
   Homestead, then Settle S3/S4 only on an owner yes.
4. The next housekeeping PR carries the approved retro items `loka-mm5v`, `loka-dgl6`, `loka-3jhb`,
   `loka-xroj` (and `loka-bwfo` above) plus the Jev decision record.

Merge mechanics: `bin/pm_merge.sh <batch-worktree> <batch-branch> <slice-branch> <review-branch>
"<subject>" <reviewed-sha>` now resolves the routine conflicts itself (generated files, the review
index, appended `docs/system/mechanics.md` sections, the `kernel_api` line in `world.ts`) and stops on
anything else; a code conflict goes to the slice developer (merge the batch into the slice branch).
`protocol/fixtures/invalid.json` is still by hand (union, `json.dumps(indent=2)`). Developers run
`bin/prepush.sh` before every push and never wait on CI; the PM watches CI.

Session lessons (2026-10-14):
- Subagents died seven times on "`server_tool_use` ids must be unique" after a compaction, on a
  SendMessage resume or a self-resume after a background CI wait. Until `loka-bwfo` proves the fix:
  never resume a compacted agent, keep agents short, and tell every agent: foreground commands only,
  no background waits.
- Run a second opinion on the head after the main review's fix round, not in parallel on a head the
  main review fails.

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

## Cloud session lessons (if the next session is in the cloud again)

- `gh` works over REST only (GraphQL blocked: no `gh pr create`/`merge`; use the GitHub MCP tools);
  `gh auth status` misreports. git and REST branch deletion are blocked: merged branches
  `toolbox/m10-*` and `toolbox/m11-*` remain on GitHub; the owner deletes them locally
  (`git push origin --delete <branch>`).
- `br` 0.7.4 has no reachable release asset; build it from the `v0.7.4` tag with cargo (13 minutes).
- The disk fills after about seven worktrees (2.2 GB each); remove merged worktrees first.
- Agents must never run `git worktree prune` while another agent's worktree is in use.

## Owner answers this session (paraphrased unless quoted)

- Adopted the Fable priority plan ("keep going, follow the fable priority plan"); defer carry-over
  48a-c and RS-7; Settle per the PM recommendation (S1 into Homestead, S2 merged into Built rooms,
  S3/S4 after Homestead on a yes); Built rooms between M13 and M14; Balance gates on the showcase only;
  keep W9 "sleep provokes"; `loka-b60` at the release candidate; "yes to word bar, put mounts after
  43a in M14"; approved all five retro items.
- `fast-jev-compaction` stays on with `compactAtPercent: 101` (owner: "yes apply compactAtPercent
  101, if you tihnk that is good for us"; "please fix the jev-compaction plugin i think its useful").

## Open owner questions

None open.

## Parked (polish lane)

- Open PR #372 (`loka-x6t`, combat playtest findings into the Book spec), branch
  `design/playtest-combat`.
- [Give action plan](plans/loka-x6t.31-give-action.md) for `loka-x6t.31` (Book never offers Give),
  drafted by Pi on 2026-10-13, not reviewed. Known gap: it offers Give to every NPC in the room
  without an engine check that the recipient accepts.
- Book UX from the Fable audit (`loka-x6t.39` to `.52`, word bar first) waits in the paused polish lane.
