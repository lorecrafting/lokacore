# Review: toolbox row 41, decay (loka-kgd.121)

- Branch `toolbox/m10-decay`, head `2d8352b6bf9806bf13cc4872c0e875149701718c`, diffed against `b6156e83` (`toolbox/batch-m10`). No PR (batch model). Installed `kernel_api` 1.76 to 1.77 (PM ruling 2026-10-13).
- Governing: [Decay](../system/mechanics.md#decay-toolbox-row-41) (added here), [reaction@1](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts) (subject table, writer groups), [Replenish](../system/mechanics.md#replenish-toolbox-row-19b), [status declarations](../system/cartridge.md#status-declarations), [contract lessons](../lessons/contracts.md) (schema sweep), Beads `loka-kgd.121` (brief; PM rulings: writer-group join in `proposal.ts` `jobs()`, `status/job.ts`, `containment/job.ts`; sampler statuses `per_tick -1`, `tick_every` half; E1 size 545, no item.move witness; consumed guard).
- Hosted CI at review time: `ci` and `book-e2e` success on the head (`gh run list --commit`).
- Verdict: **CHANGES REQUIRED** (one blocker: a surviving mutant in the writer-group join).
- Written 2026-10-13 18:58 UTC in Claude Code by claude-opus-5-5 (reviewer).

## Must be true

1. `item.move {op, room}`, both required, closed; each required entry and bound killed by a fixture or the protocol subset.
2. Only an item subject moves; a body, NPC or room subject, an item already directly in `room`, and an eaten item take nothing; one `entity.transfer` from its current holder, no event, no line.
3. The transfer composes with any earlier write of the item's container in the same proposal (no `conflicting_write` on loadable content the spec admits).
4. Floors 1.77 (KERNEL_API_RANGE_INVALID) and the room reference (UNRESOLVED_REFERENCE at the step's `room`) are twins in both kernels; the step needs no event owner.
5. Cartridges without the step keep bytes, ids, receipts and writer groups.
6. Acceptance values follow from the sampler literals (86400, 3600, 5000; cap 1).

## Proof

- Green at head: `node --test` decay, replenish, npc_status, showcase_fire, e1_barrier, validate (46/46); `mix test` content_decay, content_reactions_sampler, content_replenish, content_npc_status (5/5). `elixir bin/contracts.exs` regenerates `contracts.gen.ts` identically.
- Schema sweep on the item.move branch: drop `room` from `required` killed by `reaction_item_move_no_room` (validate.test.ts); drop `op` from `required`, drop `additionalProperties`, drop the `const` each refused by the generator's protocol subset ("outside the schema subset").
- Mutants (in place in the review worktree, each restored; TS against decay + replenish tests, Elixir `mix test --force` content_decay):
  - killed: `at === room` guard removed (test f); `replenishMovers` replaced by `[]` (one-wait test, conflicting_write); consumed guard removed (eaten-fish test); stale source (first-step container ignored; two-step test); TS floor 76 (loader test); Elixir floor 76 and the Elixir room `reference` removed (content_decay 0/1 each).
  - survived: findings 1 and 3.
- Acceptance by hand: spoil at C0+86400 (first restock grid point after is 5000·18 = 90000; 85000 finds the fish held); smoked fish immune, no row at 172800; rot 3600 swept unless held (`when` reads the player's body; taken back at 1800 the expiry is refused); all match `kernel/ts/test/decay.test.ts`.
- Composition record: `containment/react.ts` names no content; `statusGroup` naming the replenish job kind is the PM-ruled change. No import cycle (`containment/job.ts` imports only foundation, decision and `stock.ts`).

## Findings

1. **blocker** `kernel/ts/src/mechanics/containment/react.ts:24`: replacing `holders.get(subject) ?? group` with `group` keeps decay.test.ts and replenish.test.ts green. Scenario (probe, run): fish starts in the midden, spoiling (7200, tick 3600) applied at C0, restock every 5000; one wait C0 to C0+7200 restocks the fish at 5000, then its expiry moves it back. Head: accepted, fish in midden. Mutant: fault `conflicting_write`. Fix: add that case (restock before the expiry in one wait) to `decay.test.ts`.
2. **should-fix** `kernel/ts/src/mechanics/containment/react.ts:24` (spec `docs/system/mechanics.md:2614` lists `status_applied` as a subject): a move in the same command that wrote the item's container faults. Scenario (probe, run): sampler with `spoil.on = status_applied spoiling`; Take fish faults `conflicting_write` (containment of the fish): the item can never be taken, though the cartridge loads. Fix: join the group of the proposal's earlier containment write of the item, or record a known limit in the Decay section (and refuse it at load if chosen).
3. **should-fix** `kernel/ts/src/mechanics/status/job.ts:172`: deleting the `also` line survives 100 tests (status, status_composition, status_readers, status_room, status_movement, derived_status, exposure, npc_status, hireling, c5_bleed*, bleed_composition, encounter_bleed_jobs, encounter_composition, decay probes). A crossed replenish run writes no row an earlier run of the same job wrote except a mover's container, whose group is already in `found`, so no case seen needs it. Fix: name the case it protects and test it, or delete it (AGENTS.md Simplicity).
4. **nit** `kernel/ts/test/decay.test.ts:236`: the skip-list check asserts `uses()` output; a load of the sampler without `fact@1` would pin the behaviour (and its Elixir twin, which has no case).
5. **nit** `kernel/ts/src/mechanics/status/job.ts:146-152`: the `statusGroup` header still lists only statuses, rounds and bleeds; add replenish movers.

## Fix round 1 (head `1f50047340552c024244ff5035a293f957ab924f`)

Scoped to the one commit on `2d8352b6`: `decay.test.ts`, `status/job.ts` `statusGroup`, its only caller `proposal.ts` `jobs()`, and `mechanics.md`. Hosted CI on this head was still in progress at recheck (`gh run list --commit`); the PM watches it.

1. Fixed. New test `decay.test.ts:120` ("respoils the fish it moves", one wait to 90000). Under the react.ts:24 `group` mutant it fails (17/18 pass), and my restock-before-expiry case faults `conflicting_write`. At the head, decay + replenish + my cases pass 18/18, and that case leaves the fish in the midden.
2. Accepted (PM ruling). The Decay known limits now name root writes (`mechanics.md:2618`), with no code change. The scenario still faults as written (Take, then a `status_applied` move: `conflicting_write`), as the limit says.
3. Fixed. `also` is removed from `statusGroup` and from the `jobs()` call; `proposal.ts:292` is the only caller. This head's code equals the round-0 M2 mutant, which passed 100 status, bleed, encounter, hireling, npc_status and decay tests.
4. Fixed. `mechanics.md:686` matches the code: a replenish run joins the groups of the items it moves.
5. Fixed. The `statusGroup` header comment names replenish movers.
6. Dispute accepted. A load-based check would need `fact@1` dropped from a sampler whose position and death declarations require it, so the `uses()` assertion stays.

Verdict: **APPROVE WITH NOTES** (finding 2 stays open as a recorded known limit).
