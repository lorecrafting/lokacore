# Read-once documentation rule review

- PR: #195
- Source commit reviewed: `fe73a47695aa17aa8868e521db626154bff6f7a1`
- Verdict: **APPROVE**

## Requirements established before reading the diff

- An agent should reuse a needed document already in its current context while following links or read instructions.
- The rule must still allow reading changed, truncated, or insufficient material, and each fresh agent must make its own first read.
- Required governing sections remain discoverable and readable; the new decision is recorded in `docs/decisions/` and linked from the decision index and active owner rules.
- AGENTS.md stays within its word budget, with valid links and reachable documentation.

## Findings

None. The rule avoids repeated reads within one agent context while preserving rereads for changed, truncated or insufficient material, and first reads for fresh subagents. The governing references remain in place.

## Verification

- `git diff --check`: passed.
- `mise exec -- elixir bin/check_docs.exs`: passed after this record was linked in the review index; AGENTS.md is 1,399 words, with zero broken or unreachable links.
- Source PR's docs lint: green at the reviewed commit. No tests needed for this docs-only change.
- Ponytail review: lean already; no extra machinery or duplicate rules to remove.
