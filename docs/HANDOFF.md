# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place at each checkpoint (a merge, a review verdict, a pushed fix) and before a
session ends; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #492; written 2026-10-28 by Claude Code (Opus 5.5), PM
session 97831846. Owner (2026-10-28, quoted): "you can use fable when you think it would help, we have a lot of
weekly limit ... this will be my last week before a break so yeah make it right!" Owner is away from Storybook
until all work is done; the picks Monitor is off. Storybook serves polish/session-2026-10-23 on 6006 (updated
from main today, before #481). Owner delegated every open decision (quoted): "whatever your best
recommendation on all is, or whatever is open, you decide with your best recommendation"; rulings are in the
notes of loka-ivjq.20, .3, .4, .29. Owner asked to be told when the "How Loka works" page is up (after C3).

## Now

Merged 2026-10-28/29: #485-#489, #491, #492 (B5 Beads sync: refuses instead of losing a row), #490 (batch C1: TS
loader keeps integrity/install checks only; one kernel_api range check; gate_sampler `knock` -> `knock_door`;
Fable final review APPROVE WITH NOTES, docs/reviews/2026-10-28-c1-final-review.md). Pushes to main run no CI
(nightly only); prove CI changes on a scratch branch. In flight; read the agent result or PR comment first:

- Batch C2 (F3 F5 F6 F7 F8 F11 F12): draft PR #493, integration branch `simplify/c2-kinds` (worktree
  ~/dev/worktrees.noindex/simplify-c2-kinds). Merged in: A (signals out, diag guard, behavior@1 out), E
  (structures), F (story_point on the choice), B1 (policy optional), C1 (policies/ out, bundles inlined,
  hunter/prey/loot, :area), B2 (policy wrapper dropped). C2 travel cancelled: transport@1 stays. D (one
  `name` field) in review; Z (docs sweep) on `simplify/c2-z-docs`; then Fable final review. Plan, rulings
  and amendments: loka-ivjq.3 notes. pm_merge uses main's merge_resolve.py (loka-hhs6): when it refuses a
  generated-only conflict, merge by hand in the batch worktree with the batch's own resolver, regen,
  commit, push.
- Then C3: "C3 PLAN" (Fable) in loka-ivjq.4 notes; owner ratified D1 (two maps, rename recipe -> scripted
  action); naming #7 #12 folded in; C3 rebuilds the glossary. After C3: a Fable "How Loka works"
  explainer page (Artifact), link to the owner. Then C4 naming batch (loka-ivjq.29), then polish (Next 3).
- C1 lessons, applied in every brief: parallel slices clash in shared tests, so each slice merges the
  latest integration branch before handback; bash_guard refuses local full suites, CI kernel/elixir jobs
  are the full red-test list and must be green before review; handback carries its own check table;
  load gate refuses spawns above load 8. Run bin/worktree_setup.sh from inside a new worktree (the
  main checkout's copy sets up main). A developer past ~2 h on mutation triage: tell it to hand back;
  the reviewer classifies the rest. A PR blocked only by a generated-file conflict with main: merge origin/main
  with diff3, `python3 bin/merge_resolve.py`, commit, push, wait_ci, merge.
- Follow-ups filed 2026-10-28/29: loka-83pq, qik8, 82h3, kl1u, r0o7, lizb, hzag, poxf, hofs, pe11, mh6p
  (provenance before any downloadable content: D5 gate), qjj4, hpbk, zeyz, q84v, muss, hhs6.
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
