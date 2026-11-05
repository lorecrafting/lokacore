# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place once per session, at its end; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after the authoring plan PR; written 2026-11-04 by Claude Code (Opus 5.5), third PM session of the day (planning only, nothing built). `kernel_api` is 1.154. Lean default in force since #533.

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
- **Authoring editor plan agreed** ([record](decisions/owner-decision-authoring-editor-plan-2026-11-04.md), design
  [section 11](rnd/gui-editor-design-2026-11-04.md#11-audit-changes-2026-11-04)): six promises, three columns, live agent
  edits, named Book treatments (`spirit`, `reverie`), strict editor coverage, slice order. The owner writes the prologue
  once E5 (prose in the Book) lands. Owner 2026-11-04: tokens are available; build in parallel as recommended, Fable when useful.

## Merged this session

The authoring plan PR (decision record, #606 amended, owner-rules and index lines). Beads: editor slices retitled and
re-linked under loka-wfrgk, new loka-wfrgk.9 to .13, loka-vduxr.54/.55/.56 folded and closed.

## Resume, in order

1. **Before the Pro plan (about 2026-11-10), in parallel, at most three agents, each in its own worktree:**
   - loka-vduxr.58.2 **S2** area migration, with S3's area lookups in `starters.ex` (developer; one reviewer).
   - loka-wfrgk.9 **T1** treatments: designer rulings first (ask the owner for the reverie's feel), then a developer;
     contract change, `kernel_api` bump, one reviewer.
   - loka-wfrgk.2 **E1** write path with loka-vduxr.51 and loka-vduxr.53's route (developer; one reviewer, Fable is a
     good fit for this trust boundary). Scope is design section 11.
   - Then loka-vduxr.59 (toolbox page and gate) in the first free slot; it may slip into Pro.
   E1 and T1 are kept at any cost, then S2.
2. **Pro, lean, one at a time:** loka-vduxr.53 E5 prose, loka-vduxr.58.3 S3, loka-wfrgk.10 E2 shell, loka-vduxr.52 E3a
   map, loka-wfrgk.7 E3b map edits, loka-wfrgk.11 E4a gate, loka-wfrgk.12 E4b generic card, then E6 a to e
   (loka-wfrgk.3, .4, .5 with a reviewer, .6, .8). S4 (loka-vduxr.58.4) any time; loka-wfrgk.13 after E3b and S3.
3. Interleave lean: **loka-kgd.207** combat title; **loka-vduxr.57** story recipes.
4. Follow-ups: loka-x6t.132 (Book groups same-kind items; designer first), the spirit state after a death outside a
   fight (loka-kgd, P2), loka-kgd.211 (flaky `content_placeholders_test.exs`; it reddened nightly `ffb29bb8`),
   native Rise focus (P3), lampLit exact-hex (P3), loka-kgd.83 (lift `replenish.ex` `misplaced/2`).
5. Ink buttons loka-x6t.131: waiting on the owner's round-3 picks. Smaller: loka-vduxr.50, loka-kgd.198/.199/.201.

## Owner's writing list (prologue; text keys, no prose from agents)

`world.levelling.gained`, `world.levelling.level_up`, each `level_reached` line, each skill's `learned`, each rank's
`name` and `reached`, `combat.sanctuary`; the prologue's combat lines (`{attacker}`, `{target}`), its `tiers`,
`conditions` and volley lines (`{count}`, `{hits}`); its corpse lines (`{victim}`); its revival lines; its consumable
status names and meal or drink lines; the combat title keys once loka-kgd.207 lands.

## Holds

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
