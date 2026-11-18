# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place once per session, at its end; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after e9fa10b2e; written 2026-11-17 21:20 UTC in the Pi harness by deploy/deepseek-ai/deepseek-v4.1-flash-1017, PM session.
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

**32 open, 14 ready, 3 housekeeping deferred to 2027-01-01.** The ready list is the whole planned queue;
anything absent from it is deferred on purpose, not forgotten. Before proposing work, check the bead is not
already shipped — this session closed three that were (`g5hh.2`, `g5hh.2.6`, `wfrgk.120`) by reading the code.

Three ready beads want the owner's input, not an agent's:
- **`.100.5`** (scene structure editable in the GUI) reverses ruling 11, so it needs a design pass first.
- **`.100.7`** (wrapped/composed lines do not open their field) needs a multi-key decision no bead states; a composed line holds several keys, so `data-loka-key` cannot carry it.
- **`.100.4`** (card words field follow-ups): undo, `/line` retry, re-read after outside write, Keep mine, **scene field focus**. The focus item has a **lead but no fix** — see below.

**`vduxr.57` is done** (story patterns, below). **`mq9i8`** (weather phase names) is verified and re-scoped,
awaiting a design call on where the phase name is read. **`bptw`** (page-side colon labels) needs the colon
rule's one-line decision. **`czoln`, `325f8`** are prologue content, transcribing the owner's outline.

## Story patterns (shipped this session, loka-vduxr.57)

`docs/BUILDERS-GUIDE.md` has a new **Story patterns** section: ten recipes from the
[2026-11-04 adoption shortlist](rnd/prologue-adoption-shortlist-2026-11-04.md), each verified against a running
sampler file rather than the shortlist's unchecked claims. Read it before writing prologue beats; it is the
fastest path from "the outline says X" to working JSON.

**Three shortlist claims did not survive and the page now carries the corrections:** row 3 is a fact read back
by a reaction, not a delayed write (the `wait` op is real but a separate mechanism); `barrier.set` takes
`{"barrier", "to": "open"}`, not `{"open": true}`; and row 2 already has **four** working actions on one barrier
(`barrier_sampler`), not a sketch. **Row 1's `then_failed` is the one gap** — it exists in
`protocol/dialogue.schema.json` and no cartridge or sampler uses it, so the page states it as blocked rather than
showing a fake example. The supported form for a failing check is its own `failure` line.

**Do not "verify" a mechanic by grepping one schema file.** `then_failed` was declared absent after a grep of
`protocol/cartridge.schema.json` alone; it lives in `protocol/dialogue.schema.json`. Two written examples had to be
corrected the same way (`village_regard`, `mill_gate` did not exist). Grep the repo, then read the sampler.

## Resume, in order

1. **The owner is writing Part 1 in the editor.** That is the point of the queue, not a parallel task:
   `bin/author.sh`, restart it after each merge. File friction as it appears and fix blockers at once.
2. **`.100.4`'s scene-field-focus item: a lead, no fix.** The card does remount on a save (stamping an input
   inside `[aria-label="scene card"]` and saving shows the stamp gone), so the defect is real, but reverting
   `tools/author-panel/src/edit/cards/Room.tsx:216`'s `key={proseKey(draft[f])}` to `key={f}` fails no test, so there
   is no break to name. Suspect on its face: `kernel/ts/play/card.ts:312-315` returns the words themselves as
   `proseKey` when the value is a string. Next step: find which container actually remounts — when the prompt field
   remounted, the whole `[aria-label="scene card"]` went with it and did not come back, pointing at
   `RoomForm key={resets}` (`tools/author-panel/src/edit/cards/Dialogue.tsx:79`) rather than the field's key.
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

**Phases 0, 2 and 3 of the authoring-readiness plan are done** — do not re-plan them (ff954162a, 527fd4071, `.97`).

## What shipped this session (2026-11-17)

Six PRs and seven direct commits on `main`. The two worth reading before touching their area:

- **#748** (`.100.4`, 409 half): a save's 409 checks find their row by key again, no `as never`.
- **#749** (`vduxr.69`): a line beginning `~` with words after it draws one `placeholder_tilde` warning naming its
  file and line; the words ship unchanged. Only a line that trims to `~` alone is a placeholder. **Read
  `stray_tildes/2` in `lib/loka/content.ex` before touching the placeholder counters** — it binds the source index
  only when there is a stray tilde to place, which is most of a preview compile's cost.
