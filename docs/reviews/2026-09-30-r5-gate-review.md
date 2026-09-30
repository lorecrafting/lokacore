# Gate R5 review: the R5 milestone and the gate docs PR

- PR #59 (`gate-r5-docs`), reviewed head `267c8e7d98b18cbbb4e0ebe32baf7751c791a702` on 2026-09-30.
  The PR itself only changes docs. The R5 code under review is `main` at `f1a041d` (#56 merged),
  which the PR head contains unchanged.
- Depth: full gate review (WORKFLOW "Milestone gate", "Review stance"). Reviewer: fresh Opus
  agent that authored none of R5 or this PR.
- Verdict: **CHANGES REQUIRED**. The R5 code passes: every check is green, mutants die, and
  the properties hold on constructed inputs. What blocks the gate is its record. One
  capability the proof needs and three other gaps are not recorded as deferred, the ROADMAP R5
  row has not been closed, and two older decisions lack their supersession pointer. Every fix
  is a docs edit in this PR (named below). No new code is required to pass the gate, provided
  the PM accepts the `target_resolution@1` deferral (S1).

## What must be true for Gate R5 to pass (written before reading the diff)

From 14 §R5, 04 §5.4-5.5, 00 §4, ADR-074 §3 and the gate records of 2026-09-27/28:

1. Every 14 §R5 capability (world state; definitions to runtime entities; containment; room +
   Connection/Barrier; typed relations/provenance; InspectableDetail + conditional
   descriptions; TargetSpec/Search + none/unique/ambiguous resolution; typed scoped facts;
   logical clock; RNG; policies; ActionSet algebra; minimal ActionRecipe; look; move;
   take/drop/give; simple resources/checks) is in `kernel/ts/src` + `protocol/`. Each is
   covered by a fixture or a test with literal expected values, or the ROADMAP records it as
   deferred with a landing row.
2. Every capability that `release-scope.json` places at phase R5 is either installed or
   recorded as deferred.
3. Properties hold and a test fails when they break. These are: one container per item, no
   location cycles, deterministic commands, unknown capabilities fail (loader and
   admission), stable ActionSet ordering, and a bounded command result (budget fault, no
   truncated commit).
4. Golden vectors (cartridge known answers, composition fixtures, transcripts) pass through
   the TypeScript kernel and every host path that runs rules today (`loka play`, the
   simulator). ADR-074 has not been triggered: no `portable_capability` row has an Elixir
   host adapter. The foundation stays in both kernels with its differential.
5. The budget fault keeps the closed `{"kind":"fault","code":"budget_exceeded"}`. The
   `evaluation.budget_exceeded` diagnostic either has a producer or is reported as deferred,
   with where it lands.
6. The baseline findings G1-G4 are really fixed. The ROADMAP carries match the code.
7. PR content: the decision record quotes the owner verbatim (five quotes), and WORKFLOW
   agrees with it. Older decisions it overrides point to it. The docs tidy pass is done on
   docs changed during R5.

## Evidence

- `mise exec -- bin/check_all.sh` at the PR head, in a throwaway detached worktree: exit 0.
  Elixir 207 passed; TypeScript 208 passed. The simulator ran 3 regression seeds and 10,000
  fresh sequences (10,002 sequences, 325,604 steps). Its outcome set: accepted, cooldown,
  exit_closed, exit_locked, fault evaluator_error, insufficient_resource, invalid_state,
  invalid_target, not_found, not_owned, not_present, permission_denied,
  unsupported_capability. Contracts, feature map, lint and red controls, size and Prettier
  all passed.
- Mutants (each reverted). Every one turned the suite red:

  | Mutant | Result |
  |---|---|
  | ActionSet sort by ascending priority (`actions.ts:248`) | 3 tests fail |
  | ActionSet tie-break by key reversed | 3 tests fail |
  | `acyclic()` breaks instead of returning false on a cycle (`invariants.ts:31`) | 2 tests fail |
  | Elixir `walk/4` returns the path instead of `:cycle` (`invariants.ex:145`) | 2 of 207 fail |
  | compose skips the containment-cycle check (`compose.ts:229`) | 2 tests fail |
  | `delta_preconditions_hold` drops the `opened_revision` check (baseline G1 scenario) | 1 test fails |
  | `Object.hasOwn(SHOWN, …)` guard replaced by `SHOWN[type] ?? []` (baseline G4) | the `constructor` test fails |
  | GameView marks every action available (`actions.ts:243`) | `sim.test.ts` fails, 10k run and adopt red control |

- G2 re-measured with a probe of the TypeScript `containment_acyclic`. Valid chains of
  5,000, 20,000 and 80,000 rows passed, plus the same chain closed into a cycle, which was
  rejected: 8, 26 and 119 ms. That is linear. It is not a device benchmark.
- ADR-074: every `portable_capability` row in `docs/residency.gen.json` has
  `host_adapters: null`, so the trigger has not fired.
- Host paths: the transcripts replay through `kernel/ts/play/main.ts --replay`
  (`transcripts.test.ts`), and the simulator decides through the same `play/run.ts`
  `decide`. `mobile/authority/local-story` re-exports only `KERNEL_ID` and runs no rules
  yet (R6). These two paths are every accepted path that runs rules today.

## Gate check against 14 §R5

| 14 §R5 item | Where | Covered by |
|---|---|---|
| world state; definitions to runtime entities | `world.ts` `newWorld`, `decision.ts` State/World | `world.test.ts` IdSource ids, `cartridge_*_hash.json` |
| containment/location | `rules/containment.ts`, compose transfer | `composition.json`, `containment.test.ts`, invariants `one_container_per_item`, `containment_acyclic` |
| room/place + Connection/Barrier | `rules/movement.ts`, `rules/barrier.ts`, `cartridge_barriers.ts` | `cartridge_rooms_hash.json`, `cartridge_gate_hash.json`, `barriers.test.ts`, transcripts |
| typed relations/provenance | containment relation only (`state.containers`). All entities are authored, so no `EntityOrigin` is stored | partly deferred, **not recorded** (S2) |
| InspectableDetail + conditional descriptions | `rules/description_variant.ts`, `target.ts` | `cartridge_details_hash.json`, `cartridge_facts_hash.json`, transcripts |
| TargetSpec/Search + none/unique/ambiguous | `target.ts` | `target.test.ts`; capability `target_resolution@1` **not installed** (S1) |
| typed scoped facts | `fact.ts` | `cartridge_facts_hash.json`, `facts.test.ts` |
| logical clock; RNG | `rules/schedule.ts` wait, `rng.ts` | `cartridge_dusk_hash.json`, numeric vectors (both kernels) |
| policies | `policy.ts` (all/any/not, fact_compare, has_item, time_window, barrier_state) | `checks.test.ts`, `facts.test.ts` |
| ActionSet algebra; minimal ActionRecipe | `actions.ts`, `rules/action_recipe.ts` | `recipes.test.ts`, `cartridge_bell_hash.json` |
| look; move; take/drop/give | movement, description_variant, containment rules | transcripts, `play*.test.ts` |
| simple resources/checks | `resource.ts`, recipe checks | `resources.test.ts`, `cartridge_road_hash.json` |

Properties: all six hold (see Evidence). Unknown capabilities fail at the loader
(`CAPABILITY_NOT_INSTALLED`, loader corpus) and at admission (`unsupported_capability`,
including prototype keys in the simulator). A bounded result is enforced in two places: the
ops and job budgets in `compose.ts:96` and `output_bytes` in `world.ts:249`, each faulting
`budget_exceeded` with the world unchanged.

## DEFERRED

Recorded in ROADMAP (Early R7/R8 row, `docs/ROADMAP.md:54`). The gate reports these as
deferred, not missing:

| Item | Source | Lands | Code today |
|---|---|---|---|
| keys that break on a failed force | 00 §4.1, §4.4 | early R7/R8 | none |
| locked containers (door commands gain an optional target) | 00 §4.4 | early R7/R8 | barriers only on exits |
| a policy leaf reading resources | 06 §21 | early R7/R8 | no such case in `policy.ts` |
| positions and their regeneration bonuses | 00 §4.2, §4.3; `position@1` | early R7/R8 | `position@1` not yet |
| one-way and bent door passages | 21 §5 | early R7/R8 | rejected by the loader (`BARRIER_MISMATCH`) |
| a keyless locked door | S7 review, round 1 | early R7/R8 | rejected by the loader even when harmless (see N2) |
| `knock`, map discovery/`where` | 00 §4.1 amendment 2026-09-28 | R10 (chapter one) | none |
| `evaluation.budget_exceeded` producer and registration | 04 §5.4-5.5 (#56) | not named yet: recorded only in the R5 row (S3) | fault only, without the limit name |

Not in ROADMAP. These are findings, and the gate needs a line for each:

| Item | Source | Code today |
|---|---|---|
| `target_resolution@1` installed + the `target_present` policy leaf | 14 §R5; `release-scope.json` (first needed by the proof, phase R5) | resolution built in `target.ts`; capability not installed; leaf not evaluated (S1) |
| `equipment@1` | `release-scope.json` (chapter one, phase R5); 00 §4.4 | not yet (S2) |
| `attributes@1` | `release-scope.json` (chapter one, phase R5) | not yet (S2) |
| spawned-entity provenance (`EntityOrigin`) | 14 §R5 "typed relations/provenance"; `relation.schema.json` | only the containment relation is built, and every entity is authored (S2) |

## Findings

### S1 — should-fix: `target_resolution@1` is not installed, although the proof needs it at R5

`kernel/ts/src/world.ts:61`, `kernel/ts/src/policy.ts:30`, `docs/ROADMAP.md:54`

Resolution itself (none/unique/ambiguous) is built and tested in `target.ts`. But
`target_resolution` is in neither `RULES` nor `RULELESS`, so it is missing from `INSTALLED`.
`policy.ts` also has no `target_present` case, and the feature map shows the capability as
`not yet`. `release-scope.json` marks `target_resolution@1` as first needed by the proof, at
phase R5.

Failure scenario: a proof cartridge locks `target_resolution@1` (00a §2 lists it; the
schema's own `talk` example uses `{"op":"target_present"}`). The TypeScript loader rejects
that cartridge with `CAPABILITY_NOT_INSTALLED` (`cartridge.ts:204`). The deferral lists do
not mention this.

A warning for whoever fixes it: adding `'target_resolution'` to `RULELESS` alone makes the
loader accept `target_present`. `holds()` would then throw a plain `Error` (`policy.ts:30`),
which `step()` rethrows (`world.ts:209`) as a crash, not a fault. The code fix needs the leaf
and the RULELESS entry together, and `features.json` `implemented_in` is only correct once
both exist.

Edit for this PR: add to the ROADMAP carry list, in the R6P row or the Early R7/R8 row as the
PM chooses, "install `target_resolution@1`: the `target_present` policy leaf (resolution
itself is built, R5 S2), before the compiled Lantern". Implementing it now instead is the
PM's call.

### S2 — should-fix: three R5 gaps are neither built nor recorded as deferred

`docs/ROADMAP.md:52-54`; `docs/spec/release-scope.json` (`equipment@1`, `attributes@1`, phase
R5); `protocol/relation.schema.json` `EntityOrigin`.

The R5 row says "world rules the Lantern needs". That explains why `equipment@1` and
`attributes@1` (chapter one, phase R5) are not built, but no row says where they land. A
planner reading `release-scope.json` would find them missing, not deferred.
`position@1` is carried; these two are not. Likewise, 14 §R5 "typed relations/provenance" is
built only as the containment relation. No `EntityOrigin` is stored, which is harmless while
every entity is authored.

Edit: add a line to the Early R7/R8 carry list: "`equipment@1` and `attributes@1`
(`release-scope.json` phase R5, first needed by chapter one), and spawned-entity provenance
(`EntityOrigin`, with the first spawner)". The PM picks the row if early R7/R8 is wrong for
equipment.

### S3 — should-fix: the ROADMAP R5 row is not closed, and it holds history and a duplicated fact

`docs/ROADMAP.md:52`

Three problems in the row:

- "Gate R5 also takes …" now narrates what #57 did, which is history that belongs to its
  review record.
- It still lists the `evaluation.budget_exceeded` diagnostic under the gate, although #56
  made it spec-only.
- The sentence "The 10,000-sequence Node cross-check runs in the normal fast CI run …;
  the Hermes replay sample comes at R6P" repeats AGENTS.md Checks (and the harness section).

The R3 row shows the closed form.

Edit: replace everything from "The 10,000-sequence" to the end of the cell with:

> Done; Gate R5 (linked to this record) passed; deferrals are in the early
> R7/R8, R6 and R6P rows.

Then add the budget diagnostic to the R6 row: "the first `evaluation.budget_exceeded`
producer and its registration (04 §5.4-5.5): the kernel reports which limit ran out, and
the local authority, `loka play` and the simulator emit it".

Budget call: I agree with the PM's leaning, and it needs one fact. `loka play` and the
simulator already carry genuine ReplayIds (`kernel/ts/play/run.ts:25`: run, command,
revision), so the 04 §5.4 obligation applies to them now. It is dormant only because no R5
content reaches a budget fault; the 10,000-sequence outcome set above has no
`budget_exceeded`. The deferral must name a row so it does not read as "no host needs it
yet". R6 is where the local authority, the first authoritative producer of `trace.command`,
is built.

### S4 — should-fix: two older decisions still state the review policy this PR replaces

- `docs/decisions/owner-decisions-review-flow-2026-09-30.md:6`
- `docs/decisions/owner-decision-review-lever-2026-09-25.md:1`
- `docs/decisions/owner-decisions-observability-astra-2026-09-25.md:39`

The review-lever record sets Fable for about six slices, with Astra and a second round only
for foundational freezes. Observability-astra §2 says "only use astra reviews for important
PRs". Both are reachable: the ROADMAP Observability row links observability-astra, and the
decisions index links both. A reader who lands on either applies a policy the owner replaced
on 2026-09-30. The opus-reviews record already has its pointer.

Edit:

- Line 6 of the new record: "Supersedes the all-reviews-on-Opus decision, the Fable and
  Astra parts of the review lever, and §2 of the observability/Astra decisions."
- Under the title of review-lever: "Superseded in part (Fable slots; Astra only for
  foundational freezes) by the 2026-09-30 review-flow decisions (linked)."
- Under observability-astra's `## 2.` heading: "Superseded by the 2026-09-30 review-flow decisions (linked)."

### N1 — nit: "the strongest available model, Sol or Astra" loses the owner's Sol/Astra split

`docs/WORKFLOW.md:21`; `docs/decisions/owner-decisions-review-flow-2026-09-30.md:23`, `:29`

The owner said "sol and astra reviewers as normal everyday crossvendor reviews ... you can
escalate to astra liberally" and "for complex reviews you can use codexes astra". "The
strongest available" is always one model, so "escalate" means nothing, and "escalates hard
reviews to it freely" (WORKFLOW:19) escalates to codex rather than to Astra.

Failure scenario: the PM runs every codex review on whichever model it judges strongest, or
never uses Astra.

Edit: WORKFLOW:21 becomes "`-m` Sol by default, Astra for hard reviews (escalate freely)".
Mirror the change in the record's Effect bullets.

### N2 — nit: the keyless-door carry reads as the opposite of what is carried

`docs/ROADMAP.md:54`

"rejecting a locked door that has no key" reads as a check still to be built. The loader
already rejects such a door (`cartridge_barriers.ts` `lockout`, `BARRIER_UNREACHABLE_KEY`),
including a harmless one whose far room is reachable another way. The S7 review (round 1)
carried *loosening* that rejection.

Edit: "loosening the loader's rejection of a keyless locked door whose far room is
reachable another way".

### Q1 — question: where does "never a substitute" come from?

`docs/decisions/owner-decisions-review-flow-2026-09-30.md:28`

None of the five quotes says codex may not replace our own review. "otherwise the highest opus
or highest sol is good enough" could be read the other way. The standing loop (WORKFLOW step
4, a fresh `reviewer` for every slice) supports the PM's reading. Either cite it there or mark
the sentence as the PM's reading, so the record contains nothing invented.

