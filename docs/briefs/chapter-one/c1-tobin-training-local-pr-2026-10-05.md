# C1 — Tobin lessons and equipped cellar combat

Local source branch: `chapter-one/c1-tobin-training`. Source head is supplied in the developer handoff; remote PR and independent verdict remain null. Corrected B3 is inherited; corrected B5 predecessor is `2df52d328adbfdea39a0cde623f6a9f34fffb186`.

Tobin now sells one-time swords and dodge lessons. Acquisition survives qualification changes, while current STR/DEX qualification controls use. Real wielded swords change damage; a qualified standing dodge precedes an equipped off-hand shield in the shared combat draw budget. Both lessons commit their fee, acquisition and original sword custody atomically. Character and Item pages expose the authored qualification and equipment information, and the ordinary dialogue presenter advances the lesson offers after durable replies.

Governing contract: [approved brief](chapter-one-c1-tobin-training-brief-2026-10-05.md), [approved plan review](../../reviews/2026-10-05-c1-tobin-plan-review.md), [mechanics](../../system/mechanics.md), [cartridge](../../system/cartridge.md), [protocol](../../system/protocol.md), [save](../../system/save.md), and [Book UI](../../system/book-ui.md). This composes existing attributes, policy evaluation, dialogue admission and transfer, equipment custody, scheduled combat, changed-row commits and cold replay; it adds no persistence table or separate training ledger.

The active chapter is v020/API1.18. Its independently generated [hash payload](../../../protocol/fixtures/missing_child_v020_hash.json) and [92 initial IDs](../../../protocol/fixtures/missing_child_v020_ids.json) match actual source compilation. SHA-256: `78ade4fab1341f1781262ce6327ca8a77ea4e4c0a01fa5279abe7ba874735d3e`.

## Validation

- Kernel focused behavior and contract suite: 63 tests pass; kernel source/test/play typechecks pass.
- SQLite authority and Book focused suite: 80 tests pass; app typecheck passes. Real file-backed tests cover cold reopen, forged grants, failed COMMIT, both lost-ack outcomes, defended combat, trained death and corpse recovery.
- Source compiler focused training/chapter/attribute/combat suite: 15 tests pass. Final additional scene-ending reserved-write and defense-narration cases pass in the training/chapter subset (6 tests) and loader contract suite (2 tests).
- Four production lesson/shop/S2 orderings preserve literal balances and custody. The trained production route kills all five cellar rats, earns Maud's key, puts/takes the real sword in storage and reopens between transitions.
- The focused Book scenario uses real Book components, presenter and SQLite authority to click both lessons and cold reopen each reply exactly once; it verifies the next offer and the final Character qualification. React Native leaves/hooks are controlled test adapters. This is headless interaction evidence; native layout and an actual browser walkthrough remain for E3.
- Controlled red mutations fail for acquisition and qualification use, held-versus-wielded sword selection, strict dodge threshold, dodge-before-block, defense hit/loss conjunction, exact grant-command binding, fee debit, gift carry admission and foreign acquisition scope. Corresponding old focused suites pass for these mutants, demonstrating distinct regression protection. Scene-ending reserved writes receive an additional compiler/loader red control.
- Generated contracts/features, documentation links, formatting, staged AST checks and normal commit hooks pass. The full publication suite and schema mutation sweep belong to accumulated publication; no simulator or native build ran.

## Self-review

Ponytail Review: **Lean already. Ship.** Shared payment, policy and projection helpers replace duplication; no speculative configuration, new dependency or mechanic-specific kernel branch was added. Correctness review repaired a missing shared projection budget, foreign and non-Choose grant evidence, and compiler/loader defense narration and scene-ending reserved-fact validation. The existing discriminated event schema retains its typed optional prevention enum; saved receipts and narration enforce the prevention/hit/loss conjunction, with an independent red control.

Inherited B3 Credo ABC warnings in commerce shop and compiler checks are outside C1; the integrator has a separate cleanup. Concurrent Book UI introductory/guide edits must be preserved on integration. Fresh primary and save/protocol reviews remain required before publication.
