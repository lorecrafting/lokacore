# Review: Chapter 1 polish order (PR #297)

- PR: [#297](https://github.com/lorecrafting/lokacore/pull/297), branch `docs/chapter-one-polish-order`, exact head `ff7c35ab12d5349143ff9f72671540a66fb79132`.
- Governing: [AGENTS.md](../../AGENTS.md), [WORKFLOW.md](../WORKFLOW.md) Review stance, [owner rules](../system/owner-rules.md).
- **Verdict: APPROVE WITH NOTES.**

## Must be true

1. The record gives the owner order: E1 to coverage complete, E2, polish, release-candidate certification on one frozen source, E3; owner wording marked (paraphrased).
2. The index lines, the ROADMAP line and the brief notes link to the record and do not contradict it.
3. Beads: polish waits for E2, certification waits for polish, E3 waits for certification; `--complete` passes; no local paths.
4. The duplicate-slice red control still plants a real slice duplicate.

## Checks

- Record steps 1–5 and polish lane match the brief; (paraphrased) on the order, the reason and the lane.
- Beads diff: `loka-51b` → E2; `loka-4xk` → `loka-51b`; E3 → `loka-4xk` + E2. `check_beads_export.py --complete` exit 0. No machine paths in the diff.
- `bin/beads_red_controls.sh` green at head. Mutant `rows[0]` (now `loka-4xk`): exits 1 with "a duplicate slice was accepted". Restored. The regex matches the checker (`bin/check_beads_export.py:55`).
- E1 brief body still lists the final steps; the top amendment comes before the publication note and the brief is provisional. Acceptable.
- Over-engineering: none.

## Findings

1. **should-fix**: `docs/decisions/owner-decision-chapter-one-polish-order-2026-10-07.md:5,8`. Step 1 says E1 closes with an "independent" review, and step 4 says the Fable gate audit "moves here from E1". [WORKFLOW.md:23](../WORKFLOW.md) and `owner-rules.md:241` still require Fable for E1 closure. Failure: the PM closes E1 on an Opus review and cites the record, or runs Fable twice, because nothing says which applies. Fix: one clause naming the E1 closure reviewer, or amend the workflow line.
2. **nit**: `.beads/issues.jsonl`, the `loka-e1-r9-certification-2rz` notes. The old sentence "Final exact-candidate selected-v042 10,000-sequence proof, independent gate review and exact-head CI remain" stays above the 2026-10-07 line that moves the proof out of E1. A reader who stops at the first line plans the v042 proof inside E1.