## Checked and fine

- Baseline G1-G4 are fixed: G1, G2 and G4 by mutant or probe above; G3 is converted into
  the #56 spec plus this deferral (S3). The #57 and #56 findings were not re-litigated.
- The decision record has the five owner quotes, verbatim-marked and unverifiable by a
  checker, as the other records are. WORKFLOW's Models paragraph, loop step 7 (no owner
  relay) and "Why these steps" agree with the record's Effect. `.claude/agents/reviewer.md`
  and `developer.md` say nothing contrary.
- The `#54` ledger lines match the existing line shape.
- Docs tidy pass (docs changed during R5, outside spec, reviews and decisions): AGENTS.md
  Checks, `docs/lessons/contracts.md`, `protocol/README.md`, `docs/design/room-view/README.md`
  and the agent files. I found no stale lesson and no other duplicated fact. The only
  catch-all is the ROADMAP R5 row (S3).
- Simplicity: the PR is net shorter (−26/+55, mostly the verbatim record). There is nothing
  to delete.

## Cross-vendor review (codex, gpt-6-astra, read-only; appended verbatim by the PM)

Run with `codex exec` on PR #59 head 267c8e7 with the whole-milestone Gate R5 brief; it ran in parallel and did not see the Opus record.

VERDICT: CHANGES REQUIRED

