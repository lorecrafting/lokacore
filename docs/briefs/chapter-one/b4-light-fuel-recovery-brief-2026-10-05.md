# B4 — useful light, fuel/refill and safe recovery: adopted developer brief

**Branch:** `chapter-one/b4-light` in an isolated developer worktree.
**Inspected base:** provisional B3 integration `340025a0ef5d3644e84ac23634b74dfa6d20d459`,
chapter `ashmere_missing_child@0.0.18`, API1.16. B3 source is present and its focused
checks are recorded in the [B3 check note](../../evidence/2026-10-05-b3-shop/README.md).
Its independent primary/save reviews remain pending; review has identified current
ID-fixture/schema-example issues. The [v018 release answer](../../../protocol/fixtures/missing_child_v018_hash.json)
and [IDs](../../../protocol/fixtures/missing_child_v018_ids.json) are provisional,
not final dependency proof. Before building, incorporate B3 fixes and re-pin the
actual source/release independently. B4 successor release is `ashmere_missing_child@0.0.21`, API1.19;
its independent hash/94-ID answer is linked in the [source evidence](../../evidence/2026-10-05-b4-light/README.md).
Independent B4 review head and remote PR remain null. This brief authorizes the selected
local source outcome under PM adoption; it does not authorize remote publication.

Local [source evidence](../../evidence/2026-10-05-b4-light/README.md) and
[draft PR](b4-light-local-pr-2026-10-05.md) record the successor on corrected B5 and
provisional C1 source. B4 independent reviews and C1 scoped fixes remain pending;
this is not publication proof.

## Goal and player path

At Well Lane, try the public down stair without equipment: enter a truthful dark
Well Shaft, retain up egress and inventory, and find no hidden masonry link.
Return up and west to Peg; Buy the actual B3 torch for3p and oil for2p. Ignite the
held torch or Wear it in the light slot and Ignite; go east to Well Lane and down.
Inspect the now-visible masonry detail. Douse to save fuel; return up freely,
Refuel that exact torch from that exact bottle, Ignite and revisit. Put it into
the purchased satchel to prove nesting removes illumination while burn continues;
Take restores only its remaining fuel. Sold/bought-back, exhausted and lost gear
never blocks the main chapter or recovery. No lantern, new danger or required wait.

