# PM handoff

The PM's session handoff, in the repo so any harness (local Claude Code, Claude Code in the cloud,
Pi) can take over. Live status stays in Beads and GitHub; this file holds only what they do not:
the next steps, the standing owner rules that the repo does not yet state, and open owner
questions. Rewrite it at each stable checkpoint (a merge, a review verdict, a pushed fix) and before
the session ends; commit and push it with the Beads export.

Written 2026-10-22 ~18:30 UTC by Claude Code (Opus 5.5), PM session 016V3u, AS OF PR #432, before the owner's macOS
update and reboot (owner 2026-10-22, quoted: "please bring this to a good stopping point so i can upgrade, then we will
resume this session after the reboot").
Open objectives: finish loka-x6t.86 (type and ink before polish), then loka-e56t (CI browser install), then the owner's
live Storybook polish batch.

## Live polish session (OPEN since 2026-10-22, owner at Storybook)

The owner reactivated Storybook polish (2026-10-22, quoted): "i am going to do the ui polish on the storybook thing ...
PLease set things up so that its easy for me to do my ui polish there".
- Session: `polish/session-2026-10-21` in ~/dev/lokacore-session; it holds no commits yet and was fast-forwarded to
  main after #432. No pick has arrived yet.
- After the reboot: `bin/polish_session.sh start` (reuses the open session and serves the owner's Storybook on 6006),
  then confirm 6006 and the web preview on 19006 answer; restart the preview per docs/web-preview.md if not. Use
  `bin/polish_session.sh update` (not a manual merge) to bring main in: it restarts Storybook when stories change.
- Loop (WORKFLOW "Live polish session", web-preview.md "Polish queue"): picks land in
  ~/dev/lokacore-session/.polish/picks.jsonl; the PM watches it with a Monitor (`tail -F -n 0`, re-armed every 30 min),
  answers through `bin/polish_status.sh`, and routes each pick to one Opus designer in the session worktree, which commits
  each accepted tweak. Fable only when the owner asks for a new direction; never Sonnet for a designer.
- Mechanics, save, protocol or engine picks leave as Beads issues (`bin/br_create.sh`) with a panel log line.
- "Close batch": `bin/polish_session.sh close`, one Opus reviewer quick pass as PR comments, green hosted CI, merge with
  `--match-head-commit`, `bin/after_merge.sh`, `bin/preview_update.sh` (it refuses while a session is served).

## Done this session (pre-polish foundation, all merged)

- #428 (loka-x6t.81 part, loka-x6t.53): signpost text once, map scrolls to the current room at 390 px, refusal notes use
  action labels (Menu.tsx, pages.tsx). loka-x6t.81 stays open: signpost wording, Word bar height, DiscoveredMap.tsx:56
  re-scroll, notices.tsx `fresh` collapses identical lines.
- #429 (loka-x6t.82): retired-chapter sections out of docs/system/book-ui.md, general rules kept; catalogue page rows.
- #430 (loka-x6t.42): Reading size setting (x1, x1.15, x1.3, cap 1.5), Storybook `reading` toolbar, lint rule
  lint/rules/mobile-book-text.yml.
- #431 (loka-x6t.83): component specs live in JSDoc on each component (Use/Rules/States/Story), BOOK-UI-COMPONENTS.md is
  guidance plus an index, enforced by mobile/app/catalogue.test.ts. Owner (paraphrased): consolidate design files; specs
  live with components; make it enforceable. Fable designed it. Follow-up loka-x6t.85 (story metas lack `component:`).
- #432 (loka-x6t.87): showcase calendar solar phases; the Book shows dawn/day/dusk/night; no CJK hour glyph.
- Fable broad audit loka-x6t.84 (ranked findings in its notes). Owner calls 2026-10-22: titles and the status line scale
  with Reading size (supersedes the morning's "titles fixed"); distinct danger ink; one `type.pageTitle` 26 px left.

## In flight at the reboot

- loka-x6t.86 (type and ink): Opus developer stopped for the reboot. Head 551f4d82 on `feat/type-ink-before-polish`
  is committed only in its local worktree (named type-ink), not pushed: the pre-push size check failed
  (`mobile/app/book/Status.tsx:80: function StatusLine, 46 lines, limit 40`). Type check and focused tests pass.
  Left: cut StatusLine to 40 lines, run the mutants, push, open the PR, then one Opus reviewer, CI, merge,
  `bin/polish_session.sh update`. The Fable ruling and acceptance literals are in the issue notes.
- loka-e56t (P1): book-e2e jobs time out in the Playwright browser install (three times on 2026-10-22). Owner chose: after
  the audit. Plan: cache the browser directory, bound the apt step, raise the storybook job timeout. e2e-web (tester.army)
  uses the same Playwright 1.63.0 Chromium, so swapping installers alone does not help; browser-use is not a CI test driver.
- Open owner item: the time of day shows only in the status line's accessible label; a visible clock needs a spec change.

## Start of a session

1. Tools: `mise install` (pins in `mise.toml`), `br` 0.7.4 ([BEADS.md](BEADS.md)), `gh`
   authenticated for `lorecrafting/lokacore`. A cloud container may lack `br` and `gh`: install them
   first, and confirm `gh auth status` before any step that merges or waits on CI.
2. Beads: `beads.db` is not in Git; `.beads/issues.jsonl` is. Run `br sync --import-only` once, then
   read with `br ready`, `br show <id> | head -5`.
3. Read [WORKFLOW.md](WORKFLOW.md) (Loop) and this file once. `bin/session_status.sh` prints the live
   board.

## Beads sync (every checkpoint; required in the cloud: the container is thrown away)

- `beads.db` is local only; `.beads/issues.jsonl` on `main` is the shared copy (local Claude Code and
  Pi write it too). Do Beads writes from a `main` checkout.
- Before Beads writes: `git pull --ff-only origin main`, then `br sync --import-only`.
- After each checkpoint (a merge, a review verdict, issues created or closed): `br sync --flush-only`,
  check the JSONL diff has no machine path, commit `.beads/issues.jsonl` (and this file when changed)
  on `main`, push.
- Push rejected: `git pull --rebase origin main`; on an `issues.jsonl` conflict run `br sync --merge`,
  then flush and commit again. Never commit `beads.db`.

## End of a session

1. Do the Beads sync above, with this file rewritten.
2. Every branch with work is pushed. Nothing may live only in the container.
3. File the [retro](WORKFLOW.md#retro-and-housekeeping-queue) items in Beads.

## Lane and next steps

Owner order (2026-10-15, refined 2026-10-16): **showcase first**, then M14 (done), M15 (trimmed), then **UI
polish** over the whole showcase (needs the owner at the computer), then measuring and balance tools
(`loka-kgd.107`), worldbuilding, Chapters 1-3. Owner 2026-10-16 (paraphrased): the full showcases and
playtests matter as the foundation for polish; at 95% weekly usage, build ALL remaining showcase work with
Opus developers and Opus reviewers, then ONE sweeping blind Fable playtest instead of one per district;
keep going on Opus. Notes and pins (G10) were dropped from M15.

Done in session c5ed3619: 2026-10-16: #413 (loka-kgd.170, M15 batch), #414 (loka-y6yg.32/.33, law arrest and jail),
#416 (loka-y6yg.37, sim job split into two legs), #415 (loka-y6yg.35, magic district). 2026-10-21: #417 (loka-2rfk,
hosted book-e2e job `walk` runs mobile/app/walkthrough/toolbox_showcase.walk.ts on every push), #419 (loka-kgd.176,
kernel_api 1.110: a status's optional `narration.observed` gives an applied line when a perceived NPC gains it), #420
(loka-ikch, worldbuilding drafts rescued from the main checkout), #418 (loka-y6yg.38, plan 7 traps district, three
slices). THE SHOWCASE IS FULLY BUILT (hub, combat, social, fire, homestead, economy/law, magic, traps).

Session 7b6568 (2026-10-21), all merged to main:
- #422 pass-1 fix batch (loka-y6yg.34), #423 showcase becomes the app default (loka-4hik.1), #424 pass-2 fixes from the
  390 px re-walk (loka-y6yg.58), #425 authoring checks A, B1 and B2 (loka-kgd.180-182; group C deferred to loka-kgd.183).
- #426 (loka-4hik.2) THE RETIRED CHAPTER IS FULLY DELETED. Owner (AskUserQuestion, quoted): "Fully gone now". The chapter, its renamed
  copy, its frozen fixtures and the bell/finale save code are gone. 22 slices were each CI-green and reviewed in waves; M1 and
  Z have review records. Plan: the phase-2 brief README under docs/briefs/, linked from the 2026-10-21 retire decision in docs/decisions/ (D1-D3, the acceptance sweep, one exemption:
  docs/spec/conformance/contract-links.json). The universal tests now run on the showcase, renamed samplers
  (rename.sed) or in-test fragments (kernel/ts/test/fragment.ts). New samplers: bleed, expedition, shoo.
- Follow-ups from the deletion:
  - loka-4hik.30: about 30 universal checks with no content yet. Restore them when the showcase or the real game
    authors that content.
  - loka-kgd.186: test gaps that predate the deletion.
  - loka-kgd.187 FIXED in #427 (accepted() omits empty narration; review record 2026-10-22). Follow-up loka-kgd.191: validate DecisionResult on commit, not only on reopen.
  - loka-kgd.188: the cellar_sampler KAT fails raw genesis.
  - Loka-0w4 is reopened: a developer /code-review left the main checkout detached.
- Owner 2026-10-21: Sonnet builds purely mechanical slices; Opus builds judgement and save slices and does every
  review (memory sonnet-mechanical-slices). Designer once per batch (loka-dnf2).
- One full blind playtest so far (pass 1) plus one targeted re-walk. The owner accepted the recommendation of a 390 px
  smoke check now and a full blind sweep after UI polish.
3. Owner: slice D two-save playtest (`loka-y6yg.4`). Then UI polish with the owner.
Approved, after the showcase, before chapter work: loka-kgd.173 sim invariants, loka-kgd.174 Book visibility check,
loka-kgd.175 scale benchmark (status sort, entity scan hot spots), loka-kgd.177 red control for
target_candidates_ordered; approved retro items for the next housekeeping PR: loka-7m2u, loka-xvxa, loka-8zf5,
loka-9nd4 (loka-2rfk is done). Also approved 2026-10-21 ("ok go with your recommmendation on the retros"): loka-xmvu (BRIEF KIT as a repo file),
loka-3a96 (drafters cite the spec clause for every Book-visible promise), loka-csf7 (walk script --grep never filters).

Session lessons (2026-10-21, c5ed3619):
- The new hosted `walk` job caught a broken walk step on its first run (a Quench step racing the wall clock at
  rate 50). Showcase walks must not depend on anything landing inside a few real seconds.
- Fable plans can contradict docs/system (NPC status lines): the developer's STOP point caught it; the owner chose
  "Line now, page later (Recommended)".
- Rebuilding toolbox_showcase_hash.json after a merge: `mix loka.compile cartridges/toolbox_showcase <out>`, then
  split `{"cartridge":<canonical>,"content_hash":"<sha>"}` into the fixture's canonical and sha256 (loka-kjky).
- Agents share one scratchpad and delete files: keep PM working files under a `pm_` prefix (loka-xmvu).

Session lessons (2026-10-16, c5ed3619):
- Retro APPROVED by the owner 2026-10-16 ("ok approve"), for the next housekeeping PR: loka-7m2u slice size cap, loka-xvxa hard 220k handoff stop (M2 developer ~720k),
  loka-8zf5 after_merge br recover retry, loka-9nd4 sim median of main runs, loka-2rfk hosted book-e2e never runs
  the showcase walks. Follow-up loka-kgd.177 (committed red control for target_candidates_ordered).
- Hosted runners are two-speed (~280 s vs ~540 s on the same code): compare sim times only across several runs,
  never blame one slice on one run (the PM wrongly blamed #414; the diagnosis cost ~30k).
- `br` can stop with "WAL index recovery already failed ... database is busy": run
  `br doctor migrate-schema recover`, then retry; `bin/after_merge.sh` reruns cleanly.
- `git cherry-pick -q` printed a usage error and picked nothing: use plain `git cherry-pick <sha>`.

Merge mechanics: `bin/pm_merge.sh <batch-worktree> <batch-branch> <slice-branch> <review-branch or the
sha> "<subject>" <reviewed-sha>` (refuses a non-green sha). It stops on stacked additive conflicts in
`loader_floors.json`, `mechanics.md`, `MECHANICS-TOOLBOX.md` and the gen files (retro `loka-0fhi`):
merge by hand, keep both sides, run `elixir bin/contracts.exs`, `bin/review_index.sh`, focused tests,
push. Make the batch worktree with `git worktree add ../worktrees.noindex/batch-m15 origin/toolbox/batch-m15 -b toolbox/batch-m15` if absent. `bin/after_merge.sh` now works with the
owner's untracked `scripts/`.

Session lessons (2026-10-16, 93636711):
- Showcase slices turn hosted CI red on pins outside their own tests (flows.test.ts populations,
  view_actor.test.ts inn exit count, loader_floors): before marking ready, grep tests for the hub and
  district counts the slice changes.
- A content-only change can create a performance cliff: the first concealment status made every
  visibility check sort all statuses and the hosted `sim` job (10 min) timed out; fixed in
  `status/shared.ts`. Compare the showcase sim test time with main (77 s) when a slice adds a status.
- Showcase mutants must edit the compiled hash fixture or recompile: tests read
  `protocol/fixtures/toolbox_showcase_hash.json`, not the cartridge source (E2 reviewer).
- The Book NPC page never drew an NPC's Held list (spec said it should): theft worked only in tests.
  Playtests and Book e2e rows catch what kernel tests cannot.
- Use `bin/br_create.sh`, never bare `br create` (it writes source_repo_path, the export check refuses).
- Fable drafted G10 (~300k) that the owner then cut: at high usage, show the owner a descoping matrix
  before drafting a batch.

Session lessons (2026-10-15, b5fe9338, 8c186cca, fc1e2fd7 and 01da56d0):
- Designer spawns are Fable, never Sonnet (owner: "wait sonnet should never be a designer, wasn't it
  fable designer?"); Sonnet only for a live-session picker nit.
- `/code-review` read the main checkout 5 times even with the brief line (retro `loka-aa75`); the
  reviewer's full read covered each miss.
- A slice that changes a protocol schema needs a review record even in a toolbox batch (retro `loka-1qa2`).
- Blocks deps between batch slices stop `br update --status in_progress` (retro `loka-gfgr`).
- One brief for an M engine + save + content row (hs-9) cost the developer about 650k tokens before
  review: split such rows at brief time (evidence on `loka-3jhb`).
- A developer pushed with a stale generated file (hs-9 `state-sections.gen.json`), and a hook switch
  broke six hand-written React test shims (x6t-65b): both turned hosted CI red after review (`loka-u58`,
  `loka-mluq`).
- Book UI rules: the ring drains smoothly but presentation keeps no gameplay clock (display-only tween
  between views).
- Content slices hid a faucet every time in batch A; with an item loop table in every brief, batch B
  found none (retro `loka-vro5`).
- A loader_floors case was shadowed by another feature at the same floor three times (batch A craft,
  hs-14 merge over hs-12's build step): after any merge that adds a feature to a shared sampler, rerun
  the floor mutants of that sampler's other cases (retro `loka-59uu`).
- Tests passed while the GameView they built failed the schema (hs-7 price 0, hs-14 empty choices):
  validate gameView against the schema in view tests (retro `loka-x3i0`).
- Developers ran /code-review in the main checkout (hs-7, hs-14): give the exact command with the
  worktree and range (retro `loka-7p2w`).
- A fix round that answers a developer's own open question can add a blocker (hs-14 round 2): rule on
  such questions as follow-ups unless the owner already decided.
- A save-path or `runtime/proposal.ts` change in a fix round gets a second opinion.
- Parallel slices append to the same fixture and doc spots: expect a hand merge (retro `loka-0fhi`).

## Standing owner rules not yet written elsewhere in the repo

- Merge a reviewed PR without asking once its exact head is green; do not ask permission for normal
  workflow steps. Stop only for spending money, `--no-verify` or force pushes, destructive or
  outward-facing actions beyond PRs and merges, and product or spec conflicts.
- Owner-facing text: every PR number carries its Beads id and a short description, for example
  `#379 (loka-kgd, mechanics batch M9b)`. Status and step reports use ASD-STE100 (short sentences,
  active voice); design choices and risks use plain English.
- Beads: short reads (`| head -5`), quiet writes (`br -q`), notes of one or two lines. Create issues
  with `bin/br_create.sh`. Mark an issue `in_progress` when work starts.
- Models: developers Opus (Sonnet for bounded docs or content); reviewers fresh Opus; Fable only for
  the one review per mechanics batch head, E-gates and the release-candidate audit
  ([WORKFLOW.md](WORKFLOW.md) routing table).
- Fable drafts briefs for new modules, contract changes (save, protocol, world graph), Realm-sensitive
  rows and new interaction patterns, one Fable run per batch; Opus or Sonnet brief rows that follow
  an existing pattern, S rows and content (owner 2026-10-14: "yes record the fable brief rule").
- Designer models (owner 2026-10-21): Opus for design reviews, rulings and maintaining the (now stable) system; Fable only for
  a new direction (unprecedented page type or component family, owner-asked refresh, RC audit). Docs: `loka-x6t.73`.
- Browser automation (owner 2026-10-21): the global `browser-use` skill (`bu.sh`, own Chrome for Testing per agent);
  Claude in Chrome is denied in settings.
- Load gate: run `uptime` in its own call before each spawn; spawn only below load 8; at most 5
  agents, at most 3 running tests.
- Budget: the weekly Claude allowance resets Wednesdays 05:00 HST; Fable draws the same pool faster.
  Near the cap, keep to 1 or 2 agents and Sonnet for bounded work.
- Jev (TypeSafe): spend approved (owner, 2026-10-14: "yes to this approve to allow spend"); briefs and cartridge text may leave the machine, redacted first, never saves or player words, and Jev is advisory only, never a gate (owner, 2026-10-14: "yes to both, briefs can leave the machine"). Pi keeps its $2/day cap. A decision record goes in the next housekeeping PR.
- Pi work is marked (commit trailer `Harness: pi (...)`, a `Written ... in the Pi harness` line,
  `[Pi · model · session]` on tracker comments). Claude Code work uses the normal co-author trailer.

## Cloud session lessons (if the next session is in the cloud again)

- `gh` works over REST only (GraphQL blocked: no `gh pr create`/`merge`; use the GitHub MCP tools);
  `gh auth status` misreports. git and REST branch deletion are blocked: merged branches
  `toolbox/m10-*` and `toolbox/m11-*` remain on GitHub; the owner deletes them locally
  (`git push origin --delete <branch>`).
- `br` 0.7.4 has no reachable release asset; build it from the `v0.7.4` tag with cargo (13 minutes).
- The disk fills after about seven worktrees (2.2 GB each); remove merged worktrees first.
- Agents must never run `git worktree prune` while another agent's worktree is in use.

## Overnight decisions (session 93636711, for the owner's morning recap)

Owner 2026-10-15 (quoted): "I will be sleeping now so be as autonomous as possible and make decisions on your
own. And give me a recap of crucial decisions in the morning when i ask for it. Go all the way up to Ui
polish stage which needs me at the computer for a bit."

- #403 (loka-mytp.1/.2, narrate and plan-move engine steps) merged at 0f0603ed; settle-3 kept parked.
- Showcase fixes y6yg.8/.9/.15/.16/.17 batched as one content PR (loka-y6yg.18); slice D needs no rebuild.
- Decisions PR #404 (loka-kgd.162): G10 split (private notes, map pins, letters stay M15; public writing G10b deferred);
  Chronicle FD6 no longer waits for carry-over; deferred rows do not block M14/M15 exit.
- Book bugs (loka-y6yg.20): Fable designer ruled combat closure keeps the Combat page with Back to World; the
  engage line goes to the combat log; a hostile NPC shows a refusal line from new cartridge text (protocol
  change, own brief with review record + second opinion, after the content batch); x6t.28 U3 ruled out.
- #404 merged. District plans #405 (loka-y6yg.19): Homestead, economy/law, magic, traps all ready; build in that
  order, one slice each. Hub: magic up and economy/law down from the inn, Homestead west of fell_gate, traps down from
  drill_yard (no second hub room). Economy/law ends at "wanted" plus a paid fine (trial and jail are M14).
- #406 (loka-y6yg.20 part A, Book showcase bugs) merged: a fight's closing lines (kill, death, inn return, Flee) stay on
  the ended Combat page with Back to World; any receipt that opens a fight logs on the Combat page. x6t.28 was the
  test harness (a hidden tab pauses the clock), now a playtest rule.
- #405 merged (plans 4-7). Homestead build started (loka-y6yg.21) as two sequential slices H1 (steps 1-8) and H2
  (9-13, sandbox, e2e) on draft branch showcase/homestead. Plan toolbox findings filed as loka-kgd.163 (triage at M14).
- #407 (loka-y6yg.21, Homestead district) merged. Built huts cannot carry a reaction, so the cot rest bonus does not work
  in a hut: the sign promises only the rug. A seed put into a box no longer sows (non-plot containers are immune; a test
  guards new containers). A player with 0 pennies cannot claim an ordered stew (known limit). Engine gaps in loka-kgd.163.
- #408 (loka-y6yg.18, showcase fixes): the hostile Warden shuts the toll gate when the player enters (shared gate closes
  for all, like gate_lifted); the combat sign's shout gets a Book chip ("ware").
- #408 merged. Homestead blind playtest (loka-y6yg.22) triaged: content fixes .24-.30 batched as loka-y6yg.31
  (Sonnet): no new item source for the croft seed (hint instead), fishing line no longer claims a catch, neutral
  order-open line. Book UI findings in loka-x6t.67 for the polish phase. Playtest harness could not resize to phone width.
- Book bugs part B (loka-y6yg.20, hostile refusal, kernel_api 1.104) building; economy/law E1 (loka-y6yg.23) building.
- #410 (loka-y6yg.31) merged. E1 of #409 approved after a fix (an unlocked yard crate was a penny faucet: now locked).
  Hub sign reads "Four roads and a cellar stair" until the magic district adds the ladder. E2 (theft, wanted, fine) building.
- #411 (loka-y6yg.20 part B, hostile refusal, kernel_api 1.104) MERGED: review + second opinion approved; the schema
  requires hostile whenever a refusal line is present. Unaffordable buy reads "can't afford".
- M14 batch (loka-kgd.164) briefs drafted by Fable, stored in loka-kgd.165-.168 and .147. PM rulings: the trial is a
  narrate reaction plus the jailer's dialogue (no scene; the row text says "scene"); jail is content only on the arrest
  engine; companion remarks read any present NPC (member gate in content); new tags road and marsh; a mount moves only on
  road-tagged rooms; the cell is shared-world (per-instance waits for instancing). kernel_api 1.105-1.108.
- M14 arrest engine (row 35) approved after 2 fix rounds: an arrest is skipped when the move or a sleep would leave a
  water row or encounter behind (that state could not be saved and reopened). Terrain costs (43a) approved; room tags must
  be unique (new error code duplicate_items); entering a water-edge room skips the terrain fare (known limit). Tag-floor gap
  filed loka-kgd.169. Batch branch toolbox/batch-m14 (no PR yet).
- M14 trial (row 35) done in the batch: arrest + charge line + jailer fine (no scene). Engine fix found on the way: a
  currency used only by dialogue payments had no starting balance (fresh.ts). Arrest wording approved by the designer.
  Companion remarks (FD10, 1.107) in review; a perceived NPC's remarks stay visible in a dark room (PM). Jail (36) building.
- M14 batch head e31edbb8 holds rows 35 (trial), 36 (jail: force the grate, stay wanted, climb back in and be charged
  again), 43a (terrain) and FD10 (companion remarks, review + second opinion approved). Mounts 43b-engine (1.108) building;
  43b-content last; then the Fable batch review and one PR.
- M14 mounts (43b engine 1.108 + mount_sampler) approved; designer approved the mount Book text (no indicator: the
  saddled description, the mv fare and the refused exit are the only evidence). PR #412 (loka-kgd.164) opened at
  8c3c8ffd; Fable batch review running on the owner's earlier "Under 70%, go" (usage meter not readable, loka-8zqg).
- #412 MERGED (M14 closed: loka-kgd.164-.168, .147). Batch review APPROVE WITH NOTES; the one doc fix (an arrest leaves
  a ridden horse behind) is in. Filed loka-y6yg.32: the economy guard arrests instead of fighting. M15 batch loka-kgd.170
  (rows 47 loka-kgd.171, G10 loka-kgd.172, FD6 loka-kgd.143); letters stay out unless the drafter shows otherwise; Fable
  brief drafting running. E2 of #409 in Opus review.
- E2 review (#409) APPROVE WITH NOTES: the Book NPC page never listed an NPC's Held items, so stealing worked only in
  tests, not in the Book. Fix round running (reuse the existing Held list; text nits; main merged in). Stuck-wanted
  filed as loka-y6yg.33 (fix with the arrest switch loka-y6yg.32). Law playtest waits for the Held fix.
- M15 briefs drafted (Fable). PM rulings: letters by job stay OUT (the 2026-10-15 record over the 2026-10-14 note;
  OWNER: confirm); a death never costs a level, only experience above the level's threshold (OWNER FYI); item drop =
  items "corpse" or "kept"; notes are one row per character (caps 32 notes, 64 pins, 160/40 characters); pins only
  where you stand in a visited room; the Chronicle shows for every cartridge. kernel_api 1.109 (47), 1.110 (G10 notes,
  save-adjacent: review + second opinion). Rows 47 and FD6 building in parallel; G10 engine, then G10 Book.
- Row 47 (death penalty, 1.109) approved and merged into toolbox/batch-m15 (12f1ad91). Chronicle (FD6) review asked for
  a calendar-based day test (blocker) and the designer's look: lines in ink, milestones in body type, the empty line
  hides when the Chronicle has a day; fix round running. G10 notes engine building (1.110). #409 hosted sim job hits
  its 10-minute limit (the showcase sim test went from 77 s to over 240 s); a developer is finding the cause.
  OWNER (polish): is the one-size step enough to mark a Chronicle milestone, or add a hairline?
- OWNER 2026-10-16: notes and pins (G10) DROPPED from M15 (descoping matrix; only cut chosen). Engine developer stopped,
  WIP discarded; loka-kgd.172 deferred. M15 is now rows 47 and FD6. Other cuts offered (skip the economy/law playtest,
  defer its follow-ups, defer traps) were NOT chosen: those stay in plan.

## Owner answers this session

- 2026-10-22 after the reboot (quoted): "no need to have the web preview we will do everything in storybook for now";
  "how about the retro items, can you work on all of them, any other beads random one offs or cleanups we can batch and
  do before ui polish? im not ready to look at it". This approves loka-x3i0, -59uu, -z2j2, -ei7a, -mluq, -8zqg (8zqg
  edits the owner's status-line config outside the repo: separate tiny change, name the file to the owner). Batches:
  CI (e56t+ei7a), docs/workflow retro, scripts, checks/tests, then the pre-push/hook gate changes alone and last.
  Deferred from the cleanup run: loka-05rv, loka-g53x, loka-2bt2, loka-nwsv.
- 2026-10-22 (quoted): "go ahead" on the PM plan: build loka-kgd.191 (save path; review + second opinion) and
  loka-59uu after the gate batch merges; an Opus designer drafts rulings for loka-p2ey, loka-z2j2, loka-x6t.85 (owner
  answers in the polish session; nothing changes in the Book until then).

- 2026-10-21 (session c5ed3619, quoted): NPC statuses "Line now, page later (Recommended)"; worldbuilding "Lets take over
  thr worldbuilding maybe spin off a subagent to clean it up and comit" (done, #420); retro "ok approve".
- 2026-10-16 (session c5ed3619, quoted): usage "We are at 98% of the 20x max plan right now" + "Land in-flight, stop
  (Recommended)"; "Please fix the mana pool thing"; leak-area improvements "yes please those are good suggestions".
- 2026-10-16 (session 93636711, AskUserQuestion, quoted): descoping matrix "Drop notes and pins (G)" (the only choice).
- 2026-10-15 (session 93636711, AskUserQuestion choices, quoted): Book bugs x6t.27/.28/.32/.33 "Yes, fix with
  showcase (Recommended)" (now loka-y6yg.20); usage "Under 70%, go" (Fable district plan and Fable designer run).
- 2026-10-15 (session 01da56d0, quoted unless marked): usage "69% for weekly usage.  we're good, keep
  going"; "lets have generated residents" + choices "Generated townsfolk (Recommended)", "Authored name
  list (Recommended)"; "Hm lets table settlements for now i think homesteads is a good start and
  settlements can be an expansion later" + "Land engine steps only (Recommended)"; "Can we defer chapter
  carryover until we have a real solid chapter and then a second to carry over into?"; tabled
  "Languages and literacy", "Player writing (public)", "Race and pet growth"; "We want to get to the
  showcase so we can do ui polish" + "Showcase next (Recommended)"; "Lets do ui polish after m15".

- 2026-10-15 (session fc1e2fd7, quoted): "Lets put teh countdown timer on the rings for the icons";
  "yes we want smooth live countdown for the cooldown timer ring"; usage: "we're good just keep going";
  economy tools: "okay lets go with your suggestion" = measuring tools early (after Settle), number-based
  balance tools after M15, authoring tools in the worldbuilding/chapter phase (`loka-kgd.107` notes).
- 2026-10-15 (session 8c186cca, quoted): retro "okay approve all your recs for the retro"; panes audit
  answers "1. yes 2. Yes 3. go with your recommendation" = statuses on Character in batch B; rename to
  "Inventory"; hidden elites SECRET (a hidden skill shows nothing anywhere until the player qualifies).
  Status icons: "Perhaps we can go with status icons like in league of legends"; "lets make it round for
  now, the icons, and no text needed only raphic, and we can design our own with fable or opus or
  something, use place holders for now. Also no text because it will clutter, but if you press and hold
  it, it will show a tooltip that explains what it is".
- 2026-10-15 (session b5fe9338, paraphrased unless quoted): cloud compute no longer needed
  (`loka-2of` closed). Retro items: approved as recommended ("go with your recs"), `loka-8lkq` and
  `loka-iqga` rejected. Homestead: the skill path replaces NPC cooking and building; a paid NPC gives
  only a beginner tier; SWG-style skill trees for many professions ("yes SWO skilltrees sounds good"),
  several hidden elite professions; "GO with all your recs" on: skill tree screen in batch B, a failed
  craft loses its inputs, a skill box costs a trainer coin fee with XP never spent.
- Worldbuilding (`loka-ikch`): our own cosmology and lore from the ground up; it replaces the retired chapter's
  setting (new content uses generic names); a Jedi-like order of cosmic wardens is one hidden elite;
  folder `docs/worldbuilding/`, loose notes in `notes/`; the game opens with "In the beginning of this
  great eon..."; worldbuilding is story and canon only, mechanics and balance live apart (future GDD).
- Chapter 1: not now; showcases first (placeholders for missing lore), then UI polish, then
  worldbuilding, then the official Chapters 1-3; temporary showcases or cartridges to test things are
  fine.

## Open owner questions

- Worldbuilding, first decisions (not urgent: after showcases and UI polish): premise and pillars;
  cosmology shape; magic hardness and cost; Story vs Realm canon. (Hidden-elite secrecy: decided, secret.)
- Workflows/ultracode: not for routine work (PM recommendation); a bounded fan-out only, with explicit
  models, a concurrency cap, worktree isolation and a usage reading before and after.

## Parked (polish lane)

- Open PR #372 (`loka-x6t`, combat playtest findings into the Book spec), branch
  `design/playtest-combat`.
- [Give action plan](plans/loka-x6t.31-give-action.md) for `loka-x6t.31` (Book never offers Give),
  drafted by Pi on 2026-10-13, not reviewed. Known gap: it offers Give to every NPC in the room
  without an engine check that the recipient accepts.
- Book UX from the Fable audit (`loka-x6t.40` to `.52`) waits in the paused polish lane (`.39` word bar
  shipped in #391; `loka-x6t.31` Give is now Homestead hs-8).
