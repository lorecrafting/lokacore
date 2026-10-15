# PM handoff

The PM's session handoff, in the repo so any harness (local Claude Code, Claude Code in the cloud,
Pi) can take over. Live status stays in Beads and GitHub; this file holds only what they do not:
the next steps, the standing owner rules that the repo does not yet state, and open owner
questions. Rewrite it at each stable checkpoint (a merge, a review verdict, a pushed fix) and before
the session ends; commit and push it with the Beads export.

Written 2026-10-15 UTC by Claude Code (Opus 5.5) in local session 84e03897, at a clean checkpoint
(no agent running; every branch merged or pushed) for an owner-requested clear.

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

Done this session (84e03897), all on `main`:
- #389 (`loka-kgd`, mechanics batch M13: sneak, skill voices, storylets, theft, witness, ask kernel
  half, recognition and titles; kernel_api 1.94-1.97) at b9371090. Fable batch review APPROVE WITH NOTES;
  fix round found a real bug: `ask`/`whisper` missing from the invocation TARGETS.
- #390 (`loka-s05w`, FD7 Book half: "Ask about X" cards on the NPC page) at e66def4a.
- #391 (`loka-x6t.39`, word bar batch: use-on pair cards, GameView `spell_words`/`phrases` at 1.98,
  Chip component and Word block with "Type a word" for Say) at 06bac4f5.
- #392 (`loka-kgd.109`, Built rooms batch S1-S4: blueprints and sites, raise the hut through a carpenter
  service, time and timber, weather and mend; kernel_api 1.99; new compose rule: a status may sit on an
  entity created earlier in the same proposal) at c520bbd9. Save second opinions on S2-S4.

Next, in order:

1. **`loka-j64e` at kernel_api 1.100**, its own hosted PR from `main`: an optional authored reason text
   key on a recipe, so a learned spell the actor cannot cast yet shows a reason (today "not now"). Brief
   in its Beads notes (option a; one reason for the whole policy).
2. **Homestead batch A** (`toolbox/batch-homestead-a` from `main` after j64e): hs-1 `loka-5m0u`
   (`replenish.run` reaction step, 1.101), then hs-2 farming (`loka-kgd.108.1`), hs-3 fishing (`.108.3`),
   hs-4 animals (`.108.2`), hs-5 cooking (`.108.4`). Batch B: hs-6 furnishing (`.108.6` + Settle S1),
   hs-7 gifting and barter (`.108.5` + `loka-kgd.70`), hs-8 Give in the Book (`loka-x6t.31`, designer
   consult), hs-9 raze (`loka-otn4`). All briefs: `br show loka-kgd.108` notes, "FABLE BRIEFS
   HOMESTEAD" (COMMON block + one section per slice + PM rulings). Fable said hs-2/3/4 may run in
   parallel after hs-1 (content only) and hs-5 beside hs-1.
3. Then Settle S3 `loka-mytp` / S4 `loka-oxgk` (Fable briefs at build time), M14, M15.
4. Follow-ups filed this session: `loka-trex` (built room can share a map cell), `loka-z4cp` (permanent
   status still schedules a tick), `loka-kgd.157` (npc.move leaves the patrol cursor), `.158` (TARGETS
   duplicates VERBS by hand). Older: `loka-kgd.154`, `.155`, `.156`, `loka-ynfo`, `loka-3wwm`.

Merge mechanics: `bin/pm_merge.sh <batch-worktree> <batch-branch> <slice-branch> <review-branch>
"<subject>" <reviewed-sha>` (the reviewed sha must equal the slice's origin head, so put the record on
the slice branch or pass the record branch built on that head). A generated `docs/reviews/README.md`
conflict: rerun `bin/review_index.sh`. Each new kernel_api floor needs a case in
`protocol/fixtures/loader_floors.json` (#384): put it in the brief. `bin/after_merge.sh` stops on the
owner's untracked `scripts/` (retro `loka-jxwu`): do its steps by hand until fixed.

Session lessons (2026-10-15, session 84e03897):
- Check the slice's own CI before `pm_merge` (word bar S2 was merged red; retro `loka-tx2h`).
- A sampler hash change also needs its transcript known answer and the SystemDataModel Impact story
  list; put it in every brief that touches a sampler (broke CI twice; retro `loka-j6qd`).
- Store the developer's check table in Beads at handback, before spawning the reviewer (reviewers
  could not find it three times; retro `loka-8lkq`).
- Kernel tests that send ready Commands miss invocation gaps: a new verb needs one test through the
  Book's resolve path (C11 in M13).
- Developers cannot run the browser check in a slice worktree (retro `loka-uh5u`); stories stand in.

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

- 2026-10-15 (session 84e03897): retro `loka-wu5e` approved ("approved"): every brief requires the
  developer to mutate every new conditional in its diff before handback and report each in the
  check-to-test table; until developer.md says so (next housekeeping PR), paste it into each brief.
- 2026-10-15 (session 84e03897): PM rulings the owner may overrule (none asked directly):
  Built rooms build through a hired carpenter NPC, not a free-hand verb; raze moved to Homestead;
  Homestead: cook NPC (no own hearth yet), fishing is a luck miss with hour/season/weather catches (no
  rarity table), no chicks in v1 (row 45 later), barter at price 0, Give as "Give to <NPC>" cards on the
  item page; word bar: `learned` required on every spell, static say phrases, keyboard behind a "Type a
  word" control, ask never in the bar.

## Open owner questions

- Cloud compute (`loka-2of`, prices refreshed in its notes): the bottleneck is M1 CPU, not CI (CI is
  free: the repo is public). PM pick: a Hetzner CAX41 agent box (~$45/mo, 16 ARM cores) or CAX31
  (~$20/mo, within the $20 budget). Owner to choose and sign up; the PM then writes setup steps.

- Approve or reject retro items: from 2026-10-14 `loka-0j8u` (hook refuses a spawn at load 8+),
  `loka-bjwq` (developers always push; read prepush status), `loka-60rs` (CI sim time per batch head),
  `loka-iqga` (merge_resolve combines one-row doc edits and imports), `loka-a2av` (collapse Beads notes
  at approval), `loka-cnqx` (prepush per-run log directory); from 2026-10-15 `loka-hisj` (/code-review names its target), `loka-jxwu`
  (after_merge.sh ignores untracked files), `loka-tx2h` (pm_merge refuses a red reviewed sha),
  `loka-j6qd` (sampler hash change runs transcripts and the Impact story check), `loka-8lkq` (check table
  in the last commit body), `loka-uh5u` (browser checks in slice worktrees).

## Parked (polish lane)

- Open PR #372 (`loka-x6t`, combat playtest findings into the Book spec), branch
  `design/playtest-combat`.
- [Give action plan](plans/loka-x6t.31-give-action.md) for `loka-x6t.31` (Book never offers Give),
  drafted by Pi on 2026-10-13, not reviewed. Known gap: it offers Give to every NPC in the room
  without an engine check that the recipient accepts.
- Book UX from the Fable audit (`loka-x6t.40` to `.52`) waits in the paused polish lane (`.39` word bar
  shipped in #391; `loka-x6t.31` Give is now Homestead hs-8).
