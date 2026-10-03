# Review: agent tools allowlist (PR #62)

- PR: #62, branch `agent-tools`
- Commit reviewed: `edd03ac`
- Scope: config/docs only (`.claude/agents/developer.md`, `.claude/agents/reviewer.md`, `docs/WORKFLOW.md`); no mutation testing.
- Verdict: **APPROVE WITH NOTES**

## Must be true

1. Every step the two definitions and `docs/WORKFLOW.md` assign to the developer or reviewer is doable with Bash, Read, Edit, Write, Skill, ReportFindings, ToolSearch.
2. `tools:` is a valid Claude Code subagent frontmatter field in the documented comma-separated form.
3. The new bullet does not contradict the session-start registration bullet, the 250/300-word caps, or reviewer independence.
4. `bin/check_docs.exs` passes.

## Checks

1. Achievable. git/gh/mise/worktrees, `ast-grep`, `mix xref`, CI waits (`gh pr checks --watch`) go through Bash; `/ponytail-review` and `/code-review` through Skill; `ReportFindings` is the tool `/code-review` reports with (confirmed in a prior session's tool schema); record via Write/Edit; record commit/push via Bash. Outside the list: `Agent` (WORKFLOW.md:25 sends mechanical lookups to `Explore`; that is PM guidance, and Bash covers it), `SendMessage` (subagents answer through their return), `Monitor`, `WebFetch`, codex (PM-only per WORKFLOW.md:18-24). None essential. No Glob/Grep tools exist in this environment.
2. Valid: `tools: A, B, C` matches the Claude Code subagent docs format (checked from knowledge of the docs, not fetched this session); omitting it inherits all tools. The live session still lists both types as "All tools" because types register at session start, so the change takes effect next session.
3. No contradiction with the registration bullet (same `general-purpose` fallback) or the word caps.
4. `mise exec -- elixir bin/check_docs.exs`: 151 docs, 0 broken, 0 unreachable.

## Findings

- **nit** `docs/WORKFLOW.md:109-110`: the tool list is restated from the frontmatter. Adding a tool to `tools:` (the bullet's own remedy) leaves WORKFLOW stale; the docs tidy pass forbids a fact in two places. Say "list their tools in `tools:`" without the list.
- **nit** `docs/WORKFLOW.md:111`: "the PM either does that step" for a blocked reviewer step (e.g. running a check the reviewer must see fail) puts review work on the PM, weakening independence. Scope it: for the reviewer, spawn a fresh `general-purpose` with the definition file.
- **question** `.claude/agents/developer.md:4`: if `/code-review medium` fans out subagents it needs `Agent`, not listed. Non-blocking: developer.md step 2 already allows the same questions by hand.
- **question** `ToolSearch` only loads deferred tools that are also in the allowlist; it matters only if `ReportFindings` arrives deferred. Harmless.

## Fix check: `2bcb5c2`

Scope: that commit only (`docs/WORKFLOW.md:109-114`).

- nit 1 (duplicated tool list): fixed; the bullet points to `tools:` in the definition files, no list.
- nit 2 (PM doing a blocked reviewer step): fixed; a blocked reviewer step goes to a fresh `general-purpose` with the definition file, never the PM. Consistent with the registration bullet at `docs/WORKFLOW.md:107-108`.
- questions 3 and 4: dispositions accepted (step 2 allows the review by hand; ToolSearch harmless).
- `bin/check_docs.exs` passes.

Verdict: **APPROVE**.
