# Action availability lesson — independent docs-only review

**Verdict: APPROVE.** No findings.

- Local source branch: `docs/action-seam-lesson`.
- Exact source reviewed: `1b2afed918f9a4136650ee47c5bc6498bd91bb87`.
- Reviewer: independent Codex Astra; authored none of the lesson change.
- Remote PR: null. This is a local documentation verdict.

The governing requirements are [mechanic composition](../system/architecture.md#building-mechanics-by-composition), [ActionSet and admission](../system/protocol.md#actionset-and-admission), [GameView](../system/protocol.md#gameview) and the [Book boundary](../system/book-ui.md). Shared eligibility must preserve keyed target/input admission, keep presentation separate from gameplay ownership, and reuse the smallest existing mechanic query. A lesson must record evidenced history and guide a later consumer without inventing a new framework or changing delivery gates.

The single added [mechanics lesson](../lessons/mechanics.md) accurately summarizes B4-02 and its [approved fix](2026-10-05-b4-light-primary-review.md#scoped-fix-round-1--approve): a narrowed light alias bypassed authored admission in projection; the corrected candidate uses keyed ordinary refusal before the pure light transition. B4-01 separately supports distinguishing Book placement/wording from eligibility. The conditional guidance for later duplicated ordering fits the existing shared-module architecture and requires a concrete regression/red control. It does not claim that every present action path is already consolidated or that snapshot availability guarantees execution or persistence success.

Ponytail Review: Lean already. Ship. No abstraction, dependency, migration, implementation queue or new approval step is introduced.

Validation: `mise exec -- elixir bin/check_docs.exs` and `git diff --cached --check` pass. The normal pre-commit hook runs on the review-only commit. No runtime or mutation tests apply to this one-line documentation change; B4 runtime evidence remains owned by its original review record. No source change, merge or push was performed.