- **#750** (`wfrgk.100.8`, measurement): 14 → corrected **12** same-room shared wordings, all item variant families.
  `bin/measure_collisions.mjs` still cannot get past the showcase's tutorial overlay.
- **#751** (`loka-8h2cq`): `Lint.same_words/1` in `mix loka.lint` names two items drawing the same words in one room,
  naming both keys and the room. The showcase's 12 are the variety fixtures, so they are pinned in
  `test/loka/lint_baseline.txt`; the cap moved 204 → 212 with the reason beside it and still has to come down.
- **`vduxr.57`** (four commits, no PR — docs only): the Story patterns section above.

**Three beads closed as already-done or not-a-bug after checking the code, not the title:** `g5hh.2`/`.2.6` (the
level-up rush is on main from #573/#575) and `wfrgk.120` (the `craft`/`use.tool` add-menu "writes nothing" is the
intended convention: `card.ts:344` says allOf fields are the author's to pick, `Choices.tsx:29` implements it).
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

**2026-11-16 (DONE):** loka-wpw6x — the PM's `ci_wait.sh` reported failure on green heads. The Pi-side copy is
deleted and `~/.pi/agent/AGENTS.md` points at the repo's `bin/wait_ci.sh`. No owner action.

**2026-11-13 (one open):** loka-8v4lx — name the reviewer fallback model in WORKFLOW and the `loka-review` agent
instead of justifying a substitution per slice. Still awaiting the owner. (loka-qozwj approved and shipped in #731.)

**2026-11-15 (one open):** loka-7vnzm — should a pre-push check refuse a tracked symlink or absolute path at all?
Its two cheap fixes are already in #733.

**2026-11-11:** loka-x4ejm done in #714; loka-y043w shipped in #735; loka-r7vrx closed (the queue is 32).

## Lessons this session (new; older ones are in [PM lessons](lessons/pm.md))

- **A bead's title is not evidence, and this session produced four.** `g5hh.2`/`.2.6` looked like a large unbuilt
  feature and were already on main. `wfrgk.120` looked like a defect and was the codebase's own convention.
  `vduxr.29` looked like a live crash and its stated mechanism is neutralised by `runtime/proposal.ts:317` (I bumped
  it to P1 and had to revert). `then_failed` was declared absent from one schema grep. **Check the code, then check
  that the fault can happen** — the shape being wrong is not the same as the bug existing.
- **A dev server is not a `bg_run` task.** Two author-stack servers were killed by the 900 s and 1200 s timeouts I
  gave them; a server never "completes". The first orphaned a child still holding its port. Use `bin/author.sh`
  (it names a held port and traps its three components) or a no-timeout run killed by PID. Recorded in
  [mobile lessons](lessons/mobile.md).
- **A limit that grows in one batch needs its reason beside it.** `@baseline_cap` moved 204 → 212 for
  `same_words/1`, the one lint that adds a dozen findings at once; the comment now says so and says the cap still
  has to come down.
- **A guard that no mutant can break may still be load-bearing.** `is_binary(room)` in `Lint.same_words/1` survived
  its mutant because the comprehension's own `room = get_in(...)` already filters `nil`. Probed rather than assumed,
  then documented so the next reader does not delete it.
- **`git reset --hard` on a branch whose commit you have not pushed costs the work.** I lost a commit that way and
  recovered it only because the branch had been pushed. Push, then rewrite.
- **A careless grep turns a relative path into a wrong one.** `../system/...` from `docs/BUILDERS-GUIDE.md` is
  `system/...`; the docs gate caught it, which is why `bin/check_docs.exs` runs before every commit here.

## Session procedure

- Start: `mise install`, `br` 0.7.6 ([BEADS.md](BEADS.md)), `gh auth status`; `git pull --ff-only origin main`, then `br sync --import-only`;
  read [WORKFLOW](WORKFLOW.md), [PM](PM.md) and this page; `bin/session_status.sh` prints the board (`--full` for everything).
  After a `/clear`, run `ListAgents` first: the previous conversation's agents and shells keep running.
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
