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

## Cross-vendor review (Sol 5.6)

Relayed by the owner, at `da87c36`, verbatim:

```text
VERDICT: REQUEST CHANGES

ID: A1
SEVERITY: blocker
LOCATION: kernel/ts/test/sim.ts:203-239 at da87c36
FINDING: The simulator never verifies that an accepted step's committed `after.state` is the state implied by the accepted DecisionResult. `violated()` independently recomposes `decision.delta` at lines 211-218 and checks invariants against that synthetic compose result, but it never compares `result.changes` or `decision.rng` with the state actually returned by `kernel.step`. The only direct before/after state comparison is `rejection_consumes_nothing`, which deliberately exempts accepted decisions. This allows the harness to bless a deterministic but incorrectly adopted state.
FAILURE SCENARIO: Start at `clock = 0` and issue `wait until 10`. Suppose a regression makes `step()` return the correct accepted DecisionResult containing `time.advance {from:0,to:10}` but commits `after.state.clock = 9`. `violated()` recomposes the delta itself and gets the correct synthetic change to 10; the composition checks pass, the world invariants do not constrain the clock, `rejection_consumes_nothing` returns true because the decision is accepted, and the digest simply incorporates the wrong state hash for clock 9. The 10,000-sequence harness can therefore pass while the actual kernel state disagrees with its own accepted proposal.

ID: A2
SEVERITY: blocker
LOCATION: kernel/ts/src/invariants.ts:100-112; kernel/ts/test/sim.ts:40-50; protocol/invariants.json:30-36 at da87c36
FINDING: `delta_preconditions_hold` is registered and advertised as checked, but the implementation explicitly checks only the read→write value chain and explicitly does not check capacity, resource bounds, time bounds, revision, or cycle preconditions. Moreover, line 103 makes every recomposed fault automatically satisfy this invariant. That is materially narrower than the registered statement, "Every delta op's precondition holds ... or the decision faults," and narrower than the PR's "every registered invariant" claim. The placement/existence test cannot detect this semantic gap.
FAILURE SCENARIO: Give the checker state with a resource currently at 100 and a spec `{minimum:0, maximum:100}`, plus delta `resource.adjust {from:100,to:101}` and an observed result claiming the change to 101 succeeded. `initial()` returns 100, `link()` returns `[100,101]`, so lines 102-111 return true even though resource@1 requires every adjustment to remain within its declared bounds. In the simulator variant where the real `step()` incorrectly accepts/commits 101, its independent `compose()` produces a fault and line 103 also returns true; without A1's missing decision-vs-commit comparison, the supposedly checked invariant does not expose the violation.

ID: A3
SEVERITY: blocker
LOCATION: kernel/ts/test/sim.ts:28-29,296-297; kernel/ts/test/sim.test.ts:44-76 at da87c36
FINDING: The committed regression seeds are not bound to committed expected sequences or digests, and the coverage gate checks only the set of final outcome/error categories. The length distribution is diagnostic-only, and there is no assertion for cartridge coverage, command-type coverage, prototype-key coverage, action coverage, or delta-op coverage. Consequently the generator can narrow while every existing gate remains green—including the cross-process determinism test, because that test recomputes its baseline from the current generator in the same run.
FAILURE SCENARIO: Accidentally change `UNKNOWN` from `['dance','constructor','__proto__','toString','hasOwnProperty']` to `['dance']` without changing `GENERATOR = 1`. The number of generator draws is unchanged and `unsupported_capability` is still produced by `dance`, so the aggregate `REACHED` assertion can remain identical. The determinism test computes the new seed-1/seed-3 digests and then merely verifies that another process computes those same new digests. Now revert the `world.ts` own-property fix to the pre-PR prototype-unsafe lookup: no generated command type is a prototype key anymore, so the two "regression" seeds no longer protect the exact bug they claim to retain, yet none of these coverage assertions is required to fail.

ID: A4
SEVERITY: blocker
LOCATION: kernel/ts/test/sim.ts:363-409; kernel/ts/play/run.ts:21-35; kernel/ts/play/main.ts:269-296 at da87c36
FINDING: The emitted `loka play --replay` transcript is not a reproducer for the simulator failure. It re-runs ordinary `step()` and compares the regenerated game-trace records, but those records do not contain the post-step state hash or the simulator's invariant observation, and replay never calls `gameView()`/the invariant checker. A failure can therefore disappear while the transcript still reports byte-identical replay. In addition, line 370 emits no transcript at all for a drained start.
FAILURE SCENARIO: Use the PR's own planted regression: a rejected command returns the same rejection as the real kernel but incorrectly increments the clock by one. The simulator correctly reports `rejection_consumes_nothing`. Its fresh-start transcript records the command and the same rejected DecisionResult; after fixing the clock mutation, `loka play --replay` regenerates the same trace entry and can print `replay: ... commands identical`, because the changed post-state hash is only printed to stdout and is not part of the compared trace file. The transcript therefore does not reproduce/prove the original invariant failure. If the identical failure occurs from one of the simulator's drained starts, `report()` takes the `o.drained ? ''` branch and provides no replay transcript at all.

ID: A5
SEVERITY: blocker
LOCATION: kernel/ts/src/world.ts:274-280; kernel/ts/src/invariants.ts:148-154 at da87c36
FINDING: The prototype-key hardening is incomplete. `step()` now correctly protects `CAPABILITY_OWNERS.command`, but two other tag lookups still use ordinary-object prototype lookup semantics. `admit()` reads `CAPABILITY_OWNERS.event[e.payload.type]` without `Object.hasOwn`, and the GameView invariant reads `SHOWN[command.payload.type]` without an own-key guard. The latter is directly reachable from content/user-supplied strings because `constructor` is a valid `Key`.
FAILURE SCENARIO: Author a valid ActionDefinition whose action key is `constructor`, whose underlying registered command is `look`, and whose policy is available. Then feed the simulator an unknown semantic command with `payload.type = "constructor"` (already one of `UNKNOWN`). `step()` correctly rejects it after this PR, but `advertised()` can find the content action named `constructor`; line 151 evaluates inherited `SHOWN["constructor"]` to the Object constructor function, and line 153 attempts `shown.includes(...)`, throwing instead of returning an invariant result. Separately, if a malformed/buggy rule emits an accepted event with `payload.type = "constructor"`, `admit()` obtains the inherited Object constructor from `CAPABILITY_OWNERS.event` and attempts `.split('@')`, throwing a TypeError instead of the required fail-closed `unowned_event` fault. The same prototype-key class fixed for commands therefore remains at two semantic/tag boundaries.
```

