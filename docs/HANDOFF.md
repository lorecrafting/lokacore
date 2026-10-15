# PM handoff

The PM's session handoff, in the repo so any harness (local Claude Code, Claude Code in the cloud,
Pi) can take over. Live status stays in Beads and GitHub; this file holds only what they do not:
the next steps, the standing owner rules that the repo does not yet state, and open owner
questions. Rewrite it at each stable checkpoint (a merge, a review verdict, a pushed fix) and before
the session ends; commit and push it with the Beads export.

Written 2026-10-14 UTC by Claude Code (Opus 5.5) in local session c4308118, at a clean checkpoint
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

Done this session (c4308118): #386 (`loka-kgd.150`, Realm seams batch) merged at bac7d6fe; #387
(`loka-kgd.152`/`.151` long wait + `loka-kgd.138` FD1 delayed reactions + drain perf) merged at cc9a62fa
(CI sim 341 s vs main 350 s). M13 batch `toolbox/batch-m13` at 0e2914c6 holds main + row 16
(`loka-nfdq`), FD2 (`loka-kgd.139`), FD3 (`loka-kgd.140`), each reviewed to APPROVE (records in
docs/reviews/2026-10-14-*). Settle S3/S4 approved and designed; FD7 Book half decided (owner answers below).

Next, in order:

1. **Row 33** theft, fence, witnessed offense (`loka-icr4`) on `toolbox/m13-theft` at a17c31ed
   (worktree `m13-theft`, off batch-m13 1174492e; prepush ok; kernel_api 1.94). A fresh Opus developer
   finishes the LEFT list in its Beads notes (rerun mobile theft, locks and Elixir disposition/lock/NPC/hash
   tests; re-grep /code-review lines), merges `toolbox/batch-m13` in, and answers the open questions
   with PM rulings (steal back from a fence; blind or asleep victim; a stolen offer or `locks` without
   `world.theft` loads silently: refuse it; designer confirms the "Inside" heading). Rulings already made
   are in its notes (fence offers: only `stolen: true` may name another NPC's item; crowd sees, unseen =
   victim alone or thief concealed; offense subject = the thief). Then fresh Opus review, pm_merge.
2. **FD5** witness ledger (`loka-kgd.142`) + `loka-kgd.22` (reaction moves an NPC): one run on
   `reaction.ts` after 33; Fable brief in their notes (kernel_api next free; 1.95+).
3. **FD7** ask about topic (`loka-kgd.144`): kernel half now (Fable brief in notes), Book half as
   "Ask about X" rows on the NPC card in its own designer-consulted slice.
4. W15 + FD9 (Opus briefs). Then one Fable batch review on the M13 head, batch PR, merge; close
   `loka-nfdq`, `.139`, `.140`, `loka-icr4` and the rest on merge.
5. **`loka-j958` (P1 bug):** a status re-applied inside one long wait faults the wait (3-day wait in
   toolbox_showcase, npc_status_sampler, variants_sampler); fix in the status composer, then drop the
   three exceptions in `kernel/ts/test/longwait_property.test.ts`. First engine bug after M13 rows in flight.
6. Then word bar `loka-x6t.39`, Built rooms `loka-kgd.109`, Homestead `loka-kgd.108`, Settle S3
   `loka-mytp` / S4 `loka-oxgk` (design: docs/rnd/settle-design-2026-10-14.md on #384; five slices;
   Fable briefs at build time), M14, M15.
7. **Housekeeping draft #384** (`housekeeping/2026-10-14b`, worktree `housekeeping-1014b`, head
   3e7cdb64 + b1adbbb2 decision record + addc7c7c Settle design): has token hygiene, `loka-9ruc`,
   `loka-oy8i`, G10 plan edit, `loka-13i3`, `loka-z167`, `loka-o5c2`, `loka-dgl6`, `loka-mm5v`, the
   Settle/FD7 decision record. Add `loka-xroj` (twin loader-floor fixture), then one review, merge;
   close `loka-bwfo` and the items. Retro items from this session for owner approval: `loka-0j8u`,
   `loka-bjwq`, `loka-60rs`, `loka-iqga`, `loka-a2av`; also `loka-cnqx` (prepush log names).

Merge mechanics: `bin/pm_merge.sh <batch-worktree> <batch-branch> <slice-branch> <review-branch>
"<subject>" <reviewed-sha>`; a new batch worktree needs `bin/worktree_setup.sh` before its first
merge commit (Prettier hook). Generated files on conflict: regenerate (`elixir bin/contracts.exs`
writes `docs/checks.gen.json`). Developers run `bin/prepush.sh` (the #384 hook will enforce it) and
never wait on CI; the PM watches CI and treats a cancelled job at its timeout as red.

Session lessons (2026-10-14, session c4308118):
- Local perf proxies can hide a CI slowdown (200 seeds equal; CI 10000-sequence test +27%): judge
  perf by the CI sim job time on the head (retro `loka-60rs`).
- Merging two reviewed batches can break a rule neither broke alone (FD1 delayed jobs lost the event
  subject RS-4 needs): run the batch-level review on the merged head, not before the main merge.
- Run `uptime` in its own call before every spawn (broken once this session at load 15.9; retro `loka-0j8u`).

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

- 2026-10-14 (session c4308118): Settle S3/S4 yes ("yes lets do s3 and s4, fable will plan it right?
  please make it super world class!"); the seven Settle questions and FD7 "all as recommended" (record
  `docs/decisions/owner-decision-settle-and-fd7-2026-10-14.md` on #384). repowise: skip for now (PM
  assessment; one-session trial held in reserve).

- 2026-10-14 (session 84e03897): approved retro items `loka-9ruc`, `loka-oy8i`; G10 map pins and
  journal notes descoped ("maybe descope that for now"), letters by job kept; death penalty options
  (row 47) kept ("lets keep it"); retro items `loka-13i3`, `loka-z167`, `loka-o5c2` approved ("approve all three retro items"); Fable drafts briefs for hard rows ("yes record the fable brief
  rule", rule above); `~/dev` added to Spotlight Privacy.
- Earlier 2026-10-14: fast-jev compaction OFF ("ok keep it off"); Fable allowed for important
  judgment work; adopted the Fable priority plan; Settle S1 into Homestead, S2 cut, S3/S4 on a yes;
  word bar touch-first; mounts after 43a in M14.

## Open owner questions

- Cloud compute (`loka-2of`, prices refreshed in its notes): the bottleneck is M1 CPU, not CI (CI is
  free: the repo is public). PM pick: a Hetzner CAX41 agent box (~$45/mo, 16 ARM cores) or CAX31
  (~$20/mo, within the $20 budget). Owner to choose and sign up; the PM then writes setup steps.

- Approve or reject this session's retro items: `loka-0j8u` (hook refuses a spawn at load 8+),
  `loka-bjwq` (developers always push; read prepush status), `loka-60rs` (CI sim time per batch head),
  `loka-iqga` (merge_resolve combines one-row doc edits and imports), `loka-a2av` (collapse Beads notes
  at approval); plus `loka-cnqx` (prepush per-run log directory).

## Parked (polish lane)

- Open PR #372 (`loka-x6t`, combat playtest findings into the Book spec), branch
  `design/playtest-combat`.
- [Give action plan](plans/loka-x6t.31-give-action.md) for `loka-x6t.31` (Book never offers Give),
  drafted by Pi on 2026-10-13, not reviewed. Known gap: it offers Give to every NPC in the room
  without an engine check that the recipient accepts.
- Book UX from the Fable audit (`loka-x6t.39` to `.52`, word bar first) waits in the paused polish lane.
