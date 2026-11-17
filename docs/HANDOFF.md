# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place once per session, at its end; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after c44aa9fd4 (PR #749 and the backlog cull); written 2026-11-17 07:40 UTC in the Pi harness by deploy/deepseek-ai/deepseek-v4.1-flash-1017, PM session.
`kernel_api` is 1.159 (no contract slice since). **The owner is pausing the Anthropic subscription, so every reviewer
and developer here now runs on `deploy/deepseek-ai/deepseek-v4.1-flash-1017`** (`~/.pi/agent/agents/loka-dev.md`,
`loka-review.md` repinned 2026-11-13). **Nothing is mid-merge, nothing is in flight, no agent is running.**

## Direction (owner 2026-10-30 to 2026-11-07)

- **Pro low-token workflow** (owner 2026-11-07): one session does small slices itself; at most one developer at a time; a separate reviewer only for engine, save, contract or compiler-facing slices; no mutation runs on editor polish.
- **The prologue is v1** (epic loka-g5hh). The owner builds **Part 1** in the editor, in `cartridges/prologue/` (**uncommitted on purpose**). Start: `bin/author.sh`; restart it after each merge.
- **The owner writes every player-facing word**; agents use `~`. Polish feedback goes to Beads under loka-wfrgk; fixes batch on the owner's go; blockers are fixed at once.
- **Card bar:** a card never offers or writes what the compiler refuses; gates go two ways with the compiler `file:line`.
- NPC routines (loka-ni2zd) wait for the owner's own design session.

## Merged since the 2026-11-07 handoff

**This session (2026-11-17, after the 2026-11-16 blocks):** #748 (`loka-wfrgk.100.4`, the 409 half: a
save's 409 checks find their row by key again, and no `as never` in the panel), #749 (`loka-vduxr.69`: a
line that begins `~` and has words after it draws one `placeholder_tilde` warning naming its file and line,
and the writer's words ship unchanged; only a line that trims to `~` alone is a placeholder — spec in
`docs/system/cartridge.md`, **Still to write**). Read `stray_tildes/2` in `lib/loka/content.ex` before
touching the placeholder counters again: it only binds the source index when there is a stray tilde to
place, which is most of a preview compile's cost.

**Three beads were closed as already-done or not-a-bug after verifying against the code, not the title:**
`loka-g5hh.2` and `.2.6` (the whole level-up rush is on main from #573/#575 — `ExperienceRule.tsx`,
`LevelWash.tsx`, `GiltLine`, `cueDiff.ts:176`, `cueSounds.ts:89`, `level_wash.test.ts`; the epic was left
open by mistake), and `loka-wfrgk.120` (the `craft`/`use.tool` add-menu "writes nothing" is the intended
convention: `card.ts:344` says allOf fields are the author's to pick and `Choices.tsx:29` implements it;
nothing in `protocol/action.schema.json` is `allOf`, so the line 344 comment names carriers that do not exist).

**Backlog cull (same session):** the 15 open `loka-ni2zd.*` NPC-behaviour slices were deferred to
2027-01-01. The epic's own notes say NPC behaviours are not needed for the prologue and not before Pro, and
no slice starts without an owner go; keeping them open at P2 made the ready queue look 16 items larger than
the planned work. `.1` (plan runner) stays open as the reopen point. `loka-wfrgk.54` closed with its one
real element spun out as `.120` (then closed above).

