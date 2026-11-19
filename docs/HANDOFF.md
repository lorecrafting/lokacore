# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place once per session, at its end; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after 7a63067e7 (PR #758 open on a branch); written 2026-11-19 17:55 UTC in the Pi harness by deploy/deepseek-ai/deepseek-v4.1-flash-1017, PM session.
`kernel_api` is 1.159 (no contract slice since). Every reviewer and developer here runs on `deploy/deepseek-ai/deepseek-v4.1-flash-1017`
(the owner paused the Anthropic subscription; `~/.pi/agent/agents/loka-dev.md`, `loka-review.md` repinned
2026-11-13). **Nothing is mid-merge, nothing is in flight, no agent is running. #454 is the owner's P3 hold.**

## Direction (owner 2026-10-30 to 2026-11-07)

- **Pro low-token workflow** (owner 2026-11-07): one session does small slices itself; at most one developer at a time; a separate reviewer only for engine, save, contract or compiler-facing slices; no mutation runs on editor polish.
- **The prologue is v1** (epic loka-g5hh, now closed). The owner builds **Part 1** in the editor, in `cartridges/prologue/` (**uncommitted on purpose**). Start: `bin/author.sh`; restart it after each merge.
- **The owner writes every player-facing word**; agents use `~`. Polish feedback goes to Beads under loka-wfrgk; fixes batch on the owner's go; blockers are fixed at once.
- **Card bar:** a card never offers or writes what the compiler refuses; gates go two ways with the compiler `file:line`.
- NPC routines (loka-ni2zd) wait for the owner's own design session.

## Board

**28 open, 10 ready, 3 housekeeping deferred to 2027-01-01.** The ready list is
the whole planned queue; anything absent from it is deferred on purpose, not forgotten. Before proposing work,
check the bead is not already shipped — read the code, not the title. The five in-progress beads are all
epics or long-running parents (`wfrgk.102`, `vduxr`, `x6t`, `wfrgk.100.4`, `kgd`); none has an agent on it.
`y6yg` (toolbox showcase) and `kgd.194` closed 2026-11-18 with every child done; `735tg` closed by #753;
`wfrgk.100.4` closed by #754 (its undo item built; its scene-field-focus item became `3gnyd`, closed by #757).
`wfrgk.89` closed 2026-11-19 with all four items resolved, only #756 being code:
items 1 and 3 by #755/#756; **item 2 (Bind refuses short refs while the compile is refused) was already fixed by
`9f0863246`**, verified live — with a showcase file truncated the watcher says `compiled:false` and `GET /story`
still answers 724 shorts, which is right (a broken unrelated file must not take away a good ref); **item 4
(bundles re-read per call) measured not worth it** — `bundled()` is 2.97 ms on the showcase, 0.13 ms with real
bundles, twice in a 193 ms `story()` build, and the showcase has no `areas/*.json` at all.
`after_merge.sh` closes a whole bead on one PR: three reopens on that one bead. Re-read an item's **claim**
against current code before filing a follow-up, not its line number — half of these needed no work.

