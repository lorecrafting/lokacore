# PM handoff

The PM's session handoff, in the repo so any harness (local Claude Code, Claude Code in the cloud,
Pi) can take over. Live status stays in Beads and GitHub; this file holds only what they do not:
the next steps, the standing owner rules that the repo does not yet state, and open owner
questions. Rewrite it at each stable checkpoint (a merge, a review verdict, a pushed fix) and before
the session ends; commit and push it with the Beads export.

Written 2026-10-15 UTC by Claude Code (Opus 5.5) in local session 01da56d0 (after fc1e2fd7). State at
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

Done this session (01da56d0):
- #402 (`loka-kgd.108`, Homestead batch B) merged (merge 03f3181c, head b3da3d8a green): kernel_api 1.102
  bump `loka-kgd.108.15` (Opus review APPROVE); Fable batch review APPROVE WITH NOTES, one fix round
  (known nits + skill `hidden` gated at 1.102), Fable re-check APPROVE; Fable designer approved the
  book-ui.md Conditions ring text. Slice issues, `loka-x6t.60`, branches, review branches and worktrees
  removed. Record `docs/reviews/2026-10-15-homestead-b-batch-review.md`.
- `loka-mytp` (Settle S3) unblocked: its blocks on `loka-kgd.108` / `.109` removed (those epics stay open
  only for P3 follow-ups `.108.12`, `.108.13`, `loka-trex`, `loka-z4cp`).
- Designer spawns are Fable, never Sonnet (owner 2026-10-15, quoted: "wait sonnet should never be a
  designer, wasn't it fable designer?"); Sonnet only for a live-session picker nit.

In flight: one Fable agent drafts the Settle S3/S4 briefs from `docs/rnd/settle-design-2026-10-14.md`
into the session scratchpad (`settle-briefs.md`); the PM stores each brief in its Beads issue before any spawn.

Next, in order:
1. Settle batch `toolbox/batch-settle` from main: store the Fable briefs (S3-1 charter+arrival, S3-2
   keep+services, S3-3 trade+ledger, S4-1 band, S4-2 protect+reclaim, then the Settle showcase district;
   owner answers in `loka-mytp` notes), kernel_api 1.103, then the usual batch close (Fable review, one
   fix round, merge).
2. Measuring-tools batch: recheck `loka-kgd.107` notes first; 107.1, .2, .5, .8 are already closed, so
   what remains is about `.9` (replay diff as a PR comment) and `.20` (scheduled content graph).
3. M14, M15; number-based balance tools after M15.
4. Follow-ups: `loka-kgd.108.12`, `.108.13`, `loka-trex`, `loka-z4cp`, `loka-x6t.53`, `.54`, `.66`; polish
   items `loka-x6t.56`-`.62` wait for the UI polish phase.
5. Retro items awaiting owner approval: `loka-x3i0`, `loka-59uu`, `loka-z2j2`, `loka-ei7a`, `loka-mluq`,
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
