# Review: M14 row 43b mounts engine, kernel_api 1.108 (loka-kgd.168)

- Branch `toolbox/m14-43b`, exact head `21879924c0fb5a240c03a226ee9a234c0be65e62`, base `e31edbb8` (batch `toolbox/batch-m14`). No PR yet.
- Governing: [mechanics.md Mounts](../system/mechanics.md#mounts-toolbox-row-43b), [cartridge.md mount declarations](../system/cartridge.md#mount-declarations), [composition](../system/architecture.md#building-mechanics-by-composition), [WORKFLOW review stance](../WORKFLOW.md). PM rulings 1 to 6 in the Beads brief.
- Written 2026-10-16 by anthropic/claude-opus-5-5. First-pass verdict: CHANGES REQUIRED (one blocker). Final verdict after fix round 1 at the end: APPROVE WITH NOTES.

## Must be true (written before the diff)

1. Riding is an existing per_subject bool fact, scopes `["player"]`. No new saved row, field, op or event.
2. Mounted = first living NPC (EntityId order) in the body's room with a `mount` def and riding true. Otherwise on foot, and nothing is written.
3. Admission in `movementPlan` after `crossable` and before the water edge. Any listed tag admits. Untagged rooms refuse. Step, flee and view exits share it.
4. Fare: `cost_percent` default 100, applied last (after 43a terrain), floored.
5. Travel order: escort, horse, members. Each moves once.
6. Loader twins: riding shape; mount without `world.mount` or on a spawn template gives SCHEMA_VIOLATION at `npcs/<key>.mount`; floor 1.108.
7. kernel_api 1.108 and a loader_floors case.
8. Arrest, water and encounter states stay valid after a mounted move.

Holds: 1 (diffstat has no save or persistence file), 2, 3, 6, 7 (tests green; M2 to M4 red). 5: once each is tested (case 2b); the order holds by reading only (M5 green, finding 2). 8 holds by reading only: the arrest PINNED set (`sequence.ts:75-77`) is unchanged; the horse stays in `there` and `mounted()` reads on foot until the two meet again. Open: 4 (untested default, finding 1).

## Test the tests (each reverted in the review worktree)

| Mutant | Result |
| --- | --- |
| M1 `movement/shared.ts:185` absent `cost_percent` read as 0 | **green**: mount, terrain, escort, cartridge_escort, group, hireling, status_movement, trial, water, longwait_property, transcripts |
| M2 `sequence.ts:144` `.some` to `.every` | red, mount case 5 |
| M3 TS floor removed (`cartridge_mounts.ts:18-19`) | red, mount case 8, `loader_floors.test.ts` |
| M4 Elixir floor to `if false` (`mounts.ex:36`) | red, `content_mount_test.exs`, `loader_floors_test.exs` |
| M5 `escort/shared.ts:163` `[escort, horse, ...]` to `[horse, escort, ...]` | green: mount, escort, cartridge_escort, group, hireling, transcripts |

Handback claims rerun: "no new save field" holds (diffstat). The `/code-review` ran on `fd5a64940`, not on the reviewed head; the rest was reviewed by hand (finding 3). "Open: no test covers a mount without `cost_percent`" is confirmed by M1.

## Findings

1. blocker, `kernel/ts/src/mechanics/movement/shared.ts:184-186` and `kernel/ts/test/mount.test.ts:153`: PM ruling 4 (default 100) is untested. M1 stays green across the focused suite, and the sampler horse sets `cost_percent: 0`. The case 7 comment says it "Breaks: ... the 100 default is not the default". No case backs that. Scenario: an author leaves out `cost_percent` and expects the walking fare. A regression to `?? 0` makes every such horse free, and no test fails. Fix: one case that deletes `cost_percent`, rides north and expects the on-foot fare of case 1.

2. nit, `kernel/ts/src/mechanics/escort/shared.ts:163`: the order escort, then horse, then members, which the G8 Co-move bullet documents (`mechanics.md:2750`), is not pinned. M5 stays green. No test has an escort and a horse together. Scenario: a refactor reorders the movers. The decision's `entity.transfer` op order changes against the spec, and no test fails. The final state is the same.
3. nit, handback: `/code-review` ran on `fd5a64940`, not on `21879924`. Run it on the fix head (compare loka-aa75).

## Disposition

Pending the fix round.

## Fix round 1: head `3afabb9f4b5d9d74492d69eb031e82972ec30d9e`

Scope: `kernel/ts/test/mount.test.ts` (the only code change), plus the flee path at `sequence.ts:142`. Verdict: **APPROVE WITH NOTES**. Hosted CI was still running at the time of review.

- Finding 1 resolved: case 7 now deletes `cost_percent` and expects mv 9, the same as the on-foot case 1. The value is independent of the code. `?? 0` gives mv 10 (verified by reading).
- Finding 2 resolved for horse before members: case 2b pins `[body, horse, cob]`, and cob sorts before the horse. Mutant `[escort, ...members, horse]` (`escort/shared.ts:163`) is red. Escort before horse stays unpinned, because that case needs quest and escort declarations. Accepted.
- Finding 3: the round 1 `/code-review` result is reported.
- Flee with a ridden hostile opponent, run once in a scratch test and deleted: the combat fixture after `attack`, with the rat given a `mount` and riding true. Flee is accepted, and the proposal composes, so the invariant deltas hold. The ops are `entity.transfer` (body), `entity.transfer` (rat), `encounter.close` and `job.cancel`. The rat ends in the rider's new room with no open encounter. The next ordinary move is accepted, the rat comes along, and no new encounter opens. No save or invariant break, so it is a known limit to document. The same holds for a ridden horse ordered to stay.
- Open: `mechanics.md` Mounts should name both limits (PM inclination).
