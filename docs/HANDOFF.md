# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place once per session, at its end; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after 250eac16d; written 2026-11-19 in Claude Code (Opus 5.5), PM session. The Anthropic
subscription is back on the $20 Pro plan (owner 2026-11-19): low-token workflow, **subagents on Opus,
never Fable** (no usage credits). `kernel_api` is 1.159. **Nothing is in flight, no agent is running.**
#454 is the owner's P3 hold.

## Direction

- **The in-game builder is the authoring track** (owner-approved 2026-11-19, epic **`loka-hcnlh`**,
  design `docs/rnd/in-game-builder-mode-2026-11-19.md`): every panel function moves into the game
  screen (Build mode), responsive phone to desktop, **100% parity**, then `tools/author-panel` is
  deleted. Until parity the panel takes fixes only. Unwritten lines never show `~` to the owner (ruling 9).
  No builder for players unless hosted.
- **Pro low-token workflow** (owner 2026-11-07): one session does small slices itself; at most one
  developer at a time; a separate reviewer only for engine, save, contract, compiler-facing or security.
- **The prologue is v1.** The owner builds Part 1 in `cartridges/prologue/` (**uncommitted on purpose**;
  three rooms and a test item so far). Start: `bin/author.sh cartridges/prologue`; restart after each merge.
- **The owner writes every player-facing word**; agents use `~`. Polish feedback goes to Beads under
  loka-wfrgk; fixes batch on the owner's go; blockers are fixed at once.
- NPC routines (loka-ni2zd) wait for the owner's own design session.

## Board

**35 open, 11 ready, 3 housekeeping deferred to 2027-01-01.** Before proposing work, check the bead is
not already shipped: read the code, not the title, and sweep ready parents against their children.

Shipped 2026-11-19 (this session): **#760** (`wfrgk.125`) a diagnostic with `rel: null` (a `~words`
line) no longer blanks the panel's map, hierarchy and inspector (`story.ts` `nodeOf`); **#761**
(`wfrgk.121/.122/.123`) a card field types over a bare `~`, `TOUCH_LINK_MISSING` skips a bare `~` line
(a starter world compiles with no warning), and the Room card has **Add exit** (both ways, any level).
`wfrgk.124` closed as a misread. Builder probes **0.1** (the card logic bundles for web and Hermes;
release unchanged; Metro must watch `kernel/ts/play` and `protocol/`) and **0.2** (warm structural
edits 0.55-0.97 s; the 18 s was cold start) are recorded in the design's section 8.

## Story patterns (loka-vduxr.57, shipped 2026-11-17)

`docs/BUILDERS-GUIDE.md` has a **Story patterns** section: ten recipes from the
[2026-11-04 adoption shortlist](rnd/prologue-adoption-shortlist-2026-11-04.md), each verified against a running
sampler file. Read it before writing prologue beats.

**Three shortlist claims did not survive and the page carries the corrections:** row 3 is a fact read back by a
reaction, not a delayed write; `barrier.set` takes `{"barrier", "to": "open"}`; row 2 already has **four** working
actions on one barrier (`barrier_sampler`). **Row 1's `then_failed` is the one gap** — it exists in
`protocol/dialogue.schema.json` and no cartridge or sampler uses it, so the page states it as blocked.

**Do not "verify" a mechanic by grepping one schema file.** `then_failed` was declared absent after a grep of
`protocol/cartridge.schema.json` alone; it lives in `protocol/dialogue.schema.json`. Two written examples had to be
corrected the same way (`village_regard`, `mill_gate` did not exist). Grep the repo, then read the sampler.

## Resume, in order

1. **Builder slice 0.4, `loka-hcnlh.3`** (ready): move `registry.json` and `new.json` from
   `tools/author-panel/src/edit/` to `kernel/ts/play/`, re-point panel, gate (`bin/toolbox_page.exs`)
   and tests, and add `kernel/ts/play` and `protocol/` (was `protocol/fixtures`) to
   `mobile/app/metro.config.js` watchFolders. Not compiler-facing: no separate reviewer.
2. Then **0.3, `loka-hcnlh.4`** (parity gate: `book` surface per row + `parity.json`, shrink-only
   `todo`, red controls), then **1.1 `.5`** (the `Text.tsx` seam, separate reviewer and designer),
   then 1.2-1.4 (`.6`-`.8`). Split phases 2-6 into beads when phase 1 lands. Design section 7 has
   every slice's acceptance.
3. **`loka-wfrgk.100.4.1`** (small, ready): drop the card's stale ruling-11 refusal of a dialogue
   choice label (`tools/author-panel/src/edit/fields.tsx:39`); owner ruled yes 2026-11-19.
