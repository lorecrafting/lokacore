# PM decision: first cellar encounter — 2026-10-03

## Authority and status

Under [autonomous mechanics delegation](owner-decision-autonomous-mechanics-2026-10-03.md), the root PM adopts actual `gpt-6-astra` M4-A planning advice for the first Maud-cellar encounter. Advice inspected composed C1 source `0e49963f893192d193fac65851aa882be0f597b8`, frozen numeric vectors and draft [PR #136](https://github.com/lorecrafting/lokacore/pull/136). This is a **planned contract**, not installed combat, a live LegendMUD formula verification or independent code review. The [first-encounter contract/oracles](../spec/conformance/first-encounter.md) and [M4-A brief](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/briefs/m4-a-first-encounter.md) govern the bounded follow-up; [M queue](../NEXT-MECHANICS.md) retains dependencies.

## Selected consumer and content profile

One player fights **one finite cellar rat at a time** in the actual lantern_cellar, reached from the Drowned Lantern. Five authored rats all begin there, retaliate only after deliberate engagement and never join each other automatically. The five-kill S1 objective/key/trust reward waits for M20-B; killing rats alone does not complete S1. No pursuit, respawn, armor/defense/critical/stance/skills/XP or new weapon reward is required here.

The initial profile's world numbers belong to cartridge content:

| Setting | Initial first-encounter value |
|---|---|
| Round interval | 150 logical units; 3 real seconds at adopted M1 rate |
| Player HP / unarmed accuracy / damage | 10 / 75% / inclusive 1–2 |
| Rat HP minimum/start/maximum/gain | 0 / 6 / 6 / 0 |
| Rat accuracy / damage | 50% / fixed 1 |
| Sleeping incoming multiplier | 2 |
| Flee multiplier | 2 times the applicable ordinary exit MV cost |
| Shrine restoration | HP 10, MV 100; MA unchanged |

These are selected content values, not new engine literals. Later sword/defense consumers explicitly extend the adopted profile. The first encounter uses no automatic recovery suppression beyond M2's actual selected recovery policy.

## Selected interaction and safety

Attack starts engagement and schedules a later first round without immediate damage or a clock jump. Eligible attacks draw accuracy then damage only on a hit; alternate initiator-first/defender-first rounds. Refusal draws/pays nothing. Damage to a sleeping survivor wakes it once; lethal damage closes engagement before return, so revival never permits the old attack opportunity.

Escape is immediate after fixed prerequisite elapsed settlement, deterministic and atomic: validate the ordinary legal exit plus standing/MV, pay the multiplier once, move once, close engagement. During engagement directional movement and aliases use this same escape contract. No queued escape, bonus retaliation or bypass through ordinary movement. Due work at the same time precedes a new action.

Ordinary menus/details keep time active and expose usable threat/Stand/Flee controls; no ordinary-menu immunity. Mandatory modal scenes start only in authored safe contexts before engagement. First combat cannot launch while modal story controls are held. Position changes remain legal with existing instantaneous admission, so recovery/escape tradeoffs are explicit.

## Prerequisites and deliberate departures

M5 must provide entity-specific NPC HP and **persisted corpse identity with initial custody**, not a temporary World.entities insertion or global player HP applied to rats. Lethal player damage moves held and worn item roots into a distinct owned corpse, preserving nested custody, then returns the same player to a reachable shrine with story progress preserved. Repeated deaths cannot overwrite earlier corpses. No ghost mode, permanent-loss/XP punishment or timed decay.

Before M6 live lethality, add the actual four-room chapel route from existing well_lane through village_green → north_gate → chapel_steps → chapel_nave, with reciprocal traversable exits and prototype-derived prose. chapel_nave's altar is the shrine. Do not invent an inn shrine or introduce ferry dependency; night-gate behavior waits for its own consumer.

PR #136's accuracy/defense/critical/mitigation/death equations remain unadopted. This decision deliberately chooses unarmed fixed-profile damage, alternating initiative, immediate deterministic escape and existing recovery instead of its larger resolver and queued escape/suppression proposals. It is a small Loka continuing-melee contract, not a claim that the selected three-second cadence or formulas match the live Legend engine.

Schema/event fields, entity creation/placement operation syntax, final ownership and save layout freeze in their M1/M2/M5/M6 implementation PRs after the actual merged shape is read. M4-A freezes the semantics and independent literal oracles only; no combat capability lock or unused resolver is installed.

## Owner escape supersession, 2026-10-04

The [directionless random-Flee decision](owner-decision-m6-a-random-flee-2026-10-04.md)
supersedes deterministic directional escape and engaged Move/alias escape in this decision.
A/B/C combat oracles, ordinary noncombat movement and the authored flee multiplier remain.
