# PM decision: D6 water depths and recoverable drowning — 2026-10-06

**PM-selected contract; fresh scoped review, publication and source assignment remain pending.**
The PM adopts this replacement water/recovery contract under the [mechanics delegation](owner-decision-autonomous-mechanics-2026-10-03.md).
The prior local [plan review](../reviews/2026-10-06-d6-water-depths-plan-review.md)
and [adoption review](../reviews/2026-10-06-d6-water-depths-adoption-review.md)
remain historical evidence at their named heads. Their final approval predates
published D1 and covers the old logical timer; it does not approve this replacement contract,
the replacement deadline, new source or publication.

Active amendments: [mechanics](../system/mechanics.md#d6-water-depths-and-owned-corpse-recovery-selected-pending-implementation),
[cartridge](../system/cartridge.md#d6-bottom-rooms-and-water-tuning-selected-pending-implementation),
[protocol](../system/protocol.md#d6-water-movement-and-corpse-selection),
[save](../system/save.md#d6-water-and-owned-corpse-recovery),
[Book](../system/book-ui.md#d6-water-exits-and-chapel-recovery), and the
[D6 brief](../briefs/chapter-one/d6-water-depths-brief-2026-10-05.md).
These clauses select behavior; they do not claim installed source or new independent approval.

## Published dependency re-pin

Inspected base: published main **815f66f9039ca22f80d44112a1ff966eadb8381e**.
D1 source is merged via **c20addb0** ([#231](https://github.com/lorecrafting/lokacore/pull/231));
its status follows in [#232](https://github.com/lorecrafting/lokacore/pull/232).
Current chapter **0.0.30**, kernel API **1.26**, canonical SHA-256
**dbff57ba20305dffa4a0679ab58d480574fbc3fd93fddeb3bf08d48d78e057b9**,
**149 starting IDs**. The exact v030 hash/ID fixtures remain frozen. A future
D6 release is independently pinned; no historic fixture is regenerated.

| Dependency | Actual source inspected | Consequence for D6 |
|---|---|---|
| D1 lesson | `skills/swim.json`, `dialogues/sedge_swim.json`, `npcs/sedge.json` in the chapter; `kernel/ts/src/mechanics/skills.ts` | Reserved Boolean acquisition, vacuous `all: []` qualification, free immediate Sedge lesson; D6 neither teaches nor introduces CON. |
| D1 recovery | `kernel/ts/src/mechanics/transport/shared.ts`, `transports/fen_outbound.json` | Waiver is for an actual owned nonempty isle corpse, not a client flag. Chapel recovery must preserve this provenance; emptying an isle corpse removes its waiver. |
| C1 attributes | Chapter `attributes.json`, skills status owner | STR10/DEX10/PER5 are installed; CON is absent. New attribute qualification would widen D6 and D11. |
| B4/D5 route | Chapter `rooms/well_shaft.json`, `rooms/black_pool.json` | Shaft currently has only Up; Black Pool is a dry bank with three dry exits. Add reciprocal Down/Up to exactly two bottoms. |
| Movement/view | `kernel/ts/src/mechanics/movement/sequence.ts`, `kernel/ts/src/view/view.ts` | Existing execution requires standing/fare; view checks those separately. Free Up requires a shared exact-edge admission used by both. |
| Resource/clock | Chapter `resources.json`, `cartridge.json`; `kernel/ts/src/mechanics/resource.ts` | MV 0–100, standing/sitting 18 and resting/sleeping 36 per 3600; real-elapsed rate 50. Entry debit uses resource ownership; ordinary fractional recovery continues. |
| Job dispatch | `kernel/ts/src/runtime/proposal.ts`, `kernel/ts/src/mechanics/schedule/rule.ts` | Time advance drains pending jobs with due_time≤target; dispatch supports encounter/quest/population/NPC jobs. Water binding/dispatch is new typed work. One deadline needs no recurring successor/catch-up loop. |
| Death/custody | `kernel/ts/src/mechanics/death/sequence.ts`, containment shared owner | Existing fatal input requires positive-to-zero HP already applied; nullable killer/credit are supported. Existing direct/worn roots move to one corpse; same body returns to Chapel with HP 10/MV 100. No MV-only fatal interface or remote shrine recovery is installed. |

[Final source/SQLite evidence](../evidence/2026-10-06-d1-ferry-isle-publication/README.md)
and [actual Book lesson/reopen/recovery evidence](../evidence/2026-10-06-d1-browser-book/README.md)
provide D1 dependency proof; their dated local-publication caveats remain history.
The current roadmap records publication. Public isle death is not claimed: its
recovery proof uses a declared controlled hazard.

## Adopted bounded contract

The [selected mechanic](../system/mechanics.md#d6-water-depths-and-owned-corpse-recovery-selected-pending-implementation)
uses existing acquired swim, replaces ordinary entry fare, preserves free living
Up and refuses following Wren. No attribute floor or extra lesson is needed.
One deadline replaces periodic drain; MV 0 alone is never fatal. Typed drowning
composes the actual HP fatal transition, conserved corpse and same-body return.

Select the narrow Chapel action for any actual owned nonempty corpse,
including remote non-water deaths, under the linked custody contract. This
provides the selected Legend recovery fallback without a general remote Take,
replacement gear or recovery ledger. Deadline equality and historical-receipt
validation require source proof, not a global scheduler redesign by assumption.

## Selected deadline and rejected timer options

The PM selects one content-authored submersion deadline of **6000 logical seconds**: **120 real seconds** at the installed rate 50. It is a generous
chapter-one starting tuning requiring later browser proof, not an owner quote or
measured usability result. Entry at
clock 64800 yields deadline 70800 whether MV after debit is 0 or 90. At 70799 a living
Up can succeed; at 70800 expiry settles before Up and creates one actual corpse.
A later entry gets its own generation/deadline. Surface/refusal/posture/recovery/
Read/reopen never extends the current deadline. Remaining time is visible on
every underwater page alongside a captured free Up action.

[Independent Astra pacing advice](../reviews/2026-10-06-d6-water-pacing-astra-advice.md)
is preserved at advice commit **0bdbd879ce1b9630fbe7b40b902b4826776b25bc**.
It recommends a single deadline with an initial 3000-second tuning suggestion;
PM selects 6000 for more chapter-one reading runway. Advice is not
independent approval. Fresh scoped review must inspect this replacement contract,
PM tuning and the new D1 baseline.

| Option | Actual rate 50 consequence | PM disposition |
|---|---|---|
| Earlier 5 MV/150 logical seconds | MV 10→entry 0: fatal after 3 real seconds; controlled MV 20→entry 10: fatal after 9 real seconds with standing 18/3600 and zero remainder | **Rejected provisional option.** Earlier local approval did not establish acceptable real pacing. |
| Longer periodic drain | Retaining 5 MV with a longer interval lets standing recovery outpace danger; larger drains avoid that but still add recurring resource work | **Rejected.** One deadline avoids both low-MV timing and regeneration cancellation. |
| Action-based danger | Needs counted actions, refusal/replay and passive recovery policy; values/oracle null | **Unselected.** Wider participation than one existing due job. |
| One 6000-second deadline | 120 real seconds regardless of current MV/regeneration/posture | **Selected.** Fresh scoped review and implementation pending. |

For historical comparison only: the old controlled standing oracle at
clock 64800/MV 20, entry 10 and zero remainder was 64950→MV 5/remainder 2700,
65100→MV 1/remainder 1800, 65250→MV 0/remainder 900. Actual fresh MV is 100, not 20;
its old first lethal drain was tick 21 at 63 real seconds. These are independent
arithmetic for the rejected option, not production acceptance.

## Adopted items and remaining unknowns

The selected old coin is **10g**, silver ring **5g** and sunken chest **2000g**;
chest declares `container: true`, capacity **1 direct item** and **100% descendant
mass**. They are conserved items, not balance grants. Sell price and chapter-two
effect remain **null**/out of scope. Keep B4's actual torch; no extra sunken lantern
or wet-fuel system. Both bottoms are dark with known Up and ordinary light rules.

- Occupancy/job/save/projection wire shape, capability/API successor, release/hash/
  IDs, source head and PR are **null** until source design and independent
  derivation. Historical-custody receipt validation and remote owned-corpse
  projection require typed contracts/negatives and real SQLite intermediate/
  fault/replay proof before implementation is accepted.
- Remaining-time/warning wording follows PM-delegated copy: show authority-owned
  time and free Up on every underwater page without a second gameplay clock.
- D11 cannot use this no-CON consumer as its six-attribute proof. Its future
  CON consumer or narrowed scope remains a separate PM selection.

## Assignment gates and self-review

Fresh independent scoped review of this selected D1-base/deadline/loot contract
and reviewed publication precede source assignment. The active-spec/owner-rules
record accompanies this planning adoption. Re-pin
latest published main again after ongoing D4/C4 changes; inspect their actual
movement/job/proposal/save consumers, never use local unreviewed source as a
published dependency. Frozen-fixture conflict, changed death ownership, unsafe
free-Up/custody/recovery, a new clock or broader terrain/combat framework returns
to PM. Split only at a complete recoverable player outcome.

Ponytail self-review: reuse movement, acquired skill, fractional resources,
existing jobs, fatal sequence, containment and receipts. One narrow water owner
and one Chapel action have concrete consumers; no dependency/framework/migration.
Correctness self-review caught the 50× timer and direct-item capacity unit; it
retains death invalidation, same-ID root transfer and D1 waiver interaction.
This task certifies docs/pin checks only, not runtime tests or independent approval.
No source, fixtures, preview, native session or owner save was changed.
