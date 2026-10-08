# Planned first-encounter contract and literal oracles

**Status: M4-A planned semantics/oracle supplement.** [PM decision](../../decisions/pm-decision-first-encounter-2026-10-03.md) adopts this contract; no executable combat fixture, implementation, certification or native result exists yet. Frozen RNG inputs below remain the existing [numeric vectors](numeric-vectors.json) under [numeric profile v1](numeric-profile.md). Later implementation must match these independent answers without rewriting them to suit its code. Exact schema/event fields and mutation syntax remain implementation work.

## Admission, rounds and outcomes

Attack requires the trusted player's living standing body and a living authored attackable rat in the same real room, neither already engaged, no sanctuary and no modal scene holding controls. Noncombat NPCs receive no Attack offer. Repeated Attack, including another target while engaged, refuses without resource cost, RNG draws, gameplay allocations or synthetic action-time charges. Already-settled M1 elapsed time and ordinary saved refusal receipts retain their existing semantics. The first round is due at engagement time plus the content interval; Attack itself deals no damage.

Each due round gives each surviving eligible actor at most one opportunity. Round 1 initiator first, round 2 defender first, alternating thereafter. Revalidate life, engagement identity, presence and position immediately before each opportunity. Nonstanding player skips its attack without draws; sleeping positive-damage survivors stand after damage and can act only if their opportunity is still ahead. Sitting/resting do not silently stand. Recovery follows M2 piecewise position accounting, without retroactive rest or an implicit combat suppression.

For an eligible attack: accuracy uses frozen `uniform(100)` and strict `roll < chance`, including declared 0/100 chances. A miss stops without damage draw/wake. A hit with a nondegenerate inclusive interval uses `lo + uniform(hi-lo+1)`; fixed damage makes no extra draw. Apply the content sleep multiplier, then HP loss `min(current HP, multiplied damage)`, keeping the existing exact resource algebra. Validate positive bounds and checked arithmetic. A round's safety budget is **eight raw draws**, including rejection draws; exhaustion faults the entire proposal and adopts none of its RNG.

Positive-to-zero HP closes engagement immediately and composes death once before any revival. Attack results identify attacker/target and hit/miss/actual HP loss; a committed NPC death identifies victim instance/definition, death room, killer and credited player where known for future S1 credit. No kill from a corpse, stale job or replay. Allocate an attack result before its lethal occurrence/corpse identities; sort transferred item roots by EntityId. Schema fields and concrete operation forms are deliberately unfrozen.

Schedule a successor only after both opportunities and while the encounter remains open, from the previous due time plus interval. Existing due ordering remains `(due_time, job_id)`. Closed/replaced engagement jobs are harmless, drawing/mutating/emitting nothing; re-read eligibility instead of using an old due snapshot. Due work at time T settles before newly sampled player input at T. A successful flee pays once, moves once and closes atomically, with no extra retaliation. Directional move/alias shares flee's applicable ordinary exit validation and multiplied price while engaged; outside combat ordinary movement remains unchanged.

Death HP/custody/engagement closure belongs to the attack's composed writer group, preventing a competing reaction write. Receipt replay and uncertain-COMMIT recovery restore combat, jobs, resources and corpse rows together before more input. M5's actual durable corpse and reachable shrine prerequisites must be met before live lethal M6 content.

## Frozen input sequence

Copied from numeric-vectors.json; its [provenance](numeric-profile.md#known-answers-and-provenance) records a standalone upstream C cross-check. The arithmetic below is hand-calculated, not produced by combat code or another kernel. All listed raws satisfy uniform(100)'s acceptance bound **4,294,967,200**.

| State | Raw producing this state | Four RNG words |
|---|---|---|
| S0 | initial | `[1,2,3,4]` |
| S1 | 11,520 | `[7,0,1026,12288]` |
| S2 | 0 | `[12295,1029,1029,25165824]` |
| S3 | 5,927,040 | `[25179138,12295,540162,2107404]` |
| S4 | 70,819,200 | `[27274249,25704967,31982592,12605441]` |
| S5 | 2,031,721,883 | `[15224335,29364750,272377353,1125134346]` |

Controlled oracle worlds use the decision's attack profile and zero relevant recovery over these intervals; they do not pause the production clock or assume M2 never regenerates.

### A — two ordinary rounds

Start time 0, RNG S0, standing player HP10/rat HP6. At150 player accuracy `11520 % 100 = 20 < 75`, damage `1 + (0 % 2) = 1`: rat HP5. Rat accuracy `5927040 % 100 = 40 < 50`, fixed damage1: player HP9. End round1 **S3**, successor300. At300 rat first: `70819200 % 100 = 0 < 50`, player HP8. Player `2031721883 % 100 = 83 >= 75` misses with **no damage draw**. End **S5**, player HP8/rat HP5, successor450.

### B — lethal rat hit stops retaliation

Start S0, round1, standing player HP10/rat HP1. Player accuracy20 hits, damage1 kills. Exactly one rat death/corpse is proposed, engagement closes and no successor exists. Rat draws nothing: final **S2**, player HP10. Receipt replay yields the same occurrence without another corpse, event or draw.

### C — sleeping death closes before revival

Start S2, even round, rat HP6/player HP2 sleeping. Rat first: `5927040 % 100 = 40 < 50`; fixed1 × sleeping2 loses2HP. Player dies; M5 creates its owned corpse, closes engagement and returns standing at the authored shrine with HP10/MV100, MA/story progress unchanged. The restored player takes **no old-round attack**. Final **S3**, rat HP6, one player death/corpse, no successor.

## Actual foundation gaps to resolve in M5

[State/World](../../../kernel/ts/src/runtime/decision.ts) derives entity maps from pinned definitions;
[save reopen](../../../mobile/authority/local-story/store.ts) combines those definitions with saved
state. M5-A provides five finite passive cellar rats and entity-specific persisted HP through
[resource@1](../../system/mechanics.md#resource1-kerneltssrcmechanicsresourcets), with no attack
or death producer. M5-B now provides the [durable corpse/return foundation](../../system/mechanics.md#death1--corpse-custody-and-same-body-return-m5-b-foundation),
including an additive portable creation supplement and real SQLite failure/reopen controls.
The chapel route reaches chapel_nave, configured as the return room. The M6 actual
Attack → round → lethal NPC/player loss → shrine → recovery proof, including encounter
closure before revival and frozen RNG outcomes, remains required. No live death or native
consumer proof is claimed by foundation conformance.

## Escape supersession, 2026-10-04

The [owner random-Flee decision](../../decisions/owner-decision-m6-a-random-flee-2026-10-04.md)
supersedes directional Move/alias escape above: Flee is directionless and randomly selects
among currently legal exits; engaged directional movement is refused. Frozen A/B/C attack
and death vectors remain unchanged. Random-exit acceptance uses additive literal cases.

Implementation evidence: [M6-A first live cellar fight](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-04-m6-a-first-live-fight/README.md).
