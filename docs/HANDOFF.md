# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place at each checkpoint (a merge, a review verdict, a pushed fix) and before a
session ends; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #501 (157bcaf48); written 2026-10-30 by Claude Code (Opus 5.5), PM session cff5016d.
Owner (2026-10-28, quoted): "you can use fable when you think it would help, we have a lot of weekly limit ...
this will be my last week before a break so yeah make it right!" Owner delegated every open decision (quoted):
"whatever your best recommendation on all is, or whatever is open, you decide with your best recommendation";
rulings are in the notes of loka-ivjq.20, .3, .4, .29.

## Now

The overnight plan (owner-approved 2026-10-29, quoted: "okay lets do all those") is done. POLISH IS READY:
`bin/polish_session.sh update` brought main (#501) into the session worktree and restarted Storybook
(http://localhost:6006); the picks Monitor is armed (re-arm on its 30-minute expiry). Nothing is in flight.

Merged overnight, each with a fresh review and green ci/book-e2e on the exact head:
- #497 loka-t37i: stale doc facts in mechanics.md/protocol.md, cites made symbol links (leftovers loka-ba87, loka-q7i0).
- #498 loka-tafk: `bin/mutate.sh` stops itself at `MUTATE_MINUTES` (default 30), exit 3 (follow-up loka-xppq).
- #499 loka-tb31 (+gsgj): `sh bin/regen.sh` alone rebuilds every compiled hash fixture (value ones included), re-pins
  every transcript pin and watches the capability registry; containers_cartridge_{items,locks,sampler} compile from
  source (follow-up loka-273d: four stale python generators).
- #500 loka-xtia: C2/C3 retro lessons in docs/lessons/pm.md.
- #501 batch C4 loka-ivjq.29: variety@1 -> alternates@1; capability keys attribute/skill/topic/tag (singular);
  map_positions.json -> layout.json; short_variants -> name_variants; records docs/reviews/2026-10-30-c4-{a,b,final}-review.md.

- Owner ratified 2026-10-30 (quoted: "yes to all except the room log line dialogue"): C2, C3 and C4 PM rulings;
  C4 OUT items #9/#11 filed as cleanups loka-9x5y, loka-kkt5; #2b crow and #5 water deferred to the real game.
- Fix next (P2 housekeeping): loka-3pr5 merge_resolve.py should take either side for transcripts, live saves and gen
  files (pm_merge refused C4 A after B); loka-o6r3 mutate_diff follows renames; loka-xppq MUTATE_MINUTES guard.
- Batch lessons, applied in every brief: each slice merges the latest integration branch before handback;
  handback carries its own check table and /code-review result; machine load under 8; mutation is tool-timeboxed.
- Draft #454 ON HOLD (P3 hold below).

## Next, in order (owner-approved)

1. Polish: owner at Storybook; first item loka-r9mr (owner 2026-10-30: room-log dialogue in novel prose, `Nell says to you, "..."` / `Nell says, "..."`, never a colon; designer writes the rule into book-ui.md) (loop: [PM, Live polish session](PM.md#live-polish-session); owner guide:
   [polish tour](design/polish-tour.md)).
2. Simplification epic loka-ivjq: C1-C4 done; F9/F10 after .17.
3. Later: loka-x6t.130 verbose/brief setting; loka-h1gl narration follow-ups; loka-1dax compaction story;
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
