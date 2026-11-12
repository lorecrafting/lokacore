# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place once per session, at its end; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #711; written 2026-11-12 02:10 UTC in the Pi harness by deploy/deepseek-ai/deepseek-v4.1-flash-1017, PM session.
`kernel_api` is 1.159 (no contract slice since). **The owner is taking about a month off and pausing the subscription
(2026-11-07).** Nothing is mid-merge, nothing is in flight, no agent is running.

## Direction (owner 2026-10-30 to 2026-11-07)

- **Pro low-token workflow** (owner 2026-11-07): one session does small slices itself; at most one developer at a time; a separate reviewer only for engine, save, contract or compiler-facing slices; no mutation runs on editor polish.
- **The prologue is v1** (epic loka-g5hh). The owner builds **Part 1** in the editor, in `cartridges/prologue/` (**uncommitted on purpose**). Start: `bin/author.sh`; restart it after each merge.
- **The owner writes every player-facing word**; agents use `~`. Polish feedback goes to Beads under loka-wfrgk; fixes batch on the owner's go; blockers are fixed at once.
- **Card bar:** a card never offers or writes what the compiler refuses; gates go two ways with the compiler `file:line`.
- NPC routines (loka-ni2zd) wait for the owner's own design session.

## Merged since the 2026-11-07 handoff

#707 S1 of the scene structure work (`.cut` page ops through `POST /restructure`, loka-wfrgk.100.5.2, closed by
`after_merge`); #708 plain-English field guide for the kinds slice A did not cover; #709 runs the unit files a diff
touches before `bin/push_slice.sh` pushes (loka-4ks2l: #707's one-line red test cost four days); #710 two CI flakes and
the worktree post-check (loka-lvo9i, loka-wfrgk.110, loka-za8br); #711 S2 of the scene structure work (`.scene` line
add, remove and move through the same `POST /restructure`, the card's row buttons and Alt keys, and §2's refusal to
renumber a `~` choice key a twin entry, riddle, quest outcome or `choice_resolved` reaction names, loka-wfrgk.100.5.3,
closed by `after_merge`). Then docs and Beads only:
`docs/worldbuilding` Act II lore (b5fa77bd3) and epic loka-wfrgk.119 (narrative intelligence and LLM co-authoring tools,
8 open children, no work started). All three workflows green on every merged head. Untracked `cartridges/prologue/` is
the owner's in-progress Part 1: never touch it, read it only. `docs/system-graph.gen.json` regenerates from it, so keep
that file out of a commit while the scratch cartridge is present.

## In flight at handoff

Nothing. The next slice starts from main.

- **#632** (loka-vduxr.64) belongs to another session (lokacore-fb). **#454** is the owner's P3 hold. Both now carry
  `external_ref`, so `bin/session_status.sh` reports no drift.
- A cut-only scene (no `.json`) is unreachable in the panel: **loka-cr7l7**, needs a designer ruling (show the twinless
  `.cut`, or refuse it at compile; the second is the smaller diff).

## Resume, in order

1. S3 (loka-wfrgk.100.5.4: ` #<key>` grammar in `scene_lines.ex`, compiler, takes a reviewer), one at a time
   ([rulings](design/scene-structure-rulings.md)). S1 and S2 are on main: `POST /restructure`, `scene_structure.ts`'s
   `cut()` and `scene()`, and the card's `SceneRows.tsx` are there to build on. Two S2 follow-ups are filed, not done:
   loka-wfrgk.100.5.3 shipped the row buttons and the Alt key bindings but not §5's focus rules (Esc closes the Add
   menu, focus stays on the moved/added row, an added row focuses its `~` field), so the rulings' own keyboard test
   cannot pass yet; and loka-vvreo covers `bin/related_tests.sh` never typechecking `tools/author-panel`, so a panel
   type error still reaches CI.
2. Story tooling epic **loka-wfrgk.115**, children .1 to .12 chained in the owner's order: R1, W1, D1, K2, C1, L1 + L2, W2,
   F1 + W4, R2, K1, then W3 and E1 before v1. K2, L1 + L2, K1 and E1 take a reviewer.
3. Older P1s: loka-wfrgk.94, loka-wfrgk.100.8 (key-tagged Book lines), loka-wfrgk.100.4.
4. Housekeeping PR: loka-ebnu3, jqxb8, grdiq, wfrgk.96, and the retro items (below). loka-za8br is done (#710).
   Still open from the 2026-11-11 retro: loka-x4ejm, loka-y043w, loka-r7vrx, awaiting the owner's yes/no.
5. P2 editor items: .97, .98, .99, .102 follow-ups, map handle placement, `bin/loka new` duplicate keys (loka-wfrgk.68).

## Owner calls to date (2026-11-07 session; override any)

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

## Retro 2026-11-11 (filed, awaiting the owner's yes/no)

Three items, evidence in each: loka-x4ejm (session_status does not print a PR head's CI conclusion, so the handoff
said "CI not run" when it had failed twice), loka-y043w (the drift check calls a missing `external_ref` "no Beads issue":
three false alarms a session), loka-r7vrx (the queue is 75 open with duplicates and nothing closed since 11-07).
loka-4ks2l was approved and is merged (#709). Closed `loka-wfrgk.116` as a duplicate of `loka-za8br` while filing. The
2026-11-07 items are still open and unapproved; three of them closed with #710 (lvo9i, wfrgk.110, za8br).

Fixed this session, worth knowing next time: PR #711's card commit (`28556fe17`) went to CI without
`npx tsc -b` in `tools/author-panel` and failed the `Author panel types` step on two type errors; the pre-push hook
printed `MOBILE_TSC_OK` anyway, because `bin/related_tests.sh` only selects `kernel/ts` tests (loka-vvreo). Run the
panel's typecheck by hand after touching it until that issue lands. And: `wait_ci.sh` can return 1 having merely timed out while the runs are still
going (`wait_ci: timed out before ci and book-e2e both completed`); confirm with `gh run list --branch <branch>` before
re-running CI. The panel fill flake (loka-wfrgk.110) is a plausible fix, not a proven one: the race needs a loaded
runner and does not reproduce locally, so a revert still passes here.

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
- `toolbox/settle-3` is 9 commits ahead of main from 2026-10-15 with no PR: decide PR or delete before the next batch.
- Seven worktrees sit at main with nothing to save (`lokacore-preview`, `lokacore-session`, `loka-kgd.202-old`,
  `.203-mut`, `.205-design-review`, `loka-vduxr.10-second`, `toolbox-authoring-batch-a-walks`); `loka-wfrgk.100.5.2` is
  merged and prunable. `playtest-sweep` holds untracked logs, a report and shots worth reading before it goes.

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
