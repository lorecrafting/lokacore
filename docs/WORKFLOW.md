# Delivery workflow: PM, developer, reviewer

Every milestone slice (one PR) runs through three roles. Claude Code runs them as the
main session plus the subagents in [`.claude/agents/`](../.claude/agents/developer.md).
Other agents (Codex and others) use those two files as the role prompt, for example "act as
the reviewer in `.claude/agents/reviewer.md` for PR #N"; a reviewer from another vendor is
a welcome source of independence. [AGENTS.md](../AGENTS.md) rules apply to every role.

| Role | Who | Model | Owns |
|---|---|---|---|
| PM | the main session | the owner's choice | plan, slices, briefs, owner contact, merges |
| Developer | [`developer`](../.claude/agents/developer.md) subagent, one per slice | Sonnet 5.5; Opus for kernel and contract-freeze slices ([owner decision](decisions/owner-decision-sonnet-developers-2026-09-30.md)) | code, checks, self-review, opening the PR, fixes |
| Reviewer | [`reviewer`](../.claude/agents/reviewer.md) subagent, fresh per slice | highest Opus; Fable rarely (see below) | independent review, review record |

**Models** ([owner decision](decisions/owner-decisions-review-flow-2026-09-30.md)): a slice is
reviewed once, with a narrow fix check, by a reviewer on the highest Opus; the PM passes
`model: "fable"` only as a rare backstop for very complex work (it spends Claude Code tokens).
**Cross-vendor review** (codex, prepaid, reviews only) is an everyday second opinion beside
our own independent review, never instead of it: the PM may add it to any slice beyond
docs-only or trivial ones. Once CI is green the PM runs `codex exec` (read-only, `-m` Sol by
default, Astra for hard reviews (escalate freely)) with the
PR, head SHA, spec sections, focus and the output format (verdict, then findings with id,
severity, `path:line` at that SHA and a failure scenario, in one fenced block), appends the
answer verbatim to the review record, and adds its findings to the fix list.
Mechanical lookups go to the `Explore` agent (Haiku/Sonnet is fine).
Owner, 2026-10-01 (paraphrased): an Opus subagent drafts briefs and stage slice plans so the PM session stays thin (the PM decides); if codex is out of quota, a Fable subagent stands in for the cross-vendor review on kernel slice heads, never on fix re-reviews.

## Loop

**Keep going.** Once the owner has approved the slice plan, the PM runs steps 2 to 7 to the
merge without asking permission at each step, and settles judgment calls itself. When a
decision is hard, escalate in order: the `advisor` tool; then a higher model by hand (a
Fable subagent, or codex Astra for a hard review); only if both fail to settle it, or it is
critical, stop for the owner ([owner decision](decisions/owner-decision-autonomy-2026-09-30.md)).
A ladder answer is advice to the PM: it never changes a reviewer's finding or verdict and is
never the owner's OK. Critical means what [AGENTS.md](../AGENTS.md) and the owner decisions
reserve to the owner: a product or scope decision, a spec conflict, spending money, a
`--no-verify` push, anything destructive or outward-facing beyond the PR and its merge.
Report at the end of the slice, not at every step.

1. **Plan (PM).** Split the milestone into PR-sized slices, each citing its spec sections;
   keep [the roadmap](ROADMAP.md) current.
   Get the owner's OK on the plan and on any decision that is theirs.
2. **Brief (PM).** Name the branch; do not check it out (the developer does, in its own
   worktree). Spawn `developer` (pass `model: "opus"` for a kernel or contract-freeze slice) with a self-contained brief: goal,
   spec sections (the clause for each behavior), files in and out of scope, acceptance (which checks and fixtures must
   pass, which red controls to add, mutation cases, literal expected values), the relevant `docs/lessons/` file, and anything the owner
   decided, and a scope trigger (what makes the developer stop and ask, for example a frozen
   fixture or protocol file that would need to change). Add a timebox only for open-ended work:
   at the limit the developer stops and returns partial findings.
3. **Build and self-review (developer).** Implement; run the full local check line from
   AGENTS.md; run `/ponytail-review` (skill `ponytail:ponytail-review`, a user plugin) on the diff and a correctness pass over it
   (`/code-review medium`), both in the developer's worktree or on the PR number, never
   the main checkout; fix what they find. A PR that adds or changes a schema also runs the
   schema mutant sweep in the [contract lessons](lessons/contracts.md). Commit, push, open
   the PR (description cites spec sections and includes the ponytail result). Hand back a short note: what changed,
   branch and head SHA, the commands actually run (exit status, failing lines), self-review findings and
   dispositions, deviations from the brief, open questions.
