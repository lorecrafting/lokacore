# Independent review: PR #2 "Delivery workflow and test-writing rules"

- Reviewed commit: `7b2e7ab` (branch `workflow-pm-dev-review`, base `main` at `841f50d`)
- Reviewer: Claude Opus 5.5 (fresh agent; authored none of the work)
- Date: 2026-09-24
- Depth: short (docs-only slice, per [WORKFLOW.md](../WORKFLOW.md) "Review depth scales with risk")
- Checks: CI green on `7b2e7ab` (elixir, lint, typescript); `elixir bin/check_docs.exs` →
  50 docs, 0 broken, 0 unreachable.

## What must be true (derived from the owner's intent before reading the diff)

1. The PM splits and briefs; the developer builds and self-reviews; a fresh reviewer is
   adversarial but proportionate; the same developer fixes; re-review covers only the fixes
   unless the slice is large or important.
2. Every step works mechanically in Claude Code (agent registration, skills in subagents,
   SendMessage continuation, worktrees, concurrent pushes).
3. Test rules make tests accurate without needless fixtures or validations, and do not
   contradict the R1 lessons in AGENTS.md.
4. Opus by default; Fable only on escalation, and the escalation actually takes effect.
5. No contradiction with the rest of AGENTS.md; no step costs more than it catches.

## Verdict: APPROVE WITH NOTES

The loop matches the owner's intent: scoped re-review, two-round cap, owner as tiebreaker,
PM verifying CI rather than relaying claims, and a standing rule to drop steps that find
nothing. Mechanically it mostly holds: agent definitions without a `tools` list inherit the
Skill tool, so subagents can run `/ponytail-review` and `/code-review`; `SendMessage`
continues a finished agent with its context. No step is ceremony worth cutting: the
developer's self-review is cheaper than a review round trip. Three should-fix items: a git
collision when worktrees or the reviewer's push are involved, a mocking example that
contradicts the SQLite fault lesson, and a model rule that contradicts AGENTS.md and does
not say how to escalate.

---

## Findings

### F1 (should-fix): branch ownership and the reviewer's push collide with worktrees and the fix push

`docs/WORKFLOW.md:22` (PM creates the branch), `:48-49` (parallel developers in worktrees),
`.claude/agents/reviewer.md:29-31` (reviewer commits and pushes to the PR branch),
`.claude/agents/developer.md:26-27` (developer pushes fixes).

- Scenario A: the PM runs `git checkout -b r3-x` in the main checkout, then spawns the
  developer with `isolation: "worktree"`. The developer's `git checkout r3-x` fails
  ("already checked out at ..."), so it improvises a second branch name.
- Scenario B: the developer works in a worktree on `r3-x`. The reviewer, in the main
  checkout, cannot check out `r3-x` to commit its record. If it pushes the record some
  other way, the developer's local `r3-x` is now behind `origin`, its fix push is rejected,
  and the easy way out, `--force`, deletes the review record.
- Scenario C, same checkout: the reviewer's temporary mutation (reviewer.md step 3) is left
  in place when the reviewer is interrupted, and the developer's next `git add -A` commits
  it.

Fix (three lines): the PM creates the branch without checking it out (`git branch`) or the
developer creates it; the developer runs `git pull --rebase` before fix commits and never
force-pushes; the reviewer ends with a clean `git status` except its two files.

### F2 (should-fix): "Mock a store commit" contradicts the SQLite fault-testing lesson

`AGENTS.md:146-147` gives "a store commit" as the example of what may be mocked. But
`AGENTS.md:104-108` says real faults (`max_page_count` → real `SQLITE_FULL`, a genuinely
failed COMMIT) are the lesson, and `:45-47` says commits cost 1 to 11 ms, which is not
slow. Scenario: a developer tests the ADR-072 unknown-commit path with a mocked commit
that raises. The test passes, but the path is the one R1 showed a fake never exercises.
Fix: use "a device, the network" as the examples and add "store commit faults use real
SQLite faults (see SQLite fault testing)".

### F3 (should-fix): the Fable rule contradicts AGENTS.md, and escalation has no mechanism

- `AGENTS.md:196-197` says "prefer Fable for design-judgment reviews"; `docs/WORKFLOW.md:13-15`
  says Fable only for semantic freezes or a disagreement repeated twice. A PM reading
  AGENTS.md sends every review that involves design judgment to Fable, which is most
  reviews. Align AGENTS.md to "Fable when escalated per WORKFLOW.md".
- `.claude/agents/reviewer.md:4` pins `model: opus`. Spawning `reviewer` for a contract
  freeze runs Opus unless the Agent call passes `model: "fable"`, and WORKFLOW.md does not
  say so. Add that to line 13.
- `docs/WORKFLOW.md:9` lists the PM as Opus, but a document cannot set the main session's
  model; the owner chooses it. State it as "run the main session on Opus", or drop the cell.

### N1 (nit): who opens the PR

`docs/WORKFLOW.md:9` says the PM owns "PRs"; `:27` and developer.md step 3 have the
developer open it. Say the PM owns "merges" only.

### N2 (nit): steps that depend on the session have no fallback

Agent types in `.claude/agents/` register only at session start. `SendMessage` continuity
(`docs/WORKFLOW.md:36`) ends if the PM session restarts between review and fix. One line
covers both cases: if the type is missing, spawn `general-purpose` told to follow the
definition file; if the developer is gone, a fresh developer gets the brief plus the
findings.

### N3 (nit): the reviewer is never pointed at the rule that scales review depth

`reviewer.md:8` points the reviewer to WORKFLOW.md "Review stance". The rule that scales
depth with risk is in "Why these steps" (`docs/WORKFLOW.md:60-61`), so a reviewer following
its definition may run full mutation testing on a config slice. Move that sentence into
Review stance.

### N4 (nit): skill name

`/ponytail-review` comes from a user plugin (`ponytail:ponytail-review`) and is not in the
repository. That is fine for the owner's machine, and other agents already have the
by-hand fallback. Naming the plugin once avoids a failed Skill call.
