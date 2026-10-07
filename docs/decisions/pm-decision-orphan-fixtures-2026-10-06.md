# PM record: orphan provisional fixture cleanup, 2026-10-06

Applies the [forward-development decision](owner-decision-forward-development-2026-10-05.md)
to the published baseline `96e88003696e307156590fec0feca9f2f7f342b5`.

Remove only the B9 and D4 provisional hash/ID pairs and their generators from
`protocol/fixtures/`: `missing_child_b9_hash.json`, `missing_child_b9_ids.json`,
`generate_missing_child_b9.py`, `missing_child_d4_hash.json`, `missing_child_d4_ids.json`,
and `generate_missing_child_d4.py`. These pre-integration answers have no live named
consumer. The transcript runner discovers them through a fixture glob, but none of the
29 active transcript headers selects either content hash. Exact filename/hash references
outside the removed generators occur only in historical evidence and review records.

Recover B9's three files with `git show 8b9e5b52fffdffd34569cb0f6aa837090a7478df:protocol/fixtures/<filename>`;
recover D4's three with `git show 347c8197303358136cfa7095016ca8b4bcff9fb4:protocol/fixtures/<filename>`.
The [D4 provisional evidence](../evidence/2026-10-06-d4-homes-orchard/README.md), including
its historical capture referring to the removed answer, remains unchanged. Run that capture
at its recorded source commit when reproducing the provisional result.

Current v042 answers, canonical/conformance fixtures, active transcripts, C3_B8/v029
answers and historical evidence are preserved. This changes no runtime contract or save
handling and accesses no owner save. Existing fixture, transcript and compiler checks
exercise the remaining consumers; no new test or compatibility machinery is needed.
