# Review: prologue outline working draft, PR #528 (loka-g5hh)

- PR [#528](https://github.com/lorecrafting/lokacore/pull/528) at `319c58704bbd1aeee5b9263d70a9b75725b29323` (main at `9c7f0a4c0`, head up to date).
- Governing: [notes README](../worldbuilding/notes/README.md), [worldbuilding README](../worldbuilding/README.md) (canon tiers; notes are not canon until absorbed), `br show loka-g5hh` (owner rulings 2026-10-30), [WORKFLOW.md "Review stance"](../WORKFLOW.md#review-stance) (docs-only: no mutation run).
- Reviewer: independent; authored none of the work. Record on PM request (docs slice). Story content not judged (owner's call).
- Verdict: **APPROVE WITH NOTES** (no blocker, no should-fix, four nits).

## Must be true (written before reading the diff)

1. The note is marked not canon, names its sources, and does not pass Fable's or the PM's text off as the owner's words.
2. Owner rulings it cites match `loka-g5hh`.
3. It contradicts no `canon`-tier stub, or says so.
4. Links and anchors resolve; `elixir bin/check_docs.exs` passes; CI green on the head.

Results: 1 holds (line 3 "Not canon. Written by Fable"; sources the v2 repo path, which exists, and `loka-g5hh`; README entry says "not the owner's words"; owner rulings are paraphrase, not quotes). 2 holds (rulings 1-5 at lines 198-202 match the Beads note). 3 holds: no stub on main is at `canon` tier (highest is `draft`). 4 holds: check_docs `779 docs, 0 broken link(s), 0 broken anchor(s), 0 unreachable`; the note has no relative links. CI: `ci`, `book-e2e`, `graph-diff` all success for `319c587`.

Claims rerun: 48 beats (9+8+10+10+11, line 187) and 18 rooms (line 189) both count true.

## Findings

1. **Nit, `docs/worldbuilding/notes/prologue-outline-2026-10-30.md:158,161,162,164,167`** (seed table vs beats). "Too loud for me" is not in beat 23; "Some paths are walked alone" is said at 43 (line 106), not 38; the pressed flower and "Everything is given" are absent from 47 and 44; "The Pulse is strong today" is not in beat 6. A scene-sheet writer working from the table plants or pays at the wrong beat.
2. **Nit, same file `:30,:34,:40`** (draft-tier divergence unstated). Dozens of Vowed and Thera as the one Heart differ from `21-story/main-storyline-arc.md:25,29` (300 acolytes, companion one of them); "no economy, trowel the only metal" differs from `05-geography/starting-region.md` Stage 4 (smelting, coins). Drafts may change without a retcon log, so not a contradiction; listing them lets the absorbing stub edit find them.
3. **Nit, `docs/worldbuilding/notes/README.md:3`.** The header still says notes are "in the owner's own words"; this is the second entry that is not. The 2026-10-23 entry says "placed here at the owner's request"; this one gives no such reason.
4. **Nit, PR body.** No `/code-review` result reported.
