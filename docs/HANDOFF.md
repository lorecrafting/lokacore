# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place once per session, at its end; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #580, #581, #579; written 2026-11-01 by Claude Code (Opus 5.5), engine and authoring PM session. `kernel_api` is 1.149. The effects session's epic loka-xz76e is closed. Lean default in force since #533.

## Direction (owner 2026-10-30, 2026-10-31)

- **The prologue is v1** (epic loka-g5hh): a free, complete 3 to 5 hour short story ending on the landing,
  to build goodwill (owner, quoted: "make it a complete short story, for free, ending on the landing. We want to
  build goodwill."). Paid installments continue on the planet. The working outline is
  [the prologue outline](worldbuilding/notes/prologue-outline-2026-10-30.md) (Fable draft, not canon).
- **The owner writes every player-facing word** ([owner rules](system/owner-rules.md#process)); agents build
  structure, keys and placeholders only.
- **Plan downgrade around 2026-11-10** to the Pro plan. Token-heavy work went first to the authoring suite
  (epic loka-vduxr) so the owner can hand-write slowly afterwards. After it: one session working directly,
  Sonnet for content, reviewers for engine changes only, second opinions for save and contract changes only.
- **The showcase is frozen**: the regression bed, no polish.

## State of the authoring suite (loka-vduxr)

Done: `.scene` files with `needs`, `once`, `then`, nesting and `order` (#557); once per sitting, `end_talk`
and a scene from any choice (#576); dialogue lint and ally warnings (#568); `bin/loka check`, panel, cheats,
writer errors (earlier PRs); replay, coverage and Why tell the truth on refused moves and idle ticks (#580).
Level-up rush, epic child loka-g5hh.2: engine E1 to E3 (#538, #566, #570) and Book B1 to B3 (#572, #575,
#573) merged; the design pass (#579) found the level moment lost on kills: **#582 fixes it, reviewer running**.
Saves: the away cap (#569), no replay at open (#574, all test saves open under 1 s on this machine),
idle ticks coalesced (#578, an hour idle adds 0.7 MB, not 33 MB). Session start is 1 s and ~420 tokens (#581).

## Next, in order

1. #582 level moment on kills (loka-g5hh.2.8): reviewer running; merge on approval and green.
2. Owner writes the rush and sanctuary lines (list below); then a play pass of the prologue opening.
3. Open follow-ups, none blocking authoring: loka-g5hh.2.11 (a level dropped at a chapter card, page turn
   or curl), loka-g5hh.2.5, .7, .8; loka-vduxr.39 (a first-screen code bug can still offer Start over: fix
   before launch), .36 (stalled hide relies on `performance.now` across sleep; needs a phone), .29 (refill
   beside drowning soft-locks: fix before any cartridge uses drowning), .30 (two `live.test.ts` CI flakes),
   .31, .32, .35, .38, .40, .42, .43, loka-69yuw, loka-votey; .18 crow and sight order.
4. Release work awaiting the owner's three calls (store fees, iOS first, a save guarantee from launch).

## Owner's writing list (text keys, no prose from agents)

`world.levelling.gained` (uses `{amount}`), `world.levelling.level_up`, the line each `level_reached`
reaction narrates, each skill's `learned`, each rank's `name` and `reached`, and `combat.sanctuary`
(opens with a capital; a missing one falls back to "You can't do that here.").

## Retro 2026-11-01 (awaiting owner approval)

Housekeeping issues loka-v4amq (a parallel merge broke main), loka-atj0g (shared `kernel_api` pins),
loka-astk1 (a subagent worked in the main checkout), loka-7anzq (merge_pr closed a parent), loka-sztq7
(write the narrow third fix round into WORKFLOW). Older: loka-3rym, loka-9ack.

## Holds

- P3 hold (owner 2026-10-22, quoted: "lets hold off on the p3 stuff for now"): draft #454, kgd.188, 2lvx,
  5i4c, x6t.98, the 8 P3 engine bugs, and the P3 retro items (czpp, 14oe, 70yc, 7h3v).
- loka-x6t.126 skill-gated room depth (owner: "hold on that for now").

## Waiting on the owner

- Store fees, iOS first, the save guarantee; the component kit for the authoring UI.
- #574: open no longer replays history. Beyond hand-edited saves, a wrong row written by a code bug or a
  stale page from a bad restore now opens instead of offering Start over; the PM recommended accepting, the
  owner has not objected and has not confirmed.
- #564 calls: the 16 stubs marked reference only, the prologue outline, the unmarked files.
- Skills got their own page per the owner's Q3 answer (2026-10-31); owner-rules line 13 carries a dated note.
- The beats review; the two PM defaults in the outline; approval of the retro items; condition icons (loka-x6t.63).

Decided 2026-11-01 (paraphrased): keep the full level-up rush; finish the month-away cold open; cap away
catch-up at one in-game day (max 168 hours per cartridge) and keep catch-up rather than pause; drop the replay
at open; grey Attack in a sanctuary with one authored sentence. Decision records in `docs/decisions` and
the loka-vduxr and loka-g5hh.2 notes.

Storybook http://localhost:6006 serves main from the preview checkout (`bin/preview_update.sh`). The owner
sends polish prompts in the conversation; loop: [PM, Live polish session](PM.md#live-polish-session), owner
guide: [polish tour](design/polish-tour.md). Standing owner rules live in [owner rules](system/owner-rules.md#process).

## Session procedure

- Start: `mise install`, `br` 0.7.6 ([BEADS.md](BEADS.md)), `gh auth status`; `git pull --ff-only origin main`, then `br sync --import-only`;
  read [WORKFLOW](WORKFLOW.md), [PM](PM.md) and this page; `bin/session_status.sh` prints the board (`--full` for everything).
- Beads writes from the `main` checkout after `br sync --import-only`; each checkpoint is
  `bin/beads_checkpoint.sh` (pull, merge, machine-path check, commit the export and this page, push;
  a rejected push undoes its commit: rerun). Never commit `beads.db`.
- A kernel contract slice bumps only `INSTALLED.kernel_api` (`kernel/ts/src/runtime/world.ts`) to main+1 at
  push; when parallel PRs claim the same value, the later merge rebumps and reruns `bin/regen.sh`.
- `bin/merge_pr.sh <PR> <ids>` closes every id it is given: never pass an epic or parent id for a child PR.
- Subagents work only in their own worktrees under `~/dev/worktrees.noindex`, never in the main checkout.
- End: rewrite this page, push every branch with work, file the
  [retro](PM.md#retro-and-housekeeping-queue) items in Beads.
