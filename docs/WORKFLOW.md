# Delivery workflow: PM, developer, reviewer

Every milestone slice (one PR) runs through three roles. Claude Code runs them as the
main session plus the subagents in [`.claude/agents/`](../.claude/agents/developer.md);
other agents follow the same steps by hand. [AGENTS.md](../AGENTS.md) rules apply to every role.

| Role | Who | Model | Owns |
|---|---|---|---|
| PM | the main session | Opus | plan, slices, briefs, owner contact, PRs, merges after the owner's OK |
| Developer | [`developer`](../.claude/agents/developer.md) subagent, one per slice | Opus | code, checks, self-review, fixes |
| Reviewer | [`reviewer`](../.claude/agents/reviewer.md) subagent, fresh per slice | Opus; Fable when escalated | independent review, review record |

**Escalate to Fable** only for the reviewer, and only when a slice freezes semantics that
later work cannot cheaply change (a spec amendment, a canonical encoding, an identity or
delta contract, a gate review) or when an Opus reviewer and the developer disagree twice.
Mechanical lookups go to the `Explore` agent (Haiku/Sonnet is fine).

## Loop

1. **Plan (PM).** Split the milestone into PR-sized slices, each citing its spec sections.
   Get the owner's OK on the plan and on any decision that is theirs.
2. **Brief (PM).** Create the branch. Spawn `developer` with a self-contained brief: goal,
   spec sections, files in and out of scope, acceptance (which checks and fixtures must
   pass, which red controls to add), and anything the owner decided.
3. **Build and self-review (developer).** Implement; run the full local check line from
   AGENTS.md; run `/ponytail-review` on the diff and a correctness pass over it
   (`/code-review medium`); fix what they find. Commit, push, open the PR (description cites
   spec sections and includes the ponytail result). Hand back a short note: what changed,
   check output, self-review findings and dispositions, open questions.
4. **Verify and review.** PM does not relay claims: it confirms CI is green on the pushed
   commit (or reruns the check line) before review. Then it spawns a *fresh* `reviewer`
   with the PR number, the brief and the spec sections. The reviewer derives the
   requirements from the spec before reading the diff, and tests the tests by breaking
   the logic temporarily. It writes `docs/reviews/<date>-<slice>-review.md`, links it from
   [the index](reviews/README.md), and returns the findings.
5. **Fix (same developer).** PM forwards the findings with `SendMessage` to the developer,
   whose context is intact. It fixes or disputes each finding with a reason, reruns the
   checks and pushes.
6. **Re-review (same reviewer), scoped to the fixes.** PM sends the fix commits back to
   the same reviewer. It checks each disposition and the code the fix touched, plus that
   code's direct callers (a fix can break a neighbor), and nothing else; it appends the
   result to its record. A broad re-review of the whole PR happens only when the fixes
   rewrote a core piece or the slice freezes a contract or closes a gate. At most two fix
   rounds; anything still open goes to the owner.
7. **Merge (PM).** Summarize for the owner: PR link, verdict, open notes. Merge with a merge
   commit only after the owner's OK. Update AGENTS.md lessons if the slice taught one.

One developer at a time works in the main checkout. Parallel developers each get
`isolation: "worktree"` and their own branch.

## Why these steps (keep them only while they earn their cost)

- The brief is the biggest quality lever: a vague brief yields confident wrong work.
  Acceptance is written as checkable items before any code.
- Same-model reviewers share blind spots with the developer. Deriving requirements from
  the spec first, breaking the code to test the tests, and Fable on semantic freezes are
  the counterweights; a longer checklist is not.
- The developer keeps its context across fixes, so fixes are cheap and consistent; the
  reviewer stays fresh so its judgment is independent.
- Review depth scales with risk: a docs-only or config-only slice gets a short review, a
  contract freeze gets the full one. If a step keeps finding nothing across slices, the
  PM proposes dropping it to the owner.

## Review stance

Adversarial in proportion: the reviewer tries to break the change, not to redesign it.
Every finding states a concrete failure scenario (input or state, then the wrong result),
or is labeled a question. Severities: **blocker** (wrong behavior, spec violation, check
that cannot fail), **should-fix**, **nit** (at most five). Over-engineering counts as a
finding. The reviewer does not ask for features the spec and brief do not require.