4. **Verify and review.** PM does not relay claims: it confirms CI is green on the pushed
   commit (or reruns the check line) before review. Then it spawns a *fresh* `reviewer`
   with the PR number, the brief and the spec sections. The reviewer derives the
   requirements from the spec before reading the diff, and tests the tests by breaking
   the logic temporarily. It writes `docs/reviews/<date>-<slice>-review.md`, links it from
   [the index](reviews/README.md), and returns the findings.
5. **Fix (same developer).** PM forwards the findings with `SendMessage` to the developer,
   whose context is intact (after a PM session restart: a fresh developer gets the brief
   plus the findings). Every fix message restates the whole open finding list, not just the
   new ones (a resumed agent drops earlier directives). The developer runs `git pull --rebase` first (the review record is on the
   branch), never force-pushes, fixes or disputes each finding with a reason, reruns the
   checks and pushes.
6. **Re-review (same reviewer), scoped to the fixes.** PM sends the fix commits back to
   the same reviewer. It checks each disposition and the code the fix touched, plus that
   code's direct callers (a fix can break a neighbor), and nothing else; it appends the
   result to its record. A broad re-review of the whole PR happens only when the fixes
   rewrote a core piece or the slice freezes a contract or closes a gate. At most two fix
   rounds; anything still open goes up the escalation ladder above, then to the owner.
7. **Merge (PM).** Merge with a merge commit once the verdict is APPROVE or APPROVE WITH
   NOTES with nothing open and every CI job started on the head has finished green
   ([owner decision](decisions/owner-decisions-r3-lanes-2026-09-24.md),
   [which jobs run](decisions/owner-decision-ci-mobile-builds-2026-09-25.md)); then tell the owner:
   PR link, verdict, notes. Owner decisions, and anything still open after fix round 2 and the
   escalation ladder, go to the owner. If the slice taught a lesson, record it as
   [AGENTS.md, Hard-won lessons](../AGENTS.md#hard-won-lessons) says, and only if it changes a
   future decision and survives code drift; if a check could enforce it, write the check instead.

## Token hygiene

- Big outputs stay out of every agent's context, subagents' too: the PM delegates logs, diffs
  and check runs; any agent sends a check, test or push run to a scratchpad file named for the
  slice and reads only the exit status, the failing lines and the tail. Diffs a developer or
  reviewer must read are read per file or hunk, never by tail. Batch independent tool calls.
- Delegate mechanical work; clear the session after each merge and resume from the PM state
  file. No plugin or CLAUDE.md changes mid-session (they bust the prompt cache).
- Subagent returns are rules-shaped, under 250 words (reviewer 300): paths with `file:line`, decisions with
  a reason, open items, no narrative.
- PM state file: labeled "AS OF PR #N"; one "Open objectives" line; owner words only verbatim
  or marked "(paraphrased)"; keep `file:line` pointers and exact errors; drop spent exploration.

## Milestone gate: docs tidy pass

The gate review also covers the docs changed during the milestone (not `docs/spec/`,
which changes only by reviewed amendment, and not review or decision records, which are
history): a fact stated in two places (keep one, link to it), a lesson that is stale or
now enforced by a check, a doc turning into a catch-all. Findings are fixed in the gate PR.

## Git hygiene

- Every developer works in its own worktree on its own branch; the main checkout stays
  with the PM. Developer worktrees sit beside the repository (`../lokacore-<slice>`), outside
  the tree the checks scan, and are removed after merge. The reviewer mutates code only in a throwaway detached worktree
  (`git worktree add --detach`) and removes it before finishing.
- Parallel agents share one scratchpad: use file names unique to the slice (a shared
  `pr-body.md` once put one PR's description on another).
- The reviewer commits only its record, in a detached worktree at `origin/<branch>`,
  pushes from there with `git push origin HEAD:<branch>`, and removes the worktree.
- A new worktree has no `deps/`, `_build/` or `node_modules`: run `mix deps.get` there
  first, and `npm ci` at the root, in `kernel/ts` and in `mobile/app`.
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
- Same-model reviewers share blind spots with the developer. Deriving requirements from
  the spec first, breaking the code to test the tests, and a cross-vendor review are
  the counterweights; a longer checklist is not.
- The developer keeps its context across fixes, so fixes are cheap and consistent; the
  reviewer stays fresh so its judgment is independent.
- If a step keeps finding nothing across slices, the PM proposes dropping it to the owner.

## Review stance

Review depth scales with risk: a docs-only or config-only slice, or one that only changes
content numbers or UI styling ([playtest decision](decisions/owner-decision-playtest-2026-09-25.md)),
gets a short review (no mutation testing), a contract freeze gets the full one.

Adversarial in proportion: the reviewer tries to break the change, not to redesign it.
Every finding states a concrete failure scenario (input or state, then the wrong result),
or is labeled a question. Severities: **blocker** (wrong behavior, spec violation, check
that cannot fail), **should-fix**, **nit** (at most five). Over-engineering counts as a
finding. The reviewer does not ask for features the spec and brief do not require.
