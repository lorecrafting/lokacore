# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place at each checkpoint (a merge, a review verdict, a pushed fix) and before a
session ends; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #527 (e5515bd48); written 2026-10-30 by Claude Code (Opus 5.5), PM session 30f61613.
Owner (2026-10-28, quoted): "you can use fable when you think it would help, we have a lot of weekly limit ...
this will be my last week before a break so yeah make it right!"

## Direction (owner 2026-10-30)

- **The prologue is v1** (epic loka-g5hh): a free, complete 3 to 5 hour short story ending on the landing,
  to build goodwill (owner, quoted: "make it a complete short story, for free, ending on the landing. We want to
  build goodwill."). Paid installments continue on the planet. The working outline is
  [the prologue outline](worldbuilding/notes/prologue-outline-2026-10-30.md) (Fable draft, not canon; 48 beats,
  five parts, 18 rooms, 7 NPCs plus Lira). It shows the three Lamrim capacities through the Three Roots with no
  Buddhist terms in game text; no economy or property in the prologue; no romance, the bond stays implicit.
  Prior art: the v2 Seedship Forest design in lorecrafting/lokacore-v2-legacy, docs/game-design/seedship-forest-world/.
- **The showcase is frozen**: no polish, no new rows unless a mechanic needs a test; it stays the regression bed.
- **Plan downgrade around 2026-11-10** to the Pro plan: build the prologue's engine gaps and the lean workflow
  (loka-mpu9) before then. After it: content PRs without a separate reviewer, one session working directly,
  Sonnet for content, reviews for engine changes only.
- **Book effects** (epic loka-n4dg): designer brief in the book's register (paper, ink, candlelight, sound),
  owner picks, Fable builds alongside the prologue.

## Next, in order

1. Owner is reviewing the beats (said they will continue in the morning). Then, per the PM's plan the owner
   heard: a one-page prologue pitch and a player-verb pass per beat (what the player does, which mechanic, which
   engine gap), the map of the 18 rooms, scene sheets for Part 1, then build Part 1.
2. Engine gaps known now, build before the downgrade: loka-vx2v quest offers need a fixture or NPC target (10
   sampler offers have no Book control until then; temporary allow-list in
   `mobile/app/book/__tests__/polish-book.test.ts`); loka-sgqk catch-up cost with permanent ticking needs (a
   month away is about 36k steps and 345 MB of save); companion remarks were retired (FD10) and the companion
   is central, so check whether the prologue needs them; needs switched on by story events and room text by
   stage are expected to be content only (verify in the player-verb pass).
3. loka-mpu9 lean workflow into AGENTS.md and WORKFLOW before about 2026-11-10.
4. loka-n4dg effects brief (designer), then the owner's pick, then Fable builds.
5. Polish follow-ups: loka-6sig dead Gil still answers the shout; loka-c5uu delete undrawn "Ask where" buttons;
   loka-lk8i band text wording; loka-tol6 service noun; loka-fsfq picker queue gitignore. Condition icons
   (loka-x6t.63) owner undecided.
6. Engine follow-ups (epic loka-ewtx): loka-zmqs, loka-dgko, loka-w9id (plan first), loka-0vrs (plan first).
7. Held until after the owner's polish pass: loka-698n, loka-8ghm (showcase; may be moot now it is frozen).

Merged 2026-10-30 after #520: #521 docs, #522 retro, #523 showcase speech as cards (loka-eyk7), #524 map stubs
(loka-6bmd, kernel_api 1.127), #525 colon sweep and colon-label lint (loka-pxa0), #526 permanent ticking needs
(loka-rn3b, loka-dw0k, kernel_api 1.128), #527 polish batch 3 (hidden permanent refusals, one conversation exit,
Look as a card, web column, Contents tap fix, lidded Close and Put on Inside, narrated-event italics, no Say
icon with spell cards on Character, the Map as dots and lines; doors: the Book draws no Close or Lock, owner
option C), #528 the prologue outline.

## Retro 2026-10-30b (awaiting owner approval)

loka-3rym generated story saves conflict on every kernel_api bump (three extra merge rounds today);
loka-9ack polish close passed locally but CI went red a third time (stories type check, tests pinning changed
wording). Also: the PM briefly ruled loose cards onto World against the owner's room page anatomy, caught by
the designer; read [Room page anatomy](system/book-ui.md#room-page-anatomy) before ruling on World placement.

## Holds

- P3 hold (owner 2026-10-22, quoted: "lets hold off on the p3 stuff for now"): draft #454 (before merge:
  /code-review and split lib/loka/core/compose_encounter.ex instead of its size allowance), kgd.188, 2lvx,
  5i4c, k3b5, x6t.98, y6yg.36, the 8 P3 engine bugs, and the P3 retro items (czpp, 14oe, 70yc, 7h3v).
- loka-x6t.126 skill-gated room depth (owner: "hold on that for now").

## Waiting on the owner

- The beats review; the two PM defaults in the outline (the Vowed are dozens; the other cradles stay sealed).
- Approval of the two retro items above; condition icons (loka-x6t.63).

No polish session is open. Storybook http://localhost:6006 serves main from the preview checkout. The owner
sends polish prompts in the conversation (owner 2026-10-30, quoted: "no need for polish watch i'll just
directly put the polish prompts in here"). Loop: [PM, Live polish session](PM.md#live-polish-session); owner
guide: [polish tour](design/polish-tour.md).

Standing owner rules live in [owner rules](system/owner-rules.md#process).

## Session procedure

- Start: `mise install`, `br` 0.7.6 ([BEADS.md](BEADS.md)), `gh auth status`; `git pull --ff-only origin main`, then `br sync --import-only`;
  read [WORKFLOW](WORKFLOW.md), [PM](PM.md) and this page; `bin/session_status.sh` prints the board.
- Beads writes from the `main` checkout after `br sync --import-only`; each checkpoint is
  `bin/beads_checkpoint.sh` (pull, merge, machine-path check, commit the export and this page, push;
  a rejected push undoes its commit: rerun). Never commit `beads.db`.
- A kernel contract slice bumps only `INSTALLED.kernel_api` (`kernel/ts/src/runtime/world.ts`); the save pin
  refuses older saves with Start over (#519). Never bump a cartridge's `at_least` for a contract change.
- `bin/merge_pr.sh <PR> <ids>` closes every id it is given: never pass an epic id for a child PR.
- End: rewrite this page, push every branch with work, file the
  [retro](PM.md#retro-and-housekeeping-queue) items in Beads.