4. **The owner writing Part 1**: friction from `bin/author.sh` goes to Beads; blockers at once.
5. **Owner answers still open** (proposed 2026-11-19, unanswered; defaults in brackets): `vduxr.39`
   [close; doc-only done]; the weather `wet` flag [drop it]; `dbtxr` [close: (a) fixed, (c) matches
   `book-ui.md:792`, (b) only if seen]; branches `toolbox/settle-3` (9 commits, 2026-10-15) and
   `design/playtest-combat` (1 commit) [delete both]; retros `8v4lx` [yes] and `7vnzm` [no].
6. Parked on purpose: `.100.7`, `.100.8` (the builder's sheets supersede the line-key question),
   `vduxr.29` (unreproducible), `.102.1` (needs a per-node cite carrier first), `ni2zd.*`, #454.

## Code worth reading before touching its area

History lives in git and `docs/reviews/`; these four are live constraints, not a changelog.

- **`#749` (`vduxr.69`):** a line beginning `~` with words after it draws one `placeholder_tilde` warning naming its
  file and line; the words ship unchanged. Only a line that trims to `~` alone is a placeholder. **Read
  `stray_tildes/2` in `lib/loka/content.ex` before touching the placeholder counters** — it binds the source index
  only when there is a stray tilde to place, which is most of a preview compile's cost.
- **`#751` (`loka-8h2cq`):** `Lint.same_words/1` in `mix loka.lint` names two items drawing the same words in one
  room. The showcase's 12 are the variety fixtures, pinned in `test/loka/lint_baseline.txt`; the cap moved 204 → 212
  with the reason beside it and **still has to come down**.
- **`#752` (`x6t.132`):** `CarryingPage` collapses held items by their authored `words.plural` into one row
  (`holding()` in `mobile/app/book/sections.tsx`). The count is what keeps a grouped item reachable, and an item with
  no `plural` never groups — its kind would be its name alone, and two items can share a name and differ in state.
  A row-level consume control was declined; the item page's offered action is the same verb with the existing
  confirmation/refusal/narration routing.
- **`#756` (`wfrgk.89` item 1):** `useCard`'s `back()` resets only the draft it was clicked on, and only once
  the server says it wrote. `post()`'s `onOk` runs **before** `load()`, because the reload is what rebases the
  draft onto the undone file — reset after it and an edit typed during the round trip is erased unsent.
  `tools/author-panel/test/undo.test.ts` holds the two breaks; the panels share one cartridge copy, so a test
  that writes `mass_grams` must read its current value first, not hard-code one.
- **`#750` (`wfrgk.100.8`):** measured **12** same-room shared wordings, all item variant families.
  `bin/measure_collisions.mjs` still cannot get past the showcase's tutorial overlay.

**15 `loka-ni2zd.*` slices deferred to 2027-01-01**; `.1` (plan runner) stays open as the reopen point.

## Owner's writing list (prologue; text keys, no prose from agents)

`world.levelling.gained`, `world.levelling.level_up`, each `level_reached` line, each skill's `learned`, each rank's
`name` and `reached`, `combat.sanctuary`; combat lines, `tiers`, `conditions`, volley lines; corpse and revival lines;
`combat.title_you_attack` {target}, `combat.title_attacks_you` {attacker}; Well fed and Refreshed status names and meal
and drink lines; the opening dream's scene lines (reverie); ambient lines; the showcase hub sign that still mentions
hunger (`toolbox_showcase/text.json:1461`, `docs/showcase/hub-and-first-districts.md:79`); identity_sampler
`stranger_talk.scene` talk text; every `~` in the prologue.

## Holds

- **One ruling left open from this session, and it is not blocking** (Resume 8): a weather phase's existing
  `wet` flag is read by no rule, so `wet: true` does not by itself make a phase sound — what sounds is what has a
  recording. Make `wet` the switch, or drop the flag? The spec now says which it is today, so nothing is lying.
- P3 hold (owner 2026-10-22): draft #454, kgd.188, 2lvx, 5i4c, x6t.98. loka-x6t.126 skill-gated room depth.
- #632 (loka-vduxr.64) belongs to another session (lokacore-fb), not the PM.
- `toolbox/settle-3` is 9 commits ahead of main from 2026-10-15 with no PR: decide PR or delete before the next batch.
- **Both stashes are dropped** (2026-11-16): each was a stale `.beads/issues.jsonl` snapshot from a `br`-era
  workflow; Beads is the live store, so neither could be applied meaningfully. `git stash list` is now empty.
- `/tmp/continuation-prompt.md` is a harness file, not this repo's. The session it described is finished;
  do not treat its contents as current work.
- Worktrees: seven merged ones were removed this session (`k2rev-base`, `loka-kgd.202-old`, `.203-mut`,
  `.205-design-review`, `review-k2`, `toolbox-authoring-batch-a-walks`, `s3-choice-key-review`), freeing about 15 GB.
  What is left: `loka-preview` and `lokacore-session` (the polish/Storybook pair), `design-playtest`
  (`design/playtest-combat`, 4ae8f6878 — commits not in main and no PR: decide PR or delete), `settle-3` (above),
  `loka-vduxr.10-second` (three untracked probe tests: `kernel/ts/test/zz_dead.test.ts`,
  `mobile/authority/local-story/zz_esc.test.ts`, `zz_probe.test.ts`), `playtest-sweep` (untracked logs, a report and
  shots), and the two open-PR worktrees (`tools-ts-lsp` is #632, `toolbox-batch-engine-bugs-e2` is #454). Read the
  untracked files before removing either of the two probe worktrees.

Storybook http://localhost:6006 serves main from the preview checkout (`bin/preview_update.sh`); a PR's stories need a
Storybook run from its own worktree. The owner sends polish prompts in the conversation; loop: [PM, Live polish session](PM.md#live-polish-session),
owner guide: [polish tour](design/polish-tour.md). Screenshots: Playwright needs `chromium.launch({ channel: 'chrome' })`.

## Retros awaiting the owner's yes/no

**2026-11-18 (DONE):** loka-735tg — `bin/check_ts_size.mjs` failed open on a path it cannot find
(`existsSync(root + f)` dropped it, so a typo or an absolute path exited 0). Fixed in #753 with a red
control in `bin/ts_size_red_controls.sh`. The second item, re-checking a continuation prompt's beads with
`br show` before asking, is the Session procedure line above. No owner action.

**2026-11-16 (DONE):** loka-wpw6x — the PM's `ci_wait.sh` reported failure on green heads. The Pi-side copy is
deleted and `~/.pi/agent/AGENTS.md` points at the repo's `bin/wait_ci.sh`. No owner action.

**2026-11-13 (one open):** loka-8v4lx — name the reviewer fallback model in WORKFLOW and the `loka-review` agent
instead of justifying a substitution per slice. Still awaiting the owner. (loka-qozwj approved and shipped in #731.)

**2026-11-15 (one open):** loka-7vnzm — should a pre-push check refuse a tracked symlink or absolute path at all?
Its two cheap fixes are already in #733.

**2026-11-11:** loka-x4ejm done in #714; loka-y043w shipped in #735; loka-r7vrx closed (the queue is 32).

## Session procedure

- Start: `mise install`, `br` 0.7.6 ([BEADS.md](BEADS.md)), `gh auth status`; `git pull --ff-only origin main`, then `br sync --import-only`;
  read [WORKFLOW](WORKFLOW.md), [PM](PM.md) and this page; `bin/session_status.sh` prints the board (`--full` for everything).
  After a `/clear`, run `ListAgents` first: the previous conversation's agents and shells keep running.
  A continuation prompt (a harness file, not this repo's) is stale by construction: `br show <id>` every bead it
  names as awaiting the owner before asking, and drop the question if the status is terminal.
- Beads writes from the `main` checkout after `br sync --import-only`; new issues through `bin/br_create.sh`; each checkpoint is
  `bin/beads_checkpoint.sh`. Never commit `beads.db`. A child slice of an open issue gets its own child id to merge with.
- A kernel contract slice bumps only `INSTALLED.kernel_api` to main+1 at push; parallel claims rebump on the later merge.
- CI waits: `bin/wait_ci.sh <sha|branch>`; it can time out or pass while runs are still going: confirm with `gh run list --commit`.
  Merges one at a time in the main checkout via `bin/merge_pr.sh <pr> <id[,id...]>`. When `br` refuses a parent with open
  follow-up children, `br close <id> --force --reason "Merged #N"` and rerun `bin/after_merge.sh`; an untracked PR body
  draft in the worktree also stops it (remove it, rerun). A conflict after another merge goes back to the developer as
  "merge origin/main, no rebase" (force-push is forbidden). Review records sit on local `review-<PR>` branches and are
  carried by `after_merge`; a second record for the same PR is cherry-picked onto `review-<PR>` first.
- Mutation runs in a throwaway worktree need node_modules (root, `kernel/ts`, `tools/author-panel`) and `deps` linked and
  `_build` copied, else every row is BASELINE-RED; panel rows often stay BASELINE-RED there, so hand mutants in the slice
  worktree cover them.
- Subagents work only in their own worktrees under `~/dev/worktrees.noindex`; a fresh worktree runs `bin/worktree_setup.sh`.
  The load gate refuses spawns at load 8 or more: wait with a background until-loop, never bypass. Kill orphaned
  author servers and Playwright Chromes when load climbs (`ps` for `worktrees.noindex` and `--disable-field-trial-config`).
