# Retire the board dashboards for Beads Rust — independent review

Fresh reviewer; authored none of PR #289. Reviewed head
`902ebb57fe5fe6862a2f9a6bc5158a6cc5299359` against main
`aa138a73a20de5e14aab5a35ce848e1e700e5733` (the merge base), docs/config-only.

**APPROVE.** No findings.

## Must be true (written before reading the diff)

1. Nothing tracked (docs, `.github`, `.githooks`, `bin/check_all.sh`,
   `docs/CHECKS.md`, `mise.toml`) still runs or links `bin/board`,
   `bin/test_board.py` or `docs/live-board.md`.
2. Docs link/reachability check passes; historical records keep a resolvable link.
3. `.beads/issues.jsonl` changes only `loka-e1-r9-certification-2rz` notes and
   `updated_at`, carries no local machine path, and passes `bin/check_beads_export.py`.
4. The new notes match draft PR #288 and its retained evidence.
5. WORKFLOW gains only the replacement pointer; no gate changes.

## Verification

- `grep` for `bin/board`, `test_board`, `live-board`, `$board` over the tree: only
  the new WORKFLOW sentence, the repointed permalink, and plain-text mentions in the
  historical records `2026-10-05-live-board-review.md` and
  `2026-10-05-board-status-legend-review.md` (history, left as is). No CI, hook,
  check script, `docs/CHECKS.md` or `mise.toml` reference.
- Permalink target `aa138a73:docs/live-board.md` exists (blob).
- `elixir bin/check_docs.exs`: 794 docs, 0 broken, 0 unreachable.
  `python3 bin/check_beads_export.py`: exit 0. No `/Users/`, `/home/` or
  `/private/tmp` in the JSONL.
- Structural JSONL comparison: 37 rows, same ID order, only the E1 row differs,
  only in `notes` and `updated_at`; status, dependencies and `source_repo` unchanged.
- Notes against PR #288 (draft, open, head `b24d0f63c47d…`, branch
  `slice/chapter-one-e1-r9-certification`): `e1_night_marsh.ts` and
  `e1_wisp_herbs.ts` are registered in `kernel/ts/test/e1_cases.ts`; Night evidence
  is re-pinned on `aa138a73`, which contains #286 (C6 checker fix, merge
  `f8ccbcf0`). 241 pending comes from `docs/evidence/2026-10-07-e1-post-split/README.md`
  and 536 scoped from `docs/evidence/2026-10-07-e1-ancestry-items/README.md`; the
  PR body's "E1 is not passed" and remaining items (final 10,000-sequence proof,
  independent review, exact-head CI) match.
- WORKFLOW: one sentence added to the Beads Rust pilot section, consistent with the
  existing `bv` install/usage lines; the removed paragraph stated it did not replace
  the gates, so no gate changes.
- Simplicity: deletion only plus one sentence; nothing to cut. Mutation testing
  skipped: no logic changed, and the deleted test guarded only the deleted script.
