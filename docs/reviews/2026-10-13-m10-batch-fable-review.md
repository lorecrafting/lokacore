# M10 batch review (PR #380, Fable)

- Written 2026-10-13 by the batch reviewer (Fable); authored none of the work.
- PR [#380](https://github.com/lorecrafting/lokacore/pull/380), branch `toolbox/batch-m10`, head `45e7e771107da85c673e4d31cbcd28c3645732ab`, base `origin/main` `93c5913ef855792fa39001c174b073a291d177f8`. Beads `loka-kgd` (slices `.107.2/.3/.7/.8`, `.112`–`.121`).
- Governing: [AGENTS.md](../../AGENTS.md) "Writing tests"; [WORKFLOW Review stance](../WORKFLOW.md#review-stance), [Git hygiene](../WORKFLOW.md#git-hygiene); [mechanics.md](../system/mechanics.md) Fast travel, Replenish, Group primitive, Random encounters, Hireling orders, Hireling wages, Sleep, Decay, reaction@1 step table, jobs writer-group paragraph; [cartridge.md](../system/cartridge.md) declarations for those rows; [architecture: composition](../system/architecture.md#building-mechanics-by-composition).
- Per-slice records (`2026-10-12-m10-*`, `2026-10-13-m10-*`) stand; this record covers only the batch as a whole.
- Hosted CI at the head: `ci`, `book-e2e`, `graph-diff` all success.
- Verdict: **APPROVE WITH NOTES** (two docs nits, one question; no code change required).

## Must be true at the batch head

1. G8 members (22a hirelings) co-move with the player on Move, Flee and transport (row 32 fast travel); `stay` holds them back; a member moved by transport is a writer-group-0 `entity.transfer` like the escort's.
2. Row 41 `item.move` moves the subject from any holder (room, body, NPC, container) to the authored room, skips the consumed holder and "already there", and its writer group joins an earlier status/replenish write of the same item in one advance; replenish's crossed run joins an earlier `item.move`/status write of an item it moves (jobs writer-group paragraph).
3. Wage, replenish, decay and status jobs that cross in one advance touch different rows or share one group; a job whose `prior` group is defined (population pairs, repeated crossed hours) keeps its earlier behaviour.
4. Encounter plans (row 9) birth nothing at genesis or resume, draw once per wander-boundary opportunity with the rng threaded, and carry no aggression, so a birth during Sleep engages nothing; Sleep provokes only through G11 `engage` in the same proposal.
5. kernel_api floors 1.70..1.77 agree between the TS loaders, the Elixir loaders and `INSTALLED.kernel_api`; generated contracts current.
6. The spec sections and the toolbox table edit (last commit) describe what is built: sampler names and anchors resolve.

## Checks

- Must-be-true list written before the diff (above); diff read per hunk from a scratch file; `elixir bin/contracts.exs --check` exit 0.
- Focused tests `group, hireling, replenish, decay, sleep, encounter, fast_travel` (`node --test`, nice): exit 0.
- Floors: TS `cartridge_combat.ts` 1.70/1.73/1.75, `cartridge_replenish.ts` 1.71, `cartridge_derived.ts` 1.72, `cartridge_population.ts` 1.74, `cartridge_skills.ts` 1.75, `cartridge_reactions.ts` `item.move` 77; Elixir `combat.ex`, `replenish.ex`, `derived.ex`, `population.ex`, `skills.ex`, `reactions.ex` match; `runtime/world.ts` INSTALLED `1.77`. 1.76 (sleep) is installed-only by design.
- Cross-slice reading: `escort/shared.ts:136` `travel` is called by `movement/sequence.ts:52`, `combat/flee.ts` (via `moveSequence`) and `transport/shared.ts:89`, so fast travel co-moves non-`stay` members (point 1, read only; see Q1). `containment/react.ts:24` `holders.get(subject) ?? group` and `runtime/proposal.ts:292` (`statusGroup` now runs even when `prior` is defined) give point 2; only replenish runs change behaviour under the `prior`-defined path since the other kinds yield no holder (point 3). `population/settle.ts` `encounter` draws only on a boundary with an eligible slot; plans have no aggression (point 4).
- Mutants (each in the detached worktree, reverted after; test files that import the mutated module):
  1. `runtime/proposal.ts:292` skip `statusGroup` when `prior` is defined and take `prior` as the group: `decay.test.ts` red (restock+spoil and respoil cases fault `conflicting_write`).
  2. `containment/react.ts:24` `holders.get(subject) ?? group` → `group`: `decay.test.ts` red (respoil case).
  3. `escort/shared.ts:145` drop the `stay` filter in `travel`: `hireling.test.ts` red (stay and guard cases).
  4. `escort/job.ts:46` purse `>= minimum` → `> minimum`: `hireling.test.ts` red (two-hireling prefix case).
- PR-body claims rerun: "two `item.move` steps in one rule faulting `precondition_failed`" is pinned by `decay.test.ts:170` (red when `moveItem` reads `world.state.containers[subject]` instead of the rule's own last transfer); "per-seed revisit counting" is pinned by `friction.test.ts:60` (red, `gate: 7`, when `play/friction.ts:40` does not reset `entered` per seed).
- `/code-review` result: reported for the wave-4 slices (rows 32, 41, Balance 8); earlier slices point at Beads notes. Not re-run here.
- Toolbox table (commit 45e7e77): rows 19b, G8, 22a, 22b, 9, W9, 32, 41 done cells name samplers present in the diff and anchors that resolve to the new mechanics.md headings; row 22 "split into 22a, 22b"; row 23 "merged into row 22" is still consistent.

## Findings

1. nit, `docs/system/cartridge.md:463` (tool 1 ledger, ponytail): "decay is not built" is stale at this head; the batch builds the `item.move` sink and the ledger does not list it. Scenario: an author reading the ledger's caveat assumes decay cannot sink items and over-counts a faucet. Fix: reword to "decay's `item.move` sink is not listed yet" or add the sink.
2. nit, `docs/MECHANICS-TOOLBOX.md:183` row 41 Mechanic cell: "moves it to the terminal consumed holder", while the done cell and `mechanics.md:2643` say the step moves to any authored room and explicitly skips the consumed holder. Scenario: a later brief citing the Mechanic cell asks for a consumed-holder move the step refuses. Fix: amend the cell to "moves it to an authored room (a sealed room is the sink)", or leave the quote and point at the departure.
3. question, `kernel/ts/src/mechanics/transport/shared.ts:89`: fast travel co-moving a group member and holding a `stay` member is backed by code reading only; no test in `fast_travel.test.ts`, `group.test.ts` or `hireling.test.ts` drives a member through a transport route. Not a blocker: the shared `travel` path is pinned via Move in `hireling.test.ts`. A one-case pin would close it.

Open owner question (W9 "sleep provokes") is out of scope; the code matches the spec as written (Sleep calls G11 `engage`).

Verdict: APPROVE WITH NOTES.
