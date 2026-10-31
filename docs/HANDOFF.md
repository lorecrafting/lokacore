# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place at each checkpoint (a merge, a review verdict, a pushed fix) and before a
session ends; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #520 (973743d0b); written 2026-10-30 by Claude Code (Opus 5.5), PM session 30f61613.
Owner (2026-10-28, quoted): "you can use fable when you think it would help, we have a lot of weekly limit ...
this will be my last week before a break so yeah make it right!" Owner delegated every open decision (quoted):
"whatever your best recommendation on all is, or whatever is open, you decide with your best recommendation";
rulings are in the notes of loka-ivjq.20, .3, .4, .29.

## Now

Nothing in flight. No polish session is open; Storybook http://localhost:6006 serves main from the preview
checkout. The owner sends polish prompts in the conversation now (owner 2026-10-30, quoted: "no need for polish
watch i'll just directly put the polish prompts in here"): no picks Monitor. Loop: [PM, Live polish session](PM.md#live-polish-session); owner guide: [polish tour](design/polish-tour.md).

Merged 2026-10-30 (each reviewed, green ci/book-e2e on the exact head):
- Retro: #511 (loka-yqde scratch subfolders, loka-e69q DEFINITION_MAPS schema test, loka-wam0 measured: lint
  stalls in post-job cleanup, not runner queueing; follow-up loka-pzp1).
- Polish batch 1 #513: novel-prose log lines, no colon labels (loka-r9mr; owner: "as close to novel book reading
  typography as possible"); liquid and fuel amounts in words (loka-ikat, loka-nkcr); container Inside page
  (loka-mo0p); Contents hides the status bar, its pages go Back to Contents (loka-8lpm); NPC Look page, HELD list
  gone (loka-aqnc).
- Polish batch 2 #520: an unavailable action reads its plain verb, a press sends nothing and grays it with one
  reason sentence (loka-uzt6, `mobile/app/book/reasons.ts`); shop/service/order rows are prose lines with the
  noun underlined (loka-ck8k); Look page condition, worn and carried sentences; liquid log lines name the new
  level; "You can't hurt the Reeve."
- Engine epic loka-ewtx (NPC Look + prose bindings), kernel_api 1.122 -> 1.126: #512 liquid line binds the
  vessel (loka-tc2e); #514 dialogue speaker, `Nell says to you, "..."` (loka-548k); #515 NPC condition band,
  only for an NPC with its own hp (loka-ysbt); #516 bandOf/combat crash on hp-less foes (loka-zvwh); #517 NPC
  worn vs carried by slot declaration (loka-oc5i); #518 an NPC without its own hp cannot be attacked,
  `cannot_be_hurt` (loka-xyyd, owner-approved); #519 the save pin carries kernel_api, any difference is refused
  with Start over (loka-daha). Fable batch-final review APPROVE WITH NOTES, #521
  (`docs/reviews/2026-10-30-ewtx-batch-final-review.md`).

## Next, in order

1. Owner question open: hide the grayed Attack card on an NPC that cannot be hurt (PM rec: show a grayed card
   only when the player could change the outcome; hide permanent refusals like cannot_be_hurt; Book-only, a
   short reason list). Not yet answered; do it as a polish item on a yes.
2. Polish follow-ups filed today: loka-lk8i band text wording + lint, loka-tol6 service noun (protocol),
   loka-fsfq gitignore the picker queue.
3. Engine follow-ups (epic loka-ewtx): loka-zmqs (damage spells on hp-less NPCs, shared attackable(), engage
   diagnostic), loka-dgko NPC pronouns, loka-w9id every NPC has hp + authored "can't be attacked" and "peaceful
   room" flags (owner-approved, plan first; then retire "no hp means can't be hurt"), loka-0vrs peek then steal
   (plan first).
4. Held until after the owner's polish pass: loka-698n (showcase goblins cower), then loka-8ghm (ambient emotes).
5. Simplification epic loka-ivjq: C1-C4 done; F9/F10 after .17.
6. Later: loka-x6t.130 verbose/brief setting; loka-h1gl narration follow-ups; loka-1dax compaction story;
   loka-tjhk flee line on a second fight's page; loka-nw03 formal methods plan; audit leftovers loka-u9x8,
   mz8m, yjuk, kovp; loka-kgd.194.21 population.ex crash on rejected text.json; approved before chapter work:
   loka-kgd.173 sim invariants, .175 scale benchmark.

Lane order (owner 2026-10-15/16): UI polish over the showcase (owner at Storybook), then measuring and
balance tools (loka-kgd.107), worldbuilding (loka-ikch), Chapters 1-3.

## Retro 2026-10-30 (awaiting owner approval)

loka-mlok (check for a live agent before spawning on a handed-off branch), loka-vnzm (no unscoped Storybook
test-run: one OOM-killed the owner's Storybook), loka-iu6x (polish commits run the showcase walk and
catalogue test), loka-o0pw (carrying review records cancels developer CI: carry once at merge), loka-aeju (new
slice branches must not track origin/main).

## Holds

- P3 hold (owner 2026-10-22, quoted: "lets hold off on the p3 stuff for now"): draft #454 (before merge:
  /code-review and split lib/loka/core/compose_encounter.ex instead of its size allowance), kgd.188, 2lvx,
  5i4c, k3b5, x6t.98, y6yg.36, the 8 P3 engine bugs, and the P3 retro items (czpp, 14oe, 70yc, 7h3v).
- loka-x6t.126 skill-gated room depth (owner: "hold on that for now").

## Waiting on the owner

- The Attack-card question above, and approval of the five retro items.
- Worldbuilding first decisions (after polish): premise and pillars, cosmology shape, magic hardness and
  cost, Story vs Realm canon.

Standing owner rules live in [owner rules](system/owner-rules.md#process).

## Session procedure

- Start: `mise install`, `br` 0.7.6 ([BEADS.md](BEADS.md)), `gh auth status`; `git pull --ff-only origin main`, then `br sync --import-only`;
  read [WORKFLOW](WORKFLOW.md), [PM](PM.md) and this page; `bin/session_status.sh` prints the board.
- Beads writes from the `main` checkout after `br sync --import-only`; each checkpoint is
  `bin/beads_checkpoint.sh` (pull, merge, machine-path check, commit the export and this page, push;
  a rejected push undoes its commit: rerun). Never commit `beads.db`.
- A kernel contract slice bumps only `INSTALLED.kernel_api` (`kernel/ts/src/runtime/world.ts`); the save pin
  refuses older saves with Start over (#519). Never bump a cartridge's `at_least` for a contract change.
- End: rewrite this page, push every branch with work, file the
  [retro](PM.md#retro-and-housekeeping-queue) items in Beads.
