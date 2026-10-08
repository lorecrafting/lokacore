# Review: E1 child issues (PR #295)

- PR: [#295](https://github.com/lorecrafting/lokacore/pull/295), branch `chore/e1-child-issues`, exact head `888f7b40a082e9297ae5175edc22ca19060665b7`; CI green.
- Scope: tracker-only (`.beads/issues.jsonl`, +6 rows); no mutation testing.
- Governing: [WORKFLOW Beads Rust](../WORKFLOW.md#beads-rust), [audit follow-ups decision](../decisions/owner-decision-beads-audit-followups-2026-10-06.md).

## Must be true

1. Diff adds only the six rows `loka-e1-r9-certification-2rz.1`–`.6`; no existing row changes.
2. Each row is a concrete follow-up with an evidence link (recorder `kernel/ts/test/e1_cases.ts`, PR #288, source `ff63b598`) and a `parent-child` dependency on `loka-e1-r9-certification-2rz`.
3. No local machine path, no `-wisp-` ID, no title matching `^[A-E]\d+ — `; `python3 bin/check_beads_export.py --complete` passes.
4. Path lists are disjoint and total 157, matching the recorder's pending count.

## Verification

- `git diff origin/main...HEAD`: 6 additions, 0 deletions, all in `.beads/issues.jsonl`.
- `check_beads_export.py --complete`: exit 0.
- Each row: one `parent-child` dependency on `loka-e1-r9-certification-2rz` (present, `in_progress`); evidence line names `kernel/ts/test/e1_cases.ts`, PR #288 URL, source `ff63b5982d0516328273be746e493931a536450b`, exit 2, 157 pending.
- Path counts per row 27/29/31/22/26/22: equal to each "owns N" claim and to the sum of section headers; 157 total, 157 unique.
- No `source_repo_path`, no `/Users`/`/home`/`/private`; `wisp` occurs only in content names (`a_wisp_offer`, `seek_wisp`), not IDs. Titles `E1 paths: ...` do not match the slice regex.
- Statuses: `.1`, `.5` `in_progress`; others `open`.
- Not done: re-running the recorder at `ff63b598` (needs a built artifact; not cheap). Path membership is checked against the description lists only.

## Verdict

**APPROVE**. No findings.
