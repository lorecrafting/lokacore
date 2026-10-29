# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place at each checkpoint (a merge, a review verdict, a pushed fix) and before a
session ends; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #489; written 2026-10-28 by Claude Code (Opus 5.5), PM
session 5e160e83. Owner (2026-10-28, quoted): "you can use fable when you think it would help, we have a lot of
weekly limit ... this will be my last week before a break so yeah make it right!" Owner is away from Storybook
until all work is done; the picks Monitor is off. Storybook serves polish/session-2026-10-23 on 6006 (updated
from main today, before #481).

## Now

Merged 2026-10-28: #485 (P), #486/#487 (T), #488 (Docs), #489 (S: CI path filters, verified on hosted CI:
docs-only pushes run only changes+lint). Pushes to main run no CI (nightly only); prove CI changes on a
scratch branch. In flight; read the agent result or PR comment first:

- Batch C1 (S7 loka-ivjq.20, F2 loka-ivjq.2): draft PR #490 (`simplify/c1-loader`, d5136682, green; every
  check-family slice merged: prep B1 B2 C1 C2 D1 D2 F2-Ex F2-docs, records docs/reviews/2026-10-28-c1-*).
  Slice F (`simplify/c1-f`, cleanup) review CHANGES REQUIRED (docs only: "both kernels" claims for
  compiler-only refusals); fresh developer fixing. Next: scoped re-check by a reviewer, merge F into
  c1-loader (`git merge --no-ff`; regenerate generated conflicts; delegate any test/source conflict to a
  developer), CI green, mark #490 ready, Fable final-head review (whole batch), then
  `bin/merge_pr.sh 490 loka-ivjq.20,loka-ivjq.2`. Intended artifact change: gate_sampler `knock` recipe
  renamed `knock_door`. Starred decisions D1 D2 D4 D5 D6 (C1 PLAN) await owner ratification.
- B5 (loka-ivjq.28) PR #491 (`housekeeping/b5-beads-sync`, fc2e1a95, green): adversarial review running
  (row loss with real br in throwaway clones). On approve: merge; closes loka-ivjq.28, loka-9ch9, loka-kovp.
  Until merged, old recovery: on after_merge "Sync conflict" run `br sync --merge`, rerun after_merge.
- Batch C2 (F3 F5 F6 F7 F8 F11 F12): plan "C2 PLAN" in loka-ivjq.3 notes (Fable; 10 slices, 3 waves, the
  two whole-corpus rewrites last and alone). Starts after #490 merges; starred D2 D5 D8 await ratification.
- Then C3 (F4 one step/check vocabulary + engine rename, L; needs a Fable plan), then polish (Next 3).
- Follow-ups filed today: loka-83pq, loka-qik8, loka-82h3, loka-kl1u.
- C1 lessons, applied in every brief: parallel slices clash in shared tests, so each slice merges the
  latest integration branch before handback; bash_guard refuses local full suites, CI kernel/elixir jobs
  are the full red-test list and must be green before review; handback carries its own check table;
  load gate refuses spawns above load 8 (wait with a sysctl vm.loadavg until-loop).
- Draft #454 ON HOLD (P3 hold below).

## Next, in order (owner-approved)

1. Finish batch A (above).
2. Simplification batch, epic loka-ivjq (Fable audit 2026-10-28, report in its notes; owner rulings in its
   description): F1 docs, F2 kernel_api floors, F3 policy wrapper, F4 one step/check vocabulary (L, Fable
   brief), F5 single-use kinds, F6 display-name field, F7 delete signal shortcut, F11 story points onto the
   choice; F9/F10/F12 after .17.
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
