# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place once per session, at its end; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #627; written 2026-11-05 by Claude Code (Opus 5.5), the editor build session (parallel, three agents). `kernel_api` is 1.157. Lean default in force since #533.

## Direction (owner 2026-10-30 to 2026-11-05)

- **The prologue is v1** (epic loka-g5hh): a free, complete 3 to 5 hour short story ending on the landing. Outline:
  [prologue outline](worldbuilding/notes/prologue-outline-2026-10-30.md) (Fable draft, not canon). **E5 is merged: the
  owner can write the prologue in the Book now** (`?dev=1`: double-click a line, Enter saves, Esc cancels, Cmd-Z puts
  back, `[`/`]` walk `~` lines).
- **The owner writes every player-facing word** in the prologue ([owner rules](system/owner-rules.md#process)).
  Exception: the PM writes the **showcase's** combat, corpse, shrine, resurrection and consumable words and the Book's
  chrome words when the designer rules them.
- **Plan downgrade around 2026-11-10** to Pro. Lean after it: one session, Sonnet for content, reviewers for engine changes,
  second opinions for save and contract changes. Author-side edge-case guards are nits, not fix rounds.
- **New direction (owner 2026-11-04, paraphrased):** authoring tool first, then write the story slowly on Pro; no
  aggressive mechanic expansion; polish, polish, polish. A Fable audit of every open Beads issue applied it: 7 closed,
  183 parked at P4 with label `deferred` (real ideas, kept), 143 reprioritised, 17 rot-prone closed.
- **Hunger and thirst are retired** (owner 2026-11-04, verbatim in loka-vduxr.61): food and drink give positive regen
  buffs (Well fed, Refreshed); no need pools ship (a check refuses them). Supersedes
  [pm-decision-mechanics-continuation-plan-2026-10-03](decisions/pm-decision-mechanics-continuation-plan-2026-10-03.md) line 35.
- **Hotbars** (combat and other) are a brainstorming and design session after E5 (loka-x6t.131 with x6t.110/.111/.69).
- **Story map** (owner 2026-11-04): borrow articy:draft's ideas, not the tool; generated from the compiled artifact;
  all eight recommendations in [the design](rnd/story-map-design-2026-11-05.md) section 12 accepted (one `outline.json`,
  Map | Story segment, no layout library in v1).
- **Scripting** is composition, not a language (Trigger, Policy, Steps, Check blocks); custom ambient lines are the
  default, the emote table serves reuse and later multiplayer.
- **The showcase is the regression bed**, unfrozen for combat only. **Combat follows DikuMUD/LegendMUD.**
  **PR bodies are the reviewer's brief.** **Authoring editor plan** ([record](decisions/owner-decision-authoring-editor-plan-2026-11-04.md)).

## Merged this session

E1 write path #610 (with vduxr.51 text keys), T1 treatments #611 (`spirit`, `reverie`; night reverie faint gold accepted),
S2 area folders #609, toolbox page #612, status lines #613, ambient emotes #614, Story map design #615 and S1 #620,
status icons below the line, smaller, Fable-drawn #616, hunger/thirst retired #618, flaky tests #619, E5 prose in the Book
#617, combat title #621 ("You attack a goblin!"; keys `combat.title_you_attack`, `combat.title_attacks_you`),
opening scene `on {start: true}` #622, death/level bugs #623, S3 areas #624, editor chrome ruling #626, kernel hygiene #627.

## In flight at handoff (agents keep running after /clear: run ListAgents first)

- **#625 loka-wfrgk.19** open conversation re-words edited lines: approved; merged head `5a6b957ac` pushed but GitHub had
  not synced the PR head. A background job waits for the sync and runs `bin/merge_pr.sh 625 loka-wfrgk.19`; if #625 is
  still open, rerun that.
- **loka-wfrgk.10 E2** shell (developer, worktree `loka-wfrgk.10`, brief in the PM scratchpad, mirrored by the issue's
  comments and [chrome rulings](design/editor-chrome-rulings.md)): then one reviewer with screenshots.
- **loka-vduxr.50** `.scene`/`.cut` lint in the panel (developer, worktree `loka-vduxr.50`): then one reviewer.

## Resume, in order

1. Finish the in-flight three. Before Pro (about 2026-11-10), parallel, at most three agents:
   - **Story map S2** (List view + Trace, after E2) under loka-wfrgk.18; designer pass on density and chips.
   - **E3a map** (loka-vduxr.52; uses the chrome tokens), then E3b.
   - Batches from the audit: compiler simplification (9x5y, 1b68q, 2bt2, n39c; fixture generators 273d, bmnj, n3mp);
     dialogue warning parity (vduxr.31/.32/.35, 69yuw); loka-kgd.214 test flakes; loka-vduxr.62 stale hunger refs;
     loka-vduxr.58.5 area companions; loka-vduxr.60 samplers; loka-wfrgk.20 and loka-wfrgk.14 nits.
2. **Pro, lean, one at a time:** E4a gate (loka-wfrgk.11), E4b generic card, E6a–e, wfrgk.16 resident compiler,
   wfrgk.13; the hotbar design session after E5; loka-x6t.132; designer batch for ambient emotes D1–D3 (loka-8ghm notes).

## Owner's writing list (prologue; text keys, no prose from agents)

`world.levelling.gained`, `world.levelling.level_up`, each `level_reached` line, each skill's `learned`, each rank's
`name` and `reached`, `combat.sanctuary`; combat lines, `tiers`, `conditions`, volley lines; corpse and revival lines;
`combat.title_you_attack` {target}, `combat.title_attacks_you` {attacker}; Well fed and Refreshed status names and meal
and drink lines; the opening dream's scene lines (reverie); ambient lines; the hub sign that still mentions hunger.

## Waiting on the owner

- **loka-kgd.210:** a death outside a fight: A straight into the spirit state, or **B (PM recommends)** a dead page with
  Let go first, as after a combat death. Either amends book-ui.md:786/:133 and spirit-state-rulings.md.
- **loka-g5hh.4:** new-game order: today dream, then chapter title, then wake (**PM now recommends keeping it**;
  beat 1 can be the dream's first line) vs title first.
- Older: ink-button round 3 (now after E5 with the hotbar session), studio defaults, weapon proficiency shape, store
  fees, iOS first, the save guarantee, #574 acceptance, #564 calls, hosting (12uz).

## Holds

- P3 hold (owner 2026-10-22): draft #454, kgd.188, 2lvx, 5i4c, x6t.98. loka-x6t.126 skill-gated room depth.

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
  Merges one at a time in the main checkout via `bin/merge_pr.sh`; a conflict after another merge goes back to the
  developer as "merge origin/main, no rebase" (force-push is forbidden). Known flakes are now fixed (#619); a red lint job
  from a `br` download 504 is rerun with `gh run rerun --failed`.
- Subagents work only in their own worktrees under `~/dev/worktrees.noindex`; a fresh worktree runs `bin/worktree_setup.sh`.
  The load gate refuses spawns at load 8 or more: wait with a background until-loop, never bypass.
- End: rewrite this page, push every branch with work, file the [retro](PM.md#retro-and-housekeeping-queue) items in Beads.
