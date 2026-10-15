# Review: Built rooms batch head (loka-kgd.109; S1-S4)

- Branch `toolbox/batch-built`, exact head `6f29c0ede4ae2718f79b1f5ac3b3ec18593acc3b` (main merged), base `eb2e6740`. No PR (batch model); CI on this head: `ci` and `book-e2e` green.
- Scope: cross-slice only. Slice records (S1 `loka-kgd.109.1`, S2 `loka-1q3n`, S3 `loka-kgd.109.2`, S4 `loka-kgd.109.3`, with save second opinions) are not reopened. Known, not reported: loka-trex, loka-z4cp, loka-otn4, the unreachable deadline-save owner check.
- Governing: [mechanics.md Built rooms](../system/mechanics.md), [save.md Built rooms](../system/save.md#built-rooms), [cartridge.md blueprints and sites](../system/cartridge.md), [architecture.md compose](../system/architecture.md#building-mechanics-by-composition).
- Verdict: **APPROVE**.
- Written 2026-10-15 by Claude Fable 5.1 (batch-head review).

## Must be true (written before reading the diff)

1. Hut life: order moves escrow to custody, sets the fact, schedules an `order` job with `actor_id`; completion at due time mints the room (`origin built {site, direction, owner}`) and applies weathering in one proposal; weathering expiry reacts ruin onto the room; mend cures ruin and re-weathers; a second order is refused by site/caps; cold reopen at every stage rebuilds the same room, exits and view; replay mints the same ids; timber is conserved.
2. Compose: `status.transition` on a holder created earlier in the same delta is admitted with the created kind (built -> room, spawned hound/deer -> npc, else item); later-created or unknown faults; both kernels identical; no other `entity.create` consumer gains an unintended admission.
3. Built room statuses and variants reach every room reader through the hydrate overlay; `status_active subject: room` reads the actor's room; the map places the hut one step from the site.
4. Every S1-S4 field is behind kernel_api 1.99 in both kernels.
5. Owner comes from `p.actor_id` or the job's `actor_id`, never `world.character`; one structure per site direction; caps counted over all built rows.

## Evidence

| Check | Result |
|---|---|
| 1. Full life in one run (scratch test, not committed): buy, order, reopen, complete (weathering on hut), second order `site_taken`, ruin at +600 s (ruin variant in the hut), mend (3 timber in custody, weathering back), second order `site_taken` and mend `nothing_to_mend`, ruin again; `hydrate` from the saved state at each of five stages equals the live world (state, rooms, roomIds, GameView); two runs with the same command ids give identical state | passes on the head |
| 2. `compose_status.ts:34-35` and `compose_status.ex:16-22` read the `entity` overlay key, written only by `entity.create` (`compose_target.ts:33`, `compose_target.ex:17`); `createdKind` and `Creation.kind/1` agree with hydrate's `derive`; TS `createEntity` validates the identity before the overlay write (`compose.ts:199`), Elixir `apply_op` likewise (`compose.ex:143`), so an origin-less create never reaches `createdKind` | identical |
| 3. `policy.ts` statusActive room = body's container of the policy actor; `knowledge.ts` positions add site + STEP[direction]; ruin reaction subject = `body_id` (`reaction.ts:214`), holders fall to the subject (`reaction.ts:267-275`) | consistent with spec |
| 4. `loader_floors.json` 1.99 cases run in both kernels (`loader_floors.test.ts`, `loader_floors_test.exs`); escrow, max_per_owner, weathering, ruin cascade through blueprint/site resolution | behind the floor |
| 5. `build.ts` `built()` reads `row.actor_id`, refunds to `bodyOf(owner)`; `unbuildable` counts `created` rows by `origin.owner`; the only `world.character` in touched mechanics is pre-existing `schedule/behavior.ts:52`, unchanged by the batch | holds |

## Mutants (scratch worktree, reverted)

| Mutant | Run | Result |
|---|---|---|
| A `compose_status.ts:35` drop the overlay fallback | `status_composition.test.ts`, `built.test.ts` | 11 red (fixture holder-created-earlier case and every built room test) |
| B `service/build.ts:56` completion skips weathering | `built.test.ts` | 3 red (job owner, ruin, mend) |
| C `compose_status.ex` `holder_kind/3` without overlay | `compose_test.exs`, `status_test.exs` | 2 red (fixture case and the TS differential) |

## Findings

None blocking.

1. nit, batch model: no PR body on the head, so no developer `/code-review` result or `file:line` claims exist at batch level to rerun; the slice records carry them. Nothing to do.
2. question, `cartridges/build_sampler/blueprints/hut.json` locks.enter and `kernel/ts/src/mechanics/policy.ts` statusActive: a blueprint enter lock using `status_active subject: room` would read the room the actor stands in (the site), not the hut being entered. Content choice today (the sampler lock uses `fact_compare`); worth a line in mechanics.md if a later blueprint wants "cannot enter a ruin".
