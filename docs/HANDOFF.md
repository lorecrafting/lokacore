# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place once per session, at its end; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #605; written 2026-11-04 by Claude Code (Opus 5.5), second PM session of the day. `kernel_api` is 1.154. Lean default in force since #533.

## Direction (owner 2026-10-30 to 2026-11-04)

- **The prologue is v1** (epic loka-g5hh): a free, complete 3 to 5 hour short story ending on the landing. Outline:
  [prologue outline](worldbuilding/notes/prologue-outline-2026-10-30.md) (Fable draft, not canon).
- **The owner writes every player-facing word** in the prologue ([owner rules](system/owner-rules.md#process)).
  Exception (owner 2026-11-01/02/04): the PM writes the **showcase's** combat, corpse, shrine, resurrection and consumable
  words (status names, meal and drink lines) and the Book's own chrome words when the designer rules them (e.g. "Rise", "N seconds").
- **Plan downgrade around 2026-11-10** to Pro. Lean after it: one session, Sonnet for content, reviewers for engine changes,
  second opinions for save and contract changes. Author-side edge-case guards are nits, not fix rounds (owner 2026-11-04).
- **The showcase is the regression bed**, unfrozen for combat only.
- **Combat follows DikuMUD/LegendMUD** ([decision](decisions/owner-decision-diku-rounds-2026-11-01.md)).
- **PR bodies are the reviewer's brief**, no fluff ([decision](decisions/owner-decision-pr-body-reviewer-brief-2026-11-04.md)).
- **Authoring tool: design and plan before building** (owner 2026-11-04). The next session is a deep, conversational
  planning session with the owner (see Resume 1). No GUI editor or toolbox-gate code until it ends.

## Merged this session

#597 PR-body decision; #598 R&D and the area-layout design; #600 previous handoff; #599 Wayside Shrine, revival lines, the keeper
(waking line before the death's reaction lines); #601 placeholders order flake (loka-kgd.208); #602 spirit-state design rulings;
#603 area layout S1 (the compiler reads `areas/<area>/`, refusals, Builders' Guide "Cartridge layout"); #604 the Book's spirit
state (loka-kgd.205: spirit wash, Rise with a countdown, held lines); #605 consumables (loka-kgd.209: one `consume` command,
`{restore, cures, applies}`, multi-resource status `ticks`, `{status, duration}` applies with later-end refresh, Well fed and
Refreshed in the showcase, hunger and thirst pools removed); #606 GUI editor design (`docs/rnd/gui-editor-design-2026-11-04.md`).

## Resume, in order

1. **Authoring planning session with the owner** (epic loka-wfrgk, read every comment). Conversational and deep: the owner wants
   a back-and-forth, not a report. Inputs: #606's design and its 14 rulings (the owner accepted them, but now treats them as
   input, not final), the owner's goal (a world-class GUI editor; every mechanic gets purpose-built create, edit, update and
   delete, not necessarily forms), loka-vduxr.59 (generated toolbox page plus the coverage gate: summary, declarations, sampler,
   showcase location), and the **Book presentation vocabulary**: a slowly grown toolbox of designed Book treatments that
   cartridges select and set parameters on, never raw visual controls. The spirit state is the first extraction candidate. On hold until it ends:
   loka-wfrgk.2 to .8 (G1 to G7) and loka-vduxr.59. Studio slices loka-vduxr.51 to .53 feed G2 and G6; decide their place there.
2. **Area layout S2 to S4** (loka-vduxr.58.2 to .4), before the prologue cartridge starts. Ask in the planning session whether
   they wait for it (S4 writes the per-area INDEX the editor may read).
3. **loka-kgd.207**: Combat title "You attack {target}!" / "{attacker} attacks you!" (PM lean: the authority finds the opening
   receipt, no save change).
