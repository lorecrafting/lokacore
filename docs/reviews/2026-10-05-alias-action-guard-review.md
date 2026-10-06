# Authored action alias guard — independent docs review

**Verdict: APPROVE.** No findings.

- Exact source reviewed: `f0b94db9a9d3ff4f7978739294e463cb9678d36d`.
- Reviewer: fresh independent Codex; authored none of the source.
- Scope: `docs/WORKFLOW.md` and `docs/lessons/mechanics.md` only.

## Review

The new brief guidance requires naming both the offered action key and resolved command, and asks for a loaded alias in a view-to-invocation check where those names can differ. This targets the concrete failures recorded in the [B4 primary review](2026-10-05-b4-light-primary-review.md) and B7 primary review record (`2026-10-05-b7-waterskin-primary-review.md`): B4's authored refuel alias was confused with the engine command, and B7's `draw_water`, `decant` and `sip` keys resolving to `fill`, `pour` and `drink` produced no offers. In both cases, exact keyed admission and execution matter.

The requested check is deterministic: use a loaded action whose key differs from its resolved command, observe the offered invocation, then invoke that same key and targets through the existing admission path. The workflow also explicitly reuses an existing same-layer check if it catches the break. It does not require a new framework or a duplicate test. The lesson records the same evidenced distinction and keeps Book ownership separate from eligibility.

**Ponytail Review:** Lean already. Two documentation edits add the missing condition to existing workflow and mechanics guidance; no new layer or test machinery.

Validation: `mise exec -- elixir bin/check_docs.exs` and `git diff --cached --check` pass. The normal commit hook passes. Runtime tests do not apply to this docs-only review.
