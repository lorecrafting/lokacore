# PM handoff

The PM's session handoff, in the repo so any harness (local Claude Code, Claude Code in the cloud,
Pi) can take over. Live status stays in Beads and GitHub; this file holds only what they do not:
the next steps, the standing owner rules that the repo does not yet state, and open owner
questions. Rewrite it at each stable checkpoint (a merge, a review verdict, a pushed fix) and before
the session ends; commit and push it with the Beads export.

Written 2026-10-14 UTC by Claude Code (Opus 5.5) at the end of local session
0d166efd (stopped for a Claude Code restart to load the patched compaction hook), for the next
session to continue.

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

Done this session: draft #384 (loka-3jhb, housekeeping: Jev decision record and the brief-split
rule); both upstream comments posted (fast-jev-compaction#89, claude-code#99727; links in the
`loka-bwfo` notes). Batch branch `toolbox/batch-longwait` (= main 50e2af2f) exists, no PR yet.

Next, in order:

0. Prove the compaction fix (`loka-bwfo`) BEFORE any long agent. The cached hook
   (`hooks/fast-jev.ts`, original `.orig-0.3.0`) now rebuilds kept assistant rows and kept tool_result
   rows without their handle. Spawn a Sonnet general-purpose agent that reads large docs until it
   auto-compacts, calls the advisor once before compaction, and makes a few tool calls after it. Run
   both scripts from the `loka-bwfo` notes on its transcript (`dangling-parents.py`, `shared-ids.py`):
   both must print 0. Then resume it once with SendMessage: no 400 = proven; lift the no-advisor and
   never-resume rules (WORKFLOW token hygiene) in the housekeeping PR and close `loka-bwfo`. If live
   turns break (thinking blocks dropped) or the 400 returns: turn fast-jev compaction off (built-in
   compaction) and tell the owner.
1. Long-wait slice `loka-kgd.152` + `.151`: design approved (copied into the `.152` notes with the
   PM rulings). WIP on `toolbox/longwait-loop` at `e8eea2f0`, worktree `longwait-loop`: unfinished
   and unchecked. A fresh developer finishes it from the brief, the design note and the rulings, then
   main review + second opinion (proposal.ts, protocol rule).
2. FD1 `loka-kgd.138` on `toolbox/m12-delayed` at `56cbcc33` (merged main, kernel_api 1.90; throw
   wedge, holders, sight counterfeits, when-leaf refusal, XP probe done). Left: confirm red controls
   and the raid pair-test hash-order fix, `bin/prepush.sh`, `/code-review medium`, CI; then main
   review + second opinion. After `.152` lands, remove FD1's "wait end + 1" clamp. Merge both slices
   into `toolbox/batch-longwait`, one Fable batch review, merge.
3. Realm seams batch `loka-kgd.150` (RS-1, RS-4 + row 38 `loka-kgd.133`, RS-2 + RS-3, RS-5, RS-6,
   RS-8; RS-7 deferred), then the Book word bar `loka-x6t.39` in the mechanics lane.
4. M13 (FD3 storylets first), Built rooms `loka-kgd.109`, M14 (43b mounts right after 43a), M15,
   Homestead, then Settle S3/S4 only on an owner yes.
5. Housekeeping draft #384 then takes `loka-mm5v` and `loka-xroj` (after the long-wait batch; they
   build on it), `loka-dgl6`, and the token-hygiene update from step 0.

Merge mechanics: `bin/pm_merge.sh <batch-worktree> <batch-branch> <slice-branch> <review-branch>
"<subject>" <reviewed-sha>` resolves the routine conflicts (generated files, the review index,
appended `docs/system/mechanics.md` sections, the `kernel_api` line in `world.ts`) and stops on
anything else; a code conflict goes to the slice developer. `protocol/fixtures/invalid.json` is still
by hand (union, `json.dumps(indent=2)`). Developers run `bin/prepush.sh` before every push and never
wait on CI; the PM watches CI.

Session lessons (2026-10-14):
- Until step 0 passes: agents never call the advisor, never wait in the background, and no agent is
  resumed after a compaction. Check its transcript for `compact_boundary` before any SendMessage.
  This session two Opus developers died on the 400: one resumed after one compaction (the PM did not
  check), one mid-run after three compactions with no resume (each compaction rewrote its one advisor
  message under the same `message.id`).
- Run a second opinion on the head after the main review's fix round, not in parallel on a head the
  main review fails.
- The pre-commit hook blocks Prettier issues; run `npx prettier --write` on the files, never
  `--no-verify`.

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

## Owner answers this session (paraphrased unless quoted)

- 2026-10-14 (session 0d166efd): "yes restart after the batch merges, and post both comments";
  then restart now ("yes go ahead").

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
