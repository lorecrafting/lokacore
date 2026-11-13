# PM handoff

The present only: open work, next steps, owner questions, and standing owner rules the repo does not state
yet. Rewrite this page in place once per session, at its end; never add dated session sections. History lives in git, Beads and `docs/reviews/`; lessons
go to [PM lessons](lessons/pm.md) ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).

AS OF main after #722; written 2026-11-13 08:30 UTC in the Pi harness by deploy/deepseek-ai/deepseek-v4.1-flash-1017, PM session.
`kernel_api` is 1.159 (no contract slice since). **The owner is taking about a month off and pausing the subscription
(2026-11-07).** Nothing is mid-merge, nothing is in flight, no agent is running.

## Direction (owner 2026-10-30 to 2026-11-07)

- **Pro low-token workflow** (owner 2026-11-07): one session does small slices itself; at most one developer at a time; a separate reviewer only for engine, save, contract or compiler-facing slices; no mutation runs on editor polish.
- **The prologue is v1** (epic loka-g5hh). The owner builds **Part 1** in the editor, in `cartridges/prologue/` (**uncommitted on purpose**). Start: `bin/author.sh`; restart it after each merge.
- **The owner writes every player-facing word**; agents use `~`. Polish feedback goes to Beads under loka-wfrgk; fixes batch on the owner's go; blockers are fixed at once.
- **Card bar:** a card never offers or writes what the compiler refuses; gates go two ways with the compiler `file:line`.
- NPC routines (loka-ni2zd) wait for the owner's own design session.

## Merged since the 2026-11-07 handoff

#707 to #714 are in the previous handoff (scene structure S1/S2, the field guide, the pre-push gates, focus rules,
`session_status.sh`). Newer: #715 S3, a choice's key pinned when its words change (loka-wfrgk.100.5.4, closed); #716 R1,
replay saved paths against the artifact you edit; #717 W1, `bin/loka roam`; #718 `wait_ci.sh` resolves a short sha; #719 D1,
the Step tab (in-play debugger); #720 and #721 K2, reaction `once`/`cooldown` and the policy capability it needs
(loka-wfrgk.100.5.3, .115.4 closed); #722 **C1, the consequence preview of a choice** (loka-wfrgk.115.5, closed).
C1 shipped two model fields the rest of the story tooling will want: `reach.ts` edges now carry `value` and every policy
`leaf` (with `neg`), and `story.ts` links carry the `choice` a `choice_resolved` named — read
`kernel/ts/play/consequences.ts` before writing another walk over that graph. Its review record is
`docs/reviews/2026-11-13-c1-consequences-review.md` (CHANGES REQUIRED then APPROVE on re-check; all four findings fixed).
`kernel/ts/test/live.test.ts:145` (`500 !== 404` for `/open ../none.json`) is now a four-time flake, still unfixed (loka-fq96k).
Untracked `cartridges/prologue/` is the owner's in-progress Part 1: never touch it, read it only.
`docs/system-graph.gen.json` regenerates from it, so keep that file out of a commit while the scratch cartridge is present.

## In flight at handoff

Nothing. The next slice starts from main.

- **#632** (loka-vduxr.64) belongs to another session (lokacore-fb). **#454** is the owner's P3 hold.

## Resume, in order

1. Story tooling epic **loka-wfrgk.115**, children .1 to .12 chained in the owner's order: R1, W1, D1, K2, C1, L1 + L2, W2,
   F1 + W4, R2, K1, then W3 and E1 before v1. Done: R1 (#716), W1 (#717), D1 (#719), K2 (#720, #721), C1 (#722).
   **loka-wfrgk.115.6 (L1 + L2, story-logic lints in Elixir) is next** and it takes a reviewer; three lint rows plus L2b as
   a warning, specs at `docs/design/story-tooling.md:149` and `:239`. Then W2 (.7, blocks on .6).
2. Older P1s: loka-wfrgk.94, loka-wfrgk.100.8 (key-tagged Book lines), loka-wfrgk.100.4.
3. Housekeeping PR: loka-ebnu3, jqxb8, grdiq, wfrgk.96, and the retro items (below).
4. P2 editor items: .97, .98, .99, .102 follow-ups, map handle placement, `bin/loka new` duplicate keys (loka-wfrgk.68).

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

**2026-11-13 (two items):** loka-qozwj (the panel suite's parallel default races one dev server: run it
serial, one line) and loka-8v4lx (name the reviewer fallback model in WORKFLOW and the loka-review agent
instead of justifying a substitution per slice).

**2026-11-11 (three items):** evidence in each: loka-x4ejm (session_status does not print a PR head's CI conclusion — **done in #714**),
loka-y043w (the drift check calls a missing `external_ref` "no Beads issue": three false alarms a session),
loka-r7vrx (the queue is 75 open with duplicates and nothing closed since 11-07).
loka-4ks2l was approved and is merged (#709). Closed `loka-wfrgk.116` as a duplicate of `loka-za8br` while filing. The
2026-11-07 items are still open and unapproved; three of them closed with #710 (lvo9i, wfrgk.110, za8br).

## Learned this session (worth knowing next time)

- **A same-file second edit can silently revert the first.** Two `edit` calls on one file in one turn left the region as
  the *original* text; only reading the file back caught it. After a double edit on one file, read the region.
- **The panel suite passes serially and fails in parallel on this machine.** `node --test test/*.test.ts` (the CI and
  `npm test` default) gave 63/66 on C1: three unrelated card/room tests fail on one shared dev server and Chrome with
  load 2+. `node --test --test-concurrency=1 test/*.test.ts` gave 66/66. Judge a panel failure on the serial run before
  blaming the diff; the hang variant is loka-0ske4 (a comment now records this evidence).
- **`bin/subagent` async children are broken in this harness install** (`@earendil-works/chord` missing); a blocking
  `async:false` run works. The spawn also refuses at load 8+, so check `uptime` first.
- **Opus reviewers were unavailable all session** (anthropic OAuth expired, antigravity quota, no OpenRouter credits), so
  C1's review and its re-check ran on `openai-codex/gpt-5.6-luna`; the record states that in its own section.
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
- Three worktrees hold commits that are **not** in main and no PR: `design-playtest` (`design/playtest-combat`,
  4ae8f6878), `settle-3` (above), and `s3-choice-key-review` (827c997d1, a CHANGES REQUIRED record for S3 that #715
  superseded — stale, prunable). Every other worktree sits at a commit that is an ancestor of main, except the two
  open-PR ones (`tools-ts-lsp` is #632, `toolbox-batch-engine-bugs-e2` is #454), and is prunable. `loka-vduxr.10-second` holds three
  untracked probe tests (`kernel/ts/test/zz_dead.test.ts`, `mobile/authority/local-story/zz_esc.test.ts`,
  `zz_probe.test.ts`) and `playtest-sweep` untracked logs, a report and shots; read before removing either.

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
