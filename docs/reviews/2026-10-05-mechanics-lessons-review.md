# Verified mechanics lessons — independent review

PR [#169](https://github.com/lorecrafting/lokacore/pull/169), reviewed head
`dd6d7da6b21f8d98382f4687fe60342ea7caead7`, base `bb7f96a`.
Fresh independent reviewer; authored none of the proposed lessons.

**Verdict: APPROVE. No findings or open questions.**

## Requirements derived from the governing documents

- Lessons must describe verified incidents that change future engineering decisions,
  with accurate evidence and behavioral-test pointers.
- Keep the normative composition contract in
  [architecture](../system/architecture.md#building-mechanics-by-composition) and
  [mechanics](../system/mechanics.md); the lesson file supplies incident context.
- Keep this addition to the two demonstrated failures and a useful entry link from
  AGENTS.md. No new gameplay requirement or implementation machinery is needed.

## Verification and disposition

Read the governing composition section, existing area lessons, and
[PR #168's independent review and scoped fix](2026-10-05-m6-a-first-live-fight-review.md)
with its [author evidence](../evidence/2026-10-04-m6-a-first-live-fight/README.md).
Inspected the actual SQLite scheduled-departure regression and Flee query-budget test.
The former covers lost-COMMIT reconciliation, cold reopen between departure and the
pending round, then closure without damage or RNG draws. The latter exhausts the
aggregate query budget using two candidate policies and requires the literal typed
fault plus unchanged World identity.

Inspected the retained counter-reset red-control failure and restored passing output.
The mutant accepts a paid movement and encounter closure where the regression expects
`budget_exceeded`; this substantiates the second incident independently of its prose.
The first incident and validator red controls are recorded in the prior independent
review. No new mutation tests were run for this docs-only change.

Exactly two incident lessons are added. Their short practical guidance supplies context
for the linked contract without copying its normative detail. The AGENTS.md link makes
the file discoverable before engine mechanics work. Relative targets and both section
anchors resolve; the repository documentation check and review diff check passed.

Ponytail Review: lean already; no actionable simplification. Correctness review found
no unsupported claim, misleading test pointer or additional requirement.
