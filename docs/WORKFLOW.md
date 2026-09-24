# Delivery workflow: PM, developer, reviewer

Every milestone slice (one PR) runs through three roles. Claude Code runs them as the
main session plus the subagents in [`.claude/agents/`](../.claude/agents/developer.md).
Other agents (Codex and others) use those two files as the role prompt, for example "act as
the reviewer in `.claude/agents/reviewer.md` for PR #N"; a reviewer from another vendor is
a welcome source of independence. [AGENTS.md](../AGENTS.md) rules apply to every role.

| Role | Who | Model | Owns |
|---|---|---|---|
| PM | the main session | the owner's choice | plan, slices, briefs, owner contact, merges after the owner's OK |
| Developer | [`developer`](../.claude/agents/developer.md) subagent, one per slice | Opus | code, checks, self-review, opening the PR, fixes |
| Reviewer | [`reviewer`](../.claude/agents/reviewer.md) subagent, fresh per slice | Opus; Fable for design judgment | independent review, review record |

**Fable reviews design judgment:** a slice that freezes semantics later work cannot cheaply
change (a spec amendment, a canonical encoding, an identity or delta contract, a gate
review), or an Opus reviewer and the developer disagreeing twice. The PM passes
`model: "fable"` when spawning that reviewer (the file's default is Opus). Everything else
stays on Opus.
Mechanical lookups go to the `Explore` agent (Haiku/Sonnet is fine).

## Loop

1. **Plan (PM).** Split the milestone into PR-sized slices, each citing its spec sections;
   keep [the roadmap](ROADMAP.md) current.
   Get the owner's OK on the plan and on any decision that is theirs.
2. **Brief (PM).** Name the branch; do not check it out (the developer does, in its own
   worktree). Spawn `developer` with a self-contained brief: goal,
   spec sections, files in and out of scope, acceptance (which checks and fixtures must
   pass, which red controls to add), and anything the owner decided.
3. **Build and self-review (developer).** Implement; run the full local check line from
   AGENTS.md; run `/ponytail-review` (skill `ponytail:ponytail-review`, a user plugin) on the diff and a correctness pass over it
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
   whose context is intact (after a PM session restart: a fresh developer gets the brief
   plus the findings). It runs `git pull --rebase` first (the review record is on the
   branch), never force-pushes, fixes or disputes each finding with a reason, reruns the
   checks and pushes.
6. **Re-review (same reviewer), scoped to the fixes.** PM sends the fix commits back to
   the same reviewer. It checks each disposition and the code the fix touched, plus that
   code's direct callers (a fix can break a neighbor), and nothing else; it appends the
   result to its record. A broad re-review of the whole PR happens only when the fixes
   rewrote a core piece or the slice freezes a contract or closes a gate. At most two fix
   rounds; anything still open goes to the owner.
7. **Merge (PM).** Summarize for the owner: PR link, verdict, open notes. Merge with a merge
   commit only after the owner's OK. Update AGENTS.md lessons if the slice taught one.

## Milestone gate: docs tidy pass

The gate review also covers the docs changed during the milestone (not `docs/spec/`,
which changes only by reviewed amendment, and not review or decision records, which are
history): a fact stated in two places (keep one, link to it), a lesson that is stale or
now enforced by a check, a doc turning into a catch-all. Findings are fixed in the gate PR.

## Git hygiene

- Every developer works in its own worktree on its own branch; the main checkout stays
  with the PM. The reviewer mutates code only in a throwaway detached worktree
  (`git worktree add --detach`) and removes it before finishing.
- The reviewer commits only its record, in a detached worktree at `origin/<branch>`,
  pushes from there with `git push origin HEAD:<branch>`, and removes the worktree.
- A new worktree has no `deps/`, `_build/` or `node_modules`: run `mix deps.get` and
  `npm ci` there first.
- Git hooks are set once per clone ([AGENTS.md, Working rules](../AGENTS.md#working-rules));
  worktrees share that setting.
- Agent types in `.claude/agents/` register only when a session starts. If one is missing,
  spawn `general-purpose` and tell it to follow the definition file.

## Why these steps (keep them only while they earn their cost)

- The brief is the biggest quality lever: a vague brief yields confident wrong work.
  Acceptance is written as checkable items before any code.
- Same-model reviewers share blind spots with the developer. Deriving requirements from
  the spec first, breaking the code to test the tests, and Fable on semantic freezes are
  the counterweights; a longer checklist is not.
- The developer keeps its context across fixes, so fixes are cheap and consistent; the
  reviewer stays fresh so its judgment is independent.
- If a step keeps finding nothing across slices, the PM proposes dropping it to the owner.

## Review stance

Review depth scales with risk: a docs-only or config-only slice gets a short review (no
mutation testing), a contract freeze gets the full one.

Adversarial in proportion: the reviewer tries to break the change, not to redesign it.
Every finding states a concrete failure scenario (input or state, then the wrong result),
or is labeled a question. Severities: **blocker** (wrong behavior, spec violation, check
that cannot fail), **should-fix**, **nit** (at most five). Over-engineering counts as a
finding. The reviewer does not ask for features the spec and brief do not require.
