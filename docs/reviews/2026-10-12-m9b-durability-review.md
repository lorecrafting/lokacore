# Review: toolbox row 21, durability, crafting quality and repair (loka-kgd.111)

- Branch `toolbox/m9b-durability`, head `ceacdc7352d2b3ea1dd7b6314771a06967f740e1`, diffed against `dd2addcc` (`toolbox/batch-m9b`, merged into the branch). No PR (batch model). Installed `kernel_api` 1.68 to 1.69 (provisional).
- Governing: [Durability, crafting quality and repair](../system/mechanics.md#durability-crafting-quality-and-repair-toolbox-row-21) and [Durability declarations](../system/cartridge.md#durability-declarations) (both added here), [wield resolver](../system/mechanics.md#c1-training-and-armed-defense-selected-contract), [G2](../system/mechanics.md#damage-kinds-resistances-and-critical-hits-toolbox-row-g2), [B8 services](../system/mechanics.md#b8-mauds-immediate-services-selected-contract), [W2](../system/mechanics.md#entity-and-pair-facts-toolbox-row-w2), [row 17](../system/mechanics.md#ranged-first-strike-toolbox-row-17), Beads `loka-kgd.111` (brief, pre-decided design 1-7, PM rulings 2026-10-12).
- Hosted CI on the head: `book-e2e` success; `ci` **failure** (run 38208631662, job `kernel`, `npm run typecheck`).
- Verdict: **CHANGES REQUIRED** (one blocker: the typecheck) (superseded by the fix re-check below).
- Written 2026-10-12 05:48 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer).

## Must be true

1. Spec amended in this PR; numbers (max, default, wear, amount, price) are cartridge values only.
2. Wear only when the player's own durable wielded attack hits (a fully resisted `loss: 0` included); miss, unarmed, NPC or ally blows never wear; clamped at the minimum.
3. At or below the minimum the weapon strikes as `world.combat.player_attack` with no tags, takes no wear, and (row 17) shoots no more.
4. Repair targets only the wielded item whose `durability.fact` is the benefit's fact; capped at the maximum; `nothing_to_repair` and `full_durability` refuse before any charge; the offer shares `availability`.
5. Only combat wear and service repair write a durability fact (recipe, dialogue, reaction refused).
6. A cartridge with `durability` or `repair` below 1.69 does not load in either kernel.
7. No existing cartridge byte or hash moves; no per-action whole-state work.

## Proof

- Local at head: `durability`, `ranged`, `service`, `cartridge_services`, `e1_services`, `combat`, `combat_content`, `combat_contracts`, `service_contracts`, `scoped_facts`, `facts`, `practical_skills`, `showcase_combat` tests pass; `mix test test/loka/content_durability_test.exs` passes; mobile `local-story/durability.test.ts` and `scoped_facts.test.ts` pass; `elixir bin/contracts.exs --check` and CI-style prettier pass. `npm run typecheck` exits 2 (finding 1).
- Mutants, each reverted. Red: `<=` to `<` in `broken`; reaction guard dropped (`reaction.ts:241`); repair cap dropped (raw add); compiler floor off, compiler `r in named` forced true, compiler `nothing_to_repair` text dropped. These rerun the developer's broken, ownership and cap claims. Green (findings 2-5): T3, T5, T6, T7, E1.
- Probe: one `stepElapsed` spanning two round intervals faults `nonfuture_job`, so departure (c) holds.
- No `missing_child_*` fixture or existing cartridge touched; `invalid.json` only gains new-contract rows (the schema sweep).

## Departures

- (a) Accepted: a thrown `precondition_failed` faults `evaluator_error`, the same as an entitlement fact, and the spec says so.
- (b) Accepted: `reaction.ts:241`. It sits after the subjective skip, so a reaction naming an absent item skips without a write. Harmless.
- (c) Accepted (probe above). See nit 6.
- (d) Accepted: content choice; `sharp` keeps the hammer out of the forge's targets.
- (e) Accepted: a repair's fact must be named by a weapon's `durability` (`cartridge_services.ts` `repair`, `services.ex` `benefit`), and that weapon trips the 1.69 floor in both kernels. The 1.68 loader row loads the sampler with its `mend` and is refused. The diagnostic sits at the manifest's `at_least`, not at the field the brief named. That matches `cartridge_skills.ts:57`, and the amended cartridge.md states it.
- (f) Accepted: `durable` (`fact.ts:140`) scans cartridge definitions (about 60 items in Chapter 1), not state, next to the existing skill, patrol, service and scene scans in `ownership`. Proportionate.

