# E1 integrated route and witness checkpoint

The clean source `83942fe017321235af76e0975417a7fbffde1a1c` includes the
independently reviewed dialogue, modal-scene and selected-policy witness rules,
plus the reviewed Maud and Night routes. The explicit recorder check digest is
`be8ce806013cb8548473b03f5073ff071b563c5fbc21cea26486e15560e205e8`.
The v042 candidate identity and the exact remaining paths are in the
[report](report.json).

The recorder exited **2, pending**. All 18 isolated real SQLite cases passed
with semantic replay, including five endings, Maud, Night, a thirty-day hourly
replay and three storage faults. It visited all 57 rooms and every quest and
scene family. The report retains 34 dialogue families, 47 selected-choice
families and **509 authored paths** as open. This run does not certify E1.

The [CLI log](cli.log), [report](report.json) and selected [Night](night-marsh.jsonl),
[Maud](mauds-cellar.jsonl) and [dream](dream-follow_fox.jsonl) command traces are
hashed in [SHA256SUMS](SHA256SUMS), with [verification](SHA256SUMS.verify). The
complete isolated output, including the 18 databases and command logs, was
hashed at capture in [case-SHA256SUMS](case-SHA256SUMS), with successful
[verification](case-SHA256SUMS.verify). The CLI log has local paths redacted;
the recorder's `redact()` covers paths and host identifiers in failure output.

The integrated route-registration diff uses the existing recorder and named
routes without a new abstraction or dependency. Focused E1 tests passed 6/6,
TypeScript typecheck passed, and the docs check found 823 documents with zero
broken or unreachable links. Final authored-path coverage, the 10,000-sequence
simulation, final candidate pin and independent certification review remain
pending.
