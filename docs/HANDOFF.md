# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place once per session, at its end; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #529 (loka-vx2v, quest offer targets, kernel_api 1.129); written 2026-10-31 by Claude Code (Opus 5.5), engine-track PM session. A parallel session reviews the prologue beats and files "Prologue gap: ..." children of loka-g5hh; this session owns this page.

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

1. loka-sgqk catch-up cost with permanent ticking needs (kernel_api 1.130): brief, developer, reviewer, second opinion.
2. loka-mpu9 lean workflow into AGENTS.md and WORKFLOW: the owner sees the diff before merge.
3. loka-kgd.194.23 authoring tools (Fable developer running on draft PR, branch `tools/authoring`): keep my place, fast loop, checkpoints, author column, every-kind coverage and starters, still-to-write, scene files last. Independent reviewer after it. Owner asked for a nice UI and is choosing a component kit.
4. loka-g5hh.2 level-up rush (owner, quoted: "yes we also want that wow style rush too"): design pass, then brief; with loka-ot39 and loka-x6t.59 (P1). No skill-point pool in the prologue; the owner has not confirmed recording this as a decision.
5. Prologue gaps as the parallel session files them; then the proposed release work below.
6. Follow-ups: loka-xy1js, loka-9g1q1 (from #529); loka-n4dg and loka-gj82.4 effects; loka-ewtx engine follow-ups.

Proposed release work, awaiting the owner's three calls (store fees, iOS first, a save guarantee from launch): save migrations, loka-k3b5 off the P3 hold, resume mobile, rebuild the E1 harness and gates.

Owner rule 2026-10-31: every word the player reads in the prologue is hand-written by the owner; agents leave structure with empty text (record lands with loka-kgd.194.23).

Merged 2026-10-31: #529 quest offer targets (loka-vx2v).

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

- Store fees, iOS first, the save guarantee; the component kit for the authoring UI.
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
