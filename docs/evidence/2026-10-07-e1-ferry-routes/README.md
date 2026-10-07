# E1 ferry route checkpoint

Independent review found that this source compared a destination display key,
which could falsely credit another room with the same title. The captured run
and hashes below are preserved as provisional history; the corrected room-ID
guard and a same-title wrong-room red control are in the follow-up checkpoint.

Clean source `9e5ea35334f1ad78a3126f39e280387bcece9a24` binds an accepted `use_transport` to the selected authored route only when the Book reaches its exact destination. Candidate and check digest `402b2398ab683a589760735e8d9440745b2c5a2a5bf243c56b8deb696257a48e` are in the [report](report.json).

The recorder exited **2, pending**. All 18 isolated real SQLite cases and semantic replays passed, including the topology route using both ferries, five endings, thirty-day hourly replay and three storage faults. The two transport paths are now witnessed; **271 authored paths** remain open on this isolated source. This is provisional evidence, not E1 certification.

The focused E1 suite passed 10/10, TypeScript typecheck passed, and docs found 834 documents with zero broken or unreachable links. When the destination check was removed, the prior nine tests stayed [green](old-suite-green.log) and the new ferry test [failed](red-control.log). The change reuses accepted receipts and Book projection. Ponytail Review found no new dependency, configuration, or broader route claim.

The [report](report.json), selected [topology](topology.jsonl) and [ending](rescued-prior.jsonl) traces, and [redacted CLI log](cli.log) are hashed in [SHA256SUMS](SHA256SUMS), with [verification](SHA256SUMS.verify). The full isolated output, including 18 databases and traces, was hashed at capture in [case-SHA256SUMS](case-SHA256SUMS); all 38 checks are retained in [verification](case-SHA256SUMS.verify). Final path coverage, candidate pin, independent review, and 10,000-sequence simulation remain pending.
