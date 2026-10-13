# Review: toolbox row W26, NPCs use doors (loka-kgd.125)

- Branch `toolbox/m11-doors`, head `787116e767eee0f90cd644cabe7ce895d6b57e62`, diffed against `b89bb97b` (`toolbox/batch-m11`). No PR (batch model). Installed `kernel_api` 1.79 to 1.81. Absorbs `loka-kgd.32` (one shared NPC exit check).
- Governing: [NPCs use doors](../system/mechanics.md#npcs-use-doors-toolbox-row-w26) (added here), [NPC door declarations](../system/cartridge.md#npc-door-declarations), [Access locks](../system/mechanics.md#access-locks-toolbox-row-g7), conditional schedules (W10), barrier@1, the G6 bounded walk, Beads `loka-kgd.125` (brief). PM correction 2026-10-13, which overrides the brief: any G7 traverse or enter lock refuses a walking NPC and is never evaluated; G7's TypeScript refusal of `subject: "target"` in room and exit locks stays.
- Hosted CI at review time: `ci` and `book-e2e` success on the head (`gh run list --commit`).
- Verdict: **APPROVE WITH NOTES** (no blocker; two should-fix test gaps, one nit).
- Written 2026-10-13 UTC in Claude Code by anthropic/claude-opus-5-5 (reviewer).

## Must be true

1. One shared check, `npcPassage`: a hidden_until or climb face refuses. A barrier: open passes; closed passes and stays closed; locked passes only when the NPC holds `key_item`, and then the barrier goes back to locked.
2. A walking NPC is refused by any exit `traverse` or destination `enter` lock, which is never evaluated (PM correction). The player-side G7 loader rule is unchanged.
3. `walks: true` (schedule case, plain step, wander plan): BFS over exits in direction-key order, bounded by `query_steps`. One-step move. Every keyed barrier on the path emits `barrier.transition` with `barrier_changed`, in order, before `entered`. No path: no event, and the retry is at the next listed hour (no new job).
4. Without `walks`, nothing changes: Chapter 1, the samplers, population, crow. The unified copies keep their behaviour; any difference is explicit.
5. The 1.81 floor is in both kernels (KERNEL_API_RANGE_INVALID). The schema has `walks` as `const: true`, and `when` is optional.

## Proof

- Green at head: `node --test` doors, hidden_passage_npc, access_locks, schedule, schedule_cases, c4_pack×4, crow×3, deer, population_composition, barriers, barrier_sampler, validate, chapters, missing_child(_stays), combat_flee, climb_flee, hidden_passage, c4_schema_contracts. `mix test` content_doors, content_schedules, content_access_locks, content_locks, content_chapters (12 pass).
- Mutants, each in a throwaway worktree:
  - Killed:
    - dropping the final re-lock: doors c and the walking-hound test fail;
    - BFS ignoring `npcPassage`: b, d and e fail;
    - `npcPassage` not skipping a climb face: the hound, deer and wander climb tests fail;
    - `!npc` returning undefined, which backs the 2f7e411 closed-door claim: the flight and wander tests fail;
    - the passage branch removed;
    - schema `walks` changed from `const` to `boolean`: Elixir contracts fails on the walks:false case.
  - Survived: findings 1-3.
- Acceptance literals checked by hand against the sampler (lane is the entry; hut is north behind hut_door, open; yard is east behind gate, locked; keep is east of yard):
  - a: the thief is in the hut at 08.
  - b: the thief stays in the lane with no event, then jumps to the yard at 10.
  - c: lane→yard→keep, four gate events in the order locked→closed→open→closed→locked; the gate reads locked after.
  - d: the guard stays, with no event.
  - e: the enter lock refuses the walker.
  - f: the jump without `walks`.
  - g: the floors.
- Unified copies: every existing population plan's area pair has exactly one plain exit, with no hidden, climb or barrier face. The "first admitted edge" pick therefore changes no cartridge, and no Chapter 1 fixture was touched. The crow keeps `passage` on purpose, and this is documented.
- Same-time jobs: a key passage restores the barrier's starting state, so job order cannot change another job's admission.
- 2f93b88 "the TS loader again refuses target": backed (no diff to the locks loader).
- The `contracts.ex` anyOf change is left to the second reviewer.

## Findings

1. **should-fix** `kernel/ts/src/mechanics/movement/shared.ts:84`: the walker traverse-lock branch is untested.
   - Mutant: keeping only `world.rooms[there]?.locks?.enter` stays green; doors test e uses only an enter lock.
   - Scenario: an edit like this lets a walking NPC cross a traverse-locked exit, which the PM correction forbids.
   - Fix: in `kernel/ts/test/doors.test.ts:154`, add a clone with a `traverse` lock on the lane's east exit. The guard stays in the lane and the gate emits no events.
2. **should-fix** `kernel/ts/src/mechanics/movement/shared.ts:117`: the direction-key tie-break is unpinned.
   - Mutant: `.reverse()` stays green.
   - Scenario: in a test clone, add hut east→keep, so lane→keep has two equal-length routes. The spec order goes east through the gate (four `barrier_changed` events); the reversed order goes north through the hut (none).
   - Fix: add that clone to doors.test.ts.
3. **nit** `kernel/ts/src/mechanics/movement/shared.ts:119`: the `query_steps` bound is untested; removing the check stays green. The Known limit says "a path longer than the step budget refuses".

## Departures

Accepted as the developer reported them:
- the `npcPassage(world, room, direction, npc?)` signature;
- `size: allow` at 47 lines;
- the anyOf validator (second reviewer);
- the sampler key in the lane, with the guard starting there;
- flight, refuge and plain steps ignoring locks (spec: only `walks` reads locks or keys).
