# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place at each checkpoint (a merge, a review verdict, a pushed fix) and before a
session ends; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #480/#484; written 2026-10-28 by Claude Code (Opus 5.5), PM
session 5e160e83. Owner (2026-10-28, quoted): "you can use fable when you think it would help, we have a lot of
weekly limit ... this will be my last week before a break so yeah make it right!" Owner is away from Storybook
until all work is done; the picks Monitor is off. Storybook serves polish/session-2026-10-23 on 6006 (updated
from main today, before #481).

## Now

Merged 2026-10-28: #481 (loka-x6t.127), #482 (loka-ivjq.16 E1 harness), #483 (loka-ivjq.25/.27 regen and
gates), #484 (loka-ivjq.18/.19/.21 role files, guard rules, stage labels dropped), #480 (Authoring batch A:
loka-kgd.194.12/.13/.14/.16/.18/.22/.17/.9). In flight; each verdict lands as a PR comment, read those first:

- Merged this session: #486, #487 (batch T; loka-ivjq.24/.15/.14), #485 (batch P; loka-ivjq.26/.22/.13).
  Follow-ups filed: loka-83pq (compose_knowledge test gap), loka-qik8 (check_as_never nits).
  `gh` token lacks `workflow` scope: a PR touching .github/workflows merges only after `bin/sync_pr.sh`
  (worked for #485); if refused, the owner runs `gh auth refresh -s workflow`.
- #488 batch Docs (`housekeeping/batch-docs`; closes loka-ivjq.1/.17/.23/.10; F9 .9 stays open): designer
  APPROVE WITH NOTES; batch review CHANGES REQUIRED (F1 cut live liquids/fuel/food/population rules from
  cartridge.md); fix round 1 with a fresh developer. Then scoped re-check, merge.
- Batch C1 (S7 loka-ivjq.20, F2 loka-ivjq.2): plan in loka-ivjq.20 notes ("C1 PLAN", PM amendments on
  top). Integration branch `simplify/c1-loader` (worktree simplify-c1-loader) cut at 801a9a20. Wave 1
  running: slice 0 prep then B1 (one developer, `simplify/c1-prep`, `simplify/c1-b1`), F2-Ex
  (`simplify/c1-f2-ex`); D1 starts from the prep head. Per-slice review, PM merges sub-branches
  `--no-ff`; prep and D1 merged (86f6781cc); B1 and F2-Ex in fix rounds; B2, D2, F2-docs building;
  wave 3 = C1, C2; then F; Fable final-head review. At F2-Ex merge take its deletion of
  loader_floors.json and `git rm kernel/ts/test/loader_floors.test.ts`.
  Starred decisions D1 D2 D4 D5 D6 are PM defaults inside the owner's yes; owner ratifies on return.
- B5 (loka-ivjq.28) reopened: Beads sync redesign (Fable brief); #484 review found three failure states
  (AmbiguousBase after a mid-run death, br's --force-db hint reverting main rows, base rebuild dropping
  rows). Old refuse-then-manual sync stays: on `after_merge` "Sync conflict", run `br sync --merge`, then
  rerun `bin/after_merge.sh`; a "local path" refusal means a Beads note quotes a path: reword it.
- Draft #454 ON HOLD (P3 hold below).

- Batch S (speed, loka-n0ng; owner yes 2026-10-28 "yes to all the process speedups"): reviewer fixes
  small no-logic should-fixes in place; CI path filters; agents leave full suites to CI (wait_ci is the
  full-suite bar; already the practice in C1 briefs); prepush only for changed file types. One developer when
  a slot frees; B5 (loka-ivjq.28) moves ahead of C2.

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

- Start: `mise install`, `br` 0.7.4 ([BEADS.md](BEADS.md)), `gh auth status`; `git pull --ff-only origin main`, then `br sync --import-only`;
  read [WORKFLOW](WORKFLOW.md), [PM](PM.md) and this page; `bin/session_status.sh` prints the board.
- Beads writes from the `main` checkout after `br sync --import-only`; each checkpoint is
  `bin/beads_checkpoint.sh` (pull, flush, machine-path check, commit the export and this page, push;
  a rejected push prints the recovery steps). Never commit `beads.db`.
- End: rewrite this page, push every branch with work, file the
  [retro](PM.md#retro-and-housekeeping-queue) items in Beads.
