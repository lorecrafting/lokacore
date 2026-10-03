# Owner decisions: ADR-075 kernel version and dev-evidence ledger — 2026-09-25

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's chat. No checker can verify these quotes against the chat.

## What the PM proposed (summary)

1. **Kernel build identity:** kernel_version is the source revision, `<KERNEL_ID>@<full git commit>`, from a clean tree. A build from uncommitted changes is marked distinguishably and is never an exact repro key. A human-readable release version may be added later as a display label only.
2. **Dev-evidence ledger:** a committed `docs/dev-evidence.jsonl` that the PM appends when a PR merges or closes. Each line holds one agent role per PR (with model and instance) and its token usage (unknown, never 0, when not observed), and records the PR disposition, not the agent's correctness. It is evidence for analysis, never an acceptance authority.

Astra's cross-vendor review (PR #29 record) recommended both.

## Owner's words

> 1. yes go with your reccomendation. 2. yes go with your recommendation
