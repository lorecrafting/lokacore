# B3 — Peg's immediate shop: adopted developer brief

**Branch:** `chapter-1/b3-pegs-shop` in a new isolated developer worktree.
**Base:** local `main` `ec3ab73d`, B2 implementation/review merged; chapter
`ashmere_missing_child@0.0.16`, API1.14. The independent B2 release pin is
`protocol/fixtures/missing_child_v016_hash.json`. B3 release, hash, generated IDs,
implementation head, PR and check results: null. Re-pin if the base advances.
This is an assignment brief, not proof or permission to merge.

## Goal and contract

Deliver a playable Buy→carry/use→Sell exchange with Peg, conserving exact pennies,
item identity and stock. The governing clauses are [B3 mechanics](../../system/mechanics.md#pegs-immediate-shop-b3-selected-contract),
[shelf](../../system/cartridge.md#pegs-b3-shelf), [composition](../../system/protocol.md#b3-shop-composition),
[recovery](../../system/save.md#b3-shop-recovery) and [Book](../../system/book-ui.md#b3-shop-detail),
adopted by the [PM decision](../../decisions/pm-decision-b3-pegs-shop-2026-10-05.md).
This is M18-A plus only the finite M18-B stock policy actually consumed. Follow
[mechanic composition](../../system/architecture.md#building-mechanics-by-composition),
the no-wait and world-parameter owner rules. B2's `resource.transfer` is installed;
its S2 ledger, protected ancestor Give rule and 20p player start remain intact.

Implement exactly the four authored Peg-held item definitions and explicit Peg
balance in the shelf contract. The satchel's ordinary Put/Take is useful now.
Torch, oil and waterskin are purchasable goods for B4/B7; no Ignite, Refuel,
Fill, Drink, defense bonus or dynamic pricing control is selectable in B3.
Stock is direct Peg custody of the four exact initial item IDs; buyback restores
that same item. Do not add an issuance, restock or quantity subsystem. The shop
may be revisited at every hour while Peg is present.

## Implementation boundary

Add the narrow commerce command/rule and authored offer source, compiler/loader
validation, shared admission/projection, and Peg's Book interaction. Reuse B2's
exact payment, containment transfer, carrying predicate, query budget, writer
group, receipt and save reconciliation. Touch `protocol/` command/action,
capability, cartridge and GameView contracts only for the actual new shape;
derive fixtures and generated docs from the selected contract. Add current-build
save validation for the shop's real rows, with no compatibility adapter.
Likely files: chapter manifest, resources, Peg and four item JSON/text;
`lib/loka/content/`, `kernel/ts/src/content/`, `mechanics/commerce/`,
command/view/runtime seams, `mobile/authority/local-story/store.ts` and Book
NPC detail. No native/phone work, Realm, barter, merchant AI, general pricing,
unrelated scene work or obsolete-fixture preservation.

## Acceptance and verification

- Controlled initial state: actor20p, Peg20p, one Peg-held torch priced3p,
  actor load11900g/max12000g. Buy yields actor17p/Peg23p, that same item directly
  body-held, Peg stock0 and load12000g. Cold reopen and exact receipt retry retain
  those values and one ID. A distinct second Buy refuses without any change.
- At actor load11901g, balance2p, Peg absent, item sold out, or a changed quote,
  Buy refuses before money, custody, RNG, narration or receipt effects. A valid
  stale displayed offer is re-evaluated; the page and direct command agree.
- Selling that exact torch at the declared 1p gives actor18p/Peg22p and returns
  the same item to Peg. Total pennies stay40. Peg0p, a worn/nested/foreign ID,
  an unrelated item and a satchel containing the active S2 ledger all refuse
  without a partial transfer. A later Buy of the returned ID works once.
- Each legal intermediate custody/balance state reopens. Malformed balance,
  impossible shop item identity/custody or contradictory accepted receipt gives
  typed `save_corrupt` with no silent repair. Real failed COMMIT, both unknown
  COMMIT outcomes and lost acknowledgement retain all prior or all next rows.
- Name distinct plausible breaks before adding tests. Apply each mutant to the
  old focused suite first; add only missing behavior tests with independent
  literal answers. Plant missing payer debit, wrong recipient, omitted carry
  admission and duplicate item transfer, and observe a focused red test for
  each; run the schema mutant sweep for changed schemas.

Read [mechanics](../../lessons/mechanics.md), [contracts](../../lessons/contracts.md),
[storage](../../lessons/storage.md), [mobile](../../lessons/mobile.md) and
[evidence](../../lessons/evidence.md) lessons before touching those areas.
Run focused compiler/loader, commerce, admission, carry, Book and real SQLite
checks, then `mise exec -- bin/check_all.sh` once as the final hook-equivalent
run. Keep the full-check status and failing lines, not bulk logs. Perform
Ponytail Review and an actual-diff correctness pass. A fresh independent
primary reviewer and a separate protocol/save opinion check the exact head;
Astra applies if `runtime/proposal.ts` or portable foundation changes.

Stop and return to the PM for a required new creation/stock operation, a
mandatory path that can be stranded by finite stock, a changed B2 payment
contract, a frozen-fixture conflict, or a source footprint too large for a
complete Buy/Sell outcome. Do not expose an unfinished exchange.
