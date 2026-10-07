# E1 ancestry and static entity witness checkpoint

Source `cb16cff616f820182f5eb4c7e1bbef664bab32df` implements the
[exact proof policy](../../system/architecture.md#e1-exact-candidate-proof-policy)
for accepted ancestry selection, conserved static item transfers and the static
NPC bound by an opened dialogue. The receipt must match the new character row
or both transfer holders and the corresponding acquisition/drop event. Static
identity comes from the admitted candidate's entity map; merchant stock and
created entities without separate provenance earn no transfer witness.

The [report](report.json) retains six fresh real-SQLite traces and semantic
replays, 138 committed steps in total. They witness all four ancestries, Wick's
12 original bandages, Maud's original cellar key, and Wisp. These are 18 paths
that were pending in the [prior inventory](../2026-10-07-e1-integrated-checkpoint/report.json).
This comparison identifies newly supported paths; it does not combine proof
from different source identities. The scoped report itself leaves 536 authored
paths pending.

The fey route is registered as `ancestry-fey` in the recorder and checks an
absent selection becoming `fey_touched`, SPI 11 and faction -2 after cold reopen.
`ancestry-fen.jsonl` ends after First Lead search; `ancestry-hill.jsonl` ends after
selection. Their inherited case labels do not claim a completed ending or
topology run. The other three traces run the existing complete herbs, cellar
and Wisp routes with their literal assertions and cold reopens intact.

Validation: 15 focused checks passed; TypeScript typecheck, documentation links,
size and the precommit formatting/ast-grep checks passed. Omitting the new binder
left all 12 older focused checks green and made all three new checks fail. The
new checks also reject unchanged state, absent selection/transfer receipt,
missing transfer event and absent static identity. Two older dialogue assertions
now compare dialogue paths, preserving their stated behavior while allowing an
independently witnessed NPC path. The host remains 325 lines.

Ponytail Review: no new dependency, general registry, runtime writer or duplicate
mechanic; one small helper joins the existing binder and source digest.
Correctness self-review checked exact accepted selection, original item identity,
prior/resulting custody, receipt agreement, pending dialogue target roles and
semantic replay. Independent review remains with the parent E1 workflow.

[SHA256SUMS](SHA256SUMS) and [verification](SHA256SUMS.verify) bind retained logs,
report and traces. No full recorder corpus, final 10,000-sequence run, browser,
native or dynamic entity provenance proof is claimed. E1 remains pending.
