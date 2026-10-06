# B7 — Well and waterskin: fill, pour and drink conserved liquid

**Adopted brief, local source implemented; fresh review pending.** Planning branch
`planning/b7-waterskin`, inspected local base `4bfe252e75f2cc6ab556c1dd2601d5d8ca85bdb7`.
B3 is locally implemented and independently approved at chapter
`ashmere_missing_child@0.0.18`/API1.16; its accumulated-head publication remains
pending in the [roadmap](../../ROADMAP.md). Its [check note](../../evidence/2026-10-05-b3-shop/README.md)
and review heads must be re-pinned against the actual integration base before
assignment. Implementation branch: `b7-well-waterskin`.
Implementation base explicitly re-pinned to integration `1898dbb5`, chapter
`ashmere_missing_child@0.0.20`/API1.18 (C1), replacing the planning B3-only pin.
Successor release/API/hash/item IDs, exact source head and local checks live in the
[B7 evidence](../../evidence/2026-10-05-b7-waterskin/README.md). PR and fresh verdicts
remain null; this brief does not authorize merge/push or certify native play.

## Consumer, dependencies and governing clauses

Buy the original and spare waterskin from Peg, walk to the actual Well Lane well,
Fill, Drink from one filled skin to create receiver space, Pour a partial amount
from the other skin, and Drink again. B7 adds no rooms. B3 is the only new-slice
dependency; installed custody, carrying, death, receipts and Book are reused.
B1 is not needed for untimed water operations. B4, B5 and C1 are separate lanes;
none supplies a B7 prerequisite, and their successor pins are not assumed.