**`wfrgk.100.5` (scene structure) closed 2026-11-19 as stale, not as work**: all four children shipped
(#701 design, #707 S1 cut pages, #711 S2 scene lines, #715 S3 choice keys), ruling 11 was already reversed at
`docs/rnd/gui-editor-design-2026-11-04.md:234`, and its only dependent `cr7l7` closed "not reachable". A parent
stays open until someone closes it; **sweep ready parents against their children before believing the count.**
The same day: `wfrgk.102` (field guide) is *not* in that class — its children `.2`, `.3`, `.4` are closed but `.102.1`
is open on a missing carrier (see below), so the parent is correctly open.

**loka-3gnyd (#757)** is the cautionary case for beads whose own lead is a guess. It was filed as "needs an
owner repro" because two candidate causes were tried and neither failed. Both were wrong: `proseKey`'s per-save
key is stable here (the field takes `words`, not the value), and the remount was `Field`'s branch on `l.key`, not
`RoomForm key={resets}`. What found it was traffic, not reading: after a save the only failing request was
`GET /line` 409 "the source moved since the compile", and the input node was replaced while all seven `<li>`
survived. A bead that says "needs a repro" is often asking for a probe, not for the owner.

Three ready beads want the owner's input, not an agent's:
- **`.100.7`** (wrapped/composed lines do not open their field) is **correctly blocked, not work**: every one of
  its six sites composes a key's words into a longer line, which the ADR
  `docs/rnd/line-key-binding-2026-11-15.md` explicitly excludes from `data-loka-key`; its measured conclusion —
  ship the lint, no attribute — is done (`same_words`, `lib/loka/content/lint.ex:157`).
- **`.100.4`** (card words field follow-ups) is **entirely shipped**: undo (#754), the held draft (#756),
  `/line` retry, re-read after an outside write, Keep mine, and **scene field focus (#757, `3gnyd`)**. Its
  remaining item is the server-vs-card disagreement on dialogue choice labels — see Resume.

**`vduxr.57` is done** (story patterns, below). **`mq9i8` and `bptw` are both closed by #758** (2026-11-19):
weather beds are keyed by the cartridge's own phase names, and page notes read as sentences with the lint
widened to the page builders. **`czoln`, `325f8`** are prologue content, transcribing the owner's outline.

**`vduxr.39` is the one bead waiting on a bare yes/no from the owner:** the doc half is done (#746); the code
half is withdrawn. Choose (a) close won't-fix, (b) take the reviewer's M4, (c) leave doc-only (already the
state). `g96` is **closed** (2026-11-17) with its re-open trigger recorded — do not re-litigate it.

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

1. **The owner is writing Part 1 in the editor.** That is the point of the queue, not a parallel task:
   `bin/author.sh`, restart it after each merge. File friction as it appears and fix blockers at once.
   `bin/author.sh` is not a `bg_run` task: a server never completes, so a timeout kills it. Use its own trap.
2. **Next small slices, all verified and unblocked** (no owner ruling needed, unlike the rest of the queue):
   - **`.42.2`** — a per-weapon fight matrix on an item card. The mechanism is real: a wielded weapon *replaces*
     the base attack (`kernel/ts/play/fight.ts`, `round_attack.ts:229-233`, `base = usable ? {...weapon.attack,
     tags} : world.combat.player_attack`), so rows differ meaningfully per weapon. Needs a per-weapon build axis
     first and `fightOf` extended past npc keys.
   - **`.100.4`'s last item** — the card refuses a dialogue choice label that `POST /edit` would accept. The card's
     comment at `tools/author-panel/src/edit/fields.tsx:39` claims `POST /edit` refuses it ("ruling 11"), but
     `kernel/ts/play/prose.ts:14-25` shows `LITERAL` accepts any `"key": "words"` line, so only a `.scene` `-`
     line gets the reword refusal. **Two-sided: needs the owner to say which side is right** before code.
   - **`vduxr.29`** — a drowned creature's refill can fault (the recorded two-line fix looks right) but no test can
     name the break without a kill landing on the exact drowning clock; 59 probes could not reach it. A test I
     wrote now would be a change detector.
3. **`.100.8` remainder: 97 of 156, do not build speculatively.** The sampler families (59) closed via per-page
   clearing (`nextPage`, `prose_rules.ts`, 323d3ac10). The rest needs `data-loka-key`, and that is bigger than the
   R&D note first claimed (corrected in 06ab70e75): `rendered` (`mobile/app/book/logs.ts:46`) holds `line.key` and
   drops it, `DetailLine` (`:58-64`) has no key on any variant, `LogLine` (`mobile/app/book/lines.tsx:130`) never
   sees one. Build it when a real edit needs two same-screen duplicates told apart — measured: **12 same-room
   wordings, all item variant families**, which is why the attribute stays unbuilt and a lint shipped instead.
4. **`.102.1` is blocked on a missing carrier, not a missing reader.** It says move each spec cite into the schema
   node's `$comment`. That carrier does not exist: `lib/loka/content/source_schema.ex:62` writes one `$comment` per
   file, at its head. A per-node cite key must be added to the generated schemas first, so it is its own slice.
   Scale: 11 `§` cites in `schemas/source/*.json`, 23 in `lib/loka/content/*.ex`.
5. **`.vduxr.39` waits on the owner:** close won't-fix / take the reviewer's M4 / leave doc-only (done). The code
   half is *withdrawn, not deferred* — `docs/reviews/2026-11-17-first-screen-guard-review.md`. Narrowing
   `checked`'s catch to `unreadable(e)` reddens `start_over.test.ts` 2/15: a deleted body row and a forged container
   id both throw `TypeError` from the same catch. **Lesson: a catch that guards a screen, not a row, cannot classify
   by exception type.**
6. Story tooling epic **loka-wfrgk.115** is complete except E1 (`.12`): P3, parked until a beat needs it; needs a
   protocol change, a `kernel_api` bump.
7. **Housekeeping: 3 open, all deferred to 2027-01-01** (`rvbmn`, `00p0u`, `e9ey`). Nothing actionable.
8. **`mq9i8` DONE (#758).** The weather bed is now a phase-name-to-file map keyed by the cartridge's own names,
   exactly as `beds` is keyed by `room.sound`; the app holds no phase list. Row **W23** in
   `docs/world-parameters.md` is closed and `docs/system/cartridge.md` states the carrier. **Open, one line from
   the owner:** the phase's existing `wet` flag is read by no rule, so a cartridge marking `wet: true` does not by
   itself make a phase sound — today what sounds is what has a recording. Make `wet` the switch, or drop the flag?
   Not urgent; nothing is broken by leaving it declarative, and the spec now says so out loud.
9. **`bptw` DONE (#758).** Page notes read as sentences (Map place title alone, `3 days left`, `Then X.`,
   `It costs 4p to cross.`), the corpse label takes a comma, and `mobile-book-log-prose` now covers the page
   builders (`labels.ts`, `model.ts`, `notices.tsx`, `offers.ts`). The remaining page-vs-server disagreement is
   the dialogue choice label below.

**Phases 0, 2 and 3 of the authoring-readiness plan are done** — do not re-plan them (ff954162a, 527fd4071, `.97`).

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
