# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place once per session, at its end; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #689; written 2026-11-06 by Claude Code (Opus 5.5), the editor build session (parallel, five agents). `kernel_api` is 1.159 (no contract slice since). Lean default in force since #533.

## Direction (owner 2026-10-30 to 2026-11-06)

- **The prologue is v1** (epic loka-g5hh): a free, complete 3 to 5 hour short story ending on the landing. Outline:
  [prologue outline](worldbuilding/notes/prologue-outline-2026-10-30.md) (Fable draft, not canon).
- **The owner is now evaluating the editor by building prologue Part 1** (beats 1 to 9, outline section 7) and sends
  feedback in the conversation. Start: `bin/author.sh` (watcher, Book preview and panel in one command; with no
  argument it opens the last world; New world in the world picker makes one), later `bin/author.sh cartridges/<name>`.
  `bin/loka dev` alone is only the watcher. In the Book: double-click a line, Enter saves, Esc cancels, Cmd-Z puts back
  (also a palette Delete, #687), `[`/`]` walk `~` lines.
- **The owner writes every player-facing word** in the prologue ([owner rules](system/owner-rules.md#process)); agents use `~`.
  Exception: the PM writes the **showcase's** combat, corpse, shrine, resurrection and consumable words and the Book's
  chrome words when the designer rules them.
- **Descoping before Pro:** the plan drops to Pro around 2026-11-10; after it: one session, Sonnet for content, reviewers
  for engine changes, second opinions for save and contract changes. Author-side edge-case guards are nits, not fix rounds.
- **Agent cap is five** (owner 2026-11-05), counting agents waiting on CI. Never bypass hooks, the load gate or CI; wait
  for load with a background until-loop (two readings under 7 avoids a refused spawn).
- **Authoring tool first, then write slowly; no aggressive mechanic expansion; polish** (owner 2026-11-04). Ideas parked
  at P4 with label `deferred`. **loka-ni2zd** (NPC routines that really gather, sell and feed the economy) is NOT before
  Pro; the owner designs it in a separate session.
- **Fable** reviews foundation, trust-boundary, save and contract slices and gives design second opinions; developers are Opus.
- **Card bar:** a card never offers or writes what the compiler refuses; gates go two ways with the compiler
  `file:line`; a path leaves the generic baseline only when a bespoke part really draws it.
- **Developers walk in real Chrome on the final head**, screenshots in their own subfolder of the PM scratchpad, PR body
  drafts in their own worktree. **PR bodies are the reviewer's brief.**
- **Hunger and thirst are retired** (loka-vduxr.61). **Death outside a fight**: owner option B (#629/#634).

## The editor today (main)

Three-column shell (Cmd-K over `/find`), map with edits, edit model and gate, generic card with a capability-filtered
add menu, Book add-here, world picker and New world, resident compiler. Bespoke cards: Room (details save with one Tab,
optional parts folded), World, NPC/Item with Combat numbers and Schedule, Reaction/Action, Quest, Scene text, Dialogue
choice tree. Story map S1 to S3 with Add beat in number order and New outline. Palette New for every kind; Delete
refused while named (names the `file:line`), takes a set's extra files and templates with it, and is undone by Cmd-Z or
the palette's Undo (#687). Card saves run one at a time; a failed save shows a refusal and keeps the draft (#685).
Coverage tests (#684): a CRUD matrix over every registry kind, card round-trip, every server route has a caller; GAPS
rows in `kernel/ts/test/editor_crud.test.ts` name their Beads issue and go red when stale.

Go/no-go walk (this session, main af742b449): GO after #687. Built beats 1 to 3 in a fresh world; lint, Trace, Flow/Map
open, schedule, status, detail, add beat, failed save and reload all held.

## In flight at handoff

- Nothing. This session merged 40 PRs (#651 to #689).

## Resume, in order

1. **Owner feedback from the Part 1 build** comes first; file it in Beads, fix blockers. The owner's 2026-10-31
   Part 1 and NPC rulings are on main's outline (#689).
2. **Editor P2s:** loka-wfrgk.90 (a click-in edit saves the first keystroke early; cause is the queued
   `setTimeout(card.commit)` reading late, try field-to-field at CPU throttle 4; #688's attempt was reverted), .94
   (schedules and details hidden from add menus until World adds the capability), .68 (`bin/loka new` key churn),
   loka-lvo9i (CI flake: `editor_crud.test.ts:262` sees `play.test.ts:365`'s probe file).
3. **Coverage PR B** (every schema field reachable, every menu offer compiles, loka-bqnu4; design-table rows each name a
   test) and a read-only **test-cruft audit** driven by a mutation sweep (tests that kill no mutant).
4. **P3 editor nits:** loka-wfrgk.84.2, .86.1, .87.1, .89, .91, .92.1, .92.2, .95, .65, .72, .81, .82, .42.x, .43, .47,
   .53.x, .54, .56, .18.x.
5. **Engine and design:** loka-kgd.222 (no fall line on an off-fight death, P2, a bug per spec), .221 (dead page
   rulings), .223 (sim crash at `flows.ts:175`), loka-x6t.141 (designer dead-page text), loka-wfrgk.73 (in-fight death
   page explains nothing; design question).

## Owner calls this session (override any)

- A death outside a fight shows no "You are dead" line: a bug per spec (loka-kgd.222).
- An encounter arriving during the dead page waits for Let go; a second off-fight death keeps the first death's page
  (loka-x6t.141, loka-kgd.221).
- NPC routines (loka-ni2zd) deferred to a separate design session.
- Hunger and thirst are retired, so prologue beat 9's feast lines are a writing call for the owner.
- PM calls: deleting a scene does not delete its quest (`taken()` refuses and names the quest); palette Delete is
  undoable rather than confirmed (no new author words); #688's unproven .90 change was reverted rather than shipped.

## Waiting on the owner

- Part 1 build feedback (in the conversation).
- Older: studio defaults, weapon proficiency shape, store fees, iOS first, the save guarantee, #574 acceptance, #564
  calls, hosting (12uz). Retro 2026-11-06: loka-ebnu3, jqxb8, grdiq and lvo9i approved for the next housekeeping PR; fs76w closed.

## Owner's writing list (prologue; text keys, no prose from agents)

`world.levelling.gained`, `world.levelling.level_up`, each `level_reached` line, each skill's `learned`, each rank's
`name` and `reached`, `combat.sanctuary`; combat lines, `tiers`, `conditions`, volley lines; corpse and revival lines;
`combat.title_you_attack` {target}, `combat.title_attacks_you` {attacker}; Well fed and Refreshed status names and meal
and drink lines; the opening dream's scene lines (reverie); ambient lines; the showcase hub sign that still mentions
hunger (`toolbox_showcase/text.json:1461`, `docs/showcase/hub-and-first-districts.md:79`); identity_sampler
`stranger_talk.scene` talk text; every `~` in the prologue.

## Holds

- P3 hold (owner 2026-10-22): draft #454, kgd.188, 2lvx, 5i4c, x6t.98. loka-x6t.126 skill-gated room depth.
- #632 (loka-vduxr.64) belongs to another session (lokacore-fb), not the PM.

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
  Merges one at a time in the main checkout via `bin/merge_pr.sh <pr> <id[,id...]>`. When `br` refuses a parent with open
  follow-up children, `br close <id> --force --reason "Merged #N"` and rerun `bin/after_merge.sh`; an untracked PR body
  draft in the worktree also stops it (remove it, rerun). A conflict after another merge goes back to the developer as
  "merge origin/main, no rebase" (force-push is forbidden). Review records sit on local `review-<PR>` branches and are
  carried by `after_merge`; a second record for the same PR is cherry-picked onto `review-<PR>` first.
- Mutation runs in a throwaway worktree need node_modules (root, `kernel/ts`, `tools/author-panel`) and `deps` linked and
  `_build` copied, else every row is BASELINE-RED; panel rows often stay BASELINE-RED there, so hand mutants in the slice
  worktree cover them.
- Subagents work only in their own worktrees under `~/dev/worktrees.noindex`; a fresh worktree runs `bin/worktree_setup.sh`.
  The load gate refuses spawns at load 8 or more: wait with a background until-loop, never bypass. Kill orphaned
  author servers and Playwright Chromes when load climbs (`ps` for `worktrees.noindex` and `--disable-field-trial-config`).
- End: rewrite this page, push every branch with work, file the [retro](PM.md#retro-and-housekeeping-queue) items in Beads.
