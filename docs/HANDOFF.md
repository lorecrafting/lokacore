# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place at each checkpoint (a merge, a review verdict, a pushed fix) and before a
session ends; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #476 (loka-glj8 spec, room point of view) plus the 2026-10-28 harness changes; written
2026-10-28 by Claude Code (Opus 5.5), PM session 661e816a. Weekly usage reset 2026-10-28 05:00 HST.

## Now

- Nothing is building. Open PR: draft #454 (E2 engine bugs, kgd.153 only) ON HOLD with the P3 hold below.
- Polish session `polish/session-2026-10-23` in ~/dev/lokacore-session serves Storybook on 6006 (on main
  after #475). The picks Monitor is off (owner 2026-10-24: "no need to arm monitor, just diarm for now");
  re-arm only when the owner is back at Storybook. Loop: [WORKFLOW, Live polish session](WORKFLOW.md#live-polish-session).
  Owner's screen-by-screen guide: [polish tour](design/polish-tour.md).

## Next, in order (owner-approved)

1. loka-glj8 room point of view: "You arrive from the south." / "You run in from the south.", the direction
   from the destination's exit back; flee and fall lines stay in the fight room's log; NPC arrives/leaves
   lines; re-freeze the move narration in the conformance fixtures by hand (IMPORT.md 2026-10-24 precedent).
   Spec: [Book UI, Line placement](system/book-ui.md#line-placement).
2. loka-x6t.127 remainder: away recap as a new entry at the bottom of the event log (owner, quoted: "It
   should be a new entry in the event log, meaning at the very bottom"); NPC carried-item note on the NPC
   page; exit warnings and the Continue conversation button under the
   [room page anatomy](decisions/owner-decision-room-page-anatomy-2026-10-23.md). PM idea: an exit
   warning becomes a movement log line.
3. Authoring batch A (owner go 2026-10-24, queued for this reset): loka-kgd.194.12, .13, .14 (diagnostics
   at the author's line), .16 behaviours, .18 prototype parameters, .17 source JSON Schema last, .9 showcase
   walk transcripts. One draft branch, Opus developer and reviewer; the PM decides whether .17 is a Fable
   contract brief. Groundwork for the visual builder (.8). Not in it: .15 .11 .19 .20; .7 waits on lore.
4. Later: loka-x6t.130 verbose/brief setting; loka-h1gl narration follow-ups; loka-1dax compaction story;
   loka-nw03 formal methods plan; approved before chapter work: loka-kgd.173 sim invariants, .174 Book
   visibility check, .175 scale benchmark.

Lane order (owner 2026-10-15/16): UI polish over the showcase (owner at Storybook), then measuring and
balance tools (loka-kgd.107), worldbuilding (loka-ikch), Chapters 1-3.

## Holds

- P3 hold (owner 2026-10-22, quoted: "lets hold off on the p3 stuff for now"): draft #454 (before merge:
  /code-review and split lib/loka/core/compose_encounter.ex instead of its size allowance), kgd.188, 2lvx,
  5i4c, k3b5, x6t.98, y6yg.36, the 8 P3 engine bugs, and the P3 retro items (czpp, 14oe, 70yc, 7h3v).
- loka-x6t.126 skill-gated room depth (owner: "hold on that for now").

## Waiting on the owner

- loka-r9mr: a talk prompt in the room log has no speaker ("Well, stranger?"). PM recommendation: "Nell: …".
- NPC/item detail page redesign: the designer's 2026-10-23 proposal (one card list, Leave at the bottom, no
  status line on detail pages, "Buy or sell" shop page, explicit service cards, Whisper hidden) has 7 open
  questions.
- Whether to file canned emotes.
- Polish: is the one-size step enough to mark a Chronicle milestone, or add a hairline?
- Worldbuilding first decisions (after polish): premise and pillars, cosmology shape, magic hardness and
  cost, Story vs Realm canon.

Standing owner rules live in [owner rules](system/owner-rules.md#process).

## Session procedure

- Start: `mise install`, `br` 0.7.4 ([BEADS.md](BEADS.md)), `gh auth status`; `br sync --import-only`;
  read [WORKFLOW](WORKFLOW.md) (Loop) and this page; `bin/session_status.sh` prints the board.
- Beads writes from the `main` checkout: `git pull --ff-only origin main` and `br sync --import-only` first;
  after each checkpoint `br sync --flush-only`, check the JSONL has no machine path, commit
  `.beads/issues.jsonl` (and this page) on main, push. On a push conflict: `git pull --rebase`, then
  `br sync --merge`, flush, commit. Never commit `beads.db`.
- End: rewrite this page, push every branch with work, file the
  [retro](WORKFLOW.md#retro-and-housekeeping-queue) items in Beads.
