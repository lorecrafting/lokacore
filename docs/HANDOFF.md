# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place once per session, at its end; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #681; written 2026-11-06 by Claude Code (Opus 5.5), the editor build session (parallel, five agents). `kernel_api` is 1.159. Lean default in force since #533.

## Direction (owner 2026-10-30 to 2026-11-05)

- **The prologue is v1** (epic loka-g5hh): a free, complete 3 to 5 hour short story ending on the landing. Outline:
  [prologue outline](worldbuilding/notes/prologue-outline-2026-10-30.md) (Fable draft, not canon). The owner writes it
  in the editor (`bin/loka dev <cartridge>`, `?dev=1`): double-click a line, Enter saves, Esc cancels, Cmd-Z puts back,
  `[`/`]` walk `~` lines; typing over a bare `~` replaces it.
- **The owner writes every player-facing word** in the prologue ([owner rules](system/owner-rules.md#process)); agents use `~`.
  Exception: the PM writes the **showcase's** combat, corpse, shrine, resurrection and consumable words and the Book's
  chrome words when the designer rules them.
- **Do not wait for Pro (owner 2026-11-05):** build every editor slice now while the plan limit allows. The plan drops to
  Pro around 2026-11-10; after it: one session, Sonnet for content, reviewers for engine changes, second opinions for
  save and contract changes. Author-side edge-case guards are nits, not fix rounds.
- **Agent cap is five** (owner 2026-11-05), counting agents waiting on CI. Never bypass hooks, the load gate or CI; wait
  for load with a background until-loop (two readings under 7 avoids a refused spawn).
- **Authoring tool first, then write slowly; no aggressive mechanic expansion; polish** (owner 2026-11-04). Ideas parked
  at P4 with label `deferred`, among them **loka-ni2zd** (owner ask 2026-11-05: NPC routines that really gather, sell and
  feed the economy; plan first, needs an owner go).
- **Fable** reviews foundation, trust-boundary and contract slices and gives design second opinions; developers are Opus.
- **Card bar** (this session's reviews): a card never offers or writes what the compiler refuses; gates go two ways with
  the compiler `file:line`; a path leaves the generic baseline only when a bespoke part really draws it.
- **Developers walk in real Chrome on the final head**, screenshots in their own subfolder of the PM scratchpad, PR body
  drafts in their own worktree. **PR bodies are the reviewer's brief.**
- **Hunger and thirst are retired** (loka-vduxr.61). **Death outside a fight**: owner option B (#629/#634).
- **Hotbar** (loka-x6t.131): Inked; four slots in author order; the wedge is the only clock (no visible count, #671).
- **Story map**: Map | Story | Flow in the left slot; v1 is S1 to S3. [Editor plan](decisions/owner-decision-authoring-editor-plan-2026-11-04.md).

## The editor today (main)

Three-column shell (Cmd-K over `/find`, layout kept, dark), map with edits (locked by default, minimum zoom per the #680
the minimum zoom fits the level in the slot, #681), edit model and gate, generic card with a capability-filtered add menu (#678), Book add-here, world
picker and New world, resident compiler. Bespoke cards: **Room**, **World**, **NPC/Item** with **Combat numbers** and
**Schedule** blocks (#672), **Reaction/Action** rules blocks, **Quest**, **Scene text** with `npc:`/`with:`/`then:` writes
through `POST /set` and a modal-scene treatment picker (#673), **Dialogue choice tree** with gate badges, nested sets and
compiler-matched add menus (#675). Story map S1 to S3 (list, Trace, Knowledge, Pacing, Bind, Flow). `.scene`/`.cut` lint.
Engine this session: `HUB_SHUT` warning, `ENTRY_GUESSED` names deeper targets (#676), drowning refused with hp minimum
above 0 (#674), patrol choice refusal instead of a crash (#676).

## In flight at handoff

- Nothing. This session merged 29 PRs (#651, #654 to #681); no agent is running.

## Resume, in order

1. **loka-kgd.221** dead page: a fight death then an off-fight death before Let go, and a press during the dead page
   (from review-681; may need a designer ruling first).
2. **Story map follow-ups** and **editor nits** still open (all P3/P4 unless noted): loka-wfrgk.42.1 (Schedule row on the
   Map), .42.2 (P2: weapon fight rows need per-weapon rows in `kernel/ts/play/fight.ts`), .42.3, .43, .43.1, .47, .52, .53.1,
   .53.2, .54, .56 (outside-write panel harness), .18.4.1, .18.8.1, .18.10, .25, .20; loka-vduxr.67 (Play from first),
   .69 (`~words` spec change), .70 (not reproduced), .79.
3. **Map features** left by batch A as features, not nits: loka-wfrgk.27, .28, .33, .34, .35.
4. **loka-wfrgk.13** drag a template into a room; **loka-wfrgk.40** generic card overflow check; samplers (loka-vduxr.60);
   loka-x6t.132 item grouping.
5. Housekeeping retro 2026-11-06: loka-1zbvi, loka-7wvgo, loka-voset, loka-bqnu4, loka-rvbmn (owner approves).

## Owner-visible calls made this session (override any)

- Mend's showcase words: "Mend"; "You speak the word of mending, and the cut along your arm draws closed." Mend at full
  hp still spends and cools (left as is).
- Hotbar: aimed spells stay in the foe's list; no fillers means no strip; no visible rounds-left count (#671).
  `throw`, `wheel` and `pry` are the weakest glyphs at 24 px; redraws if you want them.
- The Set level cheat fires no level reactions. The S1 Flow double-click opens the definition by key.
- The trial and showcase jailers' pay (and showcase work_off) choices now end the talk (`then: end`); the
  `walk_economy_jail` transcript was re-pinned (#676).
- The author panel's single advance is capped at 3000 game minutes (#674).
- Nested sets in the Dialogue tree are a read-only fold one level deep (#675).

## Waiting on the owner

- **New:** a death outside a fight shows no "You are dead" line, unlike a fight death (#677 walk). Intended?
- **New, unruled, no consumer yet:** an encounter arriving while the dead page shows (designer note on #680).
- **New:** loka-ni2zd NPC routines (see Direction).
- Older: studio defaults, weapon proficiency shape, store fees, iOS first, the save guarantee, #574 acceptance, #564
  calls, hosting (12uz).

## Owner's writing list (prologue; text keys, no prose from agents)

`world.levelling.gained`, `world.levelling.level_up`, each `level_reached` line, each skill's `learned`, each rank's
`name` and `reached`, `combat.sanctuary`; combat lines, `tiers`, `conditions`, volley lines; corpse and revival lines;
`combat.title_you_attack` {target}, `combat.title_attacks_you` {attacker}; Well fed and Refreshed status names and meal
and drink lines; the opening dream's scene lines (reverie); ambient lines; the showcase hub sign that still mentions
hunger (`toolbox_showcase/text.json:1461`, `docs/showcase/hub-and-first-districts.md:79`); identity_sampler
`stranger_talk.scene` talk text.

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
  nit dot-children, `br close <id> --force --reason "Merged #N"` and rerun `bin/after_merge.sh`; an untracked PR body
  draft in the worktree also stops it (remove it, rerun). A conflict after another merge goes back to the developer as
  "merge origin/main, no rebase" (force-push is forbidden). Review records sit on local `review-<PR>` branches and are
  carried by `after_merge`; a second record for the same PR is cherry-picked onto `review-<PR>` first.
- Subagents work only in their own worktrees under `~/dev/worktrees.noindex`; a fresh worktree runs `bin/worktree_setup.sh`.
  The load gate refuses spawns at load 8 or more: wait with a background until-loop, never bypass. Kill orphaned
  author servers and Playwright Chromes when load climbs (`ps` for `worktrees.noindex` and `--disable-field-trial-config`).
- End: rewrite this page, push every branch with work, file the [retro](PM.md#retro-and-housekeeping-queue) items in Beads.