## PM rulings, fix round 1

Sources: Opus review record docs/reviews/2026-09-26-r5-sim-review.md (B1, S1, N1, N2) and the
cross-vendor review (Sol 5.6; A1-A5, text in r5-sim-crossvendor.txt beside this file).

1. B1 (blocker) — add two planted GameViews to sim.test.ts: (a) every recipe shown available,
   (b) an unavailable entry given the wrong reason code. Assert both are caught as
   gameview_agrees_with_admission on a `perform` (reviewer saw seed 6).
2. S1 (should-fix) — planted step that appends `{type:'bogus'}` to an accepted decision's
   events; assert unknown_types_fail_closed catches it (reviewer saw seed 1).
3. A5 (blocker, accepted) — own-key guards: `admit()` in world.ts (CAPABILITY_OWNERS.event
   lookup) and `SHOWN[...]` in invariants.ts. One regression test: an accepted decision with an
   event type `constructor` is faulted `unowned_event` by admit, not a throw. (actions.ts:95
   uses fixed VERBS keys: leave it.)
4. A1 (accepted, should-fix) — for an accepted step the simulator must check the adopted state
   against the proposal: accepted + independent compose fault is a failure, and every row
   compose changes must hold its composed value in after.state (plus the decision's rng, if the
   decision carries one), with nothing else changed except what adopt legitimately adds (derive
   that from world.ts adopt, do not guess). Report it as a simulator failure id (like `threw`),
   not a new registered invariant. Red control: accepted `wait` whose adopted clock is off by one.
   Reuse world.ts/compose.ts helpers; do not reimplement adopt.
5. A2 (partly accepted) — no new code beyond A1 (which closes the "accepted but compose faults"
   hole). Full delta_preconditions_hold stays deferred to Gate R5 as the brief allowed; the PR
   description must say plainly that the step check covers only the read->write value chain.
6. A3 (accepted, narrowed; NOT digest pinning, that is a change detector) — each entry in
   sim_seeds.json records the trigger command type it found (`__proto__`, `toString`); the test
   asserts the seed's sequence still issues it. The 10k run also asserts every cartridge is
   picked and every UNKNOWN type is issued at least once.
