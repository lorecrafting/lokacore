# Delivery workflow: PM, developer, reviewer

[AGENTS.md](../AGENTS.md) rules apply to every role.

## Lean default

The default since the [owner's lean decision](decisions/owner-decision-lean-workflow-2026-10-31.md):

- **One session works directly:** it plans, builds, self-reviews and merges, one PR per slice. It spawns a
  subagent for a fresh reviewer or an independent read, not for a PM, designer, developer chain. The roles
  below apply when a slice is too large for one session or the owner asks for them.
- **Engine change** (`kernel/`, `lib/`, `protocol/`, `schemas/`, `mobile/authority/`): Opus designs it; one fresh
  independent reviewer, with a second opinion where [Review count](#review-count) requires it.
- **Everything else** (cartridge content, walks, Book style, tools, docs): no separate reviewer. Compiler, content
  lint, the affected walkthrough and hosted CI are the gate; the session's self-review stays.
- **Models:** Sonnet for content and mechanical edits; Opus for engine design and review.
- **Content:** no mutation runs. Prologue prose is the [owner's alone](system/owner-rules.md#process).
- **Polish:** notes go to Beads and land as one batch on the owner's go.
- **[HANDOFF](HANDOFF.md):** rewritten once per session, at its end.

Claude Code runs the roles as the main session plus the subagents in [`.claude/agents/`](../.claude/agents/developer.md).

| Role | Who | Model | Owns |
|---|---|---|---|
| PM | the main session | the owner's choice | plan, slices, briefs, owner contact, merges |
| Developer | [`developer`](../.claude/agents/developer.md) subagent, one per slice | Claude: per the [routing table](#work-routing). | code, checks, self-review, opening the PR, fixes |
| Reviewer | [`reviewer`](../.claude/agents/reviewer.md) subagent, fresh per slice | Claude: `opus`; Fable for one review per mechanics batch on its final head and the E-gate closures (E1: see the fix re-check row). | independent review, review record |
| Designer | [`designer`](../.claude/agents/designer.md) subagent, fresh per review | Claude: Opus, which also maintains the stable design system; Fable only for a new page type or component family without precedent, an owner-requested visual refresh, or a milestone or RC design audit ([owner decision](decisions/owner-decision-designer-opus-2026-10-21.md)) | Book UI design system and spec text, UI brief input, design review ([owner decision](decisions/owner-decision-designer-role-2026-10-07.md)) |

**Models** ([owner decision](decisions/owner-decision-claude-only-auto-merge-2026-10-07.md)):
Claude Code runs every role. A slice is reviewed once, with a narrow fix check, by a
reviewer on the highest Opus; Fable reviews only one mechanics batch's final head, the E-gate closures and the release-candidate audit ([routing record](decisions/owner-decision-two-lane-ci-2026-10-09.md)). Codex and
other cross-vendor reviews are retired. Every `Agent` spawn names its `model`<a id="work-routing"></a>:

| Work | Claude Code default | Escalate when |
|---|---|---|
| Lookup or broad search; a brief drafter's search, citation re-anchoring and consumer inventories | [`Explore`](../.claude/agents/Explore.md) agent, Haiku (project override; the built-in inherits Opus); the drafter keeps only decisions | never for judgment |
| PM mechanical chores (index rebuilds, CI watching, the housekeeping PR); a purely mechanical slice (owner 2026-10-21, see the implementation row) | Sonnet (`developer` for edits) | spec conflict or cross-layer behavior: Opus |
| Brief drafting | Opus for a row that follows an existing pattern, an S row or content (owner, 2026-10-14; never Sonnet since 2026-10-23) | Opus drafts every other brief too (a new module, a Realm-sensitive row, a new interaction pattern); Fable drafts a save, protocol or core engine contract brief while weekly usage is under about 80%, else Opus; Sonnet never drafts a brief (owner 2026-10-23 accepted the PM recommendation, quoted: "okay lets go with your rec") |
| Slice implementation, tests, fix rounds | `developer`, Opus for save, protocol, new-content and judgement slices; Sonnet for purely mechanical slices (re-snapshots, transcript re-recording, moving tests onto existing content) ([owner rules](system/owner-rules.md#process), owner 2026-10-21) | — |
| Independent review, fix re-check | fresh `reviewer`, Opus, for an engine change ([lean default](#lean-default)) | one Fable review per mechanics batch, on the final batch head ([routing record](decisions/owner-decision-two-lane-ci-2026-10-09.md)); E2 and E3 gate closure: Fable; E1 closure: an Opus reviewer and a Fable second opinion ([record](decisions/owner-decision-e1-closure-reviewers-2026-10-07.md)), Fable audit at release-candidate certification ([record](decisions/owner-decision-chapter-one-polish-order-2026-10-07.md)) |
| Book UI design check or review | `designer`, Opus: up front only for a new page type or component family; otherwise ONE pass per UI batch (all screenshots, wording and spec text, as main writer; decided small spec text may come from the PM, see the roles note below the table). Per slice no design review: the developer builds from the designer's rulings record and [Book UI](system/book-ui.md), and the fresh `reviewer` also checks screenshots and wording against the rulings and the designer's spec and token text. In a [live polish session](#live-polish-session) the owner's approval is the design review, and a picker nit goes to the Opus designer | Fable: a new direction (see the Designer row); mechanics, save, protocol or kernel in the diff: the normal `reviewer` review ([record](decisions/owner-decision-designer-opus-2026-10-21.md)) |


Roles exist for independent judgement, not ownership of files: a fresh reviewer or designer keeps its view
unanchored on the author's work, and that is the only wall worth paying for. Any agent fixes a stale line in any
doc it is already touching (HANDOFF included) instead of leaving it for its "owner"; the PM writes small spec
text that is already decided (a ruling, a paragraph) itself and the reviewer checks it; spawn the designer for
design decisions, not to type decided text ([harness patterns](decisions/owner-decision-harness-patterns-2026-10-28.md)).
<a id="review-count"></a>**Review count** ([owner decision](decisions/owner-decision-one-reviewer-default-2026-10-04.md)):
one fresh independent reviewer is the default for an engine change. Add a separate
second opinion (another fresh reviewer) when the change alters save/reconciliation behavior, protocol or
portable foundation contracts, `kernel/ts/src/runtime/proposal.ts`, or closes a milestone
gate; the PM may add one for a concrete risk found in the first review. A second opinion supplements the
independent reviewer; it never replaces that reviewer.
PM ruling 2026-10-28, under owner delegation (paraphrased): housekeeping batches P, T and Docs get one
review per batch, on its final head; contract batches C1-C3 get a review per slice plus a Fable review of the final head.

## Loop

The PM steps (keep going and the escalation ladder, plan, brief, verify, merge) are in [PM.md](PM.md#loop); the PM reads it, no other role does.

3. **Build and self-review (developer).** Implement, check and self-review as
   [`developer.md`](../.claude/agents/developer.md) says, in the developer's own worktree, never the
   main checkout. Locally only the focused tests the diff touches (`npm run test:files -- <files>` in `kernel/ts` or `mobile/app`); hosted CI on the pushed head is
   the final run ([two-lane CI](decisions/owner-decision-two-lane-ci-2026-10-09.md)). A PR that adds or changes a schema also runs the
   schema mutant sweep in the [contract lessons](lessons/contracts.md) before remote publication; the provisional local lane checks generation and focused invalid cases first. Commit, then publish
   per the brief's [lane](#delivery-lanes) (description cites the `docs/system` sections and includes the `/code-review` result) and hand back the note `developer.md` specifies. The PM appends the note's `/code-review` open items to the slice's Beads notes at handback.

Step 4 (verify and review) is the PM's.

5. **Fix (same or fresh developer).** PM forwards the findings with `SendMessage` to the
   developer, whose context is intact, while that context is small
   (the threshold is in [Claude Code specifics](#token-hygiene)); past that, or after a PM
   session restart, a fresh developer gets the brief, the review record, the PR diff and the
   findings (every call re-reads the whole context, so a large one makes each fix call the
   most expensive of the slice). One message per round: batch every request for that round,
   and name the round (1 or 2). A conflict with `main` in an index or roadmap line is
   resolved by the PM in the integration checkout (merge, never rebase; the union driver covers the decisions list) without waking the
   developer; a conflict in code goes to the developer. Every fix message restates the whole
   open finding list, not just the new ones (a resumed agent drops earlier directives). When a
   record exists, the PM passes the reviewer's record sha (kept as local branch `review-<N>`) and the developer cherry-picks it before fixing, so the fix push carries it (no fix: `bin/after_merge.sh` cherry-picks `review-<N>` onto `main` after the merge, never a push into the PR, which cancels its CI, loka-o0pw); the developer never
   force-pushes, fixes or disputes each finding with a reason, and reruns the focused checks once.
   A published branch pushes (hosted CI reruns on the new head); a local draft
   keeps the fixed commits and review record until publication.
6. **Re-review (same reviewer), scoped to the fixes.** PM sends the fix commits back to
   the same reviewer; if a second opinion was required, its scoped fix re-check starts at the same moment. The reviewer checks each disposition and the code the fix touched, plus that
   code's direct callers (a fix can break a neighbor), and nothing else; it appends the
   result to its record. A broad re-review of the whole PR happens only when the fixes
   rewrote a core piece or the slice freezes a contract or closes a gate. At most two fix
   rounds; anything still open goes up the [escalation ladder](PM.md#loop), then to the owner.
   <a id="small-should-fix"></a>**Small should-fixes take no fix round** (owner yes, loka-n0ng): a should-fix of about 10
   lines or fewer with no logic change (docs wording, a comment, an import, one test assertion line) is either
   fixed in place by the reviewer during its re-check (a commit in a detached worktree at the head,
   pushed `HEAD:<branch>` as a fast-forward, never forced; hosted CI reruns and the PM checks the diff has no
   logic change), or the PR merges as APPROVE WITH NOTES with the item filed in Beads. A fix round (step 5) is
   only for blockers and logic changes.

Step 7 (merge) is the PM's.

## Delivery lanes
<a id="local-edit-loop"></a>

The brief names the lane. Sequential or dependent slices share one draft branch by default: each is reviewed on its exact draft head, the PM marks it ready once, and the final review runs on the ready head. All three end in step 7's gate on the pushed head.

| Lane | Use | Developer | Review | Merge |
|---|---|---|---|---|
| Hosted PR | a slice that must merge alone, or a single fix | focused tests; pushes and opens a ready PR; hosted CI on the head is the final run | fresh reviewer right after the push (step 4) | step 7 |
| Draft PR, batched pushes | a long-lived milestone branch (such as E1), or the session's housekeeping PR | focused checks; commits accumulate; the branch is pushed once per wave as a checkpoint | each slice or batch on its exact head while the PR is a draft; the PM marks it ready before the final review on the publication head ([step 7](PM.md#loop)) | step 7 on the ready head |
| Provisional local | units that can merge into local `main` before review ([fast lane](decisions/owner-decision-local-provisional-integration-2026-10-05.md), [original cadence](decisions/owner-decision-local-draft-pr-cadence-2026-10-05.md)) | touched-layer type/compile checks and focused tests; hands branch and exact head to the PM without pushing | fresh reviewer on the exact head, in its own worktree, in parallel with later work | push the accumulated local `main` as a branch and open its PR (a push to `main` starts no hosted run): every review closed, then step 7 on that head |

Mobile development and verification are [paused](decisions/owner-decision-web-first-mobile-pause-2026-10-05.md):
use focused kernel tests, the headless Node simulator and the browser preview. The
[Debug/Release Simulator procedure](decisions/owner-decision-local-edit-loop-2026-10-04.md) applies
again when the owner resumes native work; do not silently reset or re-pin a save then.
Chapter closure follows the [browser E2E loop](decisions/owner-decision-chapter-closure-e2e-loop-2026-10-05.md).

### Book interaction delivery

For every mechanic that changes what the player sees or can choose, the brief
names its existing [Book component pattern](BOOK-UI-COMPONENTS.md), its page template and
patterns from [interaction patterns](design/interaction-patterns.md) (its checklist), exact
action/result owner, detail history, nested return and one browser interaction.
Amend the canonical [Book UI rules](system/book-ui.md) in the **same slice** as
the mechanic whenever the interaction contract changes. Reuse current pages and
controls when they fit; add the smallest new component only for a real consumer.
Fix obvious navigation and UI correctness defects before counting that slice
complete, including stale actions, misleading pending/refused results, wrong log
placement and dead-end returns. The Chapter 1 E3 browser walk handles the larger
cross-page visual consistency pass; it does not defer broken interaction flows
([owner decision](decisions/owner-decision-book-ui-as-you-build-2026-10-05.md)).
A slice that changes what the player sees is briefed with the [designer](decisions/owner-decision-designer-role-2026-10-07.md)'s rulings record; the designer writes its Book UI spec text and reviews its screenshots and wording once per UI batch (routing table).

In the [polish lane](decisions/owner-decision-chapter-one-polish-order-2026-10-07.md) the developer
uses existing tokens and components only, and tells the PM when an owner item needs a new one.
Before each polish checkpoint a designer reads the batch's commits, writes each item's rule into
[Book UI](system/book-ui.md), [BOOK-UI-COMPONENTS.md](BOOK-UI-COMPONENTS.md) or a token, and flags
one-offs; then a fresh designer does the design review.

### Live polish session

The [owner's fast polish loop](decisions/owner-decision-live-polish-session-2026-10-09.md):
`bin/polish_session.sh start` serves a session branch to the owner's Storybook. The designer writes
style code, tokens and the component doc comment in that worktree, applies each picker prompt at once and
commits each accepted tweak; the owner's approval in the session is the design review.
Before a commit that changes navigation, refusals or a component doc comment, the designer runs the toolbox showcase walk
([preview command](web-preview.md), `LOKA_WALK=toolbox_showcase`) and `mobile/app/catalogue.test.ts` locally, each alone
(a batch went red on hosted CI and a close was refused for both, loka-iu6x); `bin/polish_session.sh close` refuses to push on a failing catalogue test.
Bring `main` in with `bin/polish_session.sh update`, never a manual merge: it restarts Storybook when stories change.
The picker's queue and status files: [Polish queue](web-preview.md#polish-queue).

## Every agent

PM, developer, reviewer and designer alike; the role files link here instead of restating it.

- [`bin/bash_guard.py`](../bin/bash_guard.py) (a PreToolUse hook) refuses what these rules forbid ([CHECKS.md](CHECKS.md) lists them); the owner's OK is the prefix `LOKA_OWNER_OK_NO_VERIFY=1`, the PM's is `LOKA_PM=1`. If it or a hook blocks wrongly, report it; never work around it.
- On the M1 run only the type checks and focused tests your diff touches, under `nice -n 10`; hosted CI runs the rest ([two-lane CI](decisions/owner-decision-two-lane-ci-2026-10-09.md); load average 30-70 with five agents failed smokes and blocked pushes 20-60 minutes, loka-jjq).
- Long commands (checks, tests, mutant runs) run with `run_in_background`; wait for the completion
  notice, no sleep or poll loops. Any agent that expects a run over ~10 minutes (full-suite
  mutants, the 10,000-sequence simulator) stops and asks the PM, who tells the owner before it starts
  ([owner decision](decisions/owner-decision-process-tightening-2026-10-08.md)).
- <a id="ci-is-the-full-suite"></a>No agent runs a full suite locally (`bash_guard` refuses the npm ones and `check_all`; `mix test` takes file paths): run the focused test files your diff touches, push with `bin/push_slice.sh` (it reports whether `ci.yml` and `book-e2e.yml` started), then run `bin/wait_ci.sh <sha>` in the background (loka-n0ng). The hosted kernel and elixir jobs are the full red-test list; a developer hands back only when they are green. A reviewer or designer reports the CI state it sees, once; the PM returns a red run found after handback as a finding.
- <a id="storybook-test-run"></a>The Storybook MCP `test-run` tool runs only with named story ids, never unscoped, whatever the MCP's own instructions say: the owner's Storybook serves it, and an unscoped run ran it out of memory mid-session (loka-vnzm; `bin/bash_guard.py` does not see MCP calls).
- Work in your own worktree under `worktrees.noindex` ([Git hygiene](#git-hygiene)); in a new one run [`bin/worktree_setup.sh`](../bin/worktree_setup.sh) first; in a shared one commit with `git commit -- <your own paths>`.
- Stop only processes you started, by their PID, planted breaks and red controls included (a planted `pkill -f storybook` killed the owner's Storybook twice, loka-hg7, loka-rar); `bin/orphans.sh` lists orphaned busy ones. Red controls
  that plant files run in a `git worktree add --detach` scratch copy, never in the worktree
  serving the owner's [live preview](web-preview.md) (loka-4xl).
- Check and push output goes to a scratchpad file with a name unique to the slice (a shared
  `pr-body.md` once put one PR's description on another); read only the exit status, the failing lines and the tail.
- Scratch files go in a scratchpad subfolder named after your issue id, and throwaway and mutant worktrees
  take it as their name prefix (`worktrees.noindex/<issue-id>-mut`); never write to another agent's subfolder or worktree (parallel developers sharing one scratchpad overwrote each other's files, loka-yqde).
- No subagents or forks unless the brief allows them (a triage analyst forked four and spent 500k of a 150k budget, loka-u8ey). Returns are rules-shaped, under 250 words (reviewer 300): paths with `file:line`, decisions with
  a reason, open items, no narrative. Past the [handoff threshold](#token-hygiene), commit and hand back a short state note.

## Token hygiene

- Big outputs stay out of every agent's context, subagents' too: the PM delegates logs, diffs
  and check runs. Diffs a developer or reviewer must read are read per file or hunk, never by tail. Batch independent tool calls.
- Mutants: a full-suite sweep runs only at release-candidate certification and the E3 gate on that
  same candidate. Elsewhere: a red control on the new test, and `bin/mutate.sh` triage ("already
  caught?") run narrow first against the test files that import the mutated module, the full suite
  only for survivors; reviewers sample 2-3 narrow mutants. A test that reads a compiled hash fixture
  rebuilds it per mutant: `MUTATE_REBUILD="bin/regen_hash_fixture.sh cartridges/toolbox_showcase protocol/fixtures/toolbox_showcase_hash.json"`. Schema fixture sweeps
  ([contract lessons](lessons/contracts.md)) stay: they rerun fixtures only.

Claude Code specifics:

- "Small" context means about 220k tokens or less, read from the subagent token count in its
  last completion notice. Past it, any agent (fix round or long sweep) hands the remaining work to a
  fresh agent with a short brief.

## Git hygiene

- In the provisional local [lane](#delivery-lanes), the local integration clone owns `main`;
  PM, developer and reviewer each use separate worktrees, and its review-record and merge
  steps replace the hosted push steps below until publication. Keep in-flight older clones intact.
- Every developer and concurrent planner works in a distinct worktree and branch.
  Keep a single integration worktree for local `main`; keep the owner's checkout
  out of slice work ([owner decision](archive/decisions/owner-decision-review-rules-2026-10-01.md)).
  Place worktrees outside paths the checks scan, and preserve unfinished ones. Create worktrees
  and scratch worktrees (the guard refuses others) in a sibling folder named `worktrees.noindex` next to the repo checkout
  (`git worktree add --no-track -b <branch> ../worktrees.noindex/<name> origin/main`; a branch tracking `origin/main` rebases onto main on `git pull --rebase`, loka-aeju, and `bin/push_slice.sh` sets its upstream): Spotlight never indexes
  a `.noindex` folder, and each indexed worktree kept `mds_stores` at 150-230% CPU for minutes.
  `bin/new_batch.sh <branch>` makes a batch branch that way (worktree, `bin/worktree_setup.sh`, push with upstream).
  A reviewer uses a separate detached worktree (`git worktree add --detach`).
- `bin/orphans.sh` (also in `bin/session_status.sh`) never kills: check one, then stop it by PID.
- For a contract slice's record (save, protocol or kernel contracts), the reviewer commits only its record in a detached worktree
  at `origin/<branch>`, runs `git branch -f review-<N> HEAD` to keep the commit, hands back the sha and removes the worktree; the developer's fix push carries it, or with no fix round `bin/after_merge.sh` after the merge. During local development, the reviewer commits
  the record in a separate worktree; the PM cherry-picks that review-only
  commit onto the preserved slice branch, merges it into local `main`, then
  removes the reviewer worktree. A provisional source merge may precede this.
- A new worktree has no `deps/`, `_build/` or `node_modules`: `bin/worktree_setup.sh` fills them; then `npm ci` only on a lockfile change. Never symlink `_build`, `deps` or `node_modules` from another checkout: it compiled into main's `_build` (loka-ail1).
- CI failure: rerun the job once. An identical second failure is not a flake. A failure in code
  the diff does not touch means check for a stale base (update the branch from `main` with a merge) before anything else.
- Git hooks are set once per clone ([AGENTS.md, Working rules](../AGENTS.md#working-rules));
  worktrees share that setting.
- `developer` and `reviewer` list their tools in `tools:` (their definition files) to keep
  each spawn's context small. A subagent cannot request more: it reports "blocked: needs
  <tool>" in its return. For a developer, the PM does that step or spawns `general-purpose`
  with the definition file; for a reviewer, always a fresh `general-purpose` with the
  definition file, so the PM never does review steps. Add a tool to `tools:` if a slice keeps
  hitting the same block.

## Review stance

Review depth scales with risk: a contract freeze gets the full review; other engine changes are proportionate.
For save-affecting work, the developer supplies a compact result from the existing real-SQLite
reopen, failed-COMMIT, lost-acknowledgement and receipt-replay tests, plus the relevant red
control. The reviewer reads failures and the changed contract/code, not full passing logs.


Adversarial in proportion: the reviewer tries to break the change, not to redesign it.
Every finding states a concrete failure scenario (input or state, then the wrong result),
or is labeled a question. Severities: **blocker** (wrong behavior, spec violation, check
that cannot fail), **should-fix**, **nit** (at most five). Over-engineering counts as a
finding. The reviewer does not ask for features the spec and brief do not require.