Governing clauses: [light and darkness](../../system/mechanics.md#b4-light-and-darkness-selected-contract),
[well/tuning](../../system/cartridge.md#b4-well-and-fuel),
[primitive and wire](../../system/protocol.md#b4-fuel-composition),
[durability/recovery](../../system/save.md#b4-fuel-and-dark-recovery),
[Book](../../system/book-ui.md#b4-light-details), and the
[PM adoption](../../decisions/pm-decision-b4-light-2026-10-05.md).
Those sections replace this brief's former candidate lantern/refill/retrieval policies.
Follow the no-wait, fixed-time and cartridge-owned-number owner rules.

## Composition record and boundary

Real consumer: optional room/detail perception and three exact item controls.
Shared reads: confirmed clock, source/supply definition and instance fuel, actor
body/light holder, existing custody/lid/carry queries, room darkness and corpse
ownership. Shared writes: typed `fuel.set` rows, bound narration and normal receipt.
Light owns fuel changes; elapsed authority owns time; custody/equipment/death/commerce
retain their existing writers. The host commits changed rows, then adopts, then replies.
The presenter emits invocations and consumes confirmed views.

Reuse containment, equipment, movement, corpse ownership, query budget, writer-group
conflicts, receipt/freshness and SQLite reconciliation. Missing invariant: conditional
elapsed burn must retain per-instance history across all custody changes and atomically
conserve source gain/supply debit. Deliver only the typed fuel row/spec/target and exact
prior-row op required by that invariant. Current resource gain is unconditional and
its opted recovery is posture-specific; do not bend either into a second light writer.
Portable composition additions require Elixir/TypeScript fixtures and differential
proof; story perception/admission stays TypeScript-only. No chapter-name engine branch.

In scope: selected docs, chapter torch/oil descriptions/metadata, Well Lane reciprocal
stair, new Well Shaft dark/normal text and masonry detail; compiler/loader; small light
rule/shared query; contracts/registries/generated outputs; required fresh/adopt/compose
seams; existing view/Look/Scan/target/admission; changed-row save validation; Book item
and World views; focused tests and headless simulator. Existing source identities and
B3 shop policies are retained within the new release, with new IDs independently pinned.
No native/phone work, Realm adapter, lantern/cottage, sunlight darkening, hazard,
replacement gear, shrine retrieval, stacking/liquid framework, ancestry/spell sight,
mandatory Q2/bell/cellar light gate or unrelated C1 combat change.

## Acceptance and red controls

Use controlled inputs and literal expected answers independent of implementation.
Apply each proposed mutant to the old focused same-layer suite first; add a new test
only if that distinct plausible regression is otherwise missed.

- Source capacity10/start10/rate1, Ignite at100: query103 gives7; Douse103 writes7
  unlit at103; query110 stays7; Ignite110 then query112 gives5. Transfer, nest,
  Sell/Buy and cold reopen at112 stay5. At117 effective0/unlit, Ignite refuses;
  Douse of the stored exhausted interval works once. Refuel never reignites it.
  Large elapsed intervals exhaust exactly without overflow or negative fuel.
- Source capacity8/remaining2 and compatible supply6 at a common confirmed clock:
  Refuel yields8/0; remaining7 and supply6 yields8/5. Full/empty/wrong supply,
  foreign/nested/worn/corpse supply and unowned source refuse without fuel, custody,
  RNG or narration effects. Settling a lit interval before refill neither resets
  the prior burn nor loses remaining supply. Retry returns the exact same receipt.
- Production path Buy torch then oil yields player15/Peg25/Aldric10 from20/20/10,
  retains both exact IDs, and total50; B3/S2 both-order reopen proofs stay green.
  Fuel starts, capacities and burn are independently pinned to the cartridge clauses.
- In dark Well Shaft without light, ordinary dark text/up egress/inventory/posture
  remain; masonry/other hidden identities and adjacent sight text are absent.
  Forged hidden detail or target IDs refuse. Held/light-slot lit source enables
  the same detail and admission; nested/ground/corpse/NPC source does not. A
  stale displayed action is rechecked after authoritative elapsed exhaustion.
- Controlled combat fixture in an opted dark room: Ignite and start the real
  encounter while visible, then apply the existing lethal round/elapsed producer.
  The sole torch and a bag with nested goods move to the resulting actual corpse.
  Cold reopen, same-body chapel return and gear-free legal walk reach only the
  owner's corpse; Take recovers the exact roots/descendants with ordinary lid/load
  constraints. Repeated death preserves prior corpses; foreign corpse access
  refuses. Existing production six-edge cellar recovery remains green.
- Reopen lawful fuel intermediate states named in the save contract. Real failed
  COMMIT and both unknown outcomes retain all prior/all next rows; lost acknowledgement
  retry cannot debit supply twice. Corrupt future timestamp, missing/wrong-item row,
  excess charge, malformed lit, lit supply or a forged bounded refill/omitted debit
  receipt is typed `save_corrupt`, no file repair.
- Plant missing old-interval settlement, source refill without supply debit,
  custody-triggered refill, nested light admission, hidden raw-ID bypass and omitted
  owner-corpse exemption/ownership check; observe a focused behavioral red control
  for each missing break. New portable fixtures include wrong prior row, malformed
  source/supply rows, bounds and conflicting writer cases in both kernels.

## Checks, review and stop

Read [mechanics](../../lessons/mechanics.md), [storage](../../lessons/storage.md),
[contracts](../../lessons/contracts.md), [mobile](../../lessons/mobile.md) and
[evidence](../../lessons/evidence.md) before their relevant edits. Use pinned mise.
Provisional lane: focused compiler/loader, portable fuel/conformance/differential,
light/perception/custody/admission, Book and real SQLite checks, touched TypeScript,
contract/feature generation and headless simulator; record exact commands/status.
Before accumulated publication, full active `bin/check_all.sh`, schema mutant sweep,
independent review closure and exact-head CI remain required. Native verification
is paused; any authorized browser walk supplements rather than replaces save proof.

Ponytail Review and actual-diff correctness pass are required. Fresh independent
primary and separate portable/save opinion review the exact head; use Astra if
`runtime/proposal.ts` changes. The docs-only plan receives a short fresh review.
Stop for unavailable actual torch/oil supply, unresolved B3 contract conflict,
sole-light recovery lockout, a mandatory dark route, an unconsumed perception/time/
liquid framework, loss of B3/S2 save safety, or frozen-conformance conflict. Return
concrete alternatives to PM; do not expose an unfinished Refuel control.