#707 to #714 are in the previous handoff (scene structure S1/S2, the field guide, the pre-push gates, focus rules,
`session_status.sh`). Newer: #715 S3, a choice's key pinned when its words change (loka-wfrgk.100.5.4, closed); #716 R1,
replay saved paths against the artifact you edit; #717 W1, `bin/loka roam`; #718 `wait_ci.sh` resolves a short sha; #719 D1,
the Step tab (in-play debugger); #720 and #721 K2, reaction `once`/`cooldown` and the policy capability it needs
(loka-wfrgk.100.5.3, .115.4 closed); #722 **C1, the consequence preview of a choice** (loka-wfrgk.115.5, closed).
C1 shipped two model fields the rest of the story tooling will want: `reach.ts` edges now carry `value` and every policy
`leaf` (with `neg`), and `story.ts` links carry the `choice` a `choice_resolved` named — read
`kernel/ts/play/consequences.ts` before writing another walk over that graph. Its review record is
`docs/reviews/2026-11-13-c1-consequences-review.md` (CHANGES REQUIRED then APPROVE on re-check; all four findings fixed).
#723 **L1 + L2, the story-logic lints** (loka-wfrgk.115.6, closed): `lib/loka/content/lint_story.ex`, `lint_facts.ex`
and `lint_source.ex`, wired after `LintPages` in `lib/loka/content/lint.ex`. Nine rows: a quest nothing ends; a story
point outcome nothing consumes; a scene only its own chain claims; a `fact_changed` cycle with no `when`; a compare
value nothing writes; a shadowed ambient set; a threshold the one-shot writes cannot reach; a fully gated dialogue; a
fact without `meaning`. Its review record is `docs/reviews/2026-11-13-l1-l2-story-logic-review.md` — read the
"Found after the review" section before writing another row over real cartridges: five false findings survived the
unit tests and only appeared when the rows ran over every cartridge in `cartridges/`.
#725 **W3, the proofreading sheet**; #726 **W2, a rename rewrites the checkpoints** (loka-wfrgk.115.7, closed):
`POST /restructure` takes `op: {rename: {kind, from, to}}` and rewrites every `checkpoints/*.json` step naming
`<cartridge>@<version>:<kind>/<from>` in the same `done` call, so one `/undo` restores both.
#727 **F1 + W4, the Facts table** (loka-wfrgk.115.8, closed): `kernel/ts/play/fact_usage.ts` (`FactUsage`, no imports so
the panel's `tsc -b` can read it), `kernel/ts/play/reach.ts` `factUsage()` + `onceAmounts()` (the reach ceiling mirrors
L2a's `repeats?`/`once` rules exactly), `tools/author-panel/src/storyfacts.ts` (`factRows`/`range`), the `facts` palette
row and panel. `orphanFacts()` now reads its three lists off `factUsage` rows, so the Story report and the table cannot
disagree. Panel is Cmd-K `facts`. W4 deviates from the spec by design (L2a has no floor; the floor is the declared
`value_type.minimum`) and the PR body says so. Review record `docs/reviews/2026-11-14-f1-facts-w4-review.md` — two
rechecks: one real blocker (`repeats()` inverted for quests) and one reviewer false positive it withdrew.
#730 **K1b, conditions as story nodes** (loka-wfrgk.115.14, closed): the Story map draws a condition as a node with its
reader edges, and the Policy block's leaf picker offers `named` with the condition keys. #731 **the panel's `npm test` runs
serial** (loka-qozwj, closed): one flag, `--test-concurrency=1`, because every panel test file shares `harness.ts`'s one
`bin/loka dev` server, one Chrome and one showcase copy.
`kernel/ts/test/live.test.ts:145` (`500 !== 404` for `/open ../none.json`) is now a four-time flake, still unfixed (loka-fq96k).
#733 **F8, the add menu names why a field is refused** (loka-wfrgk.94, closed): `kernel/ts/play/allowed.ts` splits its
predicate into `fits`; `blocked` returns the refused fields as `{ field, caps, needs }` off that same predicate (so no
second table can drift from `OWNERS`/`NEEDS`), and `AddMenu` (`tools/author-panel/src/edit/AddMenu.tsx`, moved out of
`Generic.tsx` at its size ceiling) draws them disabled with `needs emote in cartridge.json`. `gate`/`cardMenuWith` feed
all seven card sites. The bead's second symptom ("Add then writes a `dev` row") needed no fix: no `'dev'` literal exists
and `added()` already returns `undefined` when the author must choose.
The nightly `ci` red of 2026-11-13 (`43614268953`) was the `mobile` job's `Author panel smoke` step — the parallel panel
suite, not a diff — and #731 is its fix, merged 2026-11-14. **Confirmed:** the `mobile` job on `4b33ab690` (a push past
#731) is `success`; the nightly `6db240794` that `bin/session_status.sh` still prints predates the merge, so that flag is
stale, not open work.
**A worktree symlink can break every Elixir job.** #732 was closed for it: `git add -A` in a worktree staged a link named
`_build` pointing at an absolute home path, so `mix` found a file where it needs its build directory
(`_build/test/lib/boundary: not a directory`) and `elixir`, `kernel` and `mobile` died identically while `main` was green.
`.gitignore` said `/_build/` and `/deps/`; a trailing slash matches directories, not links, so both lost it, and
`bin/worktree_setup.sh` now refuses to run through such a link. #733 is the same tree with clean history — when a branch
is young and unsaved by anyone else, rebuild it rather than force-pushing (`AGENTS.md` forbids the push).
Untracked `cartridges/prologue/` is the owner's in-progress Part 1: never touch it, read it only.
`docs/system-graph.gen.json` regenerates from it, so keep that file out of a commit while the scratch cartridge is present.

**This session (2026-11-15 to 11-16).** First half: #733 **F8, the add menu names why a field is refused** (`.94`,
closed); #734 **`bin/main_guard.py`** (loka-vh0cy, closed) — see the rule at the bottom of this page, because it was
written to stop a mistake made in this same session; then, directly on `main`: `.98` + `.99` (**Phase 0**, ff954162a —
a first run and a held port are named instead of dying); `.68` closed as **already fixed** in 4519bac76 (key
re-sorting), both symptoms verified gone; `.100.6` (0ded416bb — a refused `/open` writes why under the asked-for line);
`.100.8`'s sampler half (323d3ac10 — bindings end with the page, closing 59 of 156); Phase 2 shipped as 527fd4071 and
Phase 3 as the `.97` writer guide.