7. A4 + N2 (partly accepted) — no replay-format change. The failure report names the real
   reproducer first (`node kernel/ts/test/sim.ts <seed>`) and labels the transcript as a
   playback of the shrunk commands that does not re-check invariants and stops at the first
   stray command; a drained start says to use the sim command.
8. N1 (nit) — REACHED: require every listed code, allow extras.

Re-run the full check line (bin/check_all.sh), mutation-check each new test (break, watch fail,
restore), /ponytail-review and /code-review medium on the diff, push, reply per finding with
fix commit or reason.

## Fix check, round 1 (`babd068`)

Scope (WORKFLOW step 6): each disposition as the PM ruled it, the code the fix touched and its
direct callers. CI green on `babd068` (bundle, elixir, lint, typescript 2m12s); locally the sim,
world, facts, recipes and containment suites pass (56 tests).

**Verdict: APPROVE WITH NOTES** (one nit, N3; nothing open).

| Item | Ruling | Result |
|---|---|---|
| B1 | two planted recipe views | Met: "every action available" and "unavailable with the other shown code" each caught as `gameview_agrees_with_admission` on a `perform` (`sim.test.ts` new red control). |
| S1 | planted unregistered event | Met: caught as `unknown_types_fail_closed` in one command. |
| N1 | REACHED a floor | Met: missing codes fail, extras allowed. |
| N2, A4 | report wording, no format change | Met: the report leads with `reproduce (re-checks every invariant): node kernel/ts/test/sim.ts <seed>` (asserted in the containment red control), labels the transcript a playback that checks no invariant and ends at the first stray command, and a drained start says to use the reproduce command. |
| A1 | `adopt_mismatch` | Met. `sim.ts` `adopted` composes the delta independently (`compose`, `base`, `row` reused, adopt not called), fails on a compose fault, and requires `after.state` to equal the state before plus the composed rows, the clock and the decision's rng, nothing else. That is exactly what `adopt` writes (`world.ts` 237-252): its other outputs (fact_changed events, budget and typed-fact faults) are not State or not accepted. Three red controls: clock off by one, rng not advanced, stale `time.advance` that composes to a fault. |
| A2 | wording only | Met: the PR description states the value-chain-only scope and the Gate R5 deferral plainly. |
| A3 | trigger types, coverage | Met: `sim_seeds.json` records each seed's trigger type and a test asserts the seed still issues it; the 10k run asserts every cartridge and every unregistered type turns up. The test keeps its own `UNKNOWN` copy, which is what makes Sol's narrowing scenario fail. |
| A5 | own-key guards | Met: `ownerOf` (own keys) serves `step` and `admit`; `world.test.ts` asserts an event typed `constructor` faults `unowned_event`. `SHOWN` guarded in `invariants.ts:152`. |

**Core changes.** `adopt` now takes its section and row from `row(target)`; for every target
kind the result is identical to the old `SECTIONS[kind]` plus `entity_id`/`key` pair, and a
kind without a section (the clock) still skips. Callers of `adopt` (`decideWith`, and the
facts, recipes and containment tests) pass unchanged. `admit`: `ownerOf` returns `undefined`
for an unknown type exactly where the old optional chain did, so only the prototype-key case
changes (TypeError before, `unowned_event` now). `step` is unchanged apart from the helper.

**Mutations (each restored):**

| Mutant | Result |
|---|---|
| `adopted` returns true | adopt_mismatch red control fails |
| want's rng taken from `after` | fails |
| clock not compared | fails |
| `ownerOf` without `Object.hasOwn` | world.test (`foreign event`) fails |
| generator `UNKNOWN` narrowed to `dance` | coverage and seed-trigger tests fail |
| `SHOWN` own-key guard removed | **all tests pass** (N3) |

**N3 (nit): the `SHOWN` guard has no test.** `kernel/ts/src/invariants.ts:152`. No demo
cartridge has an action keyed by a prototype name, so no simulated step reaches it. Failure
scenario: the guard is dropped and a later cartridge keys an action `constructor`; the check
then throws, and the simulator reports a false `threw` on a correct kernel. That is a loud
false alarm, not a missed bug, hence a nit. Fix if wanted: a direct `check('gameview_agrees_with_admission', …)`
call with a hand-made view action keyed `constructor`.
