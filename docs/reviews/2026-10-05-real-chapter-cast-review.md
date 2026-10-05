# Independent review: real chapter cast (PR #180)

- Reviewed commit: `6954a41bc15fa9a3820b9a406bc29ad231bf60af`
- Scope: six documentation files; short docs-only review
- Verdict: **APPROVE**

## Requirements derived from the governing records

1. [Actual chapter cutover](../decisions/owner-decision-actual-chapter-cutover-2026-10-05.md) makes the active app the incremental Missing Child chapter, retires the temporary Lantern errand, and says Q1 and the main search are not yet playable.
2. The owner clarification supplied with this slice excludes Old Bram from the active real chapter by default. A new decision must state its supersession without rewriting historical records.
3. The [no-wait opening rule](../decisions/owner-decision-no-wait-opening-2026-10-05.md) continues to govern required routes, even though its Bram-specific Q1 route is superseded.

## Review

The new decision scopes the cast change and explicitly supersedes both the cutover record's unresolved Bram question and the no-wait record's Bram-specific Q1 route. The active cartridge, owner-rules, queue and roadmap text agree that Q1 awaits design from the real Ashmere cast and rooms; none assigns a giver or claims the search is playable. Historical decisions, sampler source and fixtures are unchanged. No new machinery or redundant rules were added.

Checks: `mise exec -- elixir bin/check_docs.exs` passed (418 docs, 0 broken links, 0 unreachable); `git diff --check 8eafe404..6954a41b` passed. No mutation test applies to this docs-only slice.

Findings: none.
