# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place once per session, at its end; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #652; written 2026-11-05 by Claude Code (Opus 5.5), the editor build session (parallel, three agents). `kernel_api` is 1.158. Lean default in force since #533.

## Direction (owner 2026-10-30 to 2026-11-05)

- **The prologue is v1** (epic loka-g5hh): a free, complete 3 to 5 hour short story ending on the landing. Outline:
  [prologue outline](worldbuilding/notes/prologue-outline-2026-10-30.md) (Fable draft, not canon). The owner writes it
  in the editor (`bin/loka dev <cartridge>`, `?dev=1`): double-click a line, Enter saves, Esc cancels, Cmd-Z puts back,
  `[`/`]` walk `~` lines; typing over a bare `~` replaces it.
- **The owner writes every player-facing word** in the prologue ([owner rules](system/owner-rules.md#process)); agents use `~`.
  Exception: the PM writes the **showcase's** combat, corpse, shrine, resurrection and consumable words and the Book's
  chrome words when the designer rules them.
- **Do not wait for Pro (owner 2026-11-05):** build every editor slice now (E6, S3, hotbar, the rest) while the plan
  limit allows. The plan drops to Pro around 2026-11-10; after it: one session, Sonnet for content, reviewers for engine
  changes, second opinions for save and contract changes. Author-side edge-case guards are nits, not fix rounds.
- **Authoring tool first, then write slowly; no aggressive mechanic expansion; polish** (owner 2026-11-04). 183 ideas
  parked at P4 with label `deferred`.
- **Fable** reviews foundation, trust-boundary and contract slices and gives design second opinions; developers are Opus.
- **Hunger and thirst are retired** (loka-vduxr.61): food and drink give Well fed / Refreshed regen buffs.
- **Death outside a fight** (owner option B, #629/#634): the dead page in the died-in room (strong red edge, death
  lines, Let go), then the spirit state. **New-game order** stays dream, chapter title, wake (loka-g5hh.4 closed).
- **Hotbar** (owner 2026-11-05, loka-x6t.131): style **Inked**; a fixed strip at the Combat page bottom, four slots in
  author order (configurable later, x6t.111), wedge cooldown from 12 with a dim glyph, barred = dim glyph and no wedge,
  the spell and skill list opens from the last slot (x6t.110), no captions.
- **Story map**: generated from the artifact, Map | Story | Flow in the left slot; v1 is S1 to S3. PM calls on Fable's
  advice (owner may override): rooms labelled by key, one map level at a time, Trace in the slot, left column max 640,
  Flow's play offers as disabled stubs.
- **Scripting** is composition (Trigger, Policy, Steps, Check). **The showcase is the regression bed. Combat follows
  DikuMUD/LegendMUD. PR bodies are the reviewer's brief.** [Editor plan](decisions/owner-decision-authoring-editor-plan-2026-11-04.md).

## The editor today (main)

E2 three-column shell (Cmd-K over `/find`, layout kept, dark), E3a map and E3b map edits (locked by default), E4a edit
model and gate, E4b generic card (styled, chrome rulings section 7), E6a Room card with Book add-here, world picker and
New world (`bin/loka new cartridge <name> [--from cartridges/<c>]`), resident compiler (about 250 ms warm per edit),
Story map S1 and S2 (list, Trace, Knowledge, Pacing, Bind), `.scene`/`.cut` lint, area-aware `bin/loka new --area`.

## In flight at handoff (agents keep running after /clear: run ListAgents first)

- **#651 loka-wfrgk.8 E6e World card:** reviewer running. Then merge origin/main into it (E6a #649 merged and touched
  the same registry files), fix round if any, merge with `bin/merge_pr.sh 651 loka-wfrgk.8`.
- **loka-wfrgk.4 E6b NPC and Item cards:** developer, worktree `loka-wfrgk.4`; then one reviewer.
- **loka-x6t.131 hotbar style guide and spec:** Fable designer, worktree `loka-x6t.131-guide`: `docs/design/icon-style-guide.md`,
  the hotbar spec in `book-ui.md`, a developer brief on the issue. Merge on green, then build.

## Resume, in order (three agents at most)

1. Finish the in-flight three.
2. **E6c** rules blocks (loka-wfrgk.5, after E6b), then **E6d** story inspectors (loka-wfrgk.6, after E6c); one reviewer each.
3. **Story map S3** flow graph (rulings in [editor map and story rulings](design/editor-map-and-story-rulings.md), brief on loka-wfrgk.18); Fable review.
4. **Hotbar build** from the spec; an engine slice first if the spec names a missing cooldown field.
5. **loka-wfrgk.13** drag a template into a room; **loka-wfrgk.40** generic card overflow check.
6. Batches: samplers (loka-vduxr.60), the editor nits filed today (loka-wfrgk.21 to .39, loka-vduxr.63 to .77,
   loka-kgd.216 to .218, loka-wfrgk.18.3 to .5), dialogue warning parity (vduxr.31/.32/.35, 69yuw, low), designer
   batch: the two hunger mentions in `book-ui.md:1011` and `status-line-rulings.md:53`, the `book-ui.md` add-here line.

## Owner's writing list (prologue; text keys, no prose from agents)

`world.levelling.gained`, `world.levelling.level_up`, each `level_reached` line, each skill's `learned`, each rank's
`name` and `reached`, `combat.sanctuary`; combat lines, `tiers`, `conditions`, volley lines; corpse and revival lines;
`combat.title_you_attack` {target}, `combat.title_attacks_you` {attacker}; Well fed and Refreshed status names and meal
and drink lines; the opening dream's scene lines (reverie); ambient lines; the showcase hub sign that still mentions
hunger (`toolbox_showcase/text.json:1461`, `docs/showcase/hub-and-first-districts.md:79`); identity_sampler
`stranger_talk.scene` talk text.

## Waiting on the owner

- Nothing new. Older: studio defaults, weapon proficiency shape, store fees, iOS first, the save guarantee, #574
  acceptance, #564 calls, hosting (12uz).

## Holds

- P3 hold (owner 2026-10-22): draft #454, kgd.188, 2lvx, 5i4c, x6t.98. loka-x6t.126 skill-gated room depth.
- #632 belongs to another session (lokacore-fb), not the PM.

Storybook http://localhost:6006 serves main from the preview checkout (`bin/preview_update.sh`); a PR's stories need a
Storybook run from its own worktree. The owner sends polish prompts in the conversation; loop: [PM, Live polish session](PM.md#live-polish-session),
owner guide: [polish tour](design/polish-tour.md). Screenshots: Playwright needs `chromium.launch({ channel: 'chrome' })`.

## Session procedure

- Start: `mise install`, `br` 0.7.6 ([BEADS.md](BEADS.md)), `gh auth status`; `git pull --ff-only origin main`, then `br sync --import-only`;
  read [WORKFLOW](WORKFLOW.md), [PM](PM.md) and this page; `bin/session_status.sh` prints the board (`--full` for everything).
  After a `/clear`, run `ListAgents` first: the previous conversation's agents and shells keep running.
- Beads writes from the `main` checkout after `br sync --import-only`; new issues through `bin/br_create.sh`; each checkpoint is
  `bin/beads_checkpoint.sh`. Never commit `beads.db`. A child slice of an open issue gets its own child id to merge with.
- A kernel contract slice bumps only `INSTALLED.kernel_api` to main+1 at push; parallel claims rebump on the later merge.
- CI waits: `bin/wait_ci.sh <sha|branch>`; it can time out while runs are still going: confirm with `gh run list --commit`.
  Merges one at a time in the main checkout via `bin/merge_pr.sh`; it refuses when another session has the main checkout
  on a branch (ask that session to move to a worktree). A conflict after another merge goes back to the developer as
  "merge origin/main, no rebase" (force-push is forbidden). Review records sit on local `review-<PR>` branches and are
  carried by `after_merge`; a second record for the same PR is cherry-picked onto `review-<PR>` first.
- Subagents work only in their own worktrees under `~/dev/worktrees.noindex`; a fresh worktree runs `bin/worktree_setup.sh`.
  The load gate refuses spawns at load 8 or more: wait with a background until-loop, never bypass. Kill orphaned
  author servers and Playwright Chromes when load climbs (`ps` for `worktrees.noindex` and `--disable-field-trial-config`).
- End: rewrite this page, push every branch with work, file the [retro](PM.md#retro-and-housekeeping-queue) items in Beads.
