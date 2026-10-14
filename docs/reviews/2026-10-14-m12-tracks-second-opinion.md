# Review: W13 tracks and trails, invariant and portable contracts, second opinion

- Branch `toolbox/m12-tracks`, exact commit `03101ac0d1ca28222bf41e9d32bebfd718479241` (base `origin/toolbox/batch-m12` `6642e7c1`, merge-base `b80dbf71`); Beads `loka-kgd.136`; kernel_api 1.85. Second opinion because the slice widens the portable invariant `facts_typed` ([WORKFLOW Review count](../WORKFLOW.md)); scope: the invariant, both kernels' trail/reserved-fact checks, schemas and fixtures, save rows, Realm seams lines 1 and 5. Another reviewer covers the gameplay.
- Governing: [mechanics.md Tracks and trails](../system/mechanics.md#tracks-and-trails-toolbox-row-w13) ("Rooms as subjects": a room subject for these engine facts only), [Entity and pair facts (W2)](../system/mechanics.md#entity-and-pair-facts-toolbox-row-w2), [contracts lessons](../lessons/contracts.md) (schema mutant sweep), [mechanics lessons](../lessons/mechanics.md).
- **Verdict: APPROVE WITH NOTES.**

## Must be true (written before the diff)

1. `facts_typed` admits a room subject only for compiler-added trail facts of this cartridge; an authored per_subject fact naming a room still fails.
2. Trail fact names are reserved on both sides: an authored one or a content write is `RESERVED_FACT` in the compiler and the loader; the artifact's specs match byte for byte.
3. Elixir `trails.ex` and TS `cartridge_trails.ts` give the same diagnostics (codes) on the same inputs, including the 1.85 floor.
4. New `invalid.json` cases are real: each fails when its schema rule is removed.
5. Trail rows live in the existing `facts` section at `instance` scope, survive a real-SQLite cold reopen and receipt replay; no new section.
6. Chapter 1 bytes and hash unchanged; no `world.character` read in mechanics/.

## Evidence

- 1: `fact.ts:232-237` (trailFact keyed on the plan's `trail`/`hunts`), `fact.ts:250-254`. `tracks.test.ts:276` pins the real row, an authored room-subject fact (false) and an authored NPC-subject fact (true).
- 2: `trails.ex:68-73` (authored), `position.ex:108` (engine names, writes refused), `cartridge_position.ts:36-37,125` (byte compare plus writes). 3: same specs (trails.ex:14-33 = cartridge_trails.ts:10-28), same codes per case in `content_tracks_test.exs:41` and `tracks.test.ts` loader case; Key is ASCII (`^[a-z][a-z0-9_]*$`), so `length` and `byte_size` agree at 53.
- 5: reviewer scratch test (not committed) through `openStory` + `elapsedHost` on the compiled sampler: one move north writes `trail_at`/`trail_exit` rows, subject the clearing, scope `instance`; cold reopen reads `north`; the same invocation replays (lost-ack path). Receipt-history replay through `step` is gated on content (`exchange-save.ts:27`, `liquid-save.ts`; loka-b60) and was not exercised by this sampler.
- 6: `mix loka.compile cartridges/ashmere_missing_child` content_hash `5d8b0e3a…fc8b` = `missing_child_v042_hash.json`; no trail facts. No `world.character` in any added line under `kernel/ts/src/mechanics/` (trail.ts, settle.ts, combat/behavior.ts, movement/sequence.ts, action_recipe/rule.ts, fact.ts): the only `character` hits are comments. Frozen fixtures: only `invalid.json` appended.
- Claims rerun: "hold on any body in room (trail.ts:66)" holds; "no world.character" holds.

## Mutants (all red)

- TS: M1 room admitted for any fact (`fact.ts:254`) red at `tracks.test.ts:276`; M2 drop the `hunts` branch red at test 1; M3 floor `1.84` red at the loader case.
- Elixir: E1 floor `[1, 84]`, E2 authored trail fact not reserved: both red at `content_tracks_test.exs:41`.
- Schema (regenerated `contracts.gen.ts` each time): S1 drop `fresh_for.minimum`, S2 drop track check `plan` from required, S3 drop `fresh_for` from required: each red at `validate.test.ts:21` on its own case (`trails_bounds` `/trails/fresh_for`, `track_check_no_plan`, `trails_required` `/trails/fresh_for`).

## Findings

1. should-fix, `kernel/ts/src/mechanics/fact.ts:251-254`: a trail fact naming an NPC or item still passes. Probe: the real `trail_hounds_exit` row with subject swapped to a hound member: `holds('facts_typed')` = true. Spec says trail facts take "the room left as subject" and "Missing invariant: none (facts_typed covers the rows)". Failure: a regression that writes the mover id as subject keeps the invariant green; only the row assertions in `tracks.test.ts` catch it. The spec's "facts_typed covers the rows" claim is not backed by the run. Fix (one line, fix round): for a trail key, require a room subject; add the NPC-subject case to `tracks.test.ts:276`.
2. nit: no PR body yet, so no reported `/code-review medium` result (Beads notes say it ran). Report it on the batch PR.

## Fix round 1 recheck (head `144d0fa64d9b105e728815bd5c7586160691439f`)

Scope: `144d0fa6` (`fact.ts`, `tracks.test.ts`), the `lockStage` dispute and one self-review question. Verdict: **APPROVE**.

- Finding 1 resolved. `kernel/ts/src/mechanics/fact.ts:252-254`: a trail key now admits only a room; other keys admit only an entity or detail. `tracks.test.ts:303-304` swaps the subject to a hound member and expects false. `node --test test/tracks.test.ts` is green at head. Mutants, each red on that test only: M1 (room admitted for any fact) and M4 (trail key also admits an entity, the pre-fix behaviour).
- Finding 2 (no `/code-review` report) stays open for the batch PR body.
- `lockStage` dispute (`kernel/ts/src/content/cartridge.ts:221`): the developer is right, keep the reformat. With the old loop restored, `bin/check_ts_size.mjs` exits 1 (`cartridge.ts` 302/300 lines, `lockStage` 41/40). At head it exits 0. Close the main review's nit.
- `fresh()` lower bound (`trail.ts:46`): no path found, so no lower bound is needed. A character trail is written only by a player move, at `world.state.clock` before that root's `time.advance` (`movement/sequence.ts:54`). Jobs run only inside an advance, due in `(clock, to]` and sorted by due time (`runtime/proposal.ts:309-310`). So a hunt's `job.due_time` (`settle.ts:186`) is never earlier than a character trail's `at`. Plan trails come from jobs in the same due-time order. Even if a negative age did occur, the hunter would only follow a just-laid trail. Neither seam would see it, because the runtime is TypeScript only.
