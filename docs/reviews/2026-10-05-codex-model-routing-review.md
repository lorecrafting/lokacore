# Codex model routing review — 2026-10-05

- Local draft branch: `docs/codex-model-routing`; base `a7d4ef21`.
- Source head reviewed: `16f9c8492a0ce30b0920953e7c2ec05b1bbb6d0d`.
- Scoped final head: `8bcfee016e7c7af693017ae3fb595fc13132933d`.
- Reviewer: fresh independent Codex agent; authored none of the source change.
- Verdict: **APPROVE**. No open findings.

## Requirements established from governing records

- Preserve Claude Sonnet/Opus policy; distinguish a delegated PM Codex selection from an owner quote.
- Retain fresh independent review and the separate second opinions required by the [one-reviewer decision](../decisions/owner-decision-one-reviewer-default-2026-10-04.md), including gate/proposal Astra audits and Sol fix rechecks.
- Do not turn a planned save/receipt/protocol implementation into a mechanical task or claim observed cost/quality savings without evidence.
- Keep local checks, exact-head review, normal hooks and later hosted-CI requirements from the [local cadence decision](../decisions/owner-decision-local-draft-pr-cadence-2026-10-05.md).

## Findings and scoped disposition

- **CMR-N1 — nit, closed.** At initial decision lines 20–21, the four B2 findings were described as closed by SQLite red controls. A reader would infer four save-control proofs, but B2-P2 was visible deadline copy. The final head accurately distinguishes three independently proved save guards from Peg's wording fix; checked against both retained B2 review records.

The routing keeps Claude policy explicit and uses the [workflow](../WORKFLOW.md) as the authority for review count and independence. Sol handles substantive implementation; higher effort and the existing Astra audits cover named risks. Unknown token observations remain unknown; the record expressly disclaims using old evidence or API list prices to measure current session savings.

## Verification

- `git diff --check a7d4ef21 8bcfee01`: passed.
- `MISE_STATE_DIR=<writable scratch> mise exec -- elixir bin/check_docs.exs`: passed with this record indexed; zero broken links or unreachable documents.
- Normal pre-commit hook: passed.
- Ponytail Review: lean already; no machinery or redundant policy to remove.
- Docs-only review: no runtime tests or mutation testing required. No push, merge or hosted-CI claim.
