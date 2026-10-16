# Review: M14 row 35 engine, arrest (loka-kgd.165; kernel_api 1.105)

- Branch `toolbox/m14-35e`, exact head `7bd17ba9d4c56193030355f6f579286e43a48923`, base origin/main. No PR (batch slice). Developer `/code-review medium` ran on `origin/main...0944ea1af`. I read `7bd17ba9d` (size allows only) myself.
- Governing: [mechanics.md Standing and disposition (G11)](../system/mechanics.md#standing-and-disposition-toolbox-rows-15-and-g11), [mechanics.md Arrest and trial](../system/mechanics.md#arrest-and-trial-toolbox-row-35), [cartridge.md declarations](../system/cartridge.md#standing-and-disposition-declarations), [architecture.md composition](../system/architecture.md#building-mechanics-by-composition), Beads `loka-kgd.165` brief.
- Written 2026-10-16 by Claude Opus 5.5 (independent review).

## Must be true (written before reading the diff)

1. Schema: `arrest {to, narration}`, both required, no extra keys; floor 1.105 in both kernels; a loader_floors case.
2. Shape: with `arrest`, `hostile` is required and `engage` is absent (SCHEMA_VIOLATION at the disposition); `to` resolves to a room and `narration` to a text key (UNRESOLVED_REFERENCE at the member).
3. Reader: an arrest is a candidate without `world.combat`; the other G11 conditions are kept; the first candidate in EntityId order wins.
4. Effect: transfer there->to, then `separate`, then the concealment cure; the arrest line; one `entity_entered_room` after the move's events; no encounter, job or draw; nothing when there is `to`; no arrest after a fall. Sleep uses the same reader.
5. Two transfers of one body commit as one container row. The actor comes from the command (seam 1).
6. The committed state stays restorable.

## Evidence

| Check | Result |
|---|---|
| Focused TS: trial, sleep, position, standing, sneak, loader_floors, combat/water/patrol/escort contracts | pass |
| Elixir: content_trial, loader_floors, content_standing | 6/6 pass |
| M1 drop the `to !== there` guard (`disposition.ts:133`) | red (trial.test.ts) |
| M2 arrest event `room_id: there` (`disposition.ts:92`) | red |
| M3 TS shape drops `!d.hostile` (`cartridge_standing.ts:34`) | red |
| M4 Elixir `bad?` drops the hostile check (`standing.ex:48`) | red (content_trial_test.exs) |
| S1 drop `combat &&` (`disposition.ts:129`) | green. This is equivalent: the loader refuses an `attack` without `world.combat` (`cartridge_combat.ts:31`). |
| S2 drop `separate` (`disposition.ts:75`) | green. Untested, and the doc says so. Not a save break: `following` (`escort/shared.ts:116`) reads an escortee in another room as not following, and the escort is not in `restorable`. |
| `!fell` survivor (`sequence.ts:101`) | not run; covered by the `ponytail:` comment; no sampler has a fall |
| Claim rerun: "Missing invariant: none" | **refuted**, see finding 1 |
| Claim rerun: market not visited, cell visited once (`mechanics.md:3664`) | backed (`trial.test.ts` pins 0 and 1; passes) |

Other points:
- Requirements 1-5 hold.
- Dropping `time_policy` from the sampler has no effect: the Sleep test is accepted without it.
- The COMPOSES `position: ['movement']` entry (`decision.ts:232`) is needed, because Sleep now emits movement's event. The size raises (+1, +3) match the added lines.
- Seam 1 is met: the actor comes from `command.payload.actor_id`.
- Seam 5 is met: `wanted` is player-scope, the cell is shared-world state, and the event's scope is the actor.

## Findings

1. **Should-fix: an arrest out of a water-route bottom room commits a save that will not reopen.**
   - Where: `kernel/ts/src/mechanics/disposition.ts:75` and `kernel/ts/src/runtime/invariants_water.ts:28`.
   - How it fails: `watersHold` checks the body's container at the `water.transition` op, which comes before the arrest transfer. The move is accepted. The final state has a water row at `there` and the body in `to`, so `waterValid` is false and `restorable` (`mobile/authority/local-story/store.ts:144`) refuses the save.
   - Probe (scratch, not committed): `water_fixture` with sedge in `well_bottom`, `arrest.to well_shaft`, hostile always, swim learned, then `move down`. The result was accepted, the body was in well_shaft with a water row at well_bottom, and `waterValid` was false.
   - Not run: the expedition hound encounter at `there` (`combat/saved.ts:80`) has the same mechanism.
   - The doc (`mechanics.md:3664`) says only "not undone". No planned content (trial_sampler, law district `market_row`) uses such a room, so this is not a blocker.
   - Fix: either name the save failure in Known limits, as the theft limit does at `mechanics.md:3229`, and file a Beads issue for a loader refusal; or skip the arrest when the move wrote a water row or opened an encounter.
2. **Nit: the brief's Readers wording is missing.** The "Combat:" sentence of the Readers bullet (`mechanics.md:2352`) does not say "or, when the NPC declares `arrest` instead of `engage`, is arrested (row 35)". A reader of G11 alone misses the arrest path.

Known limits accepted for M14:
- Patrol progress at `there` is odd but restorable.
- A sleeper stays asleep; 35-content wakes them in the cell.
- A skipped arrest lets a later fighter engage. This deviates from the brief and is documented.

Verdict: APPROVE WITH NOTES.

## Fix round 1 (76660a69c7595f042a18da0d59b32373f8561e52)

Scope: fix commit `76660a69c` only, the code it touches, and that code's direct callers.

Dispositions:
1. Finding 1 (water and encounter save): partly fixed. The move path is fixed. The Sleep caller is not (see the new finding below).
   - `kernel/ts/src/mechanics/movement/sequence.ts:77,102` skip the arrest when the move's ops or `ventured.ops` hold a `water.transition` or `encounter.open`.
   - Probe rerun (scratch, deleted): the same fixture with `move down` is accepted, the body stays in well_bottom, and `waterValid` is true. The new test `kernel/ts/test/water.test.ts:469` pins this.
   - Mutant: dropping `'water.transition'` from `PINNED` turns `water.test.ts` red (body id mismatch). Restored. `water.test.ts` and `trial.test.ts` pass 17/17.
   - The hound (`encounter.open`) has no test. A mutant that drops it would survive. It is accepted as a note: it is the same `pinned` expression, one set entry, and no planned content uses it.
   - Note: climbing out of the water (a `water.transition` to null) also suppresses the arrest. That is safe, and the Known limits wording covers it.
2. Finding 2 (Readers): fixed. `docs/system/mechanics.md:2352` names the arrest.

New finding:
1. **Should-fix: Sleep in a water bottom still arrests and commits a save that will not reopen.**
   - Where: `kernel/ts/src/mechanics/position/rule.ts:39` calls `engage(...)` with `arrests` defaulted to true and has no pinned check. This is a direct caller of the guarded `engage`.
   - Probe (scratch, deleted): the same fixture, then `move down` (body in well_bottom, `waterValid` true), then `{type: 'sleep'}`. The Sleep was accepted with the arrest narration, and `waterValid` became false. That is the round-0 failure on the second path.
   - The doc says the arrest applies on "an ordinary move or a Sleep" (`mechanics.md:3663`). Known limits (`mechanics.md:3664`) name only the move.
   - Fix: when the body holds a water row or an encounter, Sleep passes `arrests` false (a state check, because Sleep writes no water op), and a test covers it. Or name the Sleep save failure in Known limits and file a Beads issue, as round 0 allowed.

Verdict: CHANGES REQUIRED.
