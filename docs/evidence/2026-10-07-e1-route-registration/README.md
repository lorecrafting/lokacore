# E1 reviewed-route registration checkpoint

The clean source `e5a9d6958a954edfa9b3395045a0d0716533acf3` registers the
separately reviewed Watch, Wisp ward and infirmary herb recipes as named fresh
cases in the fixed v042 recorder. Each keeps its literal route assertions, real
SQLite commits, cold reopens and semantic replay. The recorder's check digest
includes both new recipe files: `3d72f5c3c0dbdd698199d5011aa2ca4fdb01dc24b234ad1c674a4fc6e51201a6`.

The earlier clean-head 16-case run exposed an omitted check-digest dependency.
It was not used as final evidence. The corrected-head rerun exited 2 as required
for incomplete coverage: all 16 real SQLite cases passed and replayed, 57 rooms
and every scene family were reached, but Night and Maud quests, 36 dialogues,
49 choices and 609 authored obligations remained open. The candidate content
hash and exact gaps are in [the retained report](report.json); this checkpoint
does not certify E1.

The focused integrated E1 suite passed 15/15 after two obsolete empty-obligation
assertions were removed. Those route tests still assert their legal journeys and
semantic replay. TypeScript typecheck passed. In an isolated committed red control,
changing a Wisp recipe byte changed the check digest from `3d72f5c3...` to
`fa0d608d...`; the production recipe is unchanged. The actual diff's Ponytail
Review found no extra framework, dependency or unused option; correctness review
checked case names, retained witness claims and the dependency list.

The three new case traces, report and redacted CLI output are hashed in
[SHA256SUMS](SHA256SUMS), with successful [verification](SHA256SUMS.verify).
The complete isolated output, including all real SQLite databases and case logs,
was hashed by [case-SHA256SUMS](case-SHA256SUMS), with successful
[verification](case-SHA256SUMS.verify). This source-bound run is a provisional
checkpoint; final candidate, all authored paths, 10,000 simulator sequences and
independent E1 certification review remain pending.
