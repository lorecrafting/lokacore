# PM workflow

The PM's part of the [delivery workflow](WORKFLOW.md): read it after that shared core. Developers, reviewers and designers do not read this file.

## Spawning agents

The PM also sets each spawn's `effort`: high for a reviewer or Fable design
work, the default otherwise ([two-lane CI record](decisions/owner-decision-two-lane-ci-2026-10-09.md)).
An authored brief narrows exploration but never makes save, receipt or protocol work
mechanical. A brief pastes `ast-grep outline` signatures of the files the developer must touch, not whole files ([owner decision](decisions/owner-decision-agent-tooling-2026-10-08.md)). Run independent agents in the background and in parallel (one message,
several spawns); resume an agent with `SendMessage` only for its own scoped fix or
re-check, otherwise spawn fresh with a self-contained brief (worktree, exact base/head,
governing sections, acceptance checks, open findings). Agents keep full logs in a
scratch file and return failing lines or counts.


## Loop

**Keep going.** Once the owner has approved the slice plan, the PM runs steps 2 to 7 to the
merge without asking permission at each step, and settles judgment calls itself. When a
decision is hard, escalate in order: the `advisor` tool; then a Fable subagent; only if both fail to settle it, or it is
critical, stop for the owner ([owner decision](archive/decisions/owner-decision-autonomy-2026-09-30.md)).
A ladder answer is advice to the PM: it never changes a reviewer's finding or verdict and is
never the owner's OK. Critical means what [AGENTS.md](../AGENTS.md) and the owner decisions
reserve to the owner: a product or scope decision, a spec conflict, spending money, a
`--no-verify` push, anything destructive or outward-facing beyond the PR and its merge.
Report at the end of the slice, not at every step.

1. **Plan (PM).** Split the milestone into PR-sized slices, each citing its `docs/system` sections;
   keep [the roadmap](ROADMAP.md) current. The plan marks slices that share no files; the PM may run
   two developers at once on those, each PR with its own fresh reviewer (steps 2 to 7 per slice, [owner decision](decisions/owner-decision-process-speedup-2026-10-03.md)).
   Get the owner's OK on the plan and on any decision that is theirs.
