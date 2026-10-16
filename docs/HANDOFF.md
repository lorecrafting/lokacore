# PM handoff

The PM's session handoff, in the repo so any harness (local Claude Code, Claude Code in the cloud,
Pi) can take over. Live status stays in Beads and GitHub; this file holds only what they do not:
the next steps, the standing owner rules that the repo does not yet state, and open owner
questions. Rewrite it at each stable checkpoint (a merge, a review verdict, a pushed fix) and before
the session ends; commit and push it with the Beads export.

Written 2026-10-15 UTC by Claude Code (Opus 5.5) in local session fc1e2fd7 (after 8c186cca). State at
writing: see "In flight" below.

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

Mechanics toolbox (epic `loka-kgd`, [MECHANICS-TOOLBOX.md](MECHANICS-TOOLBOX.md)) is the build lane;
Storybook polish (`loka-x6t`) stays paused. The PM decides mechanics calls itself and records them in
Beads notes. Owner product order ([record](decisions/owner-decision-product-order-2026-10-15.md)): **no Chapter 1 yet**; finish
all showcases (placeholders where lore is missing), then UI polish, then worldbuilding, then the
official Chapters 1-3; temporary test cartridges or showcases are welcome any time.

Done this session (fc1e2fd7), all on batch B `toolbox/batch-homestead-b` (worktree
`../worktrees.noindex/batch-homestead-b`, head 71bda8c1, NO PR yet; each slice green on its own head):
- `loka-x6t.64` status kind (fix round: authored debuff on gored and scar; record review-x6t-64).
- `loka-x6t.65` engine: `ConditionView.duration` (owner: "Lets put teh countdown timer on the rings
  for the icons"). Book half shipped inside x6t.55.
- `loka-kgd.108.14` hidden elites secret: lesson choices hidden in dialogue, loader refuses
  qualification/policy/label/riddle reading or teaching a hidden skill, save rows accept the narrowed
  `choice_ids` (save change: second opinion, records `2026-10-15-kgd-108-14-*`).
- `loka-x6t.55` part 2: status icon row (round, graphic only, placeholder glyphs, hold/focus tooltip,
  tap opens Character, 5 then +N), countdown ring (plain React Native, no Skia), "Inventory" rename.
  Designer and reviewer approved; no record (Book).
- Earlier batch B slices (session 8c186cca): hs-13, hs-6, hs-12, hs-7, hs-8, hs-14.
- Slice issues stay open until the batch PR merges; `loka-x6t.60` closes then too (notes).

In flight: none. hs-9 is briefed (`loka-otn4` notes: full brief, PM rulings Q1-Q4) and waits only for
the owner's usage reading (owner asked: read the usage meter before hs-9 and before the Fable batch
review; the PM cannot read it: the meter reaches only the status line).

Next, in order:
1. hs-9 raze (`loka-otn4`, save: second opinion) from the batch head, after the usage reading.
2. Batch close: bump kernel_api to 1.102 for every batch B gated feature (they reuse 1.101, which
   main already carries; move their loader_floors cases; showcase and scars `at_least` move with
   them), merge `main` into batch B, open the draft PR, one Fable review of the batch head (usage
   reading first), fix round including: the hs-8 nit (mechanics.md "Give pairs" says the rule does not
   check sight; actions.ts rejects a hidden recipient); `docs/showcase/combat-district.md:51` says
   1.48; `kernel/ts/src/view/resources.ts:59` polarity computed twice; `status.test.ts:149` duplicate
   row; `docs/system/cartridge.md:1773`; book-ui.md:989 Conditions text does not say the locked ring
   goes quiet; `selection.ts:62` hidden-lesson check copied three times. Then ready, CI green, merge,
   `after_merge.sh`, close the slice issues, delete branches and worktrees (`toolbox/hs-*`,
   `toolbox/x6t-*`, `toolbox/kgd-108-14`, `review-hs-*`, `review-x6t-64`, `review-kgd-108-14*`).
3. Housekeeping PR (owner approved 2026-10-15: "okay approve all your recs for the retro"):
   `loka-0fhi`, `loka-ujau`, `loka-vro5`, `loka-zgqt`, `loka-df49`, `loka-7p2w`, plus `loka-stzq` and
   the Jev record. Not yet approved: `loka-x3i0`, `loka-59uu`, `loka-z2j2` (condition labels lowercase).
4. A docs PR with decision records: hidden-elite secrecy (secret), "Inventory" rename, status icons
   (round, graphic-only, hold tooltip, countdown ring), Skills stays on Character until a second
   profession (audit).
5. Then Settle S3 `loka-mytp` / S4 `loka-oxgk` (Fable briefs), M14, M15. Polish items from the audit
   (`loka-x6t.56`-`.62`) wait for the UI polish phase.
6. Follow-ups: `loka-kgd.108.12`, `.108.13`, `loka-x6t.53`, `.54`; Book follow-ups from x6t.55 (Book.tsx:222
   a tap on Character pushes a second Character page, as Contents does; "opens Character" literal with
   no `LABEL.character`; native check of the ring seam at 6 o'clock); older as before.

Brief kit: every brief pastes the COMMON block and Realm checklist stored in the `loka-kgd.108` notes
("BRIEF KIT").

Merge mechanics: `bin/pm_merge.sh <batch-worktree> <batch-branch> <slice-branch> <review-branch or the
sha> "<subject>" <reviewed-sha>` (refuses a non-green sha). It stops on stacked additive conflicts in
`loader_floors.json`, `mechanics.md`, `MECHANICS-TOOLBOX.md` and the gen files (retro `loka-0fhi`):
merge by hand, keep both sides, run `elixir bin/contracts.exs`, `bin/review_index.sh`, focused tests,
push. Batch worktree: `../worktrees.noindex/batch-homestead-b`. `bin/after_merge.sh` now works with the
owner's untracked `scripts/`.

Session lessons (2026-10-15, b5fe9338 and 8c186cca):
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

## Owner answers this session

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
- Worldbuilding (`loka-ikch`): our own cosmology and lore from the ground up; it replaces the Ashmere
  setting (new content uses generic names); a Jedi-like order of cosmic wardens is one hidden elite;
  folder `docs/worldbuilding/`, loose notes in `notes/`; the game opens with "In the beginning of this
  great eon..."; worldbuilding is story and canon only, mechanics and balance live apart (future GDD).
- Chapter 1: not now; showcases first (placeholders for missing lore), then UI polish, then
  worldbuilding, then the official Chapters 1-3; temporary showcases or cartridges to test things are
  fine.

## Open owner questions

- Worldbuilding, first decisions (not urgent: after showcases and UI polish): premise and pillars;
  cosmology shape; magic hardness and cost; Story vs Realm canon. (Hidden-elite secrecy: decided, secret.)
- Approve new retro items `loka-x3i0` and `loka-59uu` (PM recommends both).
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
