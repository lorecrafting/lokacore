# Delivery workflow: PM, developer, reviewer

Every milestone slice (one PR) runs through the PM, developer and reviewer roles; UI-changing
slices also use the designer. Claude Code runs them as the
main session plus the subagents in [`.claude/agents/`](../.claude/agents/developer.md).
[AGENTS.md](../AGENTS.md) rules apply to every role.

| Role | Who | Model | Owns |
|---|---|---|---|
| PM | the main session | the owner's choice | plan, slices, briefs, owner contact, merges |
| Developer | [`developer`](../.claude/agents/developer.md) subagent, one per slice | Claude: Sonnet 5.5; Opus for kernel and contract-freeze slices ([owner decision](archive/decisions/owner-decision-sonnet-developers-2026-09-30.md)). | code, checks, self-review, opening the PR, fixes |
| Reviewer | [`reviewer`](../.claude/agents/reviewer.md) subagent, fresh per slice | Claude: highest Opus; Fable for E2–E3 gate closures (E1: see the fix re-check row). | independent review, review record |
| Designer | [`designer`](../.claude/agents/designer.md) subagent, fresh per review | Claude: Opus | Book UI design system and spec text, UI brief input, design review ([owner decision](decisions/owner-decision-designer-role-2026-10-07.md)) |

**Models** ([owner decision](decisions/owner-decision-claude-only-auto-merge-2026-10-07.md)):
Claude Code runs every role. A slice is reviewed once, with a narrow fix check, by a
reviewer on the highest Opus; Fable reviews only the E2–E3 gate closures and the release-candidate audit. Codex and
other cross-vendor reviews are retired. Every `Agent` spawn names its `model`:

