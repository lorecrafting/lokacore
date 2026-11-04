# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place once per session, at its end; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #591; written 2026-11-04 by Claude Code (Opus 5.5), combat and authoring PM session. `kernel_api` is 1.151. **All work is paused at the owner's request**; resume with the order below. Lean default in force since #533.

## Direction (owner 2026-10-30 to 2026-11-02)

- **The prologue is v1** (epic loka-g5hh): a free, complete 3 to 5 hour short story ending on the landing. Outline:
  [prologue outline](worldbuilding/notes/prologue-outline-2026-10-30.md) (Fable draft, not canon).
- **The owner writes every player-facing word** in the prologue ([owner rules](system/owner-rules.md#process)).
  Exception (owner 2026-11-01/02, quoted "Can you please do this for me, and follow LegendMUD as much as possible",
  "yes please write them for me"): the PM writes the **showcase's** combat, corpse, shrine and resurrection words.
- **Plan downgrade around 2026-11-10** to Pro. Lean after it: one session, Sonnet for content, reviewers for engine changes,
  second opinions for save and contract changes.
- **The showcase is the regression bed**, unfrozen for combat only (owner 2026-11-01: "please opt in for the showcase").
- **Combat follows DikuMUD/LegendMUD** ([decision](decisions/owner-decision-diku-rounds-2026-11-01.md)): first round on Attack,
  initiative per round, named severity lines, a condition line, several swings a round with the full hit rate shown
  (owner 2026-11-02: "we still want to see the 'hitrate'"), fists can land. No HP in the log; your own condition is never printed.

## Merged this session

#582 level moment on kills; #583 author panel on Book tokens; #584 `.scene` example, `new cutscene`; #585 writer
errors; #586 checkpoint and Why words; #587 combat log by round; #588 quiet terminal, guide opens with a recipe,
BUILDERS-GUIDE cuts; #589 `bin/loka new scene`; #590 Diku rounds in the showcase; #591 several swings a round.

## Resume, in order (paused work first)

1. **PR #592, loka-kgd.204** (Book): no opponent block; death holds a bloodshot red vignette with the death sound; one
   control **Let go** (owner-approved). Head f7e9a78, CI green. Owner to look at the screenshots (session scratchpad
   `loka-kgd.204/after-death-*.png`; retake if gone), then merge. No reviewer (Book only).
2. **loka-kgd.202** (engine/Book, not started, branch `combat/round-two` = main): (a) the missing-rounds bug, cause found:
   `combatLines` in `mobile/authority/local-story/narration.ts` counts only `world.combat.narration` keys, so tier and
   condition lines go to the World log from round 2; (b) the foe's condition line right after the player's swing;
   (c) GameView says who started the fight, Combat title "You attack {target}!" / "{attacker} attacks you!". Reviewer.
3. **PR #593, loka-kgd.203** (engine + save): corpses name their victim ("The corpse of a raider is here."), cannot be
   carried, open to look inside; NPC corpse decays after 15000 units, player corpse 90000, contents spill to the floor;
   showcase goblin respawn 45000. Head c405b1723, pushed; open: hosted CI, `Menu.tsx` `{victim}` lines untested, mutation
   table in the PR body, reviewer **and** second opinion. Rebump kernel_api after #592/#202 if they claim it.
4. **loka-kgd.206** then **loka-kgd.205**: the Wayside Shrine (showcase return room) and the resurrection sequence
   (spirit state, ethereal wash, revival lines, **Open your eyes** countdown). Every word is in the loka-kgd.206 issue.
   kgd.206 waits on #593 (both touch `world.death`).
5. **Ink action buttons, loka-x6t.131**: round 3 is published at https://claude.ai/artifact/54K1Kk1zCyzq6w44Jp8kpG
   (chunky grey ink wash; the HTML is in the session scratchpad `loka-x6t.131/ink-buttons.html` and the artifact). Waiting on the
   owner's picks per dimension; then a style guide; then the hotbar. Fable designer. The polish session
   `polish/session-2026-11-02` has no commits.
6. **Authoring studio** (Fable audit 2026-11-02, full report in the loka-vduxr.51 comments): loka-vduxr.51 (key-tagged
   Book lines, first), .52 (Map tab), .53 (in-Book prose edit), .54 (write a `~` from the Book), .55 (rendered diff),
   .56 (Scene tab). PM defaults pending owner veto: the map is a panel tab, not a third column; choice labels and
   inherited or shared lines are not edited in the Book (they open the editor); rooms without `layout.json` are listed;
   undo is put-it-back plus git. .52, .53, .56 need a short design ruling first.
7. Smaller open items: loka-vduxr.50 (panel lint skips `.scene`), loka-kgd.198 (every pack member swings, if the
   prologue has packs), .199 (wimpy, kick/bash: after the downgrade), .201 (weapon proficiency: plan only, owner to
   pick), a `has_item` count for collection quests (not filed; propose to the owner), and the older follow-ups
   loka-g5hh.2.11, .2.5, .7, loka-vduxr.39, .36, .29, .30.

## Owner's writing list (prologue; text keys, no prose from agents)

`world.levelling.gained`, `world.levelling.level_up`, each `level_reached` line, each skill's `learned`, each rank's
`name` and `reached`, `combat.sanctuary`; the prologue's combat lines (`{attacker}`, `{target}`), its `tiers`,
`conditions` and volley lines (`{count}`, `{hits}`); its corpse lines (`{victim}`); its revival lines.

## Retro 2026-11-02 (awaiting owner approval)

Housekeeping: context stops mid-slice on combat slices; combat line routing untested (the #590 bug); a designer handed
back before green; the weekly limit hit with agents running; `beads_checkpoint` fails on a multi-branch FETCH_HEAD
(rerun after `git fetch origin main`). Older: loka-v4amq, loka-atj0g, loka-astk1, loka-7anzq, loka-sztq7, loka-3rym, loka-9ack.

## Holds

- P3 hold (owner 2026-10-22): draft #454, kgd.188, 2lvx, 5i4c, x6t.98, the 8 P3 engine bugs, the P3 retro items.
- loka-x6t.126 skill-gated room depth.

## Waiting on the owner

- The death screenshots (#592); the ink-button picks; veto or accept the studio defaults above; weapon proficiency shape.
- Store fees, iOS first, the save guarantee; #574 open-without-replay acceptance; #564 calls; the beads review; the outline's
  two PM defaults; the retro items; condition icons (loka-x6t.63).

Storybook http://localhost:6006 serves main from the preview checkout (`bin/preview_update.sh`). The owner
sends polish prompts in the conversation; loop: [PM, Live polish session](PM.md#live-polish-session), owner
guide: [polish tour](design/polish-tour.md). Standing owner rules live in [owner rules](system/owner-rules.md#process).

## Session procedure

- Start: `mise install`, `br` 0.7.6 ([BEADS.md](BEADS.md)), `gh auth status`; `git pull --ff-only origin main`, then `br sync --import-only`;
  read [WORKFLOW](WORKFLOW.md), [PM](PM.md) and this page; `bin/session_status.sh` prints the board (`--full` for everything).
- Beads writes from the `main` checkout after `br sync --import-only`; each checkpoint is `bin/beads_checkpoint.sh`
  (a rejected push undoes its commit: rerun). Never commit `beads.db`.
- A kernel contract slice bumps only `INSTALLED.kernel_api` (`kernel/ts/src/runtime/world.ts`) to main+1 at
  push; when parallel PRs claim the same value, the later merge rebumps and reruns `bin/regen.sh`.
- `bin/merge_pr.sh <PR> <ids>` closes every id it is given: never pass an epic or parent id for a child PR.
- Subagents work only in their own worktrees under `~/dev/worktrees.noindex`, never in the main checkout. Check
  `bin/agent_load_gate.sh` and weekly usage before fanning out; at most three agents.
- End: rewrite this page, push every branch with work, file the [retro](PM.md#retro-and-housekeeping-queue) items in Beads.