## Findings

1. **Blocker**, `kernel/ts/test/e1_obligations.ts:109-128`: TS2339 ×5 (`recovery`, `vessel`, `liquid` on the new `repair` member). Hosted `ci` is red, and the failure reproduces locally. Fix: give `kind === 'repair'` its own branch, then run the full `npm run typecheck` (`tsc`, `-p test`, `-p play`).
2. **Should-fix**, `kernel/ts/src/mechanics/combat/round_attack.ts:249`: the row 17 composition is untested. Dropping `worn` from shots (T7) stays green. Scenario: a bow with durability shoots for ever, against the spec line "a broken ranged weapon shoots no more". Fix: one test that edits `ranged_sampler` so a hit shot wears the bow and a broken bow makes round 1 melee with arrows unspent.
3. **Should-fix**, `kernel/ts/src/mechanics/service/shared.ts:96`: the fact match is untested (T3 `if (!d)` stays green). Scenario: a smith whose `mend {fact: edge}` repairs a wielded bow whose fact is `string`. Fix: a test-local second fact on the stick; mend refused `service.nothing_to_repair`.
4. **Nit**, `round_attack.ts:90`: wear on a fully resisted hit is untested (T6, moving the wear after `if (!loss) return`, stays green). Fix: a dummy with 100% physical resistance: hp 30, edge 1.
5. **Nit**, `kernel/ts/src/content/cartridge_skills.ts:145`, `lib/loka/content/skills.ex:161`: the `scopes == ["instance"]` clause is untested in both kernels (T5 and E1 green; a `["player"]` durability fact loads under T5). Fix: add a scopes row to both loader tables.
6. **Nit**, `docs/system/mechanics.md:2495`: "a later round of the same advance reads the value the earlier one wrote" describes no reachable case, because one advance holds one round. Fix: "the next round reads the committed value".

## Fix re-check

- Written 2026-10-12 06:05 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer).
- Fix commits `71a9d965` and `628bc292f1bf681514269319a816bb9ddf65147c` (`ceacdc73..628bc292`), reviewed at `628bc292`.
- Verdict: **APPROVE WITH NOTES** (no blocker; one nit). Hosted CI on `628bc292`: `ci` and `book-e2e` in progress at writing; `ci` on `71a9d965` failed (`check_hash` module list), which `628bc292` fixes.
- Local at `628bc292`: full `npm run typecheck` (`tsc`, `-p test`, `-p play`) exit 0; `durability`, `ranged`, `e1`, `e1_services`, `e1_obligations` tests pass (38); `mix test test/loka/content_durability_test.exs` passes.

### Dispositions

1. Blocker resolved: typecheck is clean and `e1.test.ts` (`check_hash covers every local module`) passes with `e1_repair.ts` in `CHECK_FILES`. The +2-line allowance (542 to 544) only covers the import and the branch, as the file header asks new witnesses to live in their own module.
2. Resolved: `ranged.test.ts` "a hit shot wears the bow; a broken bow makes round 1 melee". Mutant `worn` dropped from shots (`!shot`) is red (string 1, expected 0).
3. Resolved: `durability.test.ts` "mend refuses a wielded weapon whose durability is another fact". Mutant `if (!d)` is red.
4. Resolved: the resisted-hit row in the wooden-sword test. Mutant wear moved after `if (!loss) return` is red.
5. Resolved: TS and Elixir loader rows. Mutants (scopes clause removed in `cartridge_skills.ts:145` and in `skills.ex` `entity_int?`) are red; `mix test --force`. Claim checked: `protocol/fact.schema.json` allows `per_subject` with `["player"]` (a pair fact), so no `invalid.json` row can express it.
6. Resolved: `mechanics.md:2495` now reads "the next round reads the committed value".

### New finding

7. **Nit**, `kernel/ts/test/e1_repair.ts:6-16`: the witness runs in no E1 case. E1 replays only Chapter 1, which has no repair service. Mutant `true || ops.some(...)` stays green in `e1_services`, `e1_obligations`, `e1_world_witness` and `e1`. Scenario: a wrong repair witness (for example, an `expected`/`value` swap) would credit nothing and be caught by nothing until a repair service enters an E1 cartridge. Fix: either `else if (benefit.kind !== 'repair')`, which drops the module, the `CHECK_FILES` row and the size bump, or keep the witness and test it when E1 first replays a repair. Not blocking.