| Work | Claude Code default | Escalate when |
|---|---|---|
| Lookup or broad search | `Explore` agent | never for judgment |
| Bounded copy, content or docs edit from a fixed brief | `developer`, Sonnet | spec conflict or cross-layer behavior: Opus |
| Slice implementation, tests, fix rounds | `developer`, Opus for kernel, save, protocol, cross-layer or contract work; Sonnet for content-only | — |
| Independent review, fix re-check | fresh `reviewer`, Opus | E2 and E3 gate closure: Fable; E1 closure: two fresh Opus reviewers, Fable audit at release-candidate certification ([record](decisions/owner-decision-chapter-one-polish-order-2026-10-07.md)) |
| Book UI design check or review | `designer`, Opus, plus a fresh `reviewer`: a quick correctness pass for a pure UI polish batch (it also checks the designer's spec and token text) | mechanics, save, protocol or kernel in the diff: the normal `reviewer` review |
| Hard PM call | `advisor` tool | still unresolved and consequential: Fable, then the owner |

An authored brief narrows exploration but never makes save, receipt or protocol work
mechanical. Run independent agents in the background and in parallel (one message,
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
Mechanical lookups go to the `Explore` agent (Haiku/Sonnet is fine).

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
   worktree). Spawn `developer` (pass `model: "opus"` for a kernel or contract-freeze slice) with a self-contained brief: goal,
   `docs/system` sections (the clause for each behavior; an archived plan for new work), files in and out of scope, acceptance (which checks and fixtures must
   pass, which red controls to add, mutation cases, literal expected values), the relevant `docs/lessons/` file, and anything the owner
   decided, and a scope trigger (what makes the developer stop and ask, for example an unplanned
   protocol change with new behavior). Obsolete development fixtures may be updated under the
   [forward-development decision](decisions/owner-decision-forward-development-2026-10-05.md).
   Add a timebox only for open-ended work:
   at the limit the developer stops and returns partial findings.
   Mechanic briefs include the [composition record](system/architecture.md#building-mechanics-by-composition).
   When an offered action changes, name its exact key, resolved command, ordered targets and
   input, the shared admission query used by both execution and GameView, and a controlled
   view-to-invocation check for any new availability rule. Where authored keys may differ from
   commands, include such an alias in that check. Reuse an existing same-layer check if it
   catches that break.
3. **Build and self-review (developer).** Implement; run focused checks for the changed behavior
   and required red controls, then let the [area-selected pre-push lane](decisions/owner-decision-preproduction-ci-scope-2026-10-06.md) make the final local publication run (do not repeat it immediately before pushing); run `/ponytail-review` (skill `ponytail:ponytail-review`, a user plugin) on the diff and a correctness pass over it
   (`/code-review medium` on the branch, only for a non-tiny diff that changes code or bulk-edits
   docs; by hand otherwise, [owner decision](decisions/owner-decision-review-tools-2026-10-02.md)),
   both in the developer's worktree, never the main checkout; fix what they find. A PR that adds or changes a schema also runs the
   schema mutant sweep in the [contract lessons](lessons/contracts.md) before remote publication; the provisional local lane checks generation and focused invalid cases first. The pre-push hook compares a new branch with the pushed remote's main only when its local and advertised refs agree; otherwise it runs the full local checks. Commit, then publish
   the PR or keep a [local draft PR](#local-draft-pr-cadence) (description cites the `docs/system` sections and includes the ponytail result). Hand back a short note: what changed,
   branch and head SHA, the commands actually run (exit status, failing lines), self-review findings and
   dispositions, deviations from the brief, open questions.
4. **Verify and review.** PM does not relay claims: for a hosted PR it confirms CI
   is green on the pushed commit (or reruns the check line) before review; for
   provisional local work it verifies the focused-check evidence and can spawn
   review after the local merge. Then it spawns a *fresh* `reviewer`
   with the PR number (or local branch, base and exact head), the brief and the cited sections. The reviewer derives the
   requirements from them before reading the diff, checks the [composition record](system/architecture.md#building-mechanics-by-composition)
   against the actual consumer and diff, checks changed actions' exact offered invocations
   against keyed admission, and tests the tests by breaking
   the logic temporarily. It writes `docs/reviews/<date>-<slice>-review.md`, links it from
   [the index](reviews/README.md), and returns the findings.
5. **Fix (same or fresh developer).** PM forwards the findings with `SendMessage` to the
   developer, whose context is intact, while that context is small
   (the threshold is in [Claude Code specifics](#token-hygiene)); past that, or after a PM
   session restart, a fresh developer gets the brief, the review record, the PR diff and the
   findings (every call re-reads the whole context, so a large one makes each fix call the
   most expensive of the slice). One message per round: batch every request for that round,
   and name the round (1 or 2). A conflict with `main` in an index or roadmap line is
   resolved by the PM in the integration checkout (merge, never rebase; the union driver covers the two lists) without waking the
   developer; a conflict in code goes to the developer. Every fix message restates the whole
   open finding list, not just the new ones (a resumed agent drops earlier directives). The
   developer runs `git pull --rebase` first when the branch is published (the review record is on the branch), never
   force-pushes, fixes or disputes each finding with a reason, and reruns the checks once.
   A published branch uses the pre-push hook as its final run and pushes; a local draft
   keeps the fixed commits and review record until publication.
6. **Re-review (same reviewer), scoped to the fixes.** PM sends the fix commits back to
   the same reviewer; if a second opinion was required, its scoped fix re-check starts at the same moment. The reviewer checks each disposition and the code the fix touched, plus that
   code's direct callers (a fix can break a neighbor), and nothing else; it appends the
   result to its record. A broad re-review of the whole PR happens only when the fixes
   rewrote a core piece or the slice freezes a contract or closes a gate. At most two fix
   rounds; anything still open goes up the escalation ladder above, then to the owner.
7. **Merge (PM).** Merge with a merge commit once the verdict is APPROVE or APPROVE WITH
   NOTES with nothing open, every required hosted CI check is present and green on the
   published head, and every job started on that head has completed successfully
   ([owner decision](archive/decisions/owner-decisions-r3-lanes-2026-09-24.md),
   [which jobs run](archive/decisions/owner-decision-ci-mobile-builds-2026-09-25.md)).
   A draft PR runs no hosted CI and its skipped jobs read as passing, so mark it ready
   before review ([owner decision](decisions/owner-decision-skip-ci-on-drafts-2026-10-07.md)).
   As soon as the verdict lands on head `<sha>`, queue the merge in a background shell so
   nobody waits on hosted CI: `until [ "$(gh pr view <N> --json headRefOid -q .headRefOid)" = <sha> ];
   do sleep 5; done; until s=$(gh pr checks <N> --json name,bucket -q '[.[]|select(.name=="changes").bucket]|join(",")');
   case "$s" in pass,pass|*fail*|*skipping*|*cancel*) true;; *) false;; esac; do sleep 5; done;
   [ "$s" = pass,pass ] && gh pr checks <N> --watch --fail-fast && gh pr merge <N> --merge
   --match-head-commit <sha>` (the head wait keeps the watch from reading the previous head's checks;
   `changes` skips only on a draft, so the queue waits for both `changes` checks on `<sha>`, one
   each from `ci` and `book-e2e`, and merges only if both pass; this covers a ready run or a
   workflow that has not registered yet, and a new PR workflow raises the count). It merges only after every started job on `<sha>` passes; a
   later push makes the merge fail instead of landing unchecked, so any PM commit after the
   verdict re-queues on the new head. (`main` has no required checks and the `browser` job
   does not run on every PR, so GitHub's `--auto` would not wait.) The PM's own commits after the verdict (a `main` merge, an index line) need only green CI on the new head, and the PM puts them in one push; any
   other commit after the verdict sends the PR back to the reviewer. The scoped jobs may skip only after a relevant green ancestor and a classified safe diff
   ([CHECKS](CHECKS.md)); an unrelated skipped job is not a passing test. Right after the merge the PM writes the
   ROADMAP status-only lines (slice done, PR link, slice count) as a direct commit on `main`; any other
   ROADMAP change goes through a PR ([owner decision](decisions/owner-decision-process-speedup-2026-10-03.md)). Then tell the owner:
   PR link, verdict, notes. Owner decisions, and anything still open after fix round 2 and the
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
[owner](decisions/owner-decision-claude-only-auto-merge-2026-10-07.md)) tracks all 33 Chapter 1 slices in `.beads/issues.jsonl`; the export may also
contain concrete, evidence-linked audit follow-ups under the [owner's extension](decisions/owner-decision-beads-audit-followups-2026-10-06.md).
The PM owns tracker writes; builders and reviewers report through
the usual brief and review record. `docs/ROADMAP.md` remains the published status
and completion count, briefs own scope, reviews own findings, and this workflow
owns merge gates. Beads holds short current status, links and dependencies only.
Active issues carry one `stage:` label (building, review, fixing, recheck, integrated, gate), which the PM moves at each step; status stays `in_progress` until the reviewed merge to `main`.
It replaces the retired `bin/board` and `$board` dashboards; `bv` is the board view.

Install `br` (version 0.7.4) with
`brew tap dicklesworthstone/tap && brew install dicklesworthstone/tap/br`,
then use `br ready --brief --json`,
`br show <id> --json` and `br blocked --json`. Install the optional viewer with
`brew install dicklesworthstone/tap/bv`; run `bv` from a checkout with current
`.beads` data, then press `b` for the board or `g` for the dependency graph.
`bv` views the data on that checkout's branch, so use the main integration
checkout for the latest merged status. From another checkout, set
`LOKA_INTEGRATION_CHECKOUT` to the main integration checkout directory and run
`bv --db "$LOKA_INTEGRATION_CHECKOUT/.beads"`. This is read-only; it does not
change the branch or move tracker data. Agents can add `--robot-triage`; human
readers can use
the interactive board and graph. `br` mutates local
SQLite and exports Git-tracked JSONL. Beads Rust 0.7.4 auto-flushes mutations
and auto-imports newer JSONL on commands by default; use `br sync --status --json`
to inspect drift, `br sync --import-only` to recover an out-of-date index, and
`br sync --flush-only` before a tracker commit if the index is dirty. Review the JSONL diff
and verify it contains no local machine path; the installed release writes
`source_repo_path` on creation, so clear it with
`br update <id> --source-repo lokacore --source-repo-path ''` before committing.
Avoid `-wisp-` in an issue ID: Beads Rust reserves it for ephemeral records,
even when the task itself is durable.
The [export check](CHECKS.md) rejects path, ID and completeness errors in the
staged commit and CI. All 33 plan slices must remain present exactly once;
additional tasks need a concrete audit finding and evidence link.
Keep one PM writer across worktrees/clones and update statuses at reviewed merges.
`br` run from any worktree reads and writes the integration checkout's database and
JSONL (`br where` shows it), so commit tracker changes from that checkout, not a slice
branch. A Claude Code session starts with `bin/session_status.sh` (in-progress, ready
and blocked issues, open PRs, and report-only drift from each issue's `external_ref` PR URL:
in-progress with the PR merged or closed, open PR with no issue, closed with the PR open), so Beads, not a memory file, holds current status.
When a reviewed brief starts building, the PM marks its ready issue
`in_progress` with `br update <id> --status in_progress` and keeps its current
source/review links in the issue. After the source is reviewed and merged to
`main`, the PM uses `br close <id> --reason "Merged <PR or local merge>"` and
checks `br ready --brief --json` for newly unblocked work. A provisional review
or green local test alone does not close a slice. Ad hoc findings that need
follow-up become linked issues only when they are real work; the review record
keeps the finding and disposition. Beads gate records are not used; CI and
review records own the gate evidence.
The [hook comparison](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-06-beads-hooks-pilot.md) set up repo-owned
`post-merge` and `post-checkout` imports only in the main integration checkout.
After `git config core.hooksPath .githooks`, opt in there with
`git config --local loka.beads.integrationRoot "$(pwd -P)"`; remove that setting
with `git config --local --unset loka.beads.integrationRoot`. The hook checks for
unexported local changes before importing and never stages, commits, pushes or
closes an issue. A failed import prints a recovery instruction; Git's completed
merge/checkout cannot be rolled back by a post-hook. Do not install Beads-provided hooks
or let the tracker rewrite `AGENTS.md`.

No source merge or CI gate depends on `br`; the export check guards the JSONL.

## Local edit loop

### Local draft-PR cadence

For new work after [PR #200 (Book keyboard exits)](https://github.com/lorecrafting/lokacore/pull/200)
through [PR #204 (Green finale plan)](https://github.com/lorecrafting/lokacore/pull/204),
the [owner's cadence](decisions/owner-decision-local-draft-pr-cadence-2026-10-05.md)
and [fast provisional integration decision](decisions/owner-decision-local-provisional-integration-2026-10-05.md)
use steps 3–6 in a separate worktree and branch per new slice. Give an independent
reviewer a different worktree. Treat the brief, base and exact head, local check
result, fresh review record in `docs/reviews/`, and proposed PR description as the
draft PR. For a complete source outcome, the developer runs focused checks for
the touched layers and self-reviews; the PM can then merge it into local `main` with a
**provisional** merge commit before independent review. Record that merge SHA in
the next handoff and start the next dependency-ready slice while the fresh reviewer
checks the exact head. Run required second opinions in parallel. Fix findings
on the original branch and merge those fixes locally with their review records.
Keep unresolved findings visible and do not count the slice complete until they
close. Periodically publish the accumulated local `main` history as a GitHub PR,
run the full active local checks and red controls once on its exact accumulated
head, then merge to remote `main` only after every
review is closed and required hosted CI is green. A later source edit needs the
usual scoped re-review. Keep the owner's checkout and remote `main`
untouched during local development. Local Git branches, merge commits and review
records provide the trail without running another server. A local check is not
hosted CI proof. Step 7's hosted-CI gate applies to the later remote merge, not
to the provisional local integration merge. A settled small spec change may be
committed before code on the same branch and reviewed with the complete outcome;
cross-mechanic/save planning still gets a focused review when it prevents rework.

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

Parallel local work uses one integration owner for local `main`, normally two source
worktrees whose mechanics do not overlap, and separate worktrees for independent
plans and reviews. Plan the next dependency-ready slices while source work runs.
Each source branch keeps its own checks and review head; integrate one branch at a
time. When branches touch the same cartridge release, generated contract, save
schema or portable primitive, choose the integration order first and derive the
successor pin only after its predecessor lands. A plan may leave those values
unknown. Never have two agents edit one worktree or treat parallel green checks
as proof of their combined head; run accumulated checks before publication.

The owner has [paused mobile development and verification](decisions/owner-decision-web-first-mobile-pause-2026-10-05.md),
including Debug and Release Simulator sessions. Browser preview work may provide a local test
view in a separate slice. Use focused kernel tests and the headless Node simulator during
development; batch related WIP edits into one coherent PR. The active local checks,
closed independent reviews and exact-head CI gate remote publication (steps 3–7).

At each chapter closure, follow the [owner's browser E2E loop](decisions/owner-decision-chapter-closure-e2e-loop-2026-10-05.md): add and walk deterministic tests for required chapter routes and UI, run an exploratory E2E pass, show the owner a headed run or its video, and fix findings on an isolated chapter-polish branch. Rerun each failed path and the complete chapter walk after fixes, then get a fresh independent review of the exact final head. This browser loop complements the kernel, authority, save and contract checks. Deep mechanics or save findings become narrow tests and reviewed fixes in the owning slice; do not accumulate a large unreviewed polish batch.

The prior [Debug/Release Simulator procedure](decisions/owner-decision-local-edit-loop-2026-10-04.md)
remains historical guidance for when the owner resumes native work. Do not silently reset or
re-pin a save when that happens.

## Token hygiene

- Big outputs stay out of every agent's context, subagents' too: the PM delegates logs, diffs
  and check runs; any agent sends a check, test or push run to a scratchpad file named for the
  slice and reads only the exit status, the failing lines and the tail. Diffs a developer or
  reviewer must read are read per file or hunk, never by tail. Batch independent tool calls.
- Delegate mechanical work. At a stable publication checkpoint, update the
  roadmap, Beads and shared handoff before a fresh session; do not reset during
  an open review merely to shorten context.
- Subagent returns are rules-shaped, under 250 words (reviewer 300): paths with `file:line`, decisions with
  a reason, open items, no narrative.
- PM state file: labeled "AS OF PR #N"; one "Open objectives" line; owner words only verbatim
  or marked "(paraphrased)"; keep `file:line` pointers and exact errors; drop spent exploration.
- Start a new slice agent with a self-contained brief and no inherited chat
  history; keep a visited path/revision list while following doc links. Reuse
  developer and reviewer context for scoped fixes only while it stays small.

Start a fresh developer and independent reviewer for each new
slice from `.claude/agents/`; resume the same agent only for that slice's scoped
fix/recheck while its context remains small. Send full check output to a
scratchpad and return the short result specified by each role prompt. Before
clearing or starting a new Claude session, write the same exact-head/open-finding
handoff; read the index once on takeover and reopen only changed sections.

This preserves the brief, review records and failing evidence on disk;
compaction or a fresh session never substitutes for a reviewed merge or
silently closes unfinished work.

Claude Code specifics:

- No plugin or `CLAUDE.md` changes mid-session (they bust the prompt cache).
- "Small" context means about 220k tokens or less, read from the subagent token count in its
  last completion notice.

Another harness, if adopted, gets its own short adapter list next to this one.

## Milestone gate

A gate is slim ([owner decision](decisions/owner-decision-slim-gates-2026-10-02.md)): the owner's
play or test when the stage has something touchable; one fresh Opus audit (Fable for E2–E3) of the stage's riskiest
code; and a short checklist, checked by one reviewer without narrative (no second review of a docs-only gate PR). The checklist: every spec proof linked, every carry in a stage row,
and the docs tidy pass over the docs changed during the milestone (not `docs/archive/`, nor review
or decision records, which are history): a fact stated
in two places (keep one, link to it), a lesson that is stale or now enforced by a check, a doc
turning into a catch-all. Findings are fixed in the gate PR.

## Git hygiene

- During the local draft-PR cadence above, the local integration clone owns `main`;
  PM, developer and reviewer each use separate worktrees. The local cadence's
  review-record and merge steps replace the hosted push steps below until batch
  publication. Keep in-flight older clones intact.
- Every developer and concurrent planner works in a distinct worktree and branch.
  Keep a single integration worktree for local `main`; keep the owner's checkout
  out of slice work ([owner decision](archive/decisions/owner-decision-review-rules-2026-10-01.md)).
  Place worktrees outside paths the checks scan, and preserve unfinished ones.
  A reviewer uses a separate detached worktree (`git worktree add --detach`).
- `.gitattributes` merges `docs/reviews/README.md` and `docs/decisions/README.md` (append-only lists) with
  `merge=union`, so two branches that each add a line merge with no hand edit. GitHub's mergeability
  check may still report a conflict, so the PM still merges `main` locally and checks the merged index for duplicate or twice-edited lines and for order.
- Parallel agents share one scratchpad: use file names unique to the slice (a shared
  `pr-body.md` once put one PR's description on another).
- For a hosted PR, the reviewer commits only its record in a detached worktree
  at `origin/<branch>`, pushes from there with `git push origin HEAD:<branch>`,
  and removes the worktree. During local development, the reviewer commits
  the record in a separate worktree; the PM cherry-picks that review-only
  commit onto the preserved slice branch, merges it into local `main`, then
  removes the reviewer worktree. A provisional source merge may precede this.
- A new worktree has no `deps/`, `_build/` or `node_modules`: run `mix deps.get` there
  first, and `npm ci` at the root, in `kernel/ts` and in `mobile/app`. The PM's worktree
  does this once, then `npm ci` only on a lockfile change.
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

## Why these steps (keep them only while they earn their cost)

- The brief is the biggest quality lever: a vague brief yields confident wrong work.
  Acceptance is written as checkable items before any code.
- Same-model reviewers share blind spots with the developer. Derive requirements from
  the spec first and break the code to test the tests; add the second opinion for
  the risks named above, rather than for every mechanics PR.
- The developer keeps its context across small fix rounds, so fixes are cheap and consistent;
  a large context makes every call expensive, so a fresh developer takes over (step 5). The
  reviewer stays fresh so its judgment is independent.
- If a step keeps finding nothing across slices, the PM proposes dropping it to the owner.

## Review stance

Review depth scales with risk: a docs-only or config-only slice, or one that only changes
content numbers or UI styling ([playtest decision](archive/decisions/owner-decision-playtest-2026-09-25.md)),
gets a short review (no mutation testing), a contract freeze gets the full one.
For save-affecting work, the developer supplies a compact result from the existing real-SQLite
reopen, failed-COMMIT, lost-acknowledgement and receipt-replay tests, plus the relevant red
control. The reviewer reads failures and the changed contract/code, not full passing logs.

Adversarial in proportion: the reviewer tries to break the change, not to redesign it.
Every finding states a concrete failure scenario (input or state, then the wrong result),
or is labeled a question. Severities: **blocker** (wrong behavior, spec violation, check
that cannot fail), **should-fix**, **nit** (at most five). Over-engineering counts as a
finding. The reviewer does not ask for features the spec and brief do not require.