2. **Brief (PM).** An Opus subagent drafts briefs and stage slice plans so the PM session
   stays thin; the PM decides ([owner decision](archive/decisions/owner-decision-review-rules-2026-10-01.md)). Name the branch; do not check it out (the developer does, in its own
   worktree). Spawn `developer` (`model` per the [routing table](WORKFLOW.md#work-routing)) with a self-contained brief: goal, its [lane](WORKFLOW.md#delivery-lanes),
   `docs/system` sections (the clause for each behavior; an archived plan for new work), files in and out of scope, acceptance (which checks and fixtures must
   pass, which red controls to add, mutation cases, literal expected values), the relevant `docs/lessons/` file, and anything the owner
   decided, and a scope trigger (what makes the developer stop and ask, for example an unplanned
   protocol change with new behavior). The PM splits plan rows sized L into two briefs, and a brief holds one M-size toolbox item (or its engine and Book halves) per developer run, never a batch of three (loka-kgd.11 needed four runs); an M engine row that adds both a new schema field and a sampler also gets two briefs, engine then content (loka-3jhb); a showcase slice holds at most about 2 plan steps or 3 rooms, and the PM merges `main` into the batch before briefing (loka-7m2u); every brief states the
   handoff threshold up front ([Claude Code specifics](WORKFLOW.md#token-hygiene)) and links the [brief kit](guides/brief-kit.md) instead of copying it.
   The drafter of a plan or brief cites, for each acceptance row, the engine `file:line` that makes it possible (the long-wait rule names its delivery kind) and, for each Book-visible promise, the `docs/system` clause that allows it (loka-d89z, loka-3a96). Obsolete development fixtures may be updated under the
   [forward-development decision](decisions/owner-decision-forward-development-2026-10-05.md).
   Store the brief durably when it is drafted, one home per kind, and before the spawn (the PM checks the Beads notes first; a developer lost to a limit left its brief only in a scratchpad, loka-ydy): a slice brief and its design input
   live in that slice's Beads issue notes (`br update <id> --append-notes`); `docs/briefs/` holds only
   milestone or gate plans that several slices or reviewers link to. A scratchpad copy is only a working file. Beads text uses repo-relative paths and worktree names,
   never absolute or home-relative paths. Before ruling on an owner-approved item, read the owner's
   approval note and cite it, not the proposal text. Link process rules (AGENTS.md,
   WORKFLOW sections, the role files), never copy them; write out only the slice's own rules.
   A ruling made after drafting edits the brief's body in place and deletes the text it replaces, so the brief
   always reads as one current spec; never append a "rulings override the body" section. The dated ruling and its
   source go in the Beads notes ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).
   Add a timebox only for open-ended work:
   at the limit the developer stops and returns partial findings.
   Mechanic briefs include the [composition record](system/architecture.md#building-mechanics-by-composition).
   When an offered action changes, name its exact key, resolved command, ordered targets and
   input, the shared admission query used by both execution and GameView, and a controlled
   view-to-invocation check for any new availability rule. Where authored keys may differ from
   commands, include such an alias in that check. Reuse an existing same-layer check if it
   catches that break.

Step 3 (build and self-review) is in [WORKFLOW](WORKFLOW.md#loop).

4. **Verify and review.** PM does not relay claims: for a pushed PR it confirms the push started
   `ci.yml` and `book-e2e.yml` on the head (`gh run list --branch <branch>`) and starts review
   right away, without waiting for them; for
   provisional local work it verifies the focused-check evidence and can spawn
   review after the local merge. Then it spawns a *fresh* `reviewer`
   with the PR number (or local branch, base and exact head), the brief and the cited sections. The reviewer derives the
   requirements from them before reading the diff, checks the [composition record](system/architecture.md#building-mechanics-by-composition)
   against the actual consumer and diff, checks changed actions' exact offered invocations
   against keyed admission, and tests the tests by breaking
   the logic temporarily. For a slice that changes save, protocol or kernel contracts it writes
   `docs/reviews/<date>-<slice>-review.md` and regenerates [the index](reviews/README.md) with
   `bin/review_index.sh`; every other slice (polish, toolbox, docs) gets its findings as PR
   comments and no record ([two-lane CI](decisions/owner-decision-two-lane-ci-2026-10-09.md)).
   It returns the findings. The PM never pushes the record into the PR: that push cancels the developer's CI run;
   a fix round carries it, otherwise `bin/after_merge.sh` does (loka-o0pw).

Steps 5 and 6 (fix, re-review) are in [WORKFLOW](WORKFLOW.md#loop).

7. **Merge (PM).** Merge with `bin/merge_pr.sh <PR> <beads-id[,...]> ["ROADMAP status: ..."]` (waits on `bin/wait_ci.sh` for the head, merge commit with `--match-head-commit`, then `bin/after_merge.sh`) once the verdict is
   APPROVE or APPROVE WITH NOTES with nothing open on the exact pushed head (a small should-fix needs no fix round:
   [WORKFLOW step 6](WORKFLOW.md#small-should-fix)), and `ci.yml` and
   `book-e2e.yml` are green on that head (every push runs them; `--match-head-commit <sha>`;
   [two-lane CI](decisions/owner-decision-two-lane-ci-2026-10-09.md)). A job cancelled at its timeout is red,
   a superseded run is not: `bin/merge_pr.sh` prints `bin/ci_timing.sh <head>`: cancelled jobs (name, seconds) of that head and of the nightly runs, and the sim leg times and medians, so compare each with its `timeout-minutes`. Judge a sim time against the median of the last 5 `main` runs of that leg, never one run (runners are two-speed: 280 s and 540 s on the same code, loka-9nd4). An E-gate closure or the
   release candidate also needs E1 coverage complete for the real chapter, its harness rebuilt with that chapter ([owner rules](system/owner-rules.md)). Merge `main` into the
   branch once before marking the PR ready. A red nightly on `main` is the next session's first job.
   After the last of several close merges, run
   `bin/sync_pr.sh <branch>` once for every open PR (merges `origin/main`, regenerates the review index on a conflict there, docs check, push); then check `docs/decisions/README.md` order (newest first) by hand, as it is only union-merged.
   The owner, or the PM when the owner asks or for status-only commits (ROADMAP status lines,
   Beads export, decisions index lines, the [PM handoff](HANDOFF.md)), may push to `main` directly; never for unreviewed code or past a red check. Before `bin/merge_pr.sh` the PM edits the
   ROADMAP status-only lines (slice done, PR link, slice count) uncommitted and passes the subject; the script commits them on `main`; any other
   ROADMAP change goes through a PR ([owner decision](decisions/owner-decision-process-speedup-2026-10-03.md)).
   `bin/after_merge.sh` (run by `bin/merge_pr.sh`) does that bookkeeping after the PM's
   ROADMAP edit: pull, cherry-pick a records-only `review-<N>` not yet in `main`, close the issue, remove the worktree, branch and `review-<N>`, commit, push. Then tell the owner:
   PR link, verdict, notes; cite every PR as #N (Beads id, short description). Owner decisions, and anything still open after fix round 2 and the
   escalation ladder, go to the owner. If the slice taught a lesson, record it as
   [AGENTS.md, Hard-won lessons](../AGENTS.md#hard-won-lessons) says, and only if it changes a
   future decision and survives code drift; if a check could enforce it, write the check instead.

### Review knowledge trail

At each reviewed merge, retain the finding, fix disposition and exact source head
in the review record. Link a lasting interaction rule from its owning active spec
(including [Book UI](system/book-ui.md)), a recurring implementation hazard from
the relevant [area lesson](../AGENTS.md#hard-won-lessons), and an enforceable
invariant from its red-controlled check. Link unfinished work back to the finding
from the roadmap or adopted task tracker. The review record stays the evidence;
other records state only the reusable rule or next action, avoiding copied findings
and speculative generalizations ([owner decision](decisions/owner-decision-review-knowledge-trail-2026-10-05.md)).
Once the work closes, fold any recurring class into its lesson; the record may then be
deleted and linked by permalink ([move forward](decisions/owner-decision-move-forward-2026-10-07.md)).

### Beads Rust

Beads Rust ([adopted](decisions/owner-decision-beads-rust-pilot-2026-10-06.md), made permanent by the
[owner](decisions/owner-decision-claude-only-auto-merge-2026-10-07.md)) tracks the Chapter 1 slices in `.beads/issues.jsonl`, plus
concrete, evidence-linked audit follow-ups under the [owner's extension](decisions/owner-decision-beads-audit-followups-2026-10-06.md)
(the [export check](CHECKS.md) guards completeness, paths and IDs). Install, sync, path hygiene,
the board view and hooks: [Beads operations](BEADS.md).
The PM owns tracker writes; builders and reviewers report through
the usual brief and review record. `docs/ROADMAP.md` remains the published status
and completion count, briefs own scope, reviews own findings, and this workflow
owns merge gates. Beads holds short current status, links and dependencies only.
At review approval the PM collapses a row's notes to a two-line current state (head, record, open follow-ups); the history stays in the review record.
A batch's run order lives in a `batch-order` label and a notes line, never `br dep add`: a blocked issue cannot be marked `in_progress`, so the owner's PROG view would miss it (loka-gfgr).
An active issue's status stays `in_progress` until the reviewed merge to `main`; its notes say where the slice is (no stage labels).
Keep one PM writer across worktrees/clones; `br` run from any worktree uses the integration
checkout's database and JSONL, so commit tracker changes from that checkout, not a slice branch.
A Claude Code session starts with `bin/session_status.sh`, so Beads, not a memory file, holds current status.
When a reviewed brief starts building, the PM marks its ready issue
`in_progress` with `br update <id> --status in_progress` and keeps its current
source/review links in the issue. After the source is reviewed and merged to
`main`, the PM uses `br close <id> --reason "Merged <PR or local merge>"` and
checks `br ready --brief --json` for newly unblocked work. A provisional review
or green local test alone does not close a slice. Ad hoc findings that need
follow-up become linked issues only when they are real work; the review record
keeps the finding and disposition. Beads gate records are not used; CI and
review records own the gate evidence.
No source merge or CI gate depends on `br`; the export check guards the JSONL.

## Delivery lanes

Batch pushes and PRs ([owner preference](decisions/owner-decision-skip-ci-on-drafts-2026-10-07.md)):
one push per wave, not per small change. Collect tracker, process and docs changes into one
housekeeping PR per session, or into the next real PR. Briefs of parallel contract rows assign each row's `kernel_api` version up front, so merge conflicts stay one line (loka-btpd).

Provisional local lane: one integration owner for local `main`; source branches, plans and reviews
each in their own worktree; the owner's checkout and remote `main` stay untouched. Record each
provisional merge SHA in the next handoff and start the next dependency-ready slice while review
runs. Fix findings on the original branch and merge the fixes with their review records; a slice
is complete only when its findings close, and a later source edit gets the usual scoped re-review.
Integrate one branch at a time; when branches share a cartridge release, generated contract, save
schema or portable primitive, fix the integration order first and derive each successor pin after
its predecessor lands. Never have two agents edit one worktree or treat parallel green checks as
proof of the combined head. A local check is not hosted CI proof. A settled small spec change may
be committed before code on the same branch and reviewed with the complete outcome; cross-mechanic
or save planning still gets a focused review when it prevents rework.

### Live polish session

The PM routes each prompt. **Nit** (one place, existing tokens only: which token a style uses,
alignment, a value inside one component, a label's wording): designer on Opus. **Design** (a token
value, a new token or component, hierarchy, typography, colour or composition, several components, a
feel request): designer on Opus (Fable only for something without precedent). The
owner forces the Fable designer with a `fable:` prefix.
The owner's "Close batch", or a PM suggestion, ends the batch: with five or more nits, Opus
skims their diffs once; `bin/polish_session.sh close` pushes and opens the PR;
one Opus `reviewer` quick pass as PR comments; the PM merges on green hosted runs. Batches stay open liberally; close early only for a critical
item or too much complexity. Mechanics, save, protocol or engine items leave the session as Beads issues.

## Token hygiene

- At each handback and review completion the PM appends a Beads note `COST <role> <model> <tokens>` from the completion notice; the batch merge note sums them.
- At session start and before a fan-out of 3+ agents or a Fable run, it reads `~/.claude/usage-cache.json` (`five_hour` and `seven_day` `used_percentage`, `resets_at`, `written_at`; the owner's status line writes it) instead of asking the owner; the numbers are stale when `written_at` is old (loka-8zqg). Near the cap: see the Budget line in [owner rules](system/owner-rules.md#process).
- The PM spawns a new agent only while `uptime`, run in its own call (the one exception to batching), shows load under 8 (`bin/agent_load_gate.sh` enforces it), at most 5 agents with 3 running tests (owner 2026-10-10).
- The PM, like a developer after its push ([Every agent](WORKFLOW.md#ci-is-the-full-suite)), waits with `bin/wait_ci.sh <sha|branch>` in the background (one line per workflow; exit 0 only when all succeeded; a branch waits on its fetched origin head). On red, `bin/ci_fail.sh <sha|branch>` prints only the failing lines; send those as the finding.
- Delegate mechanical work. At a stable publication checkpoint, update the
  roadmap, Beads and shared handoff before a fresh session; do not reset during
  an open review merely to shorten context.
- PM state file: labeled "AS OF PR #N"; cite every PR as #N (Beads id, short description); one "Open objectives" line; owner words only verbatim
  or marked "(paraphrased)"; keep `file:line` pointers and exact errors; drop spent exploration.
- A subagent compacted by the built-in compaction may be resumed. The 2026-10-14 duplicate-id 400
  came from the `fast-jev-compaction` plugin, now off (loka-bwfo). A design note ends its agent: the build is a fresh spawn with the approved note (loka-2ti3).
- When weekly usage is above about 80%, the PM shows the owner the remaining-work matrix before a Fable batch draft (loka-wdkt).
- A second opinion on a slice runs on the head after the main review's fix round, never in parallel
  on a head the main review already failed (one full review saved per blocker round).
- Start a new slice agent with a self-contained brief and no inherited chat
  history; keep a visited path/revision list while following doc links. Reuse
  developer and reviewer context for scoped fixes only while it stays small.

Start a fresh developer and independent reviewer for each new
slice from `.claude/agents/`; resume the same agent only for that slice's scoped
fix/recheck while its context remains small. Send full check output to a
scratchpad and return the short result specified by each role prompt. Before
clearing or starting a new Claude session, write the same exact-head/open-finding
handoff, naming any agent still running, and the [retro](#retro-and-housekeeping-queue); on takeover read that handoff once and reopen only changed sections (the
decisions index is not part of it). Before spawning for a handed-off branch, check its worktree's last commit
(`git -C <worktree> log -1 --format=%cr`), the branch's remote and PR (`gh pr list --head <branch>`) and `ListAgents` for a live
agent on it (a second developer spawned beside a live one in the same worktree, loka-mlok).

This preserves the brief, review records and failing evidence on disk;
compaction or a fresh session never substitutes for a reviewed merge or
silently closes unfinished work.

Claude Code specifics:

- No `CLAUDE.md` changes mid-session (they bust the prompt cache). Plugin changes are allowed; each costs one cache rebuild.

## Milestone gate

A gate is slim ([owner decision](decisions/owner-decision-slim-gates-2026-10-02.md)): the owner's
play or test when the stage has something touchable; one fresh Opus audit (Fable for E2–E3) of the stage's riskiest
code; and a short checklist, checked by one reviewer without narrative (no second review of a docs-only gate PR). The checklist: every spec proof linked, every carry in a stage row,
and the docs tidy pass over the docs changed during the milestone (not `docs/archive/`, nor review
or decision records, which are history): a fact stated
in two places (keep one, link to it), a lesson that is stale or now enforced by a check, a doc
turning into a catch-all. Findings are fixed in the gate PR. The checklist also records the pattern retro done (link; see
[Retro](#retro-and-housekeeping-queue)).

## Retro and housekeeping queue

A retro item is an improvement candidate backed by evidence (run id, token count or `file:line`) and
an expected saving; at most 5 per retro ([owner decision](decisions/owner-decision-process-tightening-2026-10-08.md)).
- **When:** at every handoff, including an early clear the owner asks for, the PM writes the handoff and
  the retro. At each milestone gate (E3, release-candidate certification, release) a pattern retro: a
  Sonnet subagent reads the housekeeping issues, review records and `gh` CI timings since the last gate
  and proposes at most 5 cross-session items. The PM prompts it when a gate PR merges.
- **Beads:** `bin/br_create.sh -l housekeeping --description-file <file>`; `br list -l housekeeping` shows the queue. The owner approves: approved items go
  to the next housekeeping PR, rejected ones to `br close` with the reason.
- **Reminders:** `bin/session_status.sh` lists open housekeeping issues, prints "Before you clear: ask the
  PM for handoff + retro", and notes a missed retro when no housekeeping issue is newer than the last
  merge on `origin/main`. The PM reminds the owner of the retro when suggesting a wrap-up or when
  context is large.

## Git hygiene

- `.gitattributes` merges `docs/decisions/README.md` (an append-only list) with
  `merge=union`, so two branches that each add a line merge with no hand edit. GitHub's mergeability
  check may still report a conflict, so the PM still merges `main` locally and checks the merged index for order (`bin/check_docs.exs` fails a duplicate, twice-edited or missing line).
  `docs/reviews/README.md` is generated by `bin/review_index.sh`: a conflict there is resolved by
  rerunning it (`bin/sync_pr.sh` and `bin/after_merge.sh` do).
- Agent types in `.claude/agents/` register only when a session starts. If one is missing,
  spawn `general-purpose` and tell it to follow the definition file.

## Review stance

If a step keeps finding nothing across slices, the PM proposes dropping it to the owner.
