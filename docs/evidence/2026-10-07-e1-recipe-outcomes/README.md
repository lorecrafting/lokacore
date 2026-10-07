# E1 recipe outcome checkpoint

Clean source `fed19087a32009f88e7e7bfcc8e6f3162b4876ff` binds selected recipe outcomes to exact committed fact transitions and emitted event receipts. The candidate and check digest `f7493c9f9b6a7ac57c402f2267e1d1e3dbc714bf6d3aae4be3dc7c90d6a39667` are in the [report](report.json).

The recorder exited **2, pending**. All 18 isolated real SQLite cases and semantic replays passed, including five endings, thirty-day hourly replay and three storage faults. Recipe outcome obligations fell by 18; **255 authored paths** remain open. This is provisional evidence, not E1 certification.

The focused E1 suite passed 10/10, TypeScript typecheck passed, and docs found 832 documents with zero broken or unreachable links. An omitted epilogue event match fails the new test ([red control](red-control.log)); the restored suite is [green](focused-tests.log). The change reuses accepted receipts and before/after world state. Ponytail Review found no new dependency or configuration; the outcome witness is bounded to the two v042 step operations and fails closed for others.

The [report](report.json), selected [ending](rescued-prior.jsonl) and [Night](night-marsh.jsonl) traces, and [redacted CLI log](cli.log) are hashed in [SHA256SUMS](SHA256SUMS), with [verification](SHA256SUMS.verify). The full isolated output, including 18 databases and traces, was hashed at capture in [case-SHA256SUMS](case-SHA256SUMS); all 38 checks are retained in [verification](case-SHA256SUMS.verify). Final path coverage, candidate pin, independent review and 10,000-sequence simulation remain pending.
