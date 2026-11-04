# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place once per session, at its end; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #593; written 2026-11-04 by Claude Code (Opus 5.5), combat, death and authoring PM session. `kernel_api` is 1.152 (#599 claims 1.153). Lean default in force since #533.

## Direction (owner 2026-10-30 to 2026-11-04)

- **The prologue is v1** (epic loka-g5hh): a free, complete 3 to 5 hour short story ending on the landing. Outline:
  [prologue outline](worldbuilding/notes/prologue-outline-2026-10-30.md) (Fable draft, not canon).
- **The owner writes every player-facing word** in the prologue ([owner rules](system/owner-rules.md#process)).
  Exception (owner 2026-11-01/02/04, quoted "yes please write them for me", "you write them, like the combat words"):
  the PM writes the **showcase's** combat, corpse, shrine, resurrection and consumable (status names, meal and drink lines) words.
- **Plan downgrade around 2026-11-10** to Pro. Lean after it: one session, Sonnet for content, reviewers for engine changes,
  second opinions for save and contract changes. Author-side edge-case guards are nits, not fix rounds (owner 2026-11-04).
- **The showcase is the regression bed**, unfrozen for combat only.
- **Combat follows DikuMUD/LegendMUD** ([decision](decisions/owner-decision-diku-rounds-2026-11-01.md)): the foe's condition
  line right after the player's swing (#596); a round's lines run on, one blank line between rounds; no Look card in a fight
  until the combat hotbar is designed; a dead page shows only Let go, no status line (#592).
- **PR bodies are the reviewer's brief**, no fluff (`docs/decisions/owner-decision-pr-body-reviewer-brief-2026-11-04.md`, #597).

## Merged this session

#592 death hold, Let go, run-on rounds, no Look in a fight; #593 corpses name victims, decay and spill; #595 R&D notes
(11-03); #596 later rounds' combat lines reach the Combat page, condition after the swing.

## Resume, in order

1. **PR #599, loka-kgd.206** (Wayside Shrine, revival lines, shrine keeper): review CHANGES REQUIRED (keeper line came before
   `death.woke`), second opinion APPROVE WITH NOTES. A developer fix round was running at handoff: keeper after woke (engine
   order + spec + tests), keeper presence check, PM word fixes (sign: "wake at the Wayside Shrine"; shrine "stands above the
   shore steps"), both review records cherry-picked (ed104bdc9, 499f97e0b). Rulings: revival stays in the GameView whenever
   authored; bound tests dropped (owner). Next: check the PR head and CI, a narrow fix re-check by one reviewer, merge
   (`bin/merge_pr.sh 599 loka-kgd.206`).
2. **PRs #597 and #598** (docs: PR-body decision; R&D studies and the area-layout design): green-CI merges; no Beads ids, merge
   with `gh pr merge --merge --delete-branch` once `bin/wait_ci.sh <PR>` passes.
3. **loka-kgd.205** (Book): spirit state, revival lines, Open your eyes countdown. After #599.
4. **Area layout, loka-vduxr.58.1 to .4** (owner said yes to all 12 rulings, plus: no area field, unknown folder and bad
   folder name are compiler errors; written docs in BUILDERS-GUIDE "Cartridge layout" + AGENTS.md line + INDEX headers).
   Design: `docs/rnd/cartridge-area-layout-design-2026-11-04.md` (in #598). Before the prologue cartridge starts.
5. **loka-kgd.209 consumables**: one consume command and effect block (restore, cures, applies) for eat, drink, use; verb is
   words only; Well fed / Refreshed instead of hunger penalties; one entity per item (no engine stacks; Book groups counts);
   check loka-kgd.83 against craft. Reviewer + second opinion. PM writes the showcase words.
6. **loka-kgd.207**: Combat title "You attack {target}!" / "{attacker} attacks you!" (who started the fight; PM lean: the
   authority finds the opening receipt, no save change).
7. **loka-vduxr.57**: Builders' Guide story-pattern recipes from the
   prologue shortlist (`docs/rnd/prologue-adoption-shortlist-2026-11-04.md`, in #598), each verified first.
8. Studio slices loka-vduxr.51 -> .53 (report in the .51 comments); tell the owner the design rulings for .52/.53 before
   building. Ink buttons loka-x6t.131: waiting on the owner's round-3 picks, then the style guide.
9. Smaller: loka-kgd.208 (flaky placeholders test order), loka-vduxr.50, loka-kgd.198/.199/.201, older follow-ups.

## Owner's writing list (prologue; text keys, no prose from agents)

`world.levelling.gained`, `world.levelling.level_up`, each `level_reached` line, each skill's `learned`, each rank's
`name` and `reached`, `combat.sanctuary`; the prologue's combat lines (`{attacker}`, `{target}`), its `tiers`,
`conditions` and volley lines (`{count}`, `{hits}`); its corpse lines (`{victim}`); its revival lines; the combat title
keys once loka-kgd.207 lands.

## Holds

- P3 hold (owner 2026-10-22): draft #454, kgd.188, 2lvx, 5i4c, x6t.98, the 8 P3 engine bugs, the P3 retro items.
- loka-x6t.126 skill-gated room depth.

## Waiting on the owner

- Ink-button picks; studio defaults (veto or accept); weapon proficiency shape; the process ideas still open from
  2026-11-04 (one mutation pass per PR, each fact in one place, second opinion only for real save/contract changes).
- Store fees, iOS first, the save guarantee; #574 acceptance; #564 calls; the outline's two PM defaults; condition icons
  (loka-x6t.63).

Storybook http://localhost:6006 serves main from the preview checkout (`bin/preview_update.sh`). The owner
sends polish prompts in the conversation; loop: [PM, Live polish session](PM.md#live-polish-session), owner
guide: [polish tour](design/polish-tour.md). Screenshots: Playwright
needs `chromium.launch({ channel: 'chrome' })` (no bundled browser since #594).

## Session procedure

- Start: `mise install`, `br` 0.7.6 ([BEADS.md](BEADS.md)), `gh auth status`; `git pull --ff-only origin main`, then `br sync --import-only`;
  read [WORKFLOW](WORKFLOW.md), [PM](PM.md) and this page; `bin/session_status.sh` prints the board (`--full` for everything).
- Beads writes from the `main` checkout after `br sync --import-only`; each checkpoint is `bin/beads_checkpoint.sh`
  (a rejected push undoes its commit: rerun). Never commit `beads.db`.
- A kernel contract slice bumps only `INSTALLED.kernel_api` (`kernel/ts/src/runtime/world.ts`) to main+1 at
  push; when parallel PRs claim the same value, the later merge rebumps and reruns `bin/regen.sh`.
- `bin/merge_pr.sh <PR> <ids>` closes every id it is given: never pass an epic or parent id for a child PR. Run merges one at
  a time in the main checkout; a waiting loop must not `pgrep -f` a string its own command line contains.
- Subagents work only in their own worktrees under `~/dev/worktrees.noindex`, never in the main checkout; give each reviewer an
  exact worktree name. A fresh worktree needs `mix deps.get` before its first push (pre-push regen).
- Check `bin/agent_load_gate.sh` and weekly usage before fanning out; at most three agents.
- End: rewrite this page, push every branch with work, file the [retro](PM.md#retro-and-housekeeping-queue) items in Beads.