Second half: #735 **the drift line names the actual mistake** (loka-y043w, closed):
`bin/beads_pr_drift.py` printed "open PR #N has no Beads issue" for a bead that merely lacks an `external_ref`, which
cost three false alarms a session; it now prints the `br update <id> --external-ref ...` to run, and
`bin/beads_red_controls.sh` pins both wordings. #736 **`after_merge` closes a merged parent that has open follow-ups**
(loka-grdiq, closed): a PR's own follow-up children are created while it is open, so `br close` refused it and every
such merge needed a hand `--force` plus a rerun; the bead-closing loop now passes `--force`. #737 **`mutate_diff` names
an unrunnable checkout** (loka-ebnu3, closed): with no `node_modules`/`deps`/`_build` it printed a table of
`BASELINE-RED` rows that read as verdicts, and the baseline now exits 144 with the reason and the last 800 bytes of
output.

**The housekeeping queue was drained: 74 open to 10.** 55 were closed with a reason naming a category, and the shape
they shared is the finding: **most described work already done.** `lfdsb`/`8r5eq` were the same item and
`bin/worktree_setup.sh:12,30` already runs `mix deps.get --check-locked` and `npm ci`; `273d`'s four `*_hash.py`
generators do not exist; `fsfq` had `.gitignore:26`; `h3cny` was fixed in 3579a5d1a (verified by spawning two
`sleep 300` children under a 2s cap: no survivors); `h5hh9`'s premise was made obsolete by the two-lane decision
(the size check runs on the PR head, not in `after_merge`); `7anzq` and `atj0g` were already in `merge_pr.sh` and
`wait_ci.sh`. `cr7l7` is **not a bug**: the compiler refuses an orphan `.cut` (`This cutscene has nothing to start it`)
and the panel lists scenes from `story.ts:2`, which reads the compiled artifact, so an uncompilable file can never
appear. 22 were procedural advice that was never a ticket, and `loka-r7vrx` ("the queue is 75 open with nothing closed
since 11-07") closed because the number dropped.

## In flight at handoff

Nothing. Nothing is mid-merge and no agent is running. **#454** is still the owner's P3 hold.
**#632 merged** (`loka-vduxr.64`, the TS LSP tool and the code-search guide: `docs/guides/code-search.md` is
new and `AGENTS.md`'s "Searching code" section points at `bin/loka ts` — read both before a repo-wide search).

The `loka-wfrgk.100.4` scene-field-focus item has a **recorded lead but no fix**. The card does remount on a
save (stamping an input inside `[aria-label="scene card"]` and saving shows the stamp gone), so the defect is
real — but reverting `tools/author-panel/src/edit/cards/Room.tsx:216`'s `key={proseKey(draft[f])}` to `key={f}`
fails no test, so there is no break to name and nothing was changed. Suspect on its face: `kernel/ts/play/card.ts:312-315`
returns the words themselves as `proseKey` when the value is a string, so a literal-text field gets a new React key
on every save. Next step is to find which container actually remounts: when the prompt field remounted, the whole
`[aria-label="scene card"]` went with it and did not come back, which points at `RoomForm key={resets}`
(`tools/author-panel/src/edit/cards/Dialogue.tsx:79`) rather than the field's key.

**#746 merged** (`loka-vduxr.39`, doc half only): `docs/system/save.md` no longer claims in "What reopen
proves" that a `TypeError` is never a bad save. It said so for a universal it did not have: that holds at
the row readers (the newest receipt, the deer and skills loaders) but not at the first screen, where
`checked` reads the view before the Book draws and any throw is a refusal, because a row the view cannot
show is a save it cannot show (`start_over.test.ts`, "a save with no body row"). The paragraph now scopes
the claim and names the exception.

**Read this before retrying `loka-vduxr.39`:** the code half is *withdrawn, not deferred*, and the reason is
in `docs/reviews/2026-11-17-first-screen-guard-review.md`. Narrowing `checked`'s catch to `unreadable(e)`
(which is what the bead asks for and what mirrors the narration guard two lines below) reddens
`start_over.test.ts` 2/15: a deleted body row and a forged container id **both throw `TypeError` from the
same catch**, so no throw-shape test can separate a damaged save from a bug of ours. Rows that must refuse
(damaged save, Start over) and rows that must not (our bug, save kept) are the same observable there. The
reviewer's M4 is the direction that keeps both: accept `KernelError` as a refusal **and** make `load` refuse
an unknown container target. `loka-vduxr.39` stays open at P2 awaiting an owner decision (close won't-fix /
take M4 / leave as doc-only, which is done). **Lesson: a catch that guards a screen, not a row, cannot
classify by exception type.**

**This session (2026-11-16 fourth block, 2026-11-17 UTC) merged two PRs:**
#745 **loka-vduxr.58.4, S4 of the area layout** (closed): `bin/loka index <cartridge dir>` writes `areas/INDEX.md`
and one `areas/<area>/INDEX.md`; `bin/regen.sh` rewrites a *changed, tracked* cartridge's and skips one with no
`areas/` folder. Read `kernel/ts/play/index.ts` (324 lines) before changing the pages, and note `find.ts` now
exports `refsIn` — the one ref walk, shared, so `find.ts`'s output and its `CAP=100` must stay as they are. The
pages carry the owner's three fixed header lines and the Builders' Guide `#cartridge-layout` anchor. 12 pages are
committed (showcase 9 + root, speech_sampler 2). Self-review found a real defect and fixed it: the reverse direction
of a border spelled a root room `rooms/<key>`, reading as an area named `rooms`; root targets now print bare. Latent
(no cartridge has a root room yet), so all 12 pages are byte-identical after the fix. Showcase `content_hash` is
unchanged and still equals the fixture: the index is not part of the artifact.

**Note for the next slice over these pages:** the showcase's root index ends with 85 lines of "Root definitions
named by no area" (all `actions/*`, the `wheel_*_x_shows_*` family, `topics/*`, `scenes/letter_*`). The design
demands that list and its own sample carries it, so it shipped; the owner has not seen it yet and it is the one
thing here that may read as noise in the file an agent opens first.

**This session (2026-11-16, third block) merged six PRs, all opened and closed by this PM:**
#739 **loka-kgd.223, the flows crash** (closed): `one_container_per_item` and `containment_acyclic` admitted only an
edible item to the terminal consumed holder, but a death-created corpse decaying to it and a cured bandage were both
lawful — so an accepted step made both world invariants false and `flows.ts:175` crashed on seed 4 step 130 after
323 s. One rule now names the holder's lawful occupants (edible, bandage, death-created corpse) in
`kernel/ts/src/runtime/created.ts`, and the creation guard and both world invariants call it, so the three cannot
drift. Verified on current main: `bin/loka sim cartridges/toolbox_showcase --seeds 16 --days 3` runs every seed to
completion, and the nightly `sim (fresh)`/`sim (showcase)` jobs are green (323 s / 191 s).
#740 **loka-wfrgk.90, the half-typed write — an incomplete fix that #743 replaced.** The card's form committed a
blur's edit on a zero-delay timer; a keystroke landing before that timer ran wrote `2` of the `21` being typed, then
the next blur wrote `21`. #740 made the tick a 200 ms wait — but that wait restarts on every keystroke, so a write
stayed armed while the author typed and fired on whatever was half-typed when it expired (a 528 ms gap between the
two keys reproduced it). #743's CI caught it. `onInput` now **cancels** the waiting write and each blur arms it
again, so a write only runs on words settled when focus left; `onInput` and not `change`, because rjsf renames a map
key by a setState after its blur. The #740 test passed with the bug present — its first keystroke landed inside one
`settle`. It now waits 450 ms between keys and is mutation-checked two ways.
#743 **loka-9ack** (closed): `polish_session.sh close` ran only `catalogue.test.ts`, while book-e2e's storybook job
runs `tsc -p .storybook` — so a bad `.stories.tsx` passed `close` and went red after the push (the #513/#520/#527
class, three times). `close` runs it now, with a red control.
#738 (loka-2bp1n, loka-2zak, closed): slice size in the developer rules, and a narration brief names its fixtures.

- **#632** (loka-vduxr.64) merged this session; **#454** is the owner's P3 hold.

## Resume, in order

0. **The board is honest again: 37 open, 16 ready, 246 deferred.** The ready list is the whole
   planned queue now; anything absent from it is deferred on purpose, not forgotten. Before
   proposing work, check whether a bead is already shipped — this session closed three that were
   (see above) by reading the code, and the same habit would have caught each the first time.
1. **The owner is writing Part 1 in the editor.** That is the point of the queue below, not a parallel task:
   `bin/author.sh`, restart it after each merge. File friction as it appears and fix the blockers at once.
   Three beads are open *because* they want the owner's input, not an agent's:
   - **`.100.5`** (scene structure editable in the GUI) — reverses ruling 11, so it needs a design pass first
     (designer + PM). Do not start it blind; the first real restructuring attempt is the input.
   - **`.100.7`** (wrapped/composed lines do not open their field) — needs a multi-key decision no bead states;
     a composed line legitimately holds several keys, so `data-loka-key` cannot carry it. Do not bundle it with `.100.8`.
   - **`.100.4`** (card words field follow-ups: undo, `/line` retry, re-read after outside change).
   `cr7l7` left this list: it is closed as not-a-bug (see above).
2. **`.100.8` remainder: 97 of 156.** The sampler families (59) are closed by per-page clearing
   (`nextPage`, `prose_rules.ts`, shipped 323d3ac10). The rest needs the `data-loka-key` attribute, and that is
   **bigger than `docs/rnd/line-key-binding-2026-11-15.md` first claimed** — corrected in 06ab70e75: `rendered`
   (`mobile/app/book/logs.ts:46`) holds `line.key` and drops it, `DetailLine` (`:58-64`) has no key on any variant,
   and `LogLine` (`mobile/app/book/lines.tsx:130`) therefore never sees one. Work: a key on `DetailLine`, set in
   `rendered`, read in `LogLine`, plus `closest('[data-loka-key]')` at both lookup sites (`keyOf` in
   `mobile/app/author/inbook.ts:44`; `panel.tsx:217`, which uses `e.target` and must walk up).
   **Do not build it speculatively** — how many of the 97 ever share a screen is still unmeasured, because
   `bin/measure_collisions.mjs` cannot get past the showcase's tutorial overlay. Build it when a real edit needs
   two same-screen duplicates told apart.
3. Story tooling epic **loka-wfrgk.115** is **complete except E1** (`.12`): P3, parked until a beat needs it; it
   needs a protocol change, a kernel change and a `kernel_api` bump, so it wants an Opus design session.
4. Older P1s: `loka-vduxr.102` (the field guide), `.102.1` — **blocked on a missing carrier, not a missing reader**
   (checked this session). The bead says to move each removed spec cite into the schema node's `$comment` and read it
   there. That carrier does not exist: `lib/loka/content/source_schema.ex:62` writes exactly one `$comment` per file,
   at its head, and no per-node one is ever set. A per-node cite key must be added to the generated schemas first
   (`schemas/source/`, `protocol/`), so it is a schema slice of its own. Scale today: 11 `§` cites in
   `schemas/source/*.json`, 23 in `lib/loka/content/*.ex`.
5. Housekeeping: **2 open, 3 deferred** under the label (was 74, then 10; `7anzq` and `atj0g` closed as already
   fixed after checking `bin/after_merge.sh:73-78` and `bin/pm_merge.sh:44-48`). The 55 closed this session were verified already-fixed, duplicates or
   procedural advice. This session closed **loka-wfrgk.117** (generators no longer read an
   untracked cartridge: both now filter per cartridge, since the red control plants a transcript *inside* a tracked
   cartridge) and **loka-fd8km** (`bin/lib/beads_sync.sh` no longer `git pull`s, which raced a concurrent fetch and
   rewrote `FETCH_HEAD`). Both in #741. **Open (2):** `wfrgk.54` (E6c2 self-review, four files, deferred behind Part 1) and `vduxr.64`
   (done in #632, awaiting that PR's merge). **Deferred (4):** `rvbmn` (a Walk-head check in push_slice),
   `00p0u` (a combat narration routing check), `e9ey` (the `@tmcp/transport-http` override).
   `7vnzm` was closed: the `.gitignore` and `worktree_setup.sh` halves shipped in #733.

**Phase 0, 2 and 3 of the authoring-readiness plan are done** — do not re-plan them. Phase 0 was ff954162a
(`.98`, `.99`); Phase 2 was 527fd4071 (`fq96k`, `0ske4`, `.96` — all three now closed, and `fq96k` turned out to be a
real route bug: an outside-file fallback plus an unreadable tree file becoming a 500); Phase 3 was `.97` (the writer
guide documents the three-column shell, Cmd-K, Cmd-E and double-click-to-edit) — also closed.

## Owner calls to date (2026-11-07 session; override any)

- #701 merged as designed: a choice key is fixed by a ` #<key>` suffix, words are free.
- Story tooling: yes to every recommendation of both docs. Weather stays a story fact for Part 1 (no `weather.set`);
  modal scenes stay choice-free (branch through `.scene` dialogues); D1 uses per-step replay within a budget; E1 waits
  for a beat that needs it; L2b is a warning; the v1 phone save policy is decided at the release-candidate audit; roam
  reports only until Part 1 is written, then gates with a baseline.
- Corrections given to the owner: rooms already vary text by fact (`variants`), a story map and checkpoints exist,
  modal scenes have no choice step (the two-option choice is the dream scene's).

## Waiting on the owner

- Part 1 build feedback. Older: studio defaults, weapon proficiency shape, store fees, iOS first, the save guarantee,
  #574 acceptance, #564 calls, hosting (12uz).

## Retros awaiting the owner's yes/no

**2026-11-16 (one new item, DONE):** loka-wpw6x — **the PM's `ci_wait.sh` reports failure on green heads.** Fixed
this session: the Pi-side copy is deleted and `~/.pi/agent/AGENTS.md` points at the repo's `bin/wait_ci.sh` (which
resolves a short sha, requires both gating workflows and names "no runs found" apart from a timeout). No owner action.
Evidence: on PR
#740's head `18568fed55` it exited 1 while `gh run list --commit` showed `graph-diff`, `ci` and `book-e2e` all
`success`, and `gh pr checks 740` showed every other job `pass` with `sim` and `walk` merely `skipping` (the normal
state for a diff touching neither cartridge). Three tasks this session (`be4fd552d`, `b507857c0`, `baa27ef41`) wrote
only the bare sha, 11-12 bytes, about a minute after launch. Its three faults are ones the repo's own `bin/wait_ci.sh`
already fixed and documents: short-sha resolution (`bin/wait_ci.sh:10-16`), both gating workflows required, and "no
runs found" named apart from "timed out". Fix: replace the Pi-side copy with the repo's script. Expected saving: one
hand check or one misread red per PR, 2-4 minutes a session. The Pi-side script lives outside the repo, so this is a
change to the owner's install, not a PR.

**2026-11-13 (two items):** loka-qozwj (**approved and shipped in #731**: the panel suite's parallel default raced
one dev server) and loka-8v4lx (name the reviewer fallback model in WORKFLOW and the loka-review agent
instead of justifying a substitution per slice — still awaiting the owner).

**Closed this session, no owner action needed:** loka-y043w (the drift check's message; **shipped in #735**),
loka-r7vrx (the queue was 75 open with nothing closed; **the queue is 10**), loka-grdiq and loka-ebnu3 and
loka-h3cny (merge/mutation tooling; **#736, #737, 3579a5d1a**). The retros fired, got fixed, and closed, which is
what was missing from the previous ten days.

**2026-11-15 (one item):** loka-7vnzm (a worktree symlink named `_build` rode into a commit and broke every Elixir
job; the `git diff --stat` line that named it was skipped because the error looked like infrastructure). Its two
cheap fixes are already in #733 (`.gitignore` lost the trailing slash; `bin/worktree_setup.sh` refuses a link); the
retro asks whether a pre-push check should refuse a tracked symlink or absolute path at all.

**2026-11-11 (three items):** evidence in each: loka-x4ejm (session_status does not print a PR head's CI conclusion — **done in #714**),
loka-y043w (the drift check calls a missing `external_ref` "no Beads issue": three false alarms a session),
loka-r7vrx (the queue is 75 open with duplicates and nothing closed since 11-07).
loka-4ks2l was approved and is merged (#709). Closed `loka-wfrgk.116` as a duplicate of `loka-za8br` while filing. The
2026-11-07 items are still open and unapproved; three of them closed with #710 (lvo9i, wfrgk.110, za8br).

## Learned this session (worth knowing next time)

- **A bead's title is not evidence, and this session produced three.** `loka-g5hh.2`/`.2.6` looked like a
  large unbuilt feature (gilt wash, progress bar, level moment) and its whole epic was already on main from
  #573/#575. `loka-wfrgk.120` looked like a defect and was the codebase's own convention. `loka-vduxr.29`
  looked like a live crash and the mechanism its title stated is neutralised by `runtime/proposal.ts:317`.
  **Check the code and the schema, then check that the fault can happen** — the shape being wrong is not
  the same as the bug existing.

- **A test that passes with its bug present proves nothing, and this session produced two.** #740's test for the
  half-typed write asserted one write, but its first keystroke landed inside the 200 ms window, so it only ever
  exercised the fast path — #743's CI failed on a slow runner. The fix for `.90` was itself wrong for the same
  reason: I reasoned about the timer instead of measuring it, and only a `console.log` trace of `soon`/`change` in
  the real browser showed the timer re-arming on each keystroke. **Run the mutant before believing a green test**,
  and when a timing bug is suspected, instrument the running page rather than reason about the code.
- **`tsc -p . --noEmit` is weaker than `tsc -b`.** The panel's `noUnusedLocals` fired only in build mode, so a local
  "typecheck clean" still failed `bin/related_tests.sh` at push. Use the same command CI uses (`tsc -b`, which is
  what `npm run build` runs).
- **A separate slice needs its branch before its commit.** I committed `loka-x6t.6` on the `#743` branch and would
  have folded it into that PR; `merge_pr.sh`'s "main is not checked out here" refusal is what caught it. Branch
  first, then commit.
- **A backlog of tickets mostly describes work already done.** Of 55 closed housekeeping items, 13 were already
  fixed and 22 were procedural advice that never should have been a ticket. Before doing one, **verify the fault
  still exists**: `ls bin/*_hash.py` returned nothing, `git grep` found the fix, one `sleep`-child spawn proved the
  timeout. Closing an already-fixed bead is the correct outcome, not a shortcut. The corollary: a 74-item queue whose
  headline retro says "nothing closed since 11-07" is not a workload, it is a record of unverified assumptions.
- **A claim of "I verified it" must name the check.** I asserted `dreams.ex` accepted three choices with a duplicate
  and wrote a fix and a test; `protocol/scene.schema.json:304-307` caps `choices` at `maxItems: 2`, so the state is
  unreachable and the test failed. Reading the function is not running the system. Ask "what did I execute?" before
  "what did I read?".
- **A `bg_run` can exit 0 while its output says `no such file or directory`.** A wrong script path printed a zsh error
  and still returned success, and the terminal notification reported `exit-code 0`. Read the log, not the exit code,
  for anything whose success matters — the same lesson the repo already has about `ci_wait` on the wrong head.
- **`bin/merge_pr.sh` refuses when the checkout is on the PR's branch.** After pushing #737 this checkout was still on
  `fix/mutate-144` and the gate said `main is not checked out here` — correct refusal, wrong state. `git checkout main`
  first. This is the same class of error as the bead-id-instead-of-branch one already recorded below, and the guards
  caught both.
- **`rg -r` is *replace*.** `rg -rn foo mobile/` rewrote the results through a replacement pattern and printed
  `'[n"]'` for every match. Three times in one session, and the garbled output nearly became a false conclusion
  about where `dir="auto"` is set. Plain `rg` is already recursive.
- **A crash report's line number outlives its cause.** `flows.ts:175` was the invariant's holder rule (kgd.223).
  Re-run the repro before believing the line: `bin/loka sim <cartridge> --seeds N --days D` compiles the cartridge
  itself and cannot read a stale artifact, while `node kernel/ts/play/flows.ts <file>` reads whatever file you hand
  it. Six background tasks from the earlier session replayed a pre-fix artifact left in the temp directory and each
  "failed" identically; the current code ran 16 seeds to completion. That scratch artifact and its harness script were
  deleted this session: while they existed, every rerun "proved" a fixed bug was live.
- **A zero-delay timer is not "after this event".** `setTimeout(card.commit)` reads the draft when it fires, and an
  input event can be dispatched first — under CPU throttle it reliably is. When a deferred read must see the state at
  request time, snapshot it then, or debounce until the input settles. The ticket said "reads `latest` late" and it
  was right; two of my fixes moved the timer without closing the window.
- **The test tsconfig has no DOM lib.** `tools/author-panel/tsconfig.node.json` compiles `test/` with
  `lib: ["ES2023"]` and `types: ["node"]`, so `page.evaluate(() => document.querySelector(...))` is a type error in
  CI while a plain `tsc` beside the tests passes. Pass a string, as `tools/author-panel/test/map.test.ts:332` does, and
  run `npx tsc -b` in `tools/author-panel` (what the `mobile` job runs), not `tsc --noEmit -p .`.
- **Prettier must come from the repo root.** `node_modules/.bin/prettier` is 3.9.9 (the gate's); `npx prettier`
  inside `tools/author-panel` resolved another version and reformatted 40 unrelated lines of `Generic.tsx`. It
  reverted cleanly, but only because the diff was read before committing.
- **`bin/beads_checkpoint.sh` commits `docs/HANDOFF.md` too.** It is the one command that writes both files, its
  default subject is `Beads: checkpoint`, and it pushed this session's handoff under that message before the message
  could be written. Pass the subject: `bin/beads_checkpoint.sh "Handoff: <what changed>"`.
- **The PM's `ci_wait.sh` reports failure on green heads.** See the retro below: short shas, skipped jobs, and three
  silent single-line exits this session. Until it is fixed, check `gh pr checks <n>` by hand.

- **`ci.yml` never runs on `main`, so "I ran it locally" is not a gate.** The two-lane decision makes a green
  *branch* head the gate and leaves `main` to a nightly plus by-hand runs. `bin/prepush.sh` covers sizes,
  prettier, regen, `tsc`, docs, sounds and a few targeted red controls — but **no package test suite**. Two commits
  went to `main` gated by four minutes of local green. Nothing broke, but the rule at `docs/PM.md:92` ("never for
  unreviewed code") was broken, and reading it earlier in the session did not stop it. `bin/main_guard.py` (#734)
  now refuses it. **Check what the gate actually covers, not what you assume it covers.**
- **`bin/merge_pr.sh` takes a Beads id, not a branch name.** Passed `tools/main-guard`; the merge landed and only
  then did `br close tools/main-guard` fail, leaving the PR merged with no bead transition. It accepted the bad
  argument without complaint and failed after the irreversible step. Check the second argument.
- **A symptom's obvious fix can be the wrong layer.** `.100.8` reads "tag each line with its key", and
  extending the existing `~` zero-width marks looks like the minimal change. It is not: marking leaves
  every lookup still keyed by *words*, rewrites the strings the Book reads out as accessible names, and
  makes the panel's own `seen` bindings disagree with the render. The bead says it plainly — put the key
  on the *element* and look it up by element. When a fix fights the test suite that much, the tests are
  usually describing the contract and the fix is at the wrong layer.
- **`seen` in `mobile/app/author/panel.tsx:32` is module-level and never cleared.** That is why one shared
  wording costs the *rest of the session* rather than one page. Worth knowing before sizing `.100.8`.
- **A composed line cannot carry one key.** "Talk to " + an NPC's name is two keys in one line, so any
  element-key attribute needs a story for that (the sibling follow-up `.100.7`).
- **Write the test before the render change when the change rewrites text.** Asserting on visible words
  needs one strip helper in the harness; discovering that after the fact cost three rewrites.

- **An exemption can be right for one row and wrong for the row beside it.** `lint_facts.ex`'s writer set skips a
  mechanic-written fact for both compare rows. Correct for the bool/enum row ("nothing writes that value"); wrong for
  the int row, because `value_type.maximum` bounds the fact whoever writes it. When one `cond` branch serves two
  questions, check it answers each. Found by reading after a reviewer timed out, so #724 had no early independent pass.
- **Erlang term order is a trap in guards.** `nil > 5`, `"five" > 5` and `:x > 5` are all **true**, so a guard like
  `when t > max` fires on malformed input and reports nonsense. Every numeric guard over authored JSON needs
  `is_integer(t) and`. A reviewer found this in #724; the test pinning it fails without the clause.
- **A green sibling is the fastest way to prove a red is yours.** Three jobs died with the same
  `_build/test/lib/boundary: not a directory`, which reads like a runner flake. One command settled it:
  `gh run view <nightly> --json jobs` showed `main`'s `elixir` **success** on the same runner image, so the
  fault had to be in my head, and `git diff --stat origin/main...HEAD` printed `_build | 1 +`. Check the
  sibling before re-running anything: a rerun cost 25 minutes and returned the identical error.
- **A dotfile pattern with a trailing slash misses symlinks.** `/_build/` and `/deps/` match directories only;
  the worktree's `ln -s` links were stageable, and one rode into a commit as an absolute home path.
- **Read `git diff --stat <base>...HEAD` before trusting "my diff is TypeScript-only".** It printed the
  offending line and I skipped it because the error *looked* like infrastructure.
- **`ci_wait.sh` lives in `~/.pi/agent/scripts/`, not `bin/`**, and takes longer than a 40-minute tool timeout on a
  full run — check `gh pr checks <n> | grep -v pending` instead, or run it under `bg_run`.

- **A schema grep is not evidence a field does not exist.** `once: true` on a reaction appears in no
  `protocol/*.schema.json`, so a first pass dismissed a reviewer's finding about it. It is real: `reaction_once.ex`
  lowers `once` and `cooldown` into a done-fact guard *before* validation, and `dialogue_once.ex` does the same for a
  choice. Check `lib/loka/content/*_once.ex` and the loader before concluding a key is unused.
- **Run a new lint row over every cartridge, not just the pinned one.** `test/loka/lint_baseline.txt` pins only
  `toolbox_showcase`, so all 29 unit tests passed while five rows misfired on `errand_sampler`, `journal_sampler`,
  `build_sampler` and `reactions_sampler`. The check that caught them: `for d in cartridges/*/; do mise exec -- mix
  loka.lint "$d"; done`. Do this before handing a lint slice to review.
- **A whole-row blind spot can pass every unit test.** Before #723's fix, the compare rows skipped a fact named by *any*
  string in source: 29 of 60 showcase facts and 122 of 202 compare sites were silently exempt, and nothing failed.
  When a row is meant to fire on real cartridges, count what it actually examines.
- **A same-file second edit can silently revert the first.** Two `edit` calls on one file in one turn left the region as
  the *original* text; only reading the file back caught it. After a double edit on one file, read the region. It bit
  again in #723: a test edit reported success while the file still held the old body, and only the mutation check
  (reverting the fix and watching the test pass) exposed it.
- **The panel suite passed serially and failed in parallel** until #731 made `--test-concurrency=1` its default:
  `node --test test/*.test.ts` gave 63/66 on C1 (three unrelated card/room tests on one shared dev server and Chrome,
  load 2+), the serial run 66/66 on the same commit, and the same race took the nightly `mobile` job red. A flake that
  reproduces on main is a harness bug, not a diff: fix the harness, then confirm on the next nightly. The hang variant
  is loka-0ske4.
- **`bin/subagent` async children are broken in this harness install** (`@earendil-works/chord` missing); a blocking
  `async:false` run works. The spawn also refuses at load 8+, so check `uptime` first.
- **Opus reviewers were unavailable all session** (anthropic OAuth expired, antigravity quota, no OpenRouter credits), so
  C1's review and its re-check ran on `openai-codex/gpt-5.6-luna`; the record states that in its own section. For #723
  the same again: `loka-review` failed on the expired Anthropic refresh token, the builtin `reviewer` timed out at 60
  minutes, so `loka-scout` (antigravity/gemini-3.8-flash) ran it — and despite being a lookup agent it found two real
  blockers, one of which (`once: true`) I had wrongly dismissed.
- `wait_ci.sh` again reported success on a head where I had to confirm with `gh run list --commit`; trust the second.
- A review record for a PR is a **local** `review-<PR>` branch, never pushed: `bin/after_merge.sh` cherry-picks it. C1's
  first record arrived on the PR branch itself (cherry-picked into the fix push) and the re-check's record went to
  `review-722`, which merged cleanly.

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
