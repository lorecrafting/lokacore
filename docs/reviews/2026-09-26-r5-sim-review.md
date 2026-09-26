# Review: R5 +1, deterministic simulation

PR #53 (`r5-sim`), commit reviewed `da87c36`. Reviewer: Opus 5.5 (Fable suspended), full
depth: the slice adds the harness every later change must pass. A cross-vendor review comes
separately from the owner and is appended below when relayed.

**Verdict: CHANGES REQUIRED** (one blocker, one should-fix, two nits).

## What must be true (written before reading the diff)

From r1-acceptance-envelope §3 (and its ADR-074 paragraph), §10, docs/ROADMAP.md
(verification harness), 04 §5.0, §15, §19, 14 §R5 properties, and the brief:

1. A seeded generator builds sequences of 1 to 64 steps over every v2 demo cartridge,
   mixing offered, stray (rejected), boundary and repeated commands; its seed stream is not
   a world's RNG.
2. `step` never throws; a throw is a reported failure, not a runner crash. Each step records
   canonical bytes of the outcome (delta, events, RNG) and the state.
3. Every registered invariant with a TypeScript check runs on every step, or is listed with a
   reason. `rejection_consumes_nothing`: a rejection leaves State byte-identical.
   `unknown_types_fail_closed`: an unregistered command type or op/event/effect is never
   accepted. The new GameView invariant is registered with a 04 citation and holds both ways
   (available is not refused for a reason the view shows; unavailable is refused), for exits
   and for recipes (the S6b A2 bug class). `implemented_in` is honest.
4. Same seed, same bytes, in one process and across two.
5. A failure prints seed, generator version and a greedily shrunk sequence, replayable.
6. A committed regression seed file runs first, then at least 10,000 fresh sequences in the
   fast CI job, logging generator version, seeds, count and length distribution, within 30
   minutes.
7. Real simulator proposals feed the Elixir/TypeScript compose differential, bounded.
8. Known-answer fixtures untouched (they stay authoritative); every new check fails on its
   planted violation.

## Checks against the list

1. Met. `gen` seeds xoshiro128** from SHA-256 of the seed, separate from the world RNG. The
   mix reaches 13 outcome codes; over 10,000 seeds the rarest (`not_present`) occurs in 251
   sequences, so the `REACHED` assertion is not flaky. The 441 `evaluator_error` faults are all
   dusk `pick_lock` after `wait` to 2^53, the S6a-accepted behaviour.
2. Met. `checked` wraps view and step in try; bytes are the canonical DecisionResult plus the
   state hash.
3. Mostly met. The three checks are correct: I planted "every action available", "unavailable
   with the wrong reason" and "an accepted decision with an unregistered event type"; each is
   caught (seed 6 `perform`, seed 6 `perform`, seed 1). But two of those halves have no red
   control in the suite (B1, S1). `implemented_in` values match `registries_test.exs`.
4. Met; the test compares regression-seed digests twice in-process and via a second `node`.
5. Met. A transcript I generated for seed 2 replayed with `loka play --replay` ("30 commands
   identical"). Limitation in N2.
6. Met. Local run: 10,002 sequences, 324,133 steps, 45 s; CI typescript job 2m2s on this head.
   The diagnostic line records everything the envelope asks.
7. Met. `compose_test.exs` composes 300 live simulator proposals in both kernels (passes).
8. No fixture touched. Red-control coverage: see mutation results.

## Mutation results

Each run in a throwaway copy, restored after:

| Mutant | Result |
|---|---|
| world.ts prototype-key fix reverted | regression seeds 3 and 1 fail with `threw` |
| `SHOWN.move` emptied | red control fails (caught) |
| `SHOWN.perform` emptied | **all tests pass** |
| `advertised` looks up a perform by `p.type` instead of `p.action` | **all tests pass** |
| unavailable-entry clause reduced to "not accepted" (reason-code equality dropped) | **all tests pass** |
| `unknown_types_fail_closed` without `validate('DecisionResult', ...)` | **all tests pass** |
| shrinker stops after one pass | passes (greedy reverse deletion converges in one pass on these cases; not a realistic break) |

## Findings

**B1 (blocker): the recipe half of `gameview_agrees_with_admission` can be deleted with the
suite green.** `kernel/ts/src/invariants.ts:161` (`SHOWN.perform`) and `:170` (the perform
lookup), tested only by `kernel/ts/test/sim.test.ts:139`. The red control's `shut` view marks
all place actions unavailable, and a `look` trips it first; `open` covers exits only. Failure
scenario: a later change breaks the perform lookup (or drops the perform codes); the GameView
then advertises a recipe available while admission refuses it for `cooldown`, cost or policy,
exactly S6b's Astra A2, and the simulator stays silent across all 10,000 sequences. Same for
`:154`, the reason-code clause: a view showing `cooldown` where admission refuses
`invalid_state` passes once that clause is removed. Fix: two more planted views in the
existing test, (a) recipes always available (caught at seed 6 on a `perform`), (b) an
unavailable entry's reason swapped for another shown code (caught at seed 6), each asserting
the failing command is a `perform`.

**S1 (should-fix): the op/event/effect half of `unknown_types_fail_closed` has no red
control.** `kernel/ts/src/invariants.ts:144`; `kernel/ts/test/sim.test.ts:123` plants only an
unknown command type. Failure scenario: a rule emits an unregistered event type (or a
refactor drops the `validate` call); nothing fails, although the brief's "unregistered
command type or op is refused" and the registry statement cover it. Fix: a planted step that
appends `{type: 'bogus'}` to an accepted decision's events (caught at seed 1).

**N1 (nit): `REACHED` is an exact list.** `kernel/ts/test/sim.test.ts:62`. A new cartridge
or rule that makes a further code reachable (say `quest_requirement`) fails the simulator test
although nothing is wrong. Fix: assert every `REACHED` code is present (a floor), not set
equality.

**N2 (nit): the transcript stops at the first stray command.** `kernel/ts/test/sim.ts:400-404`.
The observation schema rejects unregistered command types, so for the prototype-key bug class
(regression seed 3) the printed `--replay` line replays zero commands. The printed JSON
commands and `node kernel/ts/test/sim.ts <seed>` still reproduce it. Fix: one clause in the
report saying so, or none; no code needed.

## Over-engineering

Nothing to cut. The `Kernel` injection exists for the red controls; `CHECKED` is the
invariant list the owner reads; the shrinker is the minimal greedy loop with its `ponytail:`
note.

## Composes-with

No mechanic added; `world.ts` changes only the capability lookup to own keys.