The [PM adoption](../../decisions/pm-decision-b7-well-waterskin-2026-10-05.md)
selects [mechanics](../../system/mechanics.md#b7-well-and-waterskin-selected-contract),
[tuning](../../system/cartridge.md#b7-water-and-vessels),
[composition](../../system/protocol.md#b7-liquid-composition),
[save](../../system/save.md#b7-liquid-recovery) and
[Book](../../system/book-ui.md#b7-water-details). They govern over earlier candidate
language. Follow [composition](../../system/architecture.md#building-mechanics-by-composition),
world-parameter, no-wait and preproduction owner rules. Historical M11/primitive
liquid direction does not authorize broad needs, mixing or a fluid simulator.

## Selected implementation boundary and composition record

- **Real consumer:** the public well detail plus two finite Peg offers. Add
  `spare_waterskin` at the same prices as the existing waterskin, not a repeat-buy
  stack. Full details are in the tuning clause; all numerical values live in
  cartridge definitions. Buying/selling a filled skin moves its exact contents.
- **Shared reads:** actor through command/bodyOf, living body, current-room detail,
  actor-owned custody plus bounded reach/lids, immutable liquid/vessel metadata,
  confirmed quantity, shell/effective mass and existing carrying ceiling. Reach
  alone includes room items and cannot prove ownership. Use one shared query
  counter, including candidate-pair evaluation and arithmetic faults.
- **Missing primitive:** one required typed `liquid` row per opted item,
  whole-row-precondition `liquid.set`, and shape/capacity/kind invariant with
  immutable observed specifications. Existing entity transfers move item custody,
  and resource adjustments do not represent finite vessel kind/capacity. Implement
  only this row mutation; no separate vessel entity, issuance ledger or factory.
  Vessel-marked templates must refuse: only authored initial instances receive rows.
- **Writer ownership:** liquid rule owns the three immediate commands and their
  registered events/outcomes. Two Pour writes share one existing writer group;
  apply/proposal owns generic atomic adoption and budgets. The carrying helper
  owns derived load, authority owns transaction/receipt/history validation, and
  Book consumes GameView. B8 later adds its actual benefit through reviewed typed
  consequences; B7 has no HP/MV or needs writer.
- **Reuse without extra code:** Take/Drop/Put/Give, ordinary lid checks, death/corpse
  roots, commerce, freshness and receipt retry carry liquid through the same item.
  A vessel does not become `container:true`. Open owned nested skins are usable;
  corpse-held skins must first be recovered. Empty skins persist as empty shells.
- **Named exceptions:** only the authored inexhaustible source introduces water.
  This is an explicit source boundary, not closed-system conservation. Pour has
  exact finite debit/credit, Drink exact consumption. No kernel special-case for
  Peg, Well Lane, water or waterskin names. No oil/liquid adapter to B4 fuel.

Add the minimal pure `mechanics/liquid/rule.ts` and shared query/transition helper
only where required; use existing command/view/carry/runtime seams. Portable
composition gets both language twins and new independently pinned fixtures;
liquid story logic remains TypeScript-only. Keep optional maps absent for
non-opted cartridges and frozen fixtures unchanged. Compiler/loader must expand
short references, reject invalid opted metadata and prove checked maximum mass
products before runtime. Extend the actual current-build save verifier; do not
create a new save table or migration.

Likely scope: chapter manifest/catalog, Peg offers, original/spare waterskin JSON
and text, Well Lane detail/text; compiler checks/loader; liquid rule/shared helper;
containment effective-mass and shared carrying admission; command/target/actions,
view, fresh/state/apply/composition seams; only necessary protocol
item/liquid/state/delta/command/action/capability/event/GameView contracts and
new fixtures/generated maps; foundation Elixir/TS operation validators; local
Story state_row/hydration/provenance and Book existing detail/pair selection.
No native/platform work, new dependencies, passive decay, thirst damage, finite
well, discard/spill, mixing, brewing, general consumable framework or new routes.

## Literal acceptance oracles and mutation plan

Expected rows/numbers below are hand-checked, never computed with a production
helper. Header each new test with its plausible break. Apply its mutant to the
old focused suite first; add a test only when that layer lacks detection.

| Controlled input | Independent expected result | Break to plant |
|---|---|---|
| Production starts actor20p/Peg20p; buy the two empty skins at4p each | actor12p/Peg28p; two distinct same acquired item IDs; each null/0; total empty skin mass1000g | Second offer resolves to first ID or creates replacement stock |
| Production cap4 water250g/unit; empty500g skin at declared well | water4, skin mass1500g; repeat Fill refuses; receipt replay stays4 | Fill bypasses source binding or overfills |
| Two filled production skins4/4, Drink1 from spare, Pour original→spare, Drink original | after Drink4/3; after Pour3/4 (transfer1, total7); after last Drink2/4 (total6) | Missing source debit or full-transfer instead of free-space limit |
| Controlled water5→water4 receiver cap7 | source water2/receiver water7, total9 | Omitted debit or receiver overflow |
| Controlled water2→empty receiver cap10 | source null/0, receiver water2 | Exhausted row retains kind or deletes shell |
| Controlled Drink amount2, water7; then exact retry | water5 both times, no resource/RNG/clock change | Replay debits or applies an early benefit |
| Controlled Drink amount2, water1 | refuse; water1 unchanged | Partial-last policy introduced silently |
| Body load excluding empty100g skin11900g, cap10, density2g/unit, ceiling12000g | before Fill12000g, proposed12020g; refuse and retain empty skin | Fill ignores liquid mass |
| Same controlled skin with other body load11880g | full Fill exactly12000g succeeds | Off-by-one carrying refusal |
| Two owned skins rearranged/Pour while body already overloaded | legal Pour is mass-neutral; Drink/Drop can reduce load | Reuse positive-acquisition check for neutral Pour |
| Full production1500g skin as incoming item, other actor load10501g/ceiling12000g | Take/Buy refuse proposed12001g; money and custody unchanged | Incoming carrying uses only500g shell |

Use table-driven refusal cases for self-pour, full receiver, empty source,
undeclared/out-of-room source, mixed kinds (controlled declared water/oil only),
foreign/corpse/closed-bag custody and forged exact IDs. Require all rows, custody,
RNG and head unchanged; no invented production oil consumer. An owned open
satchel case must succeed, while a room-ground vessel must fail ownership even
though reach succeeds. Shared projection/admission and budget exhaustion must
fail atomically, not hide a bad pair behind absence of controls.

Portable fixtures pin prior-row mismatch, duplicate writer/conflict, row
null/positive mismatch, capacity overflow, invalid kind and a two-vessel success
with literal2/7. Validate each kernel against those independent answers before
randomized differential comparison. Perform the schema required/bound mutant
sweep on new/changed schemas, preserving frozen fixtures.

Real SQLite cases must reopen every actual intermediate state: empty/fill/partial
Pour/drunk-empty, open nested bag, dropped, sold/bought back and a real controlled
fatal combat/corpse/recovered vessel. Current-load row validation alone is
insufficient: alter a valid bounded quantity without its authorized receipt,
forge an earlier source/custody participant, omit/reorder a Pour debit and confirm
`save_corrupt`. Missing/non-opted/unknown-kind/negative/fractional/overflow rows
must refuse without refill or repair. Preserve B3/S2 historical penny reconciliation
and lawful post-receipt custody; a sold full skin may lawfully be Peg-held now.

Inject real failed COMMIT and both uncertain-COMMIT outcomes by operation, not
SQL text. For Pour5/4→2/7, an actual failed transaction reopens5/4; a successful
COMMIT with lost acknowledgement reopens2/7; exact replay retains2/7. Head/receipt,
liquid and custody are all prior or all next. Input and elapsed work stay fenced
while unknown. Plant early adoption/second debit and observe a focused failure.
Reuse unchanged real receipt/fault proofs where they already detect the mutant;
retain only the new liquid-row integration regression the old suite misses.

## Verification, review and stop triggers

Read [mechanics](../../lessons/mechanics.md), [contracts](../../lessons/contracts.md),
[storage](../../lessons/storage.md), [mobile](../../lessons/mobile.md) and
[evidence](../../lessons/evidence.md) lessons before the applicable work.
Run focused compiler/loader, portable composition, liquid/carry/custody/admission,
Book pair/freshness and real SQLite checks, followed by
`mise exec -- bin/check_all.sh` once. TS headless simulation is active; mobile
verification deferral is not permission to skip changed save/Book targeted
checks. Advance the actual integrated bundled release/API and independently
re-pin known answers; do not predict another lane's successor version or IDs.

Do Ponytail Review and actual-diff correctness review. Fresh primary review plus
separate protocol/save opinion are required; Astra applies for proposal/foundation
changes. Retain red-control commands and failing assertions. Later authorized
browser proof uses buy-two→well→fill-both→drink→partial-pour→drink→refresh, with
source/receiver identities intact. Browser evidence does not certify native
SQLite, Hermes or background behavior; leave owner's saves/simulators untouched.

Stop for a frozen-fixture conflict, missing real second offer, unsafe arithmetic,
extra unconsumed physics/physiology, an alternate stored load/quantity writer,
a broader save protocol than the minimal row requires, an inaccessible mandatory
source/recovery path or incompatible concurrently merged B4/B5/C1 contract.
Report the concrete conflict and return to PM rather than weakening validation.
