# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place at each checkpoint (a merge, a review verdict, a pushed fix) and before a
session ends; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #495; written 2026-10-29 by Claude Code (Opus 5.5), PM
session cff5016d (resumed after a terminal crash killed session 97831846's agents). Owner (2026-10-28, quoted):
"you can use fable when you think it would help, we have a lot of weekly limit ... this will be my last week
before a break so yeah make it right!" Owner is away from Storybook until all work is done; the picks Monitor
is off. Owner delegated every open decision (quoted): "whatever your best recommendation on all is, or whatever
is open, you decide with your best recommendation"; rulings are in the notes of loka-ivjq.20, .3, .4, .29.
Owner asked to be told when the "How Loka works" page is up.

## Now

Merged 2026-10-29: #493 (batch C2: policy wrapper gone, policy optional, policies/population_bundles/story_points
kinds gone, one `name` field, structures; transport@1 kept; docs/reviews/2026-10-29-c2-final-review.md) and #495
(batch C3: one Step and one Check for reactions, scripted actions, dialogue choices and service benefits; recipe
is now scripted action; reaction `event.emit` (refused in delayed rules); docs/reviews/2026-10-29-c3-final-review.md).
Rulings for both: loka-ivjq.3 and .4 notes. Nothing is in flight.

- Done 2026-10-29: "How Loka works" explainer (Evennia-oriented, with architecture and Realm sections):
  https://claude.ai/artifact/HYVKe5JiSfmBQB25cx5Zgb. Merged #496 (docs/rnd Realm live-ops proposal, loka-cw9y kept open as the Realm live-ops epic).
- OVERNIGHT PLAN, owner-approved 2026-10-29 (quoted: "okay lets do all those"), in order, done before polish:
  (1) loka-tb31 P1: regen re-pins transcript and value-fixture hashes; (2) C4 naming batch loka-ivjq.29:
  PM picks under the standing delegation, low-risk renames only, nothing that changes a save, each pick
  recorded for owner ratification; (3) loka-t37i docs drift (eight stale doc facts); (4) retro for C2/C3
  (lessons: hash re-pin cost, unenforced reviewer mutation timebox loka-tafk, early-start slices, merge-order
  conflicts). Morning: `bin/polish_session.sh update`, re-arm the picks Monitor, tell the owner Storybook is
  ready, then polish (Next 3).
- Fix first after that: loka-tb31 (P1): regen does not re-pin transcript or value-fixture hashes; every
  parallel C3 slice merge conflicted in 30-50 of them and cost 20-30 min of scripted re-pinning. Also the
  unenforced reviewer mutation timebox (C3 final sweep ran ~90 of 45 min) and mutate_diff treating renamed
  files as new.
- Batch lessons, applied in every brief: each slice merges the latest integration branch before handback;
  CI kernel/elixir jobs are the full red-test list; handback carries its own check table and its
  /code-review result; load gate refuses spawns above 8; mutation work is timeboxed at 30 min per slice and
  survivors in carried-over logic are filed, not fixed. A slice that only changes compiler source merges
  cleanly; one that touches the corpus conflicts in hashes until loka-tb31 lands.
- Follow-ups filed 2026-10-29: C2/C3 review test gaps (loka-3ywg, barrier opens_when, R/P survivors,
  sequence.ts:99-101), items_sampler containment hash, cartridge_journal_hash.py stale keys, payment deletion
  (D4), loka-zeyz behavior rows.
- Owner to ratify on return (PM decided under delegation): C2 D2/D5/D8 and transport@1 kept; C3 rulings in
  loka-ivjq.4 notes (delayed event.emit refused, slice X, V's missing_property at benefit.site).
- Draft #454 ON HOLD (P3 hold below).

## Next, in order (owner-approved)

1. "How Loka works" page, then loka-tb31.
2. Simplification epic loka-ivjq: C1-C3 done (F2-F8, F11, F12); C4 naming (loka-ivjq.29) next; F9/F10 after .17.
3. Then polish: `bin/polish_session.sh update`, re-arm the picks Monitor, tell the owner Storybook is ready
   (loop: [PM, Live polish session](PM.md#live-polish-session); owner guide: [polish tour](design/polish-tour.md)).
4. Later: loka-x6t.130 verbose/brief setting; loka-h1gl narration follow-ups; loka-1dax compaction story;
   loka-tjhk flee line on a second fight's page; loka-nw03 formal methods plan; audit leftovers loka-u9x8,
   mz8m, yjuk, kovp; loka-kgd.194.21 population.ex crash on rejected text.json; approved before chapter work:
   loka-kgd.173 sim invariants, .174 Book visibility check, .175 scale benchmark.

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

- Start: `mise install`, `br` 0.7.6 ([BEADS.md](BEADS.md)), `gh auth status`; `git pull --ff-only origin main`, then `br sync --import-only`;
  read [WORKFLOW](WORKFLOW.md), [PM](PM.md) and this page; `bin/session_status.sh` prints the board.
- Beads writes from the `main` checkout after `br sync --import-only`; each checkpoint is
  `bin/beads_checkpoint.sh` (pull, merge, machine-path check, commit the export and this page, push;
  a rejected push undoes its commit: rerun). Never commit `beads.db`.
- End: rewrite this page, push every branch with work, file the
  [retro](PM.md#retro-and-housekeeping-queue) items in Beads.
