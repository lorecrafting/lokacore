# E1 batch F world, resource and cask witness review

- Scope: local branch `e1/batch-f-world-witness` (not pushed), exact head
  `abaf4d51e03ecac36ca0d45b82e5400b799c4ee7`, base `b9b9326f`; spec commit `a263a78a`, adjusted in
  `bf2b4a01` and `abaf4d51`. Beads `loka-e1-r9-certification-2rz.11`.
- Governing: [architecture E1 proof policy](../system/architecture.md#e1-exact-candidate-proof-policy)
  (owner map, "an offer or a definition count is not execution", service witness, replay re-check,
  no family credit; new clause lines 337-374), the batch F brief's final PM decisions, recorded in
  [the PM decision](../decisions/pm-decision-e1-batch-f-world-witness-2026-10-07.md), and
  [mechanics carrying](../system/mechanics.md) ("equality fits"; forced transfers bypass the ceiling).
- Verdict: **CHANGES REQUIRED** (E1-F1). Recorder, replay wiring, the `ma` exclusion and the new case are sound.

## Requirements written before the diff

1. Each of the 13 paths is credited only by an accepted step whose receipt shows the named primary
   literal acting and whose before/after state agrees. Definitions, offers, fresh pools and refusals
   credit nothing, except carry under PM decision 3 (an accepted pickup at the limit plus a refusal over it).
2. Each clause names its literal and the judged state. Bands and the bell cue are judged on the projection.
3. Replay re-derives each witness and credits it only when the retained receipt lists it.
4. `/resources/ma` stays pending, and no clause certifies a family.
5. Recorder: exit 2, 38 cases, 19 pending, 614 witnessed, 15 dispositioned, exactly 13 paths moved,
   and the 37 earlier cases byte-identical.

## Checks

- Artifact sha256 `1c53bcd8…1115`. `node --test test/e1*.test.ts`: 61/61 pass. `npm run typecheck`
  (kernel/ts): exit 0. Size gate: exit 1, with the 48 known `mobile/` violations only.
  `e1_obligations.ts` has 535 lines.
- Recorder at the head: exit 2, `failure: null`, 38 receipts, 614 witnessed, 15 dispositioned, 19 authored
  pending (the 18 batch E paths plus `ma`). Set diff against the base run (whose `source_sha` is `b9b9326f`):
  exactly the 13 paths added, none lost, and dispositions unchanged. In the 37 prior cases, every step's
  command, decision, `state_hash`, clock and rng, and every finish record, are identical. Only
  `start.source`, `kernel_version` and step `obligations` differ, and those only add the 13 paths.
- Replay (`e1_cases.ts:133`) intersects the re-derived paths with `e.obligations`. Recorder and replay share
  the composed host function, so a path cannot be credited in one and not the other.
- Spec clauses: each one names its literal and requires its effect. No clause gives vacuous credit. The gain
  clause requires `next > old`, so `ma` (always 100 = max) is never credited.
- `carry-limit` (21 steps): only lawful accepted moves and takes, and `apple_03` is accepted at exactly 12000 g.
  The only 5 g item (`silver_ring`) lies in `sunken_chest` under water, and the 10 g items are underwater or held by an NPC.
  So the 20 g `fox_drawing` refusal is the cheapest reachable one.

## Mutants (throwaway worktree, removed)

| Plant | Result |
|---|---|
| (a) movement cost hardcoded 2 | movement test red |
| (b) death `d.room_id === room(after)` | death test red |
| (c) `water.transition` check bypassed | water test red |
| (d) refused decisions fall through to the accepted rules (ops treated as empty) | bands test red. The PR's raw version crashes on `delta`, so it is not a valid red. |
| (e) `liquid.set` check removed from the service witness (`e1_obligations.ts:130`) | services test red. My `drink \|\| true` variant crashed (TypeError), so it is invalid. |
| (f) module removed from `CHECK_FILES` | `e1.test.ts` check_hash red |
| own: `too_heavy` code dropped / `===`→`>=` on load | carry test red / carry test red |
| own: gain `next > old` dropped / regen rate-unchanged dropped | hp test red / mv test red |
| own: combat `attacker_id === body` dropped (`:130`) | **full e1 suite green (61/61)** |
| own: death `victim_id === body` dropped (`:88`) | **full suite green** |
| own: death_credit `credited_character_id === me` dropped (`:100`) | **full suite green** |
| own: water route `surface` check dropped (`:69`) | **full suite green** |

## Findings

- **E1-F1 blocker**: `kernel/ts/test/e1_world_witness.ts:130,88,100,69`, with tests at
  `e1_world_witness.test.ts:167,127`. Four conditions the spec names have no red control:
  - the player attacks;
  - the victim is the player body;
  - the kill is credited to the player;
  - the move starts from a route's surface.

  Two test comments claim exactly these breaks: "combat credits an NPC-only round" and "death credits an NPC death". A probe of `maudsCellar` finds 0 NPC-only rounds and 24 player rounds, so the combat control cannot fire.
  - Failure scenario: someone deletes `e.payload.attacker_id === body`. A round where only the rat attacks (for example while the player flees or sleeps) then credits `/world/combat`, and the suite stays green.
  - Fix: on the real recorded step, rewrite the event's `attacker_id`, `victim_id` or `credited_character_id`, or the before room, and assert that the path is not credited.
- **E1-F2 should-fix (PM)**: the carry clause in `docs/system/architecture.md`, its developer note
  (`pm-decision-e1-batch-f-world-witness-2026-10-07.md:20-26`) and the new `docs/decisions/README.md` index line.
  - The refusal proves only `max < 12000 + m`. The lower bound comes from a committed load, not from an accepted pickup.
  - Forced transfers bypass the ceiling (mechanics.md, carrying). For example, `containment/recovery.ts:58-62` writes `entity.transfer` to `plan.body` without a carrying check. So a 12000 g load can be committed without any take at the limit, and the spec's "[`max_grams`, `max_grams` + m)" claim does not hold in general.
  - The rule then still credits an engine where equality no longer fits (`>` changed to `>=`). Today only the `carry-limit` recipe assertion catches that, not the witness.
  - The index line states the variant as decided, while the record's item 3 still says "accepted pickup … one gram over".
  - Disposition: this blocks APPROVE until the PM rules. Final decision 3 does not cover credit for a refusal alone, which is a brief scope trigger. One option: the PM ratifies the variant in the record and the index line, and the spec sentence states that the lower bound holds only when accepted takes reached the load. The other option: the rule also requires the accepted take at the limit.
- **E1-F3 nit**: `e1_world_witness.test.ts:79-81` records three cases at module load. No other `e1*.test.ts` file does this. A recipe fault then fails the whole file without naming a test (seen with mutant d raw).

## Disputed code-review findings (batch-f-pr.md)

1. Death reads only the last hp adjust: **agree**. The death's damage ends at 0, so a missing restore withholds credit, and an extra later adjust can only withhold it too.
2. The shadowed `witnessedObligations` name: **agree**. The brief composes at the host. Recorder and replay import it from the host, and `e1_services.test.ts` pins the base set.
3. The `/services/<key>` prefix: **agree**. The base emits `/services/${refString}`, which is the same key as `cartridge.services`. An unknown key is skipped, never credited.
4. Load-time recording "matches the other E1 tests": **disagree**, see E1-F3 (a nit).

Over-engineering: none beyond E1-F3. The module reuses the engine helpers (`load`, `level`, `bellCue`, `gameView`).
