# Delivery workflow: PM, developer, reviewer

Every milestone slice (one PR) runs through the PM, developer and reviewer roles; UI-changing
slices also use the designer. Claude Code runs them as the
main session plus the subagents in [`.claude/agents/`](../.claude/agents/developer.md).
[AGENTS.md](../AGENTS.md) rules apply to every role.

| Role | Who | Model | Owns |
|---|---|---|---|
| PM | the main session | the owner's choice | plan, slices, briefs, owner contact, merges |
| Developer | [`developer`](../.claude/agents/developer.md) subagent, one per slice | Claude: per the [routing table](#work-routing). | code, checks, self-review, opening the PR, fixes |
| Reviewer | [`reviewer`](../.claude/agents/reviewer.md) subagent, fresh per slice | Claude: `opus`; Fable for E2–E3 gate closures (E1: see the fix re-check row). | independent review, review record |
| Designer | [`designer`](../.claude/agents/designer.md) subagent, fresh per review | Claude: Opus; Fable for the polish phase ([owner decision](decisions/owner-decision-designer-fable-2026-10-08.md)) | Book UI design system and spec text, UI brief input, design review ([owner decision](decisions/owner-decision-designer-role-2026-10-07.md)) |

**Models** ([owner decision](decisions/owner-decision-claude-only-auto-merge-2026-10-07.md)):
Claude Code runs every role. A slice is reviewed once, with a narrow fix check, by a
reviewer on the highest Opus; Fable reviews only the E2–E3 gate closures and the release-candidate audit. Codex and
other cross-vendor reviews are retired. Every `Agent` spawn names its `model`<a id="work-routing"></a>:

| Work | Claude Code default | Escalate when |
|---|---|---|
| Lookup or broad search; a brief drafter's search, citation re-anchoring and consumer inventories | [`Explore`](../.claude/agents/Explore.md) agent, Haiku (project override; the built-in inherits Opus); the drafter keeps only decisions | never for judgment |
| PM mechanical chores (index rebuilds, CI watching, the housekeeping PR); bounded copy, content or docs edit from a fixed brief | Sonnet (`developer` for edits) | spec conflict or cross-layer behavior: Opus |
| Slice implementation, tests, fix rounds | `developer`, Opus for kernel, save, protocol, cross-layer or contract work; Sonnet for content-only ([owner decision](archive/decisions/owner-decision-sonnet-developers-2026-09-30.md)) | — |
| Independent review, fix re-check | fresh `reviewer`, Opus | E2 and E3 gate closure: Fable; E1 closure: an Opus reviewer and a Fable second opinion ([record](decisions/owner-decision-e1-closure-reviewers-2026-10-07.md)), Fable audit at release-candidate certification ([record](decisions/owner-decision-chapter-one-polish-order-2026-10-07.md)) |
| Book UI design check or review | `designer`, Fable in the polish phase ([record](decisions/owner-decision-designer-fable-2026-10-08.md)), plus a fresh `reviewer`: a quick correctness pass for a pure UI polish batch (it also checks the designer's spec and token text); in a [live polish session](#live-polish-session) the owner's approval is the design review, and a picker nit goes to a Sonnet designer | mechanics, save, protocol or kernel in the diff: the normal `reviewer` review |

An authored brief narrows exploration but never makes save, receipt or protocol work
mechanical. A brief pastes `ast-grep outline` signatures of the files the developer must touch, not whole files ([owner decision](decisions/owner-decision-agent-tooling-2026-10-08.md)). Run independent agents in the background and in parallel (one message,
several spawns); resume an agent with `SendMessage` only for its own scoped fix or
re-check, otherwise spawn fresh with a self-contained brief (worktree, exact base/head,
governing sections, acceptance checks, open findings). Agents keep full logs in a
scratch file and return failing lines or counts.
**Review count** ([owner decision](decisions/owner-decision-one-reviewer-default-2026-10-04.md)):
one fresh independent reviewer is the default for a mechanics PR. Add a separate
second opinion (another fresh reviewer) when the change alters save/reconciliation behavior, protocol or
portable foundation contracts, `kernel/ts/src/runtime/proposal.ts`, or closes a milestone
gate; the PM may add one for a concrete risk found in the first review. Small content,
copy and docs changes receive one short review. A second opinion supplements the
independent reviewer; it never replaces that reviewer.

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
   worktree). Spawn `developer` (`model` per the [routing table](#work-routing)) with a self-contained brief: goal, its [lane](#delivery-lanes),
   `docs/system` sections (the clause for each behavior; an archived plan for new work), files in and out of scope, acceptance (which checks and fixtures must
   pass, which red controls to add, mutation cases, literal expected values), the relevant `docs/lessons/` file, and anything the owner
   decided, and a scope trigger (what makes the developer stop and ask, for example an unplanned
   protocol change with new behavior). The PM splits plan rows sized L into two briefs, and every brief states the
   handoff threshold up front ([Claude Code specifics](#token-hygiene)). Obsolete development fixtures may be updated under the
   [forward-development decision](decisions/owner-decision-forward-development-2026-10-05.md).
   Store the brief durably when it is drafted, one home per kind, and before the spawn (the PM checks the Beads notes first; a developer lost to a limit left its brief only in a scratchpad, loka-ydy): a slice brief and its design input
   live in that slice's Beads issue notes (`br update <id> --append-notes`); `docs/briefs/` holds only
   milestone or gate plans that several slices or reviewers link to. A scratchpad copy is only a working file. Beads text uses repo-relative paths and worktree names,
   never absolute or home-relative paths. Before ruling on an owner-approved item, read the owner's
   approval note and cite it, not the proposal text. Link process rules (AGENTS.md,
   WORKFLOW sections, the role files), never copy them; write out only the slice's own rules.
   Add a timebox only for open-ended work:
   at the limit the developer stops and returns partial findings.
   Mechanic briefs include the [composition record](system/architecture.md#building-mechanics-by-composition).
   When an offered action changes, name its exact key, resolved command, ordered targets and
   input, the shared admission query used by both execution and GameView, and a controlled
   view-to-invocation check for any new availability rule. Where authored keys may differ from
   commands, include such an alias in that check. Reuse an existing same-layer check if it
   catches that break.
3. **Build and self-review (developer).** Implement, check and self-review as
   [`developer.md`](../.claude/agents/developer.md) says, in the developer's own worktree, never the
   main checkout; the [area-selected pre-push lane](decisions/owner-decision-preproduction-ci-scope-2026-10-06.md)
   makes the final local publication run (with the Storybook smoke for Book or story changes); a slice that changes an interaction flow also runs `npm run test:e2e` in `mobile/app`. A PR that adds or changes a schema also runs the
   schema mutant sweep in the [contract lessons](lessons/contracts.md) before remote publication; the provisional local lane checks generation and focused invalid cases first. The pre-push hook compares a new branch with the pushed remote's main only when its local and advertised refs agree; otherwise it runs the full local checks. Commit, then publish
   per the brief's [lane](#delivery-lanes) (description cites the `docs/system` sections and includes the `/code-review` result) and hand back the note `developer.md` specifies.
4. **Verify and review.** PM does not relay claims: for a pushed PR it confirms the push went
   through the pre-push hook (the [gate](decisions/owner-decision-preproduction-gate-2026-10-08.md))
   and starts review right away, without waiting for hosted CI; for
   provisional local work it verifies the focused-check evidence and can spawn
   review after the local merge. Then it spawns a *fresh* `reviewer`
   with the PR number (or local branch, base and exact head), the brief and the cited sections. The reviewer derives the
   requirements from them before reading the diff, checks the [composition record](system/architecture.md#building-mechanics-by-composition)
   against the actual consumer and diff, checks changed actions' exact offered invocations
   against keyed admission, and tests the tests by breaking
   the logic temporarily. It writes `docs/reviews/<date>-<slice>-review.md`, regenerates
   [the index](reviews/README.md) with `bin/review_index.sh`, and returns the findings.
5. **Fix (same or fresh developer).** PM forwards the findings with `SendMessage` to the
   developer, whose context is intact, while that context is small
   (the threshold is in [Claude Code specifics](#token-hygiene)); past that, or after a PM
   session restart, a fresh developer gets the brief, the review record, the PR diff and the
   findings (every call re-reads the whole context, so a large one makes each fix call the
   most expensive of the slice). One message per round: batch every request for that round,
   and name the round (1 or 2). A conflict with `main` in an index or roadmap line is
   resolved by the PM in the integration checkout (merge, never rebase; the union driver covers the decisions list) without waking the
   developer; a conflict in code goes to the developer. Every fix message restates the whole
   open finding list, not just the new ones (a resumed agent drops earlier directives). The
   PM passes the reviewer's record sha (kept as local branch `review-<N>`) and the developer cherry-picks it before fixing, so the fix push carries it (no fix: the PM's sync or merge push carries it, and the PM deletes `review-<N>` after the merge); the developer never
   force-pushes, fixes or disputes each finding with a reason, and reruns the checks once.
   A published branch uses the pre-push hook as its final run and pushes; a local draft
   keeps the fixed commits and review record until publication.
6. **Re-review (same reviewer), scoped to the fixes.** PM sends the fix commits back to
   the same reviewer; if a second opinion was required, its scoped fix re-check starts at the same moment. The reviewer checks each disposition and the code the fix touched, plus that
   code's direct callers (a fix can break a neighbor), and nothing else; it appends the
   result to its record. A broad re-review of the whole PR happens only when the fixes
   rewrote a core piece or the slice freezes a contract or closes a gate. A comment- or doc-only nit
   fix gets no re-review agent: it is batched into the next fix or dropped, and the PM checks the
   diff is comment- or doc-only. At most two fix
   rounds; anything still open goes up the escalation ladder above, then to the owner.
7. **Merge (PM).** Merge with a merge commit (`gh pr merge <N> --merge`; `--admin` while branch protection still requires the old checks) once the verdict is
   APPROVE or APPROVE WITH NOTES with nothing open on the exact pushed head, which passed the
   pre-push hook ([pre-production gate](decisions/owner-decision-preproduction-gate-2026-10-08.md)).
   A `toolbox/*` branch skips the pre-push checks; its gate is a green hosted run on the exact head ([record](decisions/owner-decision-hosted-ci-toolbox-2026-10-09.md)).
   Hosted CI runs nightly on `main` and by hand; a PR that touches save, protocol or kernel code,
   and the release candidate and E3, merge only after `gh workflow run ci.yml --ref <branch>` and
   `gh workflow run book-e2e.yml --ref <branch>` both end green on that head. A red nightly is
   the next session's first job.
   After the last of several close merges, run
   `bin/sync_pr.sh <branch>` once for every open PR (merges `origin/main`, regenerates the review index on a conflict there, docs check, push); then check `docs/decisions/README.md` order (newest first) by hand, as it is only union-merged.
   The owner, or the PM when the owner asks or for status-only commits (ROADMAP status lines,
   Beads export, decisions index lines), may push to `main` directly, or merge with `--admin`
   while GitHub still requires checks; never for unreviewed code or past a red check. Right after the merge the PM writes the
   ROADMAP status-only lines (slice done, PR link, slice count) as a direct commit on `main`; any other
   ROADMAP change goes through a PR ([owner decision](decisions/owner-decision-process-speedup-2026-10-03.md)).
   `bin/after_merge.sh <PR> <beads-id> ["ROADMAP status: ..."]` does that bookkeeping after the PM's
   ROADMAP edit: pull, close the issue, remove the worktree, branch and `review-<N>`, commit, push. Then tell the owner:
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
Active issues carry one `stage:` label (building, review, fixing, recheck, integrated, gate), which the PM moves at each step; status stays `in_progress` until the reviewed merge to `main`.
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
<a id="local-edit-loop"></a>

The brief names the lane. Sequential or dependent slices share one draft branch by default: each is reviewed on its exact draft head without CI, the PM marks it ready once, and the final review runs on the ready head. All three end in step 7's gate on the pushed head.

| Lane | Use | Developer | Review | Merge |
|---|---|---|---|---|
| Hosted PR | a slice that must merge alone, or a single fix | `bin/check_all.sh` once; the pre-push hook is the final run; pushes and opens a ready PR | fresh reviewer right after the push (step 4) | step 7 |
| Draft PR, batched pushes | a long-lived milestone branch (such as E1), or the session's housekeeping PR | focused checks; commits accumulate; the branch is pushed once per wave as a checkpoint | each slice or batch on its exact head while the PR is a draft; the PM marks it ready before the final review on the publication head ([step 7](#loop)) | step 7 on the ready head |
| Provisional local | units that can merge into local `main` before review ([fast lane](decisions/owner-decision-local-provisional-integration-2026-10-05.md), [original cadence](decisions/owner-decision-local-draft-pr-cadence-2026-10-05.md)) | touched-layer type/compile checks and focused tests; hands branch and exact head to the PM without pushing | fresh reviewer on the exact head, in its own worktree, in parallel with later work | publish the accumulated local `main`: full local checks and red controls once on its head, every review closed, then step 7 |

Batch pushes and PRs ([owner preference](decisions/owner-decision-skip-ci-on-drafts-2026-10-07.md)):
one push per wave, not per small change. Collect tracker, process and docs changes into one
housekeeping PR per session, or into the next real PR.

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

Mobile development and verification are [paused](decisions/owner-decision-web-first-mobile-pause-2026-10-05.md):
use focused kernel tests, the headless Node simulator and the browser preview. The
[Debug/Release Simulator procedure](decisions/owner-decision-local-edit-loop-2026-10-04.md) applies
again when the owner resumes native work; do not silently reset or re-pin a save then.
Chapter closure follows the [browser E2E loop](decisions/owner-decision-chapter-closure-e2e-loop-2026-10-05.md).

### Book interaction delivery

For every mechanic that changes what the player sees or can choose, the brief
names its existing [Book component pattern](BOOK-UI-COMPONENTS.md), exact
action/result owner, detail history, nested return and one browser interaction.
Amend the canonical [Book UI rules](system/book-ui.md) in the **same slice** as
the mechanic whenever the interaction contract changes. Reuse current pages and
controls when they fit; add the smallest new component only for a real consumer.
Fix obvious navigation and UI correctness defects before counting that slice
complete, including stale actions, misleading pending/refused results, wrong log
placement and dead-end returns. The Chapter 1 E3 browser walk handles the larger
cross-page visual consistency pass; it does not defer broken interaction flows
([owner decision](decisions/owner-decision-book-ui-as-you-build-2026-10-05.md)).
A slice that changes what the player sees consults the [designer](decisions/owner-decision-designer-role-2026-10-07.md) for its brief, its Book UI spec text and its review.

In the [polish lane](decisions/owner-decision-chapter-one-polish-order-2026-10-07.md) the developer
uses existing tokens and components only, and tells the PM when an owner item needs a new one.
Before each polish checkpoint a designer reads the batch's commits, writes each item's rule into
[Book UI](system/book-ui.md), [BOOK-UI-COMPONENTS.md](BOOK-UI-COMPONENTS.md) or a token, and flags
one-offs; then a fresh designer does the design review.

### Live polish session

The [owner's fast polish loop](decisions/owner-decision-live-polish-session-2026-10-09.md):
`bin/polish_session.sh start` serves a session branch to the owner's Storybook. The designer writes
style code, tokens and the catalogue line in that worktree, applies each picker prompt at once and
commits each accepted tweak; the owner's approval in the session is the design review.
The PM routes each prompt. **Nit** (one place, existing tokens only: which token a style uses,
alignment, a value inside one component, a label's wording): designer on Sonnet. **Design** (a token
value, a new token or component, hierarchy, typography, colour or composition, several components, a
feel request): designer on Fable. Sonnet hands a nit that needs a token or rule change to Fable; the
owner forces either with a `fable:` or `quick:` prefix.
The owner's "Close batch", or a PM suggestion, ends the batch: with five or more Sonnet nits, Fable
skims their diffs once; `bin/polish_session.sh close` pushes (one pre-push hook) and opens the PR;
one Opus `reviewer` quick pass on it; the PM merges. Batches stay open liberally; close early only for a critical
item or too much complexity. Mechanics, save, protocol or engine items leave the session as Beads issues.

## Token hygiene

- Big outputs stay out of every agent's context, subagents' too: the PM delegates logs, diffs
  and check runs; any agent sends a check, test or push run to a scratchpad file named for the
  slice and reads only the exit status, the failing lines and the tail. Diffs a developer or
  reviewer must read are read per file or hunk, never by tail. Batch independent tool calls.
- At most two agents run `bin/check_all.sh`, smoke or a pre-push at once; the PM queues the rest (load average 30-70 with five agents failed smokes and blocked pushes 20-60 minutes, loka-jjq).
- Long commands (checks, tests, mutant runs) run with `run_in_background`; wait for the completion
  notice, no sleep or poll loops. Any agent that expects a run over ~10 minutes (full-suite
  mutants, the 10,000-sequence simulator) stops and asks the PM, who tells the owner before it starts
  ([owner decision](decisions/owner-decision-process-tightening-2026-10-08.md)).
- Mutants: a full-suite sweep runs only at release-candidate certification and the E3 gate on that
  same candidate. Elsewhere: a red control on the new test, and `bin/mutate.sh` triage ("already
  caught?") run narrow first against the test files that import the mutated module, the full suite
  only for survivors; reviewers sample 2-3 narrow mutants. Schema fixture sweeps
  ([contract lessons](lessons/contracts.md)) stay: they rerun fixtures only.
- Delegate mechanical work. At a stable publication checkpoint, update the
  roadmap, Beads and shared handoff before a fresh session; do not reset during
  an open review merely to shorten context.
- Subagent returns are rules-shaped, under 250 words (reviewer 300): paths with `file:line`, decisions with
  a reason, open items, no narrative.
- PM state file: labeled "AS OF PR #N"; cite every PR as #N (Beads id, short description); one "Open objectives" line; owner words only verbatim
  or marked "(paraphrased)"; keep `file:line` pointers and exact errors; drop spent exploration.
- Start a new slice agent with a self-contained brief and no inherited chat
  history; keep a visited path/revision list while following doc links. Reuse
  developer and reviewer context for scoped fixes only while it stays small.

Start a fresh developer and independent reviewer for each new
slice from `.claude/agents/`; resume the same agent only for that slice's scoped
fix/recheck while its context remains small. Send full check output to a
scratchpad and return the short result specified by each role prompt. Before
clearing or starting a new Claude session, write the same exact-head/open-finding
handoff and the [retro](#retro-and-housekeeping-queue); on takeover read that handoff once and reopen only changed sections (the
decisions index is not part of it).

This preserves the brief, review records and failing evidence on disk;
compaction or a fresh session never substitutes for a reviewed merge or
silently closes unfinished work.

Claude Code specifics:

- No `CLAUDE.md` changes mid-session (they bust the prompt cache). Plugin changes are allowed; each costs one cache rebuild.
- "Small" context means about 220k tokens or less, read from the subagent token count in its
  last completion notice. Past it, any agent (fix round or long sweep) hands the remaining work to a
  fresh agent with a short brief.

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
- **Beads:** `bin/br_create.sh -l housekeeping --description-file <file>` (it clears
  `source_repo_path`, [BEADS](BEADS.md)); `br list -l housekeeping` shows the queue. The owner approves: approved items go
  to the next housekeeping PR, rejected ones to `br close` with the reason.
- **Reminders:** `bin/session_status.sh` lists open housekeeping issues, prints "Before you clear: ask the
  PM for handoff + retro", and notes a missed retro when no housekeeping issue is newer than the last
  merge on `origin/main`. The PM reminds the owner of the retro when suggesting a wrap-up or when
  context is large.

## Git hygiene

- In the provisional local [lane](#delivery-lanes), the local integration clone owns `main`;
  PM, developer and reviewer each use separate worktrees, and its review-record and merge
  steps replace the hosted push steps below until publication. Keep in-flight older clones intact.
- Every developer and concurrent planner works in a distinct worktree and branch.
  Keep a single integration worktree for local `main`; keep the owner's checkout
  out of slice work ([owner decision](archive/decisions/owner-decision-review-rules-2026-10-01.md)).
  Place worktrees outside paths the checks scan, and preserve unfinished ones.
  A reviewer uses a separate detached worktree (`git worktree add --detach`).
- `.gitattributes` merges `docs/decisions/README.md` (an append-only list) with
  `merge=union`, so two branches that each add a line merge with no hand edit. GitHub's mergeability
  check may still report a conflict, so the PM still merges `main` locally and checks the merged index for order (`bin/check_docs.exs` fails a duplicate, twice-edited or missing line).
  `docs/reviews/README.md` is generated by `bin/review_index.sh`: a conflict there is resolved by
  rerunning it (`bin/sync_pr.sh` and `bin/after_merge.sh` do).
- Stop only processes you started, by their PID; never `pkill` by name (loka-hg7), planted breaks and red controls
  included (a planted `pkill -f storybook` killed the owner's Storybook twice, loka-rar). Red controls
  that plant files run in a `git worktree add --detach` scratch copy, never in the worktree
  serving the owner's [live preview](web-preview.md) (loka-4xl).
- Parallel agents share one scratchpad: use file names unique to the slice (a shared
  `pr-body.md` once put one PR's description on another).
- For a hosted PR, the reviewer commits only its record in a detached worktree
  at `origin/<branch>`, runs `git branch -f review-<N> HEAD` to keep the commit, hands back the sha and removes the worktree; the developer's fix push or the PM's merge commit carries it, with no standalone record push. During local development, the reviewer commits
  the record in a separate worktree; the PM cherry-picks that review-only
  commit onto the preserved slice branch, merges it into local `main`, then
  removes the reviewer worktree. A provisional source merge may precede this.
- A new worktree has no `deps/`, `_build/` or `node_modules`: run [`bin/worktree_setup.sh`](../bin/worktree_setup.sh) there once, then `npm ci` only on a lockfile change.
- CI failure: rerun the job once. An identical second failure is not a flake. A failure in code
  the diff does not touch means check for a stale base (update the branch from `main` with a merge, never a rebase
  or force-push) before anything else.
- Git hooks are set once per clone ([AGENTS.md, Working rules](../AGENTS.md#working-rules));
  worktrees share that setting.
- Agent types in `.claude/agents/` register only when a session starts. If one is missing,
  spawn `general-purpose` and tell it to follow the definition file.
- `developer` and `reviewer` list their tools in `tools:` (their definition files) to keep
  each spawn's context small. A subagent cannot request more: it reports "blocked: needs
  <tool>" in its return. For a developer, the PM does that step or spawns `general-purpose`
  with the definition file; for a reviewer, always a fresh `general-purpose` with the
  definition file, so the PM never does review steps. Add a tool to `tools:` if a slice keeps
  hitting the same block.

## Review stance

Review depth scales with risk: a docs-only or config-only slice, or one that only changes
content numbers or UI styling ([playtest decision](archive/decisions/owner-decision-playtest-2026-09-25.md)),
gets a short review (no mutation testing), a contract freeze gets the full one.
For save-affecting work, the developer supplies a compact result from the existing real-SQLite
reopen, failed-COMMIT, lost-acknowledgement and receipt-replay tests, plus the relevant red
control. The reviewer reads failures and the changed contract/code, not full passing logs.

If a step keeps finding nothing across slices, the PM proposes dropping it to the owner.

Adversarial in proportion: the reviewer tries to break the change, not to redesign it.
Every finding states a concrete failure scenario (input or state, then the wrong result),
or is labeled a question. Severities: **blocker** (wrong behavior, spec violation, check
that cannot fail), **should-fix**, **nit** (at most five). Over-engineering counts as a
finding. The reviewer does not ask for features the spec and brief do not require.
