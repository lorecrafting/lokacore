# Review: M10 toolbox row G8, group primitive (loka-kgd.115)

- Written 2026-10-12 07:17 UTC in the Pi harness by anthropic/claude-opus-5-5 (role reviewer, Pi session 01a12ef2).
- Branch `toolbox/m10-group`, head `279ac6422f711728ce91f8e3f6260bbf289a1a8c`, diffed against `ab441303` (the developer's base). No PR (batch model). Installed `kernel_api` 1.69 to 1.70.
- Governing: [Group primitive](../system/mechanics.md#group-primitive-toolbox-row-g8) and [Group declarations](../system/cartridge.md#group-declarations) (added here), [row 6b](../system/mechanics.md#npc-vs-npc-damage-allies-and-kill-credit-toolbox-row-6b), [W2 pair facts](../system/mechanics.md#entity-and-pair-facts-toolbox-row-w2), [escort@1](../system/mechanics.md#escort1), toolbox row G8, Beads `loka-kgd.115` brief. PM rulings (latest `loka-kgd` comment) not reopened: `kernel_api` 1.70, not the brief's 1.71; no "follows you" Book line, as for escort.
- Hosted: `ci` green on the head; `book-e2e` re-run in progress at writing (`gh run list --commit`).
- Verdict: **APPROVE WITH NOTES** (no blocker, no should-fix; one nit).

## Must be true

1. Membership is only the `world.group.member` bool pair fact read at (NPC, character); nothing new is stored.
2. Move, Flee and transport move every living member directly in the source room, in EntityId order, in one writer group; a member elsewhere stays without fault; the escorted NPC moves once.
3. A member is an ally of its leader's character: no Attack admission or GameView offer on it, it strikes as the round's ally after listed allies (one ally turn, eight-draw budget kept), its blows narrate as ally, its kill credits the character.
4. Player death writes nothing for the group.
5. Both kernels: `world.group` below 1.70 is KERNEL_API_RANGE_INVALID; a non-bool, non-`per_subject` or non-`["player"]` member fact is SCHEMA_VIOLATION at `.cartridge.world.group.member`; beside `world.combat` the ally narration is required; the loader exempts only this reference from the per_subject FACT_SCOPE_UNSUPPORTED rule.
6. Chapter 1 and other samplers unchanged (opt-in).

## Proof

- Diff matches 1 to 6: `member` (`kernel/ts/src/mechanics/escort/shared.ts:124`), `travel` (:131) over `npcsIn` (living, EntityId order); `ally` gains the character at every caller (typecheck-enforced: `attackRefused`, `combatOffered`, credit, `narrate`, `round_attack`); `allyOf` (`combat/shared.ts:86`) falls back to the first member with an attack; spell `fightBack` and expedition admission route through `attackRefused`, so members are covered there too. No death or Book change.
- Focused runs green at head: TS `group`, `escort`, `targets`, `cartridge_escort`, `transport`; Elixir `content_group_test`, `content_combat_test` (6 pass).
- Mutants, each reverted, each red: credit `ally(world, null, …)` (`credit.ts:123`); `!!npc.attack` dropped from `allyOf`; striker without member (`round_flow.ts:242`); foe test without member (`round_attack.ts:64`); co-location dropped (`npcsIn` over all rooms); escort skip dropped (escort.test); GameView without member (`view/combat.ts:19`); loader scopes check dropped; loader floor 1.70 to 1.69; loader narration without `c.world.group`; Elixir narration clause off; Elixir `scopes` match dropped (`mix test --force`).
- Schema sweep: `group.required` dropped is red in TS `validate.test` and Elixir `contracts_test`; `additionalProperties` dropped is red in Elixir `contracts_test` (the TS validator stays green, as for other fields; one layer catches it).
- Toolbox row G8 still `todo`: the PM marks rows done after merge (as `d862f562`).

## Findings

1. **nit** `kernel/ts/src/mechanics/escort/shared.ts:138` (and `combat/shared.ts:91`): `travel` now sorts every known entity on every Move, Flee and transport, and `allyOf` on every round without a listed ally, in every cartridge, Chapter 1 included, where `world.group` is absent and the scan always yields nothing. Per-action work is the bottleneck (AGENTS.md Performance). Fix: return no members when `world.cartridge.world?.group` is unset, before `npcsIn`.

## Departures

- `kernel_api` 1.70 (brief 1.71): the PM's renumbering; accepted.
- No "follows you" line: PM ruling; accepted.
- Unknown member fact reported UNRESOLVED_REFERENCE (brief named only SCHEMA_VIOLATION for a wrong shape): the existing reference rule; accepted.

## RECHECK at `34f27f20`

Written 2026-10-12 07:46 UTC in the Pi harness by anthropic/claude-opus-5-5. Role: reviewer (fresh). Fix commits `0d80cf1a`, `34f27f20`.

Verdict: **APPROVE**.

- Nit 1, fixed (`0d80cf1a`): `travel` (`kernel/ts/src/mechanics/escort/shared.ts:138`) and `allyOf` (`combat/shared.ts:91`) skip `npcsIn` when `world.cartridge.world?.group` is unset. Behaviour unchanged: `member` already returned false without `group.member`, and `allyOf` yields `undefined` either way. Mutant dropping both guards stays green (TS `group`, `escort`, `cartridge_escort`, `speech`, `combat*`, `reaction*`; 62 pass), as expected for a perf-only change; no test can observe it.
- Import cycle, fixed (`34f27f20`): `npcsIn` body moved byte-for-byte into `death/shared.ts`; all five importers re-pointed, none left on `speech/shared` (grep; `npm run typecheck` green). A value-import graph walk shows `death/shared.ts` reaches none of escort, speech or dialogue, and `escort/shared.ts` is no longer on a cycle; the same walk reports the cycle at `0d80cf1a` (red control).
- No new test: accepted. The failure needs a Metro browser bundle; hosted book-e2e on this head is the gate, and loka-g53x (import-cycle check) is the cheap guard. A Node walk of relative value imports caught this cycle, so g53x is feasible without Metro.
- Hosted CI on `34f27f20`: ci and book-e2e in progress at recheck time.