4. **loka-vduxr.57**: Builders' Guide story-pattern recipes from `docs/rnd/prologue-adoption-shortlist-2026-11-04.md`.
5. Follow-ups filed this session: loka-x6t.132 (Book groups same-kind items with a count; designer ruling first; count wording
   is the designer's or owner's), the spirit state after a death outside a fight (loka-kgd, P2), loka-kgd.211 (flaky
   content_placeholders_test.exs:28, an extra "lantern" error), native Rise focus (P3), lampLit exact-hex (loka-x6t, P3).
   loka-kgd.83 (spell reagents) is small: lift `lib/loka/content/replenish.ex` `misplaced/2`.
6. Ink buttons loka-x6t.131: waiting on the owner's round-3 picks. Smaller: loka-vduxr.50, loka-kgd.198/.199/.201.

## Owner's writing list (prologue; text keys, no prose from agents)

`world.levelling.gained`, `world.levelling.level_up`, each `level_reached` line, each skill's `learned`, each rank's
`name` and `reached`, `combat.sanctuary`; the prologue's combat lines (`{attacker}`, `{target}`), its `tiers`,
`conditions` and volley lines (`{count}`, `{hits}`); its corpse lines (`{victim}`); its revival lines; its consumable
status names and meal or drink lines; the combat title keys once loka-kgd.207 lands.

## Holds

- Authoring build: loka-wfrgk.2 to .8 and loka-vduxr.59 until the planning session (owner 2026-11-04).
- P3 hold (owner 2026-10-22): draft #454, kgd.188, 2lvx, 5i4c, x6t.98, the 8 P3 engine bugs, the P3 retro items.
- loka-x6t.126 skill-gated room depth.

## Waiting on the owner

- Ink-button picks; studio defaults (veto or accept); weapon proficiency shape; the process ideas still open (one mutation
  pass per PR, each fact in one place, second opinion only for real save or contract changes).
- Store fees, iOS first, the save guarantee; #574 acceptance; #564 calls; the outline's two PM defaults; condition icons
  (loka-x6t.63).

Storybook http://localhost:6006 serves main from the preview checkout (`bin/preview_update.sh`); a PR's stories need a
Storybook run from its own worktree. The owner sends polish prompts in the conversation; loop: [PM, Live polish session](PM.md#live-polish-session),
owner guide: [polish tour](design/polish-tour.md). Screenshots: Playwright needs `chromium.launch({ channel: 'chrome' })`.

## Session procedure

- Start: `mise install`, `br` 0.7.6 ([BEADS.md](BEADS.md)), `gh auth status`; `git pull --ff-only origin main`, then `br sync --import-only`;
  read [WORKFLOW](WORKFLOW.md), [PM](PM.md) and this page; `bin/session_status.sh` prints the board (`--full` for everything).
  After a `/clear`, run `ListAgents` first: the previous conversation's agents and shells keep running.
- Beads writes from the `main` checkout after `br sync --import-only`; new issues through `bin/br_create.sh`; each checkpoint is
  `bin/beads_checkpoint.sh` (a rejected push undoes its commit: rerun). Never commit `beads.db`.
- A kernel contract slice bumps only `INSTALLED.kernel_api` (`kernel/ts/src/runtime/world.ts`) to main+1 at
  push; when parallel PRs claim the same value, the later merge rebumps and reruns `bin/regen.sh`.
- CI waits: `bin/wait_ci.sh <sha|branch>`, never a PR number. Chain `wait && merge` with output redirected to a file, never
  through `| tail`. Docs PRs with no Beads id: `gh pr merge <PR> --merge --delete-branch` after the exact head is green.
- `bin/merge_pr.sh <PR> <ids>` closes every id it is given: never pass an epic or parent id for a child PR. Run merges one at
  a time in the main checkout; a waiting loop must not `pgrep -f` a string its own command line contains.
- Subagents work only in their own worktrees under `~/dev/worktrees.noindex`, never in the main checkout; give each reviewer an
  exact worktree name. A fresh worktree needs `mix deps.get` and `npm ci` at the root, in `kernel/ts` and in `mobile/app`
  before its first push.
- Check `bin/agent_load_gate.sh` and weekly usage before fanning out; at most three agents.
- End: rewrite this page, push every branch with work, file the [retro](PM.md#retro-and-housekeeping-queue) items in Beads.
