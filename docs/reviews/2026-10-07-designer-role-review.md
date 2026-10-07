# Review: designer role (PR #298)

- PR: [#298](https://github.com/lorecrafting/lokacore/pull/298), branch `docs/designer-role`, exact head `e6d7a078d070f8767eb4ee00407966b1d0d4f7e2`; CI green.
- Governing: owner decision 2026-10-07 (PM brief), [AGENTS.md](../../AGENTS.md), [WORKFLOW.md](../WORKFLOW.md) Review stance. Short docs-only review, no mutation testing.
- **Verdict: APPROVE WITH NOTES.**

## Must be true

1. Designer is the single writer of tokens, the component catalogue and `book-ui.md` interaction rules; developers propose.
2. Designer review plus a fresh correctness pass is the independent review only for a pure UI polish batch; that pass checks the designer's own text. Mechanics, save, protocol or kernel get the normal reviewer.
3. No role approves its own text; no change to PM tracker ownership or reviewer independence; no scope or taste authority.
4. Record marks owner words (paraphrased), PM clarification separate; each fact in one place; AGENTS.md within budget.

## Findings

1. **should-fix** `docs/WORKFLOW.md:26`: the routing row sends "Book UI design check or review" to `designer` and adds the normal `reviewer` only when mechanics, save, protocol or kernel are in the diff. It omits the fresh correctness reviewer (stated only in `designer.md:29-30` and the record's PM clarification) and does not limit designer-as-review to pure polish. Scenario: a PM routing from this table sends a pure polish batch, or a non-polish UI slice with no kernel change, to the designer alone; the designer's own spec and token text merges unreviewed (breaks item 2 and 3). Fix: escalation cell reads, e.g., "always also a fresh `reviewer`: a quick correctness pass for a pure UI polish batch, otherwise the normal review".
2. **nit** `.claude/agents/designer.md:37` vs `:31-32`: "Edit only the design-system docs and the token file" conflicts with "write and link the record" (`docs/reviews/`). Add review records to the allowed edits.
3. **nit** `.claude/agents/designer.md:35,37`: "the token file" does not exist yet (record: "No tokens ... are created"). Acceptable as forward reference; name the path when the polish slice creates it.

## Checked, no finding

- Record (`docs/decisions/owner-decision-designer-role-2026-10-07.md`) matches the brief; PM clarification sits under Effect, labelled.
- `designer.md` matches `developer.md`/`reviewer.md` frontmatter and tools list, links sources, return under 250 words.
- `bin/check_docs.exs`: exit 0 (277 docs, 0 broken links; AGENTS.md budget passes).
- No tracker (`br`) duties given to the designer; reviewer independence intact.
- PR #297: its polish lane defers designer review to "its own decision, in another PR"; consistent with this PR, no contradiction on lines 11, 15, 23 or 308.
- Over-engineering: none; 90 added lines across the required files.
