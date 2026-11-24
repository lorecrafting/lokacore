# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place once per session, at its end; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after 0ed522f3e; written 2026-11-23 in Claude Code (Opus 5.5), PM session. The Anthropic
subscription is on the $20 Pro plan: low-token workflow, **subagents on Opus, never Fable** (no usage
credits). `kernel_api` is 1.159. **Nothing is in flight, no agent is running.** #454 is the owner's P3 hold.

Shipped 2026-11-23: **#780** `loka-0s4wv` (the nightly's red: the map test now polls the room files
too, not only `layout.json`) and **#779** `hcnlh.17` (2.5, ghost lines and See as…). Rulings on 2.5:
- **The owner (paraphrased): every ghost is its own line under the title, never collapsed.** Each line is
  cut to one line; the Room sheet lists every ghost again, whole. The owner accepted the fixed header
  growing one touch target per ghost.
- PM: a same-room act does not end See as. Ghost lines are the Build-only exception to the room page
  anatomy (`book-ui.md`, `AGENTS.md`).
- Open 2.5 limits are in #779's body: canon cached until reload; placement by starting room; a dark room
  ghosts every variant; gate reasons shown even when the fact is true.

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
  **Give the owner http://localhost:19009 (panel) or http://localhost:19006/?dev=1 (the Book with Build).**
  Never 19007: that is Metro's raw port, with no isolation headers, so the save fails there (#769).
- **The owner writes every player-facing word**; agents use `~`. Polish feedback goes to Beads under
  loka-wfrgk; fixes batch on the owner's go; blockers are fixed at once.
- NPC routines (loka-ni2zd) wait for the owner's own design session.

## Board

**55 open, 14 ready.** Before proposing work, check the bead is not already shipped: read the code, not
the title, and sweep ready parents against their children.

Shipped 2026-11-20 (this session), the builder's phases 0 and 1:
- **#762** `hcnlh.3` (0.4): `registry.json` and `new.json` now live in `kernel/ts/play/`. Metro watches
  `kernel/ts/play` and `protocol/`.
- **#764** `hcnlh.4` (0.3): the parity gate (`bin/editor_gate.exs`, `kernel/ts/play/parity.json`, and the
  shrink-only `test/loka/builder_todo_baseline.txt`). It proves each builder home exists, not that it works.
- **#767** `hcnlh.10`: the gate **refuses `book: generic`** until the generic form editor exists. Slice 2.3
  lifts it, with its own shrink-only list.
- **#763** `wfrgk.100.4.1`: a dialogue choice label has its words field on the card.
- **#765** `hcnlh.5` (1.1): the dev-only `authorSeam` in `book/Text.tsx`, lint, and a release sentinel.
- **#766** `hcnlh.6` (1.2): the Build strip; owner decision `owner-decision-build-strip-2026-11-20.md`.
- **#768** `hcnlh.7` (1.3): the in-place field (`mobile/app/author/build/field.tsx`). `/set` is deferred to 5.1.
- **#770** `hcnlh.8` (1.4): Undo chip (5 s, owner OK until the Recent tab), the Checks badge and sheet, and
  the keep-my-place notice. All three actions were browser-checked by the PM.
- **#769** `hcnlh.12`: the author terminal names the preview port, not Metro's.

Book UI spec for 1.3 and 1.4: `book-ui.md` Author mode, and looks in `BOOK-UI-COMPONENTS.md`.

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

1. **Builder 3.1 `loka-hcnlh.18`** (`--lan`, pairing; phase 2 is done).
   - Slices 3.1-6.8 are beads `loka-hcnlh.18`-`.35`, chained in the design's §7 order, each with its acceptance.
   - Reviewer and designer flags are the **R** and **D** marks in the design's table: 3.1 needs a reviewer
     (it is security work).
   - Brief the developer to browser-check every acceptance line at 390 px before handback (retro `loka-p971b`
     item 4).
2. **The panel smoke flake `loka-wfrgk.127`** (palette Undo) still costs reruns; the map-test flake is fixed (#780).
3. Builder follow-ups (small, dev-only):
   - `loka-hcnlh.9`: a failed hold request is silent.
   - `loka-hcnlh.11`: the field's E5 overlap and silent failures, the 1.4 nits, and Esc focus.
   - `loka-wfrgk.126`: a choice-label note mismatch between book-ui and prose_rules.
4. **The owner writing Part 1**: friction from `bin/author.sh` goes to Beads; blockers are fixed at once.
5. **Retro `loka-p971b`** waits for the owner's approval of its four items.
6. Parked on purpose:
   - `.100.7` and `.100.8` (the builder's sheets supersede the line-key question).
   - `vduxr.29` (unreproducible).
   - `.102.1` (needs a per-node cite carrier first).
   - `ni2zd.*` and #454.

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

- P3 hold (owner 2026-10-22): draft #454, kgd.188, 2lvx, 5i4c, x6t.98. loka-x6t.126 skill-gated room depth.
- #632 (loka-vduxr.64) belongs to another session (lokacore-fb), not the PM.
- **Both stashes are dropped** (2026-11-16): each was a stale `.beads/issues.jsonl` snapshot from a `br`-era
  workflow; Beads is the live store, so neither could be applied meaningfully. `git stash list` is now empty.
- `/tmp/continuation-prompt.md` is a harness file, not this repo's. The session it described is finished;
  do not treat its contents as current work.
- Worktrees: what is left is `loka-preview` and `lokacore-session` (the polish/Storybook pair),
  `loka-vduxr.10-second` (three untracked probe tests: `kernel/ts/test/zz_dead.test.ts`,
  `mobile/authority/local-story/zz_esc.test.ts`, `zz_probe.test.ts`), `playtest-sweep` (untracked logs, a report and
  shots), and the two open-PR worktrees (`tools-ts-lsp` is #632, `toolbox-batch-engine-bugs-e2` is #454). Read the
  untracked files before removing either of the two probe worktrees.

Storybook http://localhost:6006 serves main from the preview checkout (`bin/preview_update.sh`); a PR's stories need a
Storybook run from its own worktree. The owner sends polish prompts in the conversation; loop: [PM, Live polish session](PM.md#live-polish-session),
owner guide: [polish tour](design/polish-tour.md). Screenshots: Playwright needs `chromium.launch({ channel: 'chrome' })`.

## Retros

`loka-p971b` (2026-11-20) awaits the owner. Before asking about a retro, `br show` it first.

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
- Subagents work only in their own worktrees under `~/dev/worktrees.noindex`. A fresh worktree runs **its own**
  `bin/worktree_setup.sh`, from inside it: main's copy sets up main.
  The load gate refuses spawns at load 8 or more: wait with a background until-loop, never bypass. Kill orphaned
  author servers and Playwright Chromes when load climbs (`ps` for `worktrees.noindex` and `--disable-field-trial-config`).
