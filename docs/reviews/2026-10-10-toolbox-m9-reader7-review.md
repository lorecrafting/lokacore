# Review: M9 status reader 7, movement (loka-kgd.92)

- Branch `toolbox/m9-reader7`, head `74dc1e5cb19054aef59f9da13b84ab0d3afa04e7`, base `toolbox/batch-m9` `e56d1226`. No PR (batch model).
- Governing: [Movement on a status](../system/mechanics.md#movement-on-a-status-toolbox-row-sr7), [cartridge.md row SR7 floors](../system/cartridge.md#status-declarations), [G1 tags](../system/mechanics.md#property-tags-and-the-policy-leaf-set-toolbox-row-g1) (every Tag has a `Resistances` member: `mechanics.md:1941`, `:1993`), toolbox row SR7, Beads `loka-kgd.92`.
- Hosted `ci` and `book-e2e` green on the head (`gh run list --commit`, reviewer; runs 38123670276, 38123670348).
- Verdict: **CHANGES REQUIRED** (one blocker, one should-fix, one nit).

## Must be true

1. Fare = base (world cost or 1 mv, times flee multiplier) scaled by each active status's percent in a fixed order, floored per step; a 0 fare writes no op.
2. A move into a room tagged air/chasm/water is refused `invalid_state` unless the active statuses together pass every such tag; leaving is never barred, so a player in terrain (start, transport, expiry) is not stranded by the engine.
3. Step, flee candidate selection and the GameView exit list use the same admission (`movementPlan`), so the view invariant holds.
4. Both kernels floor a status `movement` and a terrain tag on a room, item or barrier at 1.62; cartridges without them unchanged (Chapter 1 bytes and hash).
5. Air/chasm/water join `Resistances`, as every Tag does.

## Proof

- Named files green locally: `status_movement`, `damage`, `validate`, `status_readers`, `climb`, `sim` (node --test, exit 0); `npm run typecheck` exit 0; `mix test test/loka/content_status_movement_test.exs` 1 passed.
- (2)(3): `movementPlan` `kernel/ts/src/mechanics/movement/sequence.ts:127`; flee filters on it (`combat/flee.ts:30`), the view reads it (`view/view.ts:257`); `crossable` reads only the destination's tags. Probe (not committed): hall tagged `water`, no status: north accepted and listed available; returning south refused `invalid_state`.
- (4): no `cartridges/` file in the diff; Elixir `status.ex` floor and `barriers.ex:118` mirror `cartridge_status.ts` and `cartridge_knowledge.ts:77`.
- Mutants on `status_movement.test.ts`: `every`→`some` in `crossable` red; `Math.floor`→`Math.ceil` in `fare` red; dropping the `crossable` line red; dropping `c.barriers` from `terrainFloor` **green**; Elixir twin, dropping `barrier` at `barriers.ex:118`, `mix test` **green** (finding 1).
- Claim reruns: "step, flee and the GameView share `movementPlan`" (cites above) holds; "a fare of 0 writes no mv op" holds (test asserts no `resource.adjust`); "a fare past the pool is refused by pay, never an overflow fault" (`movement/shared.ts:88-89`) does not hold (finding 2).
- (5): Elixir keeps no tag list (no `windproof` in `lib/`); it reads the schema, so `74dc1e5c` needs no Elixir side. `damage.test.ts` green locally and in CI.

## Findings

1. **blocker**, `kernel/ts/src/content/cartridge_knowledge.ts:77`, `lib/loka/content/barriers.ex:118`: the barrier terrain-tag floor (a new engine loader check, claimed by `8ae248c1` and `cartridge.md` SR7) has no red test in either kernel; dropping the barrier branch stays green in both (`kernel/ts/test/status_movement.test.ts:130`, `test/loka/content_status_movement_test.exs` cover room and item only). Failure: a later edit drops it in one kernel; a 1.61 cartridge with a `water`-tagged barrier compiles in Elixir and is refused by the TS loader, or the reverse. Engine rule, so a blocker (M7 precedent). Fix: one barrier case in each twin.
2. **should-fix**, `kernel/ts/src/mechanics/movement/shared.ts:90-92`: the scaling uses raw `*`, `/` and `Math.floor`, and the comment claims an oversized fare is always refused. Probe: base 2147483647 through seven 1000% statuses gives 21474836470000000 (not a safe integer); `pay` → `adjust` → `add` throws `integer_overflow` (KernelError) instead of `insufficient_resource`, and the GameView, which calls `movementPlan`, throws with it. Fix: checked `mul`/`divide` (`foundation/int.ts`, numeric profile), or saturate the running fare (any fare above the pool maximum refuses the same), and make the comment true.
3. **nit**: the handoff reports no `/code-review` result (commit `8ae248c1` is titled "Review:" but states no outcome).

## Open items (no finding; spec places them on content)

- Expiry over terrain and a terrain-tagged start or respawn room are content (`mechanics.md:2405`): the player can always leave, but may be unable to return or to cross a run of terrain rooms.

## Batch re-check at `9cfda552` (fix `92e88810`)

- Written 2026-10-12 03:47 UTC in the Pi harness by anthropic/claude-fable-5-1 (reviewer, Pi session 01a12e09).
- The fix was accepted without a scoped re-check (Beads `loka-kgd.92`); the [Fable batch review](2026-10-12-m9-batch-fable-review.md) re-ran the stated mutants on the batch head. Both dispositions hold: **APPROVE**.
1. **Resolved.** `kernel/ts/test/status_movement.test.ts:178` adds a `chasm`-tagged barrier case; `test/loka/content_status_movement_test.exs:20` its twin. Mutants (reverted): `[c.rooms, c.items, c.barriers]` → `[c.rooms, c.items]` at `cartridge_knowledge.ts:77` red (`loader: movement and terrain tags need API 1.62`); `~w(room item barrier)` → `~w(room item)` at `barriers.ex:118`, `mix test --force`, red (`assert {:error, [%{"code" => "KERNEL_API_RANGE_INVALID"}]}`).
2. **Resolved.** `movement/shared.ts:92` saturates each scaled step (`saturate`, `foundation/int.ts`) and the comment now says so; `status_movement.test.ts:118` pins seven 1000% statuses on a 2^31-1 fare, expecting `insufficient_resource`. Mutant (reverted): `saturate(…)` dropped, red on that test.
3. Nit (no `/code-review` result): carried to the batch PR body, which reports none (Pi lane); recorded in the batch review.
