# C1 — Tobin lessons and equipped cellar combat

Local source branch: `chapter-one/c1-tobin-training`. Source head is supplied in the developer handoff; remote PR remains null. Both independent reviews of `e8bf456e` requested changes; the source fix round below awaits their scoped rechecks. Corrected B3 is inherited; corrected B5 predecessor is `2df52d328adbfdea39a0cde623f6a9f34fffb186`.

Tobin now sells one-time swords and dodge lessons. Acquisition survives qualification changes, while current STR/DEX qualification controls use. Real wielded swords change damage; a qualified standing dodge precedes an equipped off-hand shield in the shared combat draw budget. Both lessons commit their fee, acquisition and original sword custody atomically. Character and Item pages expose the authored qualification and equipment information, and the ordinary dialogue presenter advances the lesson offers after durable replies.

Governing contract: [approved brief](chapter-one-c1-tobin-training-brief-2026-10-05.md), [approved plan review](../../reviews/2026-10-05-c1-tobin-plan-review.md), [mechanics](../../system/mechanics.md), [cartridge](../../system/cartridge.md), [protocol](../../system/protocol.md), [save](../../system/save.md), and [Book UI](../../system/book-ui.md). This composes existing attributes, policy evaluation, dialogue admission and transfer, equipment custody, scheduled combat, changed-row commits and cold replay; it adds no persistence table or separate training ledger.

The active chapter is v020/API1.18. Its independently generated [hash payload](../../../protocol/fixtures/missing_child_v020_hash.json) and [92 initial IDs](../../../protocol/fixtures/missing_child_v020_ids.json) match actual source compilation. SHA-256: `78ade4fab1341f1781262ce6327ca8a77ea4e4c0a01fa5279abe7ba874735d3e`.

## Validation

- Full kernel suite: 573 tests pass; kernel source/test/play typechecks pass, including shared schema examples and invalid vectors.
- SQLite authority and Book focused suite against freshly compiled production content: 81 tests pass; app typecheck passes. Real file-backed tests cover cold reopen, forged grants, failed COMMIT, both lost-ack outcomes, defended combat, trained death and corpse recovery.
- Source compiler training/chapter/attribute/combat plus shared Elixir contract/schema suites: 93 tests pass. Actual compiled source retains the exact v020 payload/hash.
- Four production lesson/shop/S2 orderings preserve literal balances and custody. The trained production route kills all five cellar rats, earns Maud's key, puts/takes the real sword in storage and reopens between transitions.
- The focused Book scenario uses real Book components, presenter and SQLite authority to click both lessons and cold reopen each reply exactly once; it verifies the next offer and the final Character qualification. React Native leaves/hooks are controlled test adapters. This is headless interaction evidence; native layout and an actual browser walkthrough remain for E3.
- Controlled red mutations fail for acquisition and qualification use, held-versus-wielded sword selection, strict dodge threshold, dodge-before-block, defense hit/loss conjunction, exact grant-command binding, fee debit, gift carry admission and foreign acquisition scope. Corresponding old focused suites pass for these mutants, demonstrating distinct regression protection. Scene-ending reserved writes receive an additional compiler/loader red control.
- Generated contracts/features, documentation links, formatting, staged AST checks and normal commit hooks pass. The full publication suite and schema mutation sweep belong to accumulated publication; no simulator or native build ran.

## Self-review

Ponytail Review: **Lean already. Ship.** Shared payment, policy and projection helpers replace duplication; no speculative configuration, new dependency or mechanic-specific kernel branch was added. Correctness review repaired a missing shared projection budget, foreign and non-Choose grant evidence, and compiler/loader defense narration and scene-ending reserved-fact validation. The existing discriminated event schema retains its typed optional prevention enum; saved receipts and narration enforce the prevention/hit/loss conjunction, with an independent red control.

Inherited B3 Credo ABC warnings in commerce shop and compiler checks are outside C1; the integrator has a separate cleanup. Concurrent Book UI introductory/guide edits must be preserved on integration. The same primary and save/protocol reviewers must close the scoped fixes before publication.

## Source fix round 1

- **C1-PRIMARY-01 / C1-S1:** shared choice/gift evidence now binds actor, root correlation, world and exact player scope to the lawful Choose command. Six file-backed foreign-event cases refuse as `save_corrupt` without changing file bytes, after first accepting lawful later wield custody. The new case fails on the reviewed source; six individual guard removals fail it while the prior authority suite passes with all six removed. The final shared identity helper also fails its three individual field-removal controls.
- **C1-S2:** four new named schemas now carry independent literal examples. Shared TypeScript and Elixir example/invalid suites pass; concise schema descriptions also remove the four new generated-document trailing spaces. No generator change was necessary.
- **C1-S3:** shared invalid fixtures name literal missing `dodge.skill`, missing `dodge.chance`, chance -1 and chance 101 errors. Valid examples exercise 0 and 100. Removing each of the four guards leaves the old shared corpus green in both validators and makes the new corpus fail (TypeScript exit1, Elixir exit2). Guards and generated outputs were restored before final checks.
- **C1-PRIMARY-02:** seven C1 Credo diagnostics are cleared using ordered `Enum.concat` and small named validation predicates, with all checks preserved. Combining this source with the separately approved B3-LINT changes passes strict Credo (exit0); the temporary inherited preview changes were restored and are not retained here.
- The integration equipment assertion now includes the authored `head` item slot; removing that projection makes the assertion fail. Full kernel validation also exposed an inherited transcript known-answer lookup limited to Missing Child v003. Its existing fixture discovery now globs chapter known answers, allowing the already-pinned commerce and exchange transcripts to replay. This is test fixture selection, with no runtime compatibility adapter.
- The shared identity guard is reused at both event boundaries. Existing detail routing and duplicate quest consequence checks were simplified without changing historical exchange acceptance; focused repeat-exchange, dialogue, authority and Book checks pass. Touched source/test size checks pass. Ponytail Review: **Lean already. Ship.**

Release content, SHA-256 and all 92 initial IDs remain unchanged. Generated checks, documentation checks and normal commit hooks pass. No main merge, remote push, browser session or native build was performed.
