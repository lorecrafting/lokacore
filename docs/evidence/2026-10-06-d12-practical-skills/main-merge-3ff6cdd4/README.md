# D12 provisional merge of published main — 2026-10-06

Source merge: `f1d71b231516d8b27bc369b118d784cdc48df3ff`.
Parents: reviewed D12 `1b18987f57bacc378cc7cdef52298b548a2f478e` and published
main `3ff6cdd4106664f6352a502c11e2eb667cd01539`. Branch:
`chapter1/d12-practical-skills-provisional`.
[Original source proof](../README.md),
[primary review](../../../reviews/2026-10-06-d12-provisional-primary-review.md)
and [save/protocol review](../../../reviews/2026-10-06-d12-provisional-save-review.md)
remain historical approvals of their recorded heads.

[Merge output](merge.log) records three conflicts: the text catalogue, generated
contracts and GameView size marker. Three-way text resolution preserves every
published D4 key/value and adds the D12 keys. Contracts regenerate from merged
schemas. GameView retains D4 food projection and the reviewed D12 method-aware
admission; its measured size marker becomes312. No D12 mechanic logic or test fix
was needed. D4 homes/orchard/food, PR235's simulator oracle and PR236's dependency
docs are preserved.

| Focused check | Result |
|---|---|
| [Compile](compile.log) and [compiler tests](compiler.log) | exit0;3 tests |
| [Kernel D12/transport/D4 food/homes/composition](kernel.log) | exit0;17 tests |
| [SQLite/Book/transport/D4 food](host-book.log) | exit0;17 tests |
| [Kernel types](types.log), [app types](app-types.log) | exit0 |
| [Regeneration](contracts.log), [drift](drift.log) | exit0 |
| [Headless simulator](sim.log) | exit0;19 tests,500 fresh sequences and current oracle controls |
| [Focused GameView size](size.log), [normal commit hook](commit.log) | pass |

Ponytail/correctness self-review: mechanical composition of reviewed changes;
no new machinery. D12's careful/quote logic is unchanged. A scoped integration
re-review should cover the shared GameView and regenerated protocol contracts;
no new mechanic fix requires review. Final exact-head review/proof still follows
C4 publication and integration.

Successor release/API/hash/IDs, browser proof, PR and publication are **null**.
Inherited D4 `0.0.31`/API1.27 labels and published fixtures/assets are predecessor
values, not D12 successor answers. No new pins, push, PR, full publication gate,
browser preview, native simulator/device or owner-save work occurred.

Raw outputs redact home/worktree/scratch paths. [SHA256SUMS](SHA256SUMS) covers
retained files; [verification](SHA256SUMS.verify.log) is separate.
