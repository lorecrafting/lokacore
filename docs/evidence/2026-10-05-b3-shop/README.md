# B3 finite Peg shop — local source checks

Governing contracts: [mechanics](../../system/mechanics.md#pegs-immediate-shop-b3-selected-contract),
[shelf](../../system/cartridge.md#pegs-b3-shelf),
[wire](../../system/protocol.md#b3-shop-composition),
[recovery](../../system/save.md#b3-shop-recovery) and
[Book](../../system/book-ui.md#b3-shop-detail).
Current independent release and fresh IDs:
[v018 pin](../../../protocol/fixtures/missing_child_v018_hash.json),
[IDs](../../../protocol/fixtures/missing_child_v018_ids.json).

| Focused check | Result |
|---|---|
| Compiler chapter known answer and rejected shop source | 3 pass, 0.6 s |
| Kernel commerce/contracts plus real SQLite and Book binding | 12 pass, 1.25 s |
| Existing containment/resources/B2/SQLite fault/Book regressions plus commerce | 106 pass, 27.9 s |
| Kernel src, tests and play TypeScript | pass |
| Book and authority TypeScript excluding unavailable e2e packages | pass |
| Contract and feature generators/checks | pass |

The SQLite cases cover Buy→reopen→receipt retry→Sell→reopen→buyback;
S2 acceptance/payout in both purchase orders; active and expired S2; ordinary
satchel Put/Take; protected active-ledger ancestor refusal; failed COMMIT and
both unknown outcomes. Assertions use literal balances and exact item custody.
Saved forged payer debit, recipient, historical prior balance, custody and receipt
order yield `save_corrupt`.

Focused mutation controls: omitted payer debit and wrong recipient fail both the
prior payment suite and commerce; omitted commerce carry admission and wrong item
destination leave the prior focused suite green and fail commerce; duplicate item
transfer also fails commerce. Removing Buy's required quoted price makes the new
contract test fail. All mutants were restored.

Ponytail Review: reuse exact B2 payment, existing carrying/Give protection, item
transfer, writer group and confirmed receipt/narration path. No creation, restock,
quantity row, pricing framework or dependency added. Actual-diff correctness review
also bound saved ordinary custody operations to their command and kept historical
S2 balances independent of today's player balance.

B3 merged provisional A3 correction `05e72a3c`; the combined focused commerce,
scene/finale and Book run passes 18 tests in 1.5 s, and the compiler passes three
in 0.8 s. Integration typechecking found an A3 nominal `CorrelationId`/`CommandId`
comparison; the string comparison was corrected without changing runtime behavior.

Full checks, broad schema mutant sweep, independent reviews and publication CI
remain publication-head work under the [provisional lane](../../decisions/owner-decision-local-provisional-integration-2026-10-05.md).
Full app TypeScript encounters unavailable `@e2e-dev/web` and `e2e`; its touched
Book/authority subset compiles. No native build, simulator or phone check was run.