```text
R5-01 | blocker | kernel/ts/src/target.ts:46 at main f1a041d
Input: a loader-accepted artifact containing 1,025 items named “coin” in the entry room. resolve("coin") returns 1,025 candidates, violating TargetResolution’s 1,024 limit. Reproduced: validation returns too_many_items. In loka play, the resulting target.unresolved observation also exceeds its candidate limit and throws during record validation. Enforce bounded resolution; silently truncating would violate §5.3.

R5-02 | should-fix | kernel/ts/src/rules/containment.ts:64 at main f1a041d
State: thousands of valid items directly inside one room. The world-level containment_acyclic check traverses the entire container list for every entity, even after reaching a room. The simulator calls this every step, so #57’s linear foundation checker leaves quadratic validation on the active path. Measured median checks: 1,000 items ≈29 ms; 2,000 ≈214 ms; 4,000 ≈1,045 ms. Reuse linear traversal while preserving room and capacity checks.

R5-03 | should-fix | docs/ROADMAP.md:52 at SHA 267c8e7
Gate accounting: the known carries are mentioned, but none has the requested explicit DEFERRED status. The budget diagnostic producer is merely “still to be built” inside the R5 row; the mechanics appear as prose carries at line 54. Mark these explicitly DEFERRED so closing R5 does not leave their disposition ambiguous.

R5-04 | nit | docs/ROADMAP.md:51 at SHA 267c8e7
A reader checking the observability decision sees ADR-075 described as “proposed,” although its authoritative record says accepted on 2026-09-25. Remove the stale status restatement and retain the link.
```
