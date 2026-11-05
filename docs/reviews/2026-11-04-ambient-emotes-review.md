# Review: ambient emotes, PR #614 (loka-8ghm)

- PR [#614](https://github.com/lorecrafting/lokacore/pull/614) `toolbox/ambient-emotes` at `960e91bcbd1b25b9d8c50175e2835619883af46f`.
- Scope: contract slice ([review count](../WORKFLOW.md#review-count)): `ambient` on `protocol/entity.schema.json`, `protocol/room.schema.json`, `schemas/source/defs.schema.json`; kernel_api 1.156; a read-only hook in `kernel/ts/src/runtime/proposal.ts`. This record is also the proposal.ts second opinion ([WORKFLOW.md](../WORKFLOW.md), "Every agent").
- Governing: [Ambient emotes](../system/mechanics.md#ambient-emotes), [Ambient declarations](../system/cartridge.md#ambient-declarations), [owner ruling 2](../decisions/owner-decision-moods-ambient-emotes-2026-10-30.md), [composition](../system/architecture.md#building-mechanics-by-composition), [AGENTS.md Writing tests](../../AGENTS.md).
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): ci success (41995661377), book-e2e success (41995661599), graph-diff success (41995670220).
- `/code-review medium` is reported in the PR body.

## Must be true (written before the diff)

1. Due iff `floor(to/every) > floor(from/every)`, `n = floor(to/every)`; `h = SHA-256("<cartridge@version:kind/key>:<set>:<n>")`; fires iff `u32(h[4..8]) % 100 < chance`; line `u32(h[0..4]) % count`. No RNG draw, no command id.
2. At most one line per entity per advance, across a long Wait and an elapsed catch-up.
3. Read on the state after the advance: the reader's room, then only entities directly in it, visible, and living NPCs. Nothing from another room.
4. First set whose `when` holds, with the entity as target; no fallthrough.
5. Lines follow the command's own narration.
6. No new op, event, job, RNG draw, save row, GameView field or capability; registry and hash fixtures untouched.
7. Six compile refusals (UNDECLARED_CAPABILITY, SCHEMA_VIOLATION x3, UNKNOWN_FIELD, UNRESOLVED_REFERENCE x2), each with a red control.
8. Opt-in: older artifacts and saves load; kernel_api 1.156 everywhere a pin lives.
9. Sampler prose is `~`.

## Checks that held

- (1) `kernel/ts/src/mechanics/emote/ambient.ts:37-43`: `n <= floor(from/every)` returns; hash over the `roomIds`/`entityIds` keys (the authored ref); `u32(4) % 100 >= chance` silent; `lines[u32(0) % length]`. `now(p)` carries `rng: p.rng` and `ambient` never reads it. Test 1 replays under another command id against an in-test SHA.
- (2) `wait 60000` and the elapsed 50-boundary tests: one line per entity.
- (3) `proposal.ts:136-139` passes `now(p)` (the advanced world) with `p.world.state.clock` as `from`; `ambient.ts:57-58` filters by container, `living`, `visible`. Passage test is silent.
- (4) `findIndex(holds(..., {target}))`, then only that set; the begone/afraid test pins the target and the expiry.
- (5) `proposal.ts:106` `[...closing, ...told]`.
- (6) `git diff origin/main --stat` on `docs/spec/conformance`, `capability_registry.json`, step/command/cartridge/game_view schemas, toolbox_showcase, emote_sampler, fear_sampler: empty. Added kernel lines carry no op push, event, job or rng read.
- (7) `test/loka/content_ambient_test.exs`: 21 bound rows plus both/neither, emotes on room/item, unknown line/emote, no emote@1, unknown status. Room and item `when` reach `Resolve.expand`'s map fallback (`lib/loka/content/resolve.ex:281`); NPC sets go through `NpcFields` to `Emotes.expand`.
- (8) Seven `mobile/app/stories/live/*.sql` pins are 1.156; no save or delta field added; the sampler is the only cartridge with `ambient`.
- (9) `cartridges/ambient_emote_sampler/text.json`: every value `~`.
- Query steps: `holds` and `visible` take `p.steps`, charged into `query_steps` at adopt like the other read-only consumers (`proposal_adopt.ts:34`); reached only by a cartridge locking emote@1 on an advancing command, so no existing cartridge's budget moves.
- Composition record (`mechanics.md` Ambient emotes): capability code names no other mechanic's content; `living`/`visible`/`holds` are the shared helpers.

## Mutants

`MUTATE_MINUTES=30 bin/mutate_diff.sh origin/main` at the head: 36 mutants, 35 run, 5 red-narrow (Elixir), 30 SURVIVED, 1 NOT-UNIQUE, no TIMEBOX, exit 1. Every SURVIVED row is in `ambient.ts`, `proposal.ts:134-135` or `emotes.ex`, whose test `kernel/ts/test/ambient_emote.test.ts` imports `../src/index.ts` (two hops; the tool's documented one-hop limit), so the sweep ran only neighbouring tests. Matches the handback, which cleared them by hand (32 red).

Hand mutants against `test/ambient_emote.test.ts` and `test/loka/content_ambient_test.exs` (files restored after each):

| mutant | result |
| --- | --- |
| `ambient.ts:38` `n! <=` -> `n! <` | red |
| `ambient.ts:42` roll from `u32(4)` -> `u32(0)` | red |
| `emotes.ex:53` drop the lines/emotes exclusive check | red |
| `ambient.ts:58` drop `\|\| !visible(...)` | green (finding 1) |
| `ambient.ts:58` drop `!living(w, id) \|\|` | green (nit 2) |

## Findings

1. Should-fix, `kernel/ts/test/ambient_emote.test.ts` (pins `ambient.ts:58`). The `visible` filter is spec text ("each visible item and living NPC") and nothing pins it: dropping the call stays green. Scenario: a refactor drops it and a goblin in an unlit cave emotes to a reader who cannot see it. Six-line case, no sampler change: spread `dark_description` onto the cave as `test/gift.test.ts:221` does, `wait` 1200, expect no `emote.performed`. Verified here in a scratch test: dark cave, wait 3600, narration was `['room.cave.drip']` only.
2. Nit, `ambient.ts:58` `!living` unpinned: the sampler has no hp and no kill path; the spec's Known limits note and the death helper's own tests cover it. Accept.
3. Nit, `lib/loka/content/emotes.ex:53-54`: a room or item set carrying `emotes` is refused twice (UNKNOWN_FIELD from the schema and SCHEMA_VIOLATION here). Author-side ([owner rule](../system/owner-rules.md)); accept.
4. Nit, `protocol/entity.schema.json` / `room.schema.json` / `schemas/source/defs.schema.json` `every.maximum` 9007199254740991 is dead text (2^53 is refused as a non-integer first), which is why its mutants survive. Accept or drop.
5. Nit, `ambient.ts:40-41` u32 read duplicated from `kernel/ts/src/mechanics/alternates.ts:9-18`: two sites, four lines; a shared helper is not worth it yet.

## Developer's open items

- (a) NPC dying mid-advance read in its final room: matches "read from state after the advance"; accept.
- (b) O(rooms+entities) scan per advance: gated on the emote lock and an advancing command, prologue scale; accept.
- (c) u32 duplication: nit 5.
- (d) spawned NPCs get no ambient: documented in Known limits; accept.
- (e) redundant SCHEMA_VIOLATION: nit 3.
- (f) untested `!living`/`!visible`: finding 1 (test-side, no sampler growth) and nit 2.
- (g) `every.maximum` mutants: nit 4.
- (h) emotes on room/item refused as UNKNOWN_FIELD; elapsed test edits `time_policy` through `reload`: the spec at this head names UNKNOWN_FIELD and the reload edit is a controlled input, not a fixture; accept.

## Verdict

APPROVE WITH NOTES. One small test-side should-fix (finding 1) for the fix round; nits at the developer's discretion. No contract, save or protocol defect found; kernel_api 1.156 pins agree.
