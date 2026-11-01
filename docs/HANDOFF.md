# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place once per session, at its end; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #530, #535, #537, #539, #538; written 2026-10-31 by Claude Code (Opus 5.5), engine-track PM session. A parallel session reviews the prologue beats and files "Prologue gap: ..." children of loka-g5hh; this session owns this page. Lean default in force since #533.

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
- **Book effects** (epic loka-xz76e): #554, #559 and #558 merged the approved list; all audio is placeholder and not auditioned. Design source: [batch 2 rulings](design/effects-batch-2-rulings.md). Storm and wind need content phases named `rain`, `wind`, `storm` (the frozen showcase has `gale`), so they are Storybook-verified only.

## Next, in order

1. #540 loka-vduxr.4 `bin/loka check`: fix round 1 running (preview and check share one fixed seed and frozen clock; mend replay; decision record in the PR). Then the reviewer's scoped re-check, merge.
2. #541 loka-k3b5, head 9d2ed1dca, CI green: Opus reviewer, then a second opinion (save-affecting), merge.
3. loka-vduxr.2 scene verbs: building `sets`, `quest: accept`, narration, second speaker, `.cut`. `needs`, `once`, `then` and nesting cannot lower to existing JSON: Fable is designing a runtime slice; its brief goes in the issue notes.
4. loka-ivjq.9 generated reference: building.
5. Queue: loka-vduxr.5 panel and .6 dev cheats after #540; .7 fault batch; .8, .9 follow-ups; loka-kgd.175 benchmark; loka-qhvgq month-away cold open; a Part 2 placeholder spike after scene verbs (owned plot and hut against no property; hut at the landing; tiredness). Later briefs use narrow mutants, no `bin/mutate_diff.sh`: sweeps cost hours per slice.
6. loka-g5hh.2 level-up: E1 merged (#538). E2, E3, then B1 to B3; B2 needs #532 and loka-gj82.4. Brief and owner answers in its notes; a multi-slice issue needs a child id for `bin/merge_pr.sh`.
7. Proposed release work, awaiting the owner's three calls (store fees, iOS first, a save guarantee from launch): save migrations, loka-k3b5 off the P3 hold, resume mobile, rebuild the E1 harness and gates.
8. Ending page and outside link (owner wants a next-chapter message and giving to a hunger charity; PM advised a website link, not a Kickstarter button, and a direct link to a named charity for the free prologue). Not filed; the owner has not decided whether the game must fund itself.
9. Follow-ups: loka-xy1js, loka-9g1q1, loka-1b68q; loka-xz76e.10 waking music; loka-ewtx engine follow-ups.

`cartridges/lantern_proof` stays as host of the frozen conformance traces (PM ruling, in `docs/system/cartridge.md`); Bram stays in the samplers because literal ids and frozen fixtures pin him. Retiring the traces would need the owner.

Owner resets the weekly limit by hand at 99% (owner 2026-10-31); read `~/.claude/usage-cache.json` and warn near it. The spawn gate is CPU load, not usage; other sessions' tests hold it above 8 at times.

Merged 2026-10-31: #529 quest offer targets (loka-vx2v), #533 lean workflow (loka-mpu9), #534 Lantern cleanup (loka-4hik.31, .4), #536 restored tests (loka-4hik.30).

## Retro 2026-10-31 (awaiting owner approval)

loka-3rym and loka-9ack from before; new items are in the housekeeping queue: `push_slice` reports CI "not started" because it samples too early; the spawn load gate gives no fair wait across sessions.

## Holds

- P3 hold (owner 2026-10-22, quoted: "lets hold off on the p3 stuff for now"): draft #454 (before merge:
  /code-review and split lib/loka/core/compose_encounter.ex instead of its size allowance), kgd.188, 2lvx,
  5i4c, x6t.98, the 8 P3 engine bugs, and the P3 retro items (czpp, 14oe, 70yc, 7h3v).
- loka-x6t.126 skill-gated room depth (owner: "hold on that for now").

## Waiting on the owner

- Store fees, iOS first, the save guarantee; the component kit for the authoring UI.
- Decided 2026-10-31 ("ok go ahead with all your recs"): see loka-vduxr and loka-g5hh.2 notes.
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
