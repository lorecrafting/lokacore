# Primitive composition audit — preserved inspection evidence

Published supporting evidence from the 2026-10-04 read-only audit at merged code
`6d9712ef2b0ea12be537e4ef4c826a6d04e155af`. This is a dated inspection snapshot,
not an additional normative catalog, independent implementation approval or runtime
certification. The [active composition guide](../../system/architecture.md#building-mechanics-by-composition)
owns the brief/review rule; active contracts and the current roadmap govern delivery.

- [Lead report](report.md): conclusions, PC-01–11 findings, consumer gates and limits.
- [112-row matrix](coverage-matrix.md) and [structured matrix](matrix-data.json): 37 feature-map capabilities (22 installed subsets/15 not yet at the audit pin), 23 M groups, 29 later mechanic candidates, 10 reuse batches, five continuity/product boundaries and eight foundation/host rows.
- [Kernel auditor appendix](kernel-code-auditor.md): installed kernel, portable twins, composition and work bounds.
- [Content/host auditor appendix](host-content-code-auditor.md): compiler/loader, changed-row persistence, session and presenter boundaries.

| Finding | Evidence class | Closure at publication |
|---|---|---|
| PC-01 exit availability bypasses composed ActionSet | Static code-path defect: an otherwise usable exit can be advertised after room composition removes Move. | Runtime reproduction and fix not performed by this docs lane. |
| PC-11 ordinary FactSpec defaults lack loader enum/bounds validation | Static artifact trust-boundary gap; compiler validation does not substitute for independent loader validation. | Runtime reproduction and fix not performed by this docs lane; no malformed bundled sampler claim. |
| PC-02 completed-job history scans | Source-level scaling debt with lifetime-history dependence. | No phone latency, threshold or measured performance failure claimed. |

All other gaps are bounded to the consumers named in the report, not blanket catalog
requirements or new M2 stop conditions. Private brief/draft references are provenance
labels, not public proof links. Their absence does not establish installed behavior.

The audit inspected PR #136 while pending; that wording remains historical evidence.
[PR #136](https://github.com/lorecrafting/lokacore/pull/136) subsequently merged; its
[PM reconciliation](../../decisions/pm-decision-legend-mechanics-reconciliation-2026-10-04.md)
now governs planning. Later-story rows capture the earlier source-only draft, including
then-open alternatives; the separate later-story planning publication owns selected future
policies. No source fixes, tests, builds, device/save operations or runtime proof were
performed by the audit. Documentation publication checks are separate from audit claims.

Copies were checked for private home/scratch/worktree paths and device/signing identifiers.
Only the matrix's two relative archive links changed for this evidence location; original
private copies remain preserved. [SHA256SUMS](SHA256SUMS) records these public bytes;
[verification output](SHA256SUMS.verify) records their hash check.
