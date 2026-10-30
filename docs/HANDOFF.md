# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place at each checkpoint (a merge, a review verdict, a pushed fix) and before a
session ends; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #509 (0b795d299); written 2026-10-30 by Claude Code (Opus 5.5), PM session e74a58c9.
Owner (2026-10-28, quoted): "you can use fable when you think it would help, we have a lot of weekly limit ...
this will be my last week before a break so yeah make it right!" Owner delegated every open decision (quoted):
"whatever your best recommendation on all is, or whatever is open, you decide with your best recommendation";
rulings are in the notes of loka-ivjq.20, .3, .4, .29.

## Now

Polish-foundation session done (owner 2026-10-30, quoted: "Ok the five items oyu suggested, please work on them").
NOTHING IN FLIGHT. POLISH IS READY: `bin/polish_session.sh update` brought main (#509) into the session worktree;
Storybook http://localhost:6006 shows the new stories: Book/LogLines "NPC emotes", Pages/Room "Goblins cower",
"An afraid goblin and a calm one", "Two afraid goblins", Pages/NPC "Mood (afraid goblin)".

Merged 2026-10-30, each with a fresh review and green ci/book-e2e on the exact head:
- #503 loka-3pr5: `bin/merge_resolve.py` resolves and stages what it can when hand files are left, `*.gen.*` glob,
  transcripts only on content_hash-only conflicts; `pm_merge` names only leftovers (REGEN_FAIL/COMMIT_FAIL). Cause of
  the C4 A refusal: all-or-nothing exit plus a CONFLICT line that listed every file (follow-up loka-b3ii). Proven
  live: it resolved #508's checks.gen.json conflict with no hand edit.
- #502 loka-o6r3: `bin/mutate_diff.sh` follows renames (`-M`, AMR) and counts setup inside `MUTATE_MINUTES`.
- #504 loka-xppq: `bin/mutate.sh` refuses a non-integer or leading-zero `MUTATE_MINUTES` (exit 2).
- #505 loka-9t2m: one malformed POST to Storybook `/mcp` killed Storybook (ECONNREFUSED for every agent after):
  npm override `@tmcp/transport-http` 0.9.1 (follow-up loka-e9ey). Never probe `/mcp` by curl.
- #506 loka-kgd.174: `mobile/app/book/declared_visible.test.ts` (follow-ups loka-h12t mana beside ma, loka-hp4d
  shop stock under Held).
- #508 loka-x6t.61: `lint/rules/mobile-book-english.yml`, Book English only in LABEL; 14 files allowlisted
  (part 2 loka-s7af).
- #507 loka-x6t.71 moods: NPC mood = name_variants (may carry their own `words`) + description_variants; NPC
  room_line_variants retired (item moods loka-n39c); record `docs/reviews/2026-10-30-x6t71-moods-review.md`.
- #510 loka-2ve2: the article is written again when adjacent names end in the same word ("A cowering goblin and a
  goblin are here."; owner 2026-10-30 accepted the PM rec).
- #509 loka-kgd.193 NPC emotes: `emote@1` table (`others`, optional `to`), reaction `emote` step, renderer in
  `mobile/packages/game-view/line_words.ts`, `cartridges/emote_sampler`; record
  `docs/reviews/2026-10-30-kgd193-npc-emotes-review.md` (Realm per-reader lines loka-u6wj; emoted trigger loka-s0fy).
- Closed, no code: loka-y6yg.52 (web clock pauses in a hidden tab by design, `App.tsx:136,144`; the owner's
  browser-use skill now calls `Page.bringToFront` after `new_tab`).

Owner decisions 2026-10-30 (record `docs/decisions/owner-decision-moods-ambient-emotes-2026-10-30.md`): three
builder tools, moods / ambient emotes (NPCs, rooms, every item; loka-8ghm) / canned emotes; player emotes tabled to
the Realm (quoted: "Actually, dont emotes only make sense in multiplayer? if so table it for now"), NPC emotes kept.
Every feature ships a Storybook story. Owner re-added ~/dev to Spotlight privacy (mdfind hits 0).
- Draft #454 ON HOLD (P3 hold below).

## Next, in order (owner-approved)

1. Polish: owner at Storybook; first item loka-r9mr (owner 2026-10-30: room-log dialogue in novel prose, `Nell says to you, "..."` / `Nell says, "..."`, never a colon; designer writes the rule into book-ui.md) (loop: [PM, Live polish session](PM.md#live-polish-session); owner guide:
   [polish tour](design/polish-tour.md)).
2. After the owner's polish pass (PM rec): loka-698n showcase goblins cower, then loka-8ghm ambient emotes.
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
