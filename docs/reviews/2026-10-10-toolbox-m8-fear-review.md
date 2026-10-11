# Review: toolbox row W21, fear and morale for NPCs (loka-kgd.74)

- Branch `toolbox/m8-fear`, head `346831dbc80a79818a3c88a60f4edc5c12df3cbc`, base merge-base with `origin/toolbox/batch-m8` `b7a602a4` (36 files; contract: `status.fear`, `status.apply.co_present`, `kernel_api` 1.50). No PR (batch model); the `/code-review medium` dispositions are in the Beads comments.
- Governing: [W21](../system/mechanics.md#fear-and-morale-for-npcs-toolbox-row-w21), [G3 holders](../system/mechanics.md#statuses-on-npcs-and-things-toolbox-row-g3), [C4 flight](../system/mechanics.md#c4-hound-response-pack-assistance-and-flight-selected-contract), the writer-group rule (`mechanics.md:662-679`, loka-x2gv), [status declarations](../system/cartridge.md#status-declarations), toolbox row W21, Beads `loka-kgd.74` (PM decision: `co_present: true`; surrender deferred to `loka-kgd.80`).
- Hosted ci and book-e2e green on the head (`gh run list --commit`, reviewer).
- Verdict: **APPROVE WITH NOTES** (one nit).

## Must be true

1. A pack member holding an active fear status attempts C4 flight before its opportunity whatever its hp; with no legal exit it attacks; authored NPCs and the player are unaffected.
2. `co_present` lands on every living NPC in the event's room (`room_id`, else the room directly holding the subject), never the player's body, never the dead victim, `immune` respected, in a deterministic order.
3. Each co_present holder joins the writer group its status rows already hold in the advance, so one wait equals the split wait.
4. Both kernels refuse `fear`/`co_present` below 1.50 and `co_present` with `item` or `npc`; a fear status may omit `per_tick`.
5. Chapter 1 bytes unchanged (no Chapter 1 file touched; it declares no status).

## Proof

- Focused baseline in a scratch worktree with its own `_build`: `kernel/ts/test/fear.test.ts` 6/6, `test/loka/content_fear_test.exs` 1/1.
- Mutants (each red, then reverted): drop `afraid(at, selected) ||` (`round_flow.ts:150`): 2 tests fail; `joined = group` (no holder join, `reaction.ts:206`): the one-wait-equals-two test fails; co_present over every contained entity instead of `npcsIn` (player, dead chief): 3 fail; `present` without the room guard: the no-room test fails.
- Reviewer red control (Elixir): drop `|| s["co_present"]` (`lib/loka/content/reactions.ex:175`) with `mix test --force`: the loader twin fails (compiles `{:ok, ...}`).
- Probes (not committed): population area reduced to the den, shouted goblins stay and strike (player 8 HP, both in the den, still afraid): C4's no-exit rule holds. After the chief falls, the two status rows mint job ids in EntityId order (`npcsIn` sorts by `cmp`); only TypeScript runs reactions, so no cross-kernel order exists to differ.
- Subject in a container or carried: `present` reads only a room directly holding it, so nobody (as documented). A subjectless event falls back to the actor's body (reaction@1 table, `mechanics.md:586-590`), so its room is the player's: consistent with "the event's subject".
- Death and W8: the victim is not `living`, so it takes nothing; NPC death ends every status, permanent ones included (G3), so a permanent fear ends with its holder.
- Chapter 1 and parity: outside `cartridges/fear_sampler`, the diff touches under `protocol/fixtures`, `mobile`, `cartridges`, `test` and `kernel/ts/test` only `invalid.json` (additions) and the two new tests; no golden, save or receipt fixture pins the installed `kernel_api` (grep for 1.48/1.49 there finds only samplers' manifests); Chapter 1 goldens (`kernel/ts/test/chapters.test.ts`) run in the green hosted ci. `reaction`, `status` and `combat` are `portable_capability` in `protocol/capability_registry.json` with no Elixir host adapter (`bin/contracts.exs:125`), so co_present order has no Elixir twin to differ from.
- Cites rerun: `combat/behavior.ts:136` is `afraid`; `round_flow.ts:150` is its read in `maybeFlight`.

## Findings

1. **nit**, `lib/loka/content/reactions.ex:172-183`: `{co_present: true, npc: "nobody"}` gives only UNRESOLVED_REFERENCE in the compiler, while the TypeScript loader (`cartridge_status.ts` `lone`) also reports SCHEMA_VIOLATION at `.npc`. Both refuse, so no wrong admission; the gap is the existing row 42 one. Disposition: accepted (developer's Beads note).
