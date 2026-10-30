# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place at each checkpoint (a merge, a review verdict, a pushed fix) and before a
session ends; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #507 (142f058d3); written 2026-10-30 by Claude Code (Opus 5.5), PM session e74a58c9.
Owner (2026-10-28, quoted): "you can use fable when you think it would help, we have a lot of weekly limit ...
this will be my last week before a break so yeah make it right!" Owner delegated every open decision (quoted):
"whatever your best recommendation on all is, or whatever is open, you decide with your best recommendation";
rulings are in the notes of loka-ivjq.20, .3, .4, .29.

## Now

Polish-foundation session (owner 2026-10-30, quoted: "Ok the five items oyu suggested, please work on them").
In flight: #509 loka-kgd.193 slice A (NPC emotes: emote@1 table with `others`/`to` lines, reaction `emote` step,
renderer in `mobile/packages/game-view/line_words.ts`, `cartridges/emote_sampler`, stories) at 0e1fdaf56: fresh
Opus review running (record `docs/reviews/2026-10-30-kgd193-npc-emotes-review.md`, branch `review-509`), then a
second opinion on the post-fix head (protocol change). Then slice B (showcase goblins cower), then loka-8ghm ambient.
Storybook on 6006 is current with #507 (Pages/Room Mood, MoodPair; Pages/NPC Mood).

Merged 2026-10-30, each with a fresh review and green ci/book-e2e on the exact head:
- #503 loka-3pr5: `bin/merge_resolve.py` resolves and stages what it can when hand files are left, `*.gen.*` glob,
  transcripts only on content_hash-only conflicts; `pm_merge` names only leftovers (REGEN_FAIL/COMMIT_FAIL). Cause of
  the C4 A refusal: all-or-nothing exit plus a CONFLICT line that listed every file (follow-up loka-b3ii).
- #502 loka-o6r3: `bin/mutate_diff.sh` follows renames (`-M`, AMR) and counts setup inside `MUTATE_MINUTES`.
- #504 loka-xppq: `bin/mutate.sh` refuses a non-integer or leading-zero `MUTATE_MINUTES` (exit 2).
- #505 loka-9t2m: one malformed POST to Storybook `/mcp` killed Storybook (ECONNREFUSED for every agent after):
  npm override `@tmcp/transport-http` 0.9.1 (follow-up loka-e9ey: drop it when addon-mcp moves). Never probe `/mcp` by curl.
- #506 loka-kgd.174: `mobile/app/book/declared_visible.test.ts`, every declared pool, NPC Held list (theft) and
  status visible in GameView and the Book (follow-ups loka-h12t mana beside ma, loka-hp4d shop stock under Held).
- #508 loka-x6t.61: `lint/rules/mobile-book-english.yml`, Book English only in LABEL; 14 files allowlisted
  (part 2 loka-s7af, with the rule's false positives and a Book.tsx:262 test gap).
- #507 loka-x6t.71 moods: NPC mood = name_variants (may carry their own `words`) + description_variants; NPC
  room_line_variants retired; record `docs/reviews/2026-10-30-x6t71-moods-review.md` (item moods loka-n39c).
- Closed, no code: loka-y6yg.52 (web clock pauses in a hidden tab by design, `App.tsx:136,144`).

Owner decisions 2026-10-30 (record `docs/decisions/owner-decision-moods-ambient-emotes-2026-10-30.md`; Beads
loka-kgd.193 notes): three builder tools, moods / ambient emotes (NPCs, rooms, every item; interval + optional
chance; loka-8ghm) / canned emotes. Then (quoted): "Actually, dont emotes only make sense in multiplayer? if so
table it for now", and chose "Keep NPC emotes (Recommended)": player emotes (command, Emote... pick list) are tabled
to the Realm; NPC emotes stay. Every feature ships a Storybook story.

Owner questions open: (1) mixed mood line "A cowering goblin and goblin are here." (shared-article rule,
book-ui.md:81-86) vs repeating the article for a shared noun (PM recommends repeat); (2) add
`cdp("Page.bringToFront")` after `new_tab()` in the owner's browser-use skill (outside the repo); (3) check that
~/dev is still in Spotlight Search Privacy (mdworker indexed the session worktree after npm ci; load 14).
- Draft #454 ON HOLD (P3 hold below).

## Next, in order (owner-approved)

1. Finish loka-kgd.193 (review #509, slice B), then loka-8ghm ambient emotes.
2. Polish: owner at Storybook; first item loka-r9mr (owner 2026-10-30: room-log dialogue in novel prose, `Nell says to you, "..."` / `Nell says, "..."`, never a colon; designer writes the rule into book-ui.md) (loop: [PM, Live polish session](PM.md#live-polish-session); owner guide:
   [polish tour](design/polish-tour.md)).
3. Simplification epic loka-ivjq: C1-C4 done; F9/F10 after .17.
4. Later: loka-x6t.130 verbose/brief setting; loka-h1gl narration follow-ups; loka-1dax compaction story;
   loka-tjhk flee line on a second fight's page; loka-nw03 formal methods plan; audit leftovers loka-u9x8,
   mz8m, yjuk, kovp; loka-kgd.194.21 population.ex crash on rejected text.json; approved before chapter work:
   loka-kgd.173 sim invariants, .175 scale benchmark.

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
