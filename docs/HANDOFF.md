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

Done this session (fc1e2fd7):
- On `main`: #400 (`loka-0fhi` and six more retro items, housekeeping 2026-10-15: merge_resolve unions
  additive appends, `bin/push_slice.sh <worktree> <branch>`, developer/reviewer rules, COST notes,
  usage check) merged; #401 (`loka-kgd.107` and others, decision records 2026-10-15: secrecy, Inventory
  and status icons, economy tools split; Skills placement as a PM decision) merged.
- Batch B `toolbox/batch-homestead-b` (worktree `../worktrees.noindex/batch-homestead-b`, head
  2910c69b, NO PR yet) is COMPLETE: every slice reviewed, each green on its own head:
  hs-13 `.108.10`, hs-6 `.108.6`, hs-12 `.108.9`, hs-7 `.108.5` + `loka-kgd.70`, hs-8 `loka-x6t.31`,
  hs-14 `.108.11` (session 8c186cca); this session `loka-x6t.64` status kind, `loka-x6t.65` duration
  + smooth countdown ring, `loka-kgd.108.14` hidden elites secret (save: second opinion),
  `loka-x6t.55` part 2 status icon row + Inventory rename, hs-9 raze `loka-otn4` (save: second
  opinion). Handbacks, rulings and COST lines are in each issue's notes.

In flight: none. No agent running.

Next, in order:
1. Batch close (the PM reads no usage meter: owner said 2026-10-15 "we're good just keep going"):
   a. One Opus developer: bump kernel_api to 1.102 for every batch B gated feature (they reuse 1.101,
      which main already carries): `world.ts`/Elixir floors, loader_floors cases, the samplers'
      `at_least` (showcase and scars move too), hash fixtures; rerun every floor mutant of shared
      samplers (loka-59uu lesson). Branch from the batch head, pm_merge after review.
   b. Merge `main` into batch B (it now has #400 and #401), open the draft PR.
   c. One Fable review of the batch head.
   d. One fix round with the Fable findings plus these known nits: hs-8 mechanics.md "Give pairs"
      says the rule does not check sight (actions.ts rejects a hidden recipient);
      `docs/showcase/combat-district.md:51` says 1.48; `kernel/ts/src/view/resources.ts:59` polarity
      computed twice; `kernel/ts/test/status.test.ts:149` duplicate row; `docs/system/cartridge.md:1773`;
      book-ui.md:989 Conditions locked ring wording; `selection.ts:62` hidden-lesson check x3;
      mechanics.md:3389 known limit: a corpse blocks raze for good (link `loka-kgd.122`); the
      secrecy decision record links the hs-14 "Load check" section once it is on main.
   e. Ready, CI green, merge, `bin/after_merge.sh`, close the slice issues and `loka-x6t.60`, delete
      branches and worktrees (`toolbox/hs-*`, `toolbox/x6t-*`, `toolbox/kgd-108-14`, `review-hs-*`,
      `review-x6t-64`, `review-kgd-108-14*`, `review-hs-9*`).
2. Then Settle S3 `loka-mytp` / S4 `loka-oxgk` (Fable briefs); then one small measuring-tools batch
   (`loka-kgd.107` notes: 107.1, .2, .5, .8, .9, .20); then M14, M15; number-based balance tools
   after M15 (owner split; record `owner-decision-economy-tools-split-2026-10-15.md`).
3. Follow-ups: `loka-kgd.108.12`, `.108.13`, `loka-x6t.53`, `.54`; Book follow-ups from x6t.55
   (Book.tsx:222 a tap on Character pushes a second Character page, as Contents does; "opens
   Character" literal with no `LABEL.character`; native check of the ring seam at 6 o'clock); polish
   items `loka-x6t.56`-`.62` wait for the UI polish phase.
4. Retro items awaiting owner approval: `loka-x3i0`, `loka-59uu`, `loka-z2j2`, `loka-ei7a`, `loka-mluq`,
   `loka-8zqg` (PM recommends all).

Merge mechanics: `bin/pm_merge.sh <batch-worktree> <batch-branch> <slice-branch> <review-branch or the
sha> "<subject>" <reviewed-sha>` (refuses a non-green sha). It stops on stacked additive conflicts in
`loader_floors.json`, `mechanics.md`, `MECHANICS-TOOLBOX.md` and the gen files (retro `loka-0fhi`):
merge by hand, keep both sides, run `elixir bin/contracts.exs`, `bin/review_index.sh`, focused tests,
push. Batch worktree: `../worktrees.noindex/batch-homestead-b`. `bin/after_merge.sh` now works with the
owner's untracked `scripts/`.

Session lessons (2026-10-15, b5fe9338, 8c186cca and fc1e2fd7):
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
- Approve retro items `loka-x3i0`, `loka-59uu`, `loka-z2j2`, `loka-ei7a`, `loka-mluq`, `loka-8zqg` (PM
  recommends all; `loka-8zqg` touches the owner's status-line config).
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
