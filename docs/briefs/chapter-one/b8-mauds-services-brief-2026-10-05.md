# B8 — Maud's room, food and drink services

**Adopted planning brief, source implementation pending.** Planning branch
`planning/b8-maud-services`, inspected local base
`4ec52632d510e45214e43a1fe5beca0ec5addbad`. B3 is locally implemented and reviewed
at chapter `ashmere_missing_child@0.0.18`/API1.16; accumulated publication remains
pending. B7 has an adopted plan, not merged source. Installed Rest/position and
MV recovery exist; Inn/meal/Eat/service implementations do not. Re-pin actual
B3/B7 integration and review heads before assignment. Implementation branch
`chapter-1/b8-maud-services` (not created). Successor release/API/hash/entity IDs,
implementation head, PR and verdicts: null. Docs only; no merge/push/play claim.

## Consumer, dependencies and governing clauses

At the actual Drowned Lantern, open original Maud's detail, buy the room, eat a
paid bread meal and drink a paid ale serving. Each has a complete immediate
outcome. Walk upstairs to the real Inn Rooms bed and use ordinary Rest after
payment. B8 adds no rooms; S10/dream remains B9. Services stay available before,
during and after S1 without hiding its offer or turn-in. Upstairs, attic, cellar,
S1 key/chest and the owned-corpse recovery route remain free of service gates.

