# E1 combined dream and recipe checkpoint

Clean source `178d02909bb4a66f2135bf55eeff8015836820cd` combines the
reviewed dialogue, modal, route and recipe witnesses with the corrected dream
negative test. Its check digest is
`99ef5eb828e57c68371ba2b6f3ce85931e18695fef3cd840a24dfde1e6a0ce49`.
The candidate identity and exact gaps are in the [report](report.json).

The recorder exited **2, pending**. All 18 isolated real SQLite cases passed
with semantic replay, including the five endings, the thirty-day hourly replay,
Maud, Night and three storage faults. All 57 rooms and every quest and scene
family were reached. All ten dream-scene paths are now witnessed; 29 recipe
paths, 34 dialogue families, 47 choice families and **428 authored paths**
remain open. This source does not certify E1.

The combined focused E1 suite passed 8/8, TypeScript typecheck passed, and the
docs check found 827 documents with zero broken or unreachable links. The
dream Rest-display and recipe omission red controls are retained in their
respective evidence checkpoints. The actual diff reuses the existing exact
receipt and semantic replay path; its Ponytail Review found no new dependency,
configuration or generic coverage shortcut.

The [report](report.json), selected [dream follow](dream-follow_fox.jsonl),
[dream wake](dream-wake.jsonl) and [ending](rescued-prior.jsonl) traces, and
redacted [CLI log](cli.log) are hashed in [SHA256SUMS](SHA256SUMS), with
[verification](SHA256SUMS.verify). The complete isolated output, including
the 18 databases and traces, was hashed at capture in
[case-SHA256SUMS](case-SHA256SUMS), with successful
[verification](case-SHA256SUMS.verify). The recorder's `redact()` covers local
paths and host identifiers in failure output. Final path coverage, a final
candidate pin and the 10,000-sequence simulation remain pending.
