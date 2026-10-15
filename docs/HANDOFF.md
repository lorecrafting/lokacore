# PM handoff

The PM's session handoff, in the repo so any harness (local Claude Code, Claude Code in the cloud,
Pi) can take over. Live status stays in Beads and GitHub; this file holds only what they do not:
the next steps, the standing owner rules that the repo does not yet state, and open owner
questions. Rewrite it at each stable checkpoint (a merge, a review verdict, a pushed fix) and before
the session ends; commit and push it with the Beads export.

Written 2026-10-14 UTC by Claude Code (Opus 5.5) in local session 84e03897, at a clean checkpoint
(no agent running; every branch pushed) for an owner-requested clear.

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
Batch order: the owner-adopted [priority plan](briefs/toolbox-priority-plan-2026-10-14.md).
Compaction: fast-jev is off; built-in compaction confirmed (24-43 s, with a summary). The advisor,
background waits and resumes after a compaction are allowed (owner, 2026-10-14).

Done this session: #385 (`loka-kgd.107.21`, prose lint) merged; Realm seams slices all built and
merged into `toolbox/batch-rs`; batch PR #386 opened; long-wait and FD1 reviewed to approval.

Next, in order:

1. **Realm seams batch #386** (`loka-kgd.150`, branch `toolbox/batch-rs` at `85e84069`, main merged in).
   RS-1, RS-4 + row 38, RS-6 + RS-8, RS-2 + RS-3, RS-5 all merged. Run the one **Fable batch
   review** on the head (it was held for load). Ask it to check: RS-3's claim that jobs store their
   character (the wage job row stores none, per the RS-2/3 developer); the NPC-entrant no-op for
   `quest.activate` on `entity_entered_room` (no loader test pins it). Rulings already made are in each
   child's Beads notes. Then CI green on the head, merge (`--match-head-commit`), close the children
   (`.150.1-.7`, `loka-kgd.133`), follow-up `loka-6ij9`.
2. **Long-wait batch** (`toolbox/batch-longwait` = main 50e2af2f, no PR yet):
   - `loka-kgd.152` + `.151` on `toolbox/longwait-loop` at `3b25c212`: approved (main review +
     recheck, Fable second opinion + recheck). The last CI runs were cancelled: the sim job hit its
     10-minute timeout (a slowdown, fixed in 3b25c212: 200 seeds 8.5 s vs main 7.5 s). Check CI on
     3b25c212; if sim still times out, add a target->group index in `proposal_hours.ts` (one more
     dev run). Then `bin/pm_merge.sh` into the batch with review records (origin branches
     `review-longwait`, `-recheck`, `-fable`, `-fable-recheck`). Follow-ups `loka-7n60`, `loka-l9oq`.
   - FD1 `loka-kgd.138` on `toolbox/m12-delayed` at `7c71e119`: approved (main + Fable second
     opinion; records on origin `review-m12-delayed-final`, `review-m12-delayed-fable`). After .152 is
     in the batch, one Opus run: merge the batch (one conflict at `proposal.ts:288-292`, keep FD1's
     `p` arg and 6-arg `statusGroup`), remove the "wait end + 1" clamp for job-run deliveries only
     (keep it for root deliveries, ruling (b) in `.152`), count delayed runs in steps/deliveries
     (`proposal.ts:284`), update `raid.test.ts:391`. Scoped recheck, then one Fable batch review,
     open the batch PR, merge.
3. **M13**: FD2 (`loka-kgd.139`) then FD3 (`loka-kgd.140`); Fable briefs with PM rulings are in their
   Beads notes (kernel_api 1.91, 1.92). Start after both batches land (FD2 needs FD1's `policy.ts`
   and RS-5's `view.ts`). Then a Fable brief run for 16, 33, FD5 + `loka-kgd.22`, FD7 (owner rule
   below), W15 + FD9 by Opus.
4. Word bar `loka-x6t.39` (touch-first, optional keyboard for Say), Built rooms `loka-kgd.109`, M14
   (ghost-walk `loka-kgd.69` with jail; mounts after 43a), M15 (G10 is letters by job only; pins and
   notes descoped), Homestead, Settle S3/S4 only on an owner yes.
5. Housekeeping draft #384: has the token-hygiene update, `loka-9ruc` (pre-push hook runs
   `bin/prepush.sh`), `loka-oy8i` (session_status compaction line), the G10 plan edit. Add
   `loka-mm5v`, `loka-xroj` after the long-wait batch, `loka-dgl6`, and this session's retro items if
   approved. Its branch edits `docs/HANDOFF.md` (one line): on conflict keep main's HANDOFF and
   re-apply "the pre-push hook runs it". Close `loka-bwfo` when #384 merges.

Merge mechanics: `bin/pm_merge.sh <batch-worktree> <batch-branch> <slice-branch> <review-branch>
"<subject>" <reviewed-sha>`; a new batch worktree needs `bin/worktree_setup.sh` before its first
merge commit (Prettier hook). Generated files on conflict: regenerate (`elixir bin/contracts.exs`
writes `docs/checks.gen.json`). Developers run `bin/prepush.sh` (the #384 hook will enforce it) and
never wait on CI; the PM watches CI and treats a cancelled job at its timeout as red.

Session lessons (2026-10-14, session 84e03897):
- A developer's `/code-review` result can be the only record of its findings: put open items in
  Beads at handback (retro `loka-z167`).
- "cancelled" in `gh run list` can be a job timeout, not a superseded run: open the run (retro
  `loka-13i3`).
- Spotlight: the owner added `~/dev` to Spotlight Privacy; mds load spikes from the main checkout
  should stop.

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

## Owner answers this session (paraphrased unless quoted)

- 2026-10-14 (session 84e03897): approved retro items `loka-9ruc`, `loka-oy8i`; G10 map pins and
  journal notes descoped ("maybe descope that for now"), letters by job kept; death penalty options
  (row 47) kept ("lets keep it"); Fable drafts briefs for hard rows ("yes record the fable brief
  rule", rule above); `~/dev` added to Spotlight Privacy.
- Earlier 2026-10-14: fast-jev compaction OFF ("ok keep it off"); Fable allowed for important
  judgment work; adopted the Fable priority plan; Settle S1 into Homestead, S2 cut, S3/S4 on a yes;
  word bar touch-first; mounts after 43a in M14.

## Open owner questions

- Cloud compute (`loka-2of`, prices refreshed in its notes): the bottleneck is M1 CPU, not CI (CI is
  free: the repo is public). PM pick: a Hetzner CAX41 agent box (~$45/mo, 16 ARM cores) or CAX31
  (~$20/mo, within the $20 budget). Owner to choose and sign up; the PM then writes setup steps.
- Retro items `loka-13i3`, `loka-z167`, `loka-o5c2` (this session): approve or reject.

## Parked (polish lane)

- Open PR #372 (`loka-x6t`, combat playtest findings into the Book spec), branch
  `design/playtest-combat`.
- [Give action plan](plans/loka-x6t.31-give-action.md) for `loka-x6t.31` (Book never offers Give),
  drafted by Pi on 2026-10-13, not reviewed. Known gap: it offers Give to every NPC in the room
  without an engine check that the recipient accepts.
- Book UX from the Fable audit (`loka-x6t.39` to `.52`, word bar first) waits in the paused polish lane.
