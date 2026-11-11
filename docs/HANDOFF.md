# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place once per session, at its end; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #706; written 2026-11-07 by Claude Code (Opus 5.5), PM session. `kernel_api` is 1.159 (no contract slice since).
**The owner is taking about a month off and pausing the subscription (2026-11-07).** Nothing is mid-merge.

## Direction (owner 2026-10-30 to 2026-11-07)

- **Pro low-token workflow** (owner 2026-11-07): one session does small slices itself; at most one developer at a time; a separate reviewer only for engine, save, contract or compiler-facing slices; no mutation runs on editor polish.
- **The prologue is v1** (epic loka-g5hh). The owner builds **Part 1** in the editor, in `cartridges/prologue/` (**uncommitted on purpose**). Start: `bin/author.sh`; restart it after each merge.
- **The owner writes every player-facing word**; agents use `~`. Polish feedback goes to Beads under loka-wfrgk; fixes batch on the owner's go; blockers are fixed at once.
- **Card bar:** a card never offers or writes what the compiler refuses; gates go two ways with the compiler `file:line`.
- NPC routines (loka-ni2zd) wait for the owner's own design session.

## Merged this session

#703 system graph lists only tracked cartridge files (nightly CI was red from the owner's untracked world; loka-wfrgk.112);
#701 scene structure design; #704 story tooling design (`docs/design/story-tooling.md`); #705 big-studio tooling survey
(`docs/rnd/studio-tooling-survey-2026-11-07.md`); #706 owner decisions and build order.

## In flight at handoff

- **S1** (loka-wfrgk.100.5.2): **draft PR #707**, branch `editor/restructure-cut-pages`, head `8056fca34`, worktree
  `~/dev/worktrees.noindex/loka-wfrgk.100.5.2`. `scene_structure.ts` (five `.cut` page ops), `POST /restructure`
  (`scene_card.ts` `restructure`, wired in `write.ts`), page buttons on the modal scene card. Kernel typecheck and 10
  tests pass, push_slice green, red controls in the PR body. **Not done:** hosted CI not run; the panel card E2E not rerun
  after the review fixes. Open review notes: Undo order across page ops and form edits (ponytail note in `Scene.tsx`),
  `cut()` recomputed per button per render, stale check duplicates `write.ts` `fresh()`, CRLF cuts get mixed endings; a
  cut-only scene (no `.json`) is unreachable in the panel (outside S1: file it). To finish: rerun the card E2E, mark
  ready, CI, merge with `bin/merge_pr.sh 707 loka-wfrgk.100.5.2`.

## Resume, in order

1. S1, then S2 (loka-wfrgk.100.5.3), then S3 (loka-wfrgk.100.5.4, compiler grammar, reviewer), one at a time
   ([rulings](design/scene-structure-rulings.md)).
2. Story tooling epic **loka-wfrgk.115**, children .1 to .12 chained in the owner's order: R1, W1, D1, K2, C1, L1 + L2, W2,
   F1 + W4, R2, K1, then W3 and E1 before v1. K2, L1 + L2, K1 and E1 take a reviewer.
3. Older P1s: loka-wfrgk.94, loka-wfrgk.100.8 (key-tagged Book lines), loka-lvo9i (CI flake), loka-wfrgk.100.4.
4. Housekeeping PR: loka-ebnu3, jqxb8, grdiq, lvo9i, wfrgk.96, the panel.test.ts:225 flake, and the retro items (below).
5. P2 editor items: .97, .98, .99, .102 follow-ups, map handle placement, `bin/loka new` duplicate keys.

## Owner calls this session (override any)

- #701 merged as designed: a choice key is fixed by a ` #<key>` suffix, words are free.
- Story tooling: yes to every recommendation of both docs. Weather stays a story fact for Part 1 (no `weather.set`);
  modal scenes stay choice-free (branch through `.scene` dialogues); D1 uses per-step replay within a budget; E1 waits
  for a beat that needs it; L2b is a warning; the v1 phone save policy is decided at the release-candidate audit; roam
  reports only until Part 1 is written, then gates with a baseline.
- Corrections given to the owner: rooms already vary text by fact (`variants`), a story map and checkpoints exist,
  modal scenes have no choice step (the two-option choice is the dream scene's).

## Waiting on the owner

- Part 1 build feedback. Older: studio defaults, weapon proficiency shape, store fees, iOS first, the save guarantee,
  #574 acceptance, #564 calls, hosting (12uz).

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
