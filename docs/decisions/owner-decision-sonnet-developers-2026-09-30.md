# Owner decision: Sonnet developers, Opus for kernel and contract slices — 2026-09-30

Relayed by the PM (Claude Code) from the owner's chat, **(paraphrased)**: the verbatim words
were not retained. No checker can verify this against the chat.

Owner (paraphrased): yes, after the Gate R5 PR merges, make the developer subagent default to
Sonnet 5.5, with Opus passed explicitly for kernel and contract-freeze slices; reviewers stay
on the highest Opus.

Effect ([workflow](../WORKFLOW.md)):

- `.claude/agents/developer.md` defaults to `model: sonnet`; the PM passes `model: "opus"` for
  kernel and contract-freeze slices. Reviewers are unchanged.
- Sonnet developers need explicit briefs: files, the spec clause per behavior, mutation
  cases, literal expected values.
- Reason: Claude Code is the principal and burns tokens; Opus review is the safety net.
- Follow-up: compare Sonnet and Opus slices in `docs/dev-evidence.jsonl` (tokens, fix
  rounds); return contract-heavy slices to Opus if Sonnet needs more rounds.