The [PM adoption](../../decisions/pm-decision-b8-mauds-services-2026-10-05.md)
selects [mechanics](../../system/mechanics.md#b8-mauds-immediate-services-selected-contract),
[tuning](../../system/cartridge.md#b8-mauds-service-declarations),
[composition](../../system/protocol.md#b8-immediate-service-composition),
[save](../../system/save.md#b8-service-recovery) and
[Book](../../system/book-ui.md#b8-maud-and-bed-details). These supersede the old
purchase-item-then-consume candidate. Food/ale are eaten/drunk in the service
transaction itself; Room grants immediately usable entitlement, not recovery.
B7 water remains benefit-free. Historical00a §§2/4/5 and primitive21 §§14/22 Inn
supply consumer direction, not installed hunger/drunk/occupancy defaults.
Follow world-parameters, fixed elapsed time, no-wait, forward-development and
[composition](../../system/architecture.md#building-mechanics-by-composition).

## Minimal implementation and composition record

- **Real consumer:** three exact original-Maud service offers and actual Inn
  Rooms bed; prices/benefits/starts live only in the tuning clause. Service keys
  and refs bind identity, never English labels or first-eligible Talk order.
- **Shared reads:** actor→bodyOf, living actor/provider, original provider's
  authored offers and current room, current quote, exact pennies/stock bounds,
  actor entitlement, settled MV/headroom, exact provider-held opted ale vessel
  kind/quantity and immutable serving metadata. One shared query budget covers
  all candidates, custody and arithmetic before allocation.
- **Typed writes/owners:** service owns admission and lowering; reuse B3 exact
  payment helper and existing resource/fact ops. Liquid owns the reusable pure
  serving transition; service uses it for its exact bound provider vessel, not
  a public actor-owned Drink call. Position owns actual Rest and MV rate changes.
  Proposal owns atomic writer conflict/adoption; authority owns changed-row
  transaction/history validation; Book only emits captured ActionInvocations.
- **Missing primitive/invariant:** the smallest typed immediate service command,
  declaration and shared projection/admission query. Payment and stock must be
  exact; MV benefit may cap after ordinary settlement. No new portable delta
  op, service row, entitlement ledger, issuer or registry of arbitrary effects.
- **Reuse:** room is narrative Boolean truth, meals are finite nonregenerating
  resource stock, ale is the B7 finite row. Meal/drink require positive MV
  headroom; no carrying acquisition occurs. Existing replay, combat/scene
  precedence, receipt narration and unknown-COMMIT fencing compose directly.
- **Named exceptions:** provider-owned serving debit is deliberately distinct
  from B7 actor-owned Drink admission, using the same checked row transition.
  No Maud/named room/ale switch in the kernel. B9 alone adds actual accepted
  Rest credit at Inn Rooms after entitlement; unpaid prior Rest never credits.
  D4's later foraged food remains a separate real Eat consumer, not certified
  or implemented here. No idle wait, service duration, hunger/drunk or HP bonus.

Scope: chapter manifest/text/facts/resources, original Maud, a provider-held
`lantern_ale_cask`, Inn Rooms bed detail; minimal source service declarations and
compiler/loader short refs, capability dependencies and invalid cases; pure
`mechanics/service` rule/shared query, reused commerce/resource/liquid helpers,
commands/targets/actions, GameView service projection, world dispatch/feature
map; only consumed protocol command/action/offer/consequence/event/capability
contracts and generated artifacts/current fixtures; local Story store/save
verifier and receipt narration recovery; shared Book Maud/bed detail/freshness.
No mobile native changes, new dependencies, portable-foundation rewrites,
extra source rooms, stock regeneration, shop buyback, edible inventory,
bartering, passive physiology, B9 overlay, timed Inn reservation or Realm.

## Independent literal acceptance and mutation plan

Test only a distinct break missed by the old focused suite in that layer. Name
that break before the test, apply its mutant to the old suite first, and use
hand-checked literals below rather than production helpers for expected values.
Freeze elapsed input at0 for these arithmetic tests; test genuine settlement
separately. Production values come from the governing tuning clause.

| Controlled input | Independent expected result | Realistic mutation |
|---|---|---|
| Actor20p/Maud10p, unpaid, standing, fullMV100; rent3p | 17p/13p, paid=true, standing/MV100/clock0; no S10/slept/dream grant | Rental calls Rest or grants recovery |
| Exact replay, then distinct already-paid rental | remains17/13/true; distinct attempt refuses with no stock/event/payment | Replay or repeated room double-charges |
| Actor20/Maud10, meals4, MV50/max100; meal2p/+12 | 18/12, meals3, MV62, unchanged HP and position; replay stays same | Debit omitted, benefit early or serving not consumed |
| Actor20/Maud10, meals4, MV95/max100; meal | 18/12, meals3, MV100 | MV overflow or payment treated as saturating |
| FullMV100; meal or drink | refusal, balances20/10, meals4, ale4 | Pay despite zero benefit |
| Actor20/Maud10, ale4, MV50; drink1p/+4 | 19/11, ale3, MV54; exact replay identical | Separate ale store or second consumption |
| Ale1, MV96; drink then another distinct drink | first ale null/0, MV100; second refuses; shell ID retained | Partial serving, refill-on-empty or shell deletion |
| Controlled serving2, ale1, MV50 | refuse; ale1/MV50 and money unchanged | B7 strict-last policy silently weakened |
| Controlled Maud999p, actor20p, meal2p | refuse overflow; money/stock/MV all prior | Credit saturation destroys conserved pennies |
| All three from20/10, meals4, ale4, MV50 | actor14/Maud16, paid=true/meals3/ale3/MV66 | One benefit shares wrong provider/stock |
| MV5, remainder0, standing rate18/3600; elapsed1800 then meal+12 | clock1800, MV26, remainder0; then accepted Rest and1800 at resting36/3600 yieldMV44 | Service discards settlement or grants menu rate |

Table-drive insufficient pennies, zero meals, empty/mismatched/foreign/ground
ale stock, departed/dead/forged provider, stale quote/ref, scene/combat block and
budget exhaustion. Verify whole-proposal rollback, RNG, head and receipt rules;
never silently substitute stock/service. A controlled second provider catches
reading world.character/original-Maud constants instead of bound command identity.
Bed paid/unpaid rendering and actual Rest admission prove entitlement is consumed
without denying ordinary unpaid position controls. Already-resting Rest refuses;
Stand→Rest accepts. S1 not accepted, active before five kills, objective met,
resolved: service controls plus the correct existing Talk/turn-in remain reachable.

Real SQLite cold-reopen unpaid, paid-before-Rest, used meal, partial/empty ale,
and actual same-body death/corpse/recovery then use their next real consumer.
Current bounded values alone do not prove history: mutate paid false→true,
meals3→4, ale3→4, swap a receipt service/provider/quote or remove one valid
payment/stock/benefit op and require `save_corrupt` without rewriting the file.
Keep B3/S2 payment provenance and B7 liquid provenance; later valid elapsed,
travel, body death, payments and custody cannot invalidate historical receipts.

For room/meal/drink inject real failed COMMIT and both unknown-COMMIT outcomes
by operation, not SQL text. Failed/unknown-not-committed reopen all old; committed
lost acknowledgement reopens all new; exact replay repeats no charge/benefit.
While unknown input/elapsed are fenced. Reuse existing unchanged fault/replay
proofs when they detect the mutant; retain only missing service integration cases.
Plant early adoption, omitted debit/stock and wrong bound service, observe focused
failures. Schema required/bound sweep covers changed contracts. If any portable
composition semantics actually change, stop to amend this no-new-op brief and
supply both kernels' independently pinned fixtures/differential obligations.

## Checks, review and stop triggers

Read mechanics/contracts/storage/mobile/evidence lessons before applicable work.
Run focused compiler/loader, service/admission/settlement/S1/bed, Book freshness
and real SQLite checks, schema mutants, then `mise exec -- bin/check_all.sh`
once for publication. TS headless sim stays active; native/Hermes proof remains
deferred under the mobile pause. Independently derive integrated release/API and
known answers after dependencies merge, never predict another lane's ID/version.

Apply Ponytail Review and actual-diff correctness self-review. Fresh independent
primary plus separate protocol/save opinion are required; Astra applies if
proposal/foundation changes become authorized. Retain actual red-control commands
and failing assertions. Later authorized browser proof uses Maud room→meal→drink,
Leave→upstairs→bed Rest→refresh, repeated rental refusal and S1 control reachability.
Browser refresh does not certify native SQLite/background/Hermes; no owner-save
or simulator operation is authorized by this plan.

Stop for a missing B7 integration/review, incompatible quote/liquid/save producer,
unsafe arithmetic, arbitrary effect framework, required edible item/Eat policy,
paid-only movement/corpse route, S1 first-eligible interference, rental-as-Rest,
HP/physiology/time-skip expansion or governing/frozen-fixture conflict. Return
concrete evidence to PM; do not weaken payment, custody or save validation.
