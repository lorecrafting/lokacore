# Review: NPC-vs-NPC damage, allies and kill credit, toolbox row 6b (loka-kgd.68)

- Local branch `toolbox/m7-allies`, head `fd6dc2153faaf7e95b150b6fee3f64c653166297`, diff `00a305cd...fd6dc215` (27 files, 3 commits including the PM's test-typecheck cast); no PR yet. Contract slice by PM ruling: `CombatSettings.allies` and narration `ally_hit`/`ally_miss` in the cartridge schema, two invalid fixtures ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [toolbox row 6b](../MECHANICS-TOOLBOX.md#ranked-toolbox), [mechanics.md row 6b](../system/mechanics.md#npc-vs-npc-damage-allies-and-kill-credit-toolbox-row-6b), [cartridge.md allies](../system/cartridge.md), brief in Beads `loka-kgd.68`.
- Hosted CI on the head: ci 38082678287 and book-e2e 38082678272, both success. Trial merge with `toolbox/batch-m7` 545030b6: conflicts only in `docs/toolbox.gen.json` and `docs/system-graph.gen.json` (generated; regenerate on merge).
- Verdict: **CHANGES REQUIRED** (one blocker: a mutant on a spec rule survives).

## Must be true

1. Opt-in only: without `allies` a cartridge keeps bytes, hash, receipts and GameView; Chapter 1 receipts are unchanged, including after the `statusGroup` widening.
2. The round never exceeds eight raw draws; any ally skip depends only on seeded state, so replay gives the same receipt.
3. An ally is never a target: Attack refused `invalid_target` in and out of a fight, no Attack offered, foes strike only the player.
4. The ally strikes the player's target with its own profile; the player's dodge, block and sleep multiplier apply only to blows on the player.
5. Credit: `entity_died` names the ally as killer and the encounter's character as credited; the credit consumer accepts that and nothing broader.
6. Both kernels reject the same bad `allies` inputs at the same paths.

## Proof

- Baseline at head: 16 focused TS files (targets, c4_pack x3, hounds, e1, combat x4, status x2, npc_status, encounter_bleed_jobs, levelling, c5_bleed) plus chapters, validate, e1_creatures: green. Elixir `content_targets_test`, `c4_pack_composition_test`, `contracts_test`, `content_chapters_test` (hash pin), `cartridge_cross_kernel_test`: 21 passed. Chapter 1 receipts and hash unchanged (1).
- Mutants caught (`targets.test.ts`, `combat_credit.test.ts`): `allyFits` `<= 7` and `< 6`; pack loop `continue` back to `break`; `credit.ts:98` without `|| ally(...)`; `statusGroup` back to `[body_id, npc_id]`; `view/combat.ts` without the ally check; `attackRefused` without the ally check. Elixir `combat.ex` without the `spawn_template` branch fails (`mix test --force`).
- **Mutant survived:** `round_attack.ts:65` `accurate && foe` changed to `accurate && !player` (the ally's blow runs the player's `defend`). Suite green.
- Budget skip (2): `allyFits` reads `r.draws` only, so it is deterministic and replay-safe. The yard proof (rng `[1,2,3,4]`) asserts `combat.ally_hit`, so it does not skip silently.
- (3): `attackRefused` runs before `retarget` (`combat/rule.ts:20-23`), so an in-fight Attack on the guard is also `invalid_target`. Encounter openers (`combat/rule.ts`, `expedition/sequence.ts:112`) pass through `attackRefused`. Pack admission needs a spawned hound origin (`combat/saved.ts` `packValid`), so an authored ally never enters `active_ids` and the job never needs a re-point.
- loka-lpq6: credit only reads the proposal's own events (`credit.ts` `occurrenceValid`, `attackOf`). A double kill writes no credit fact. Replay is deterministic, so no save or replay corruption: acceptable as a filed limit.
- loka-x2gv remainder as stated: `proposal.ts:289-292` (a bleed pair is taken before `statusGroup`) and first-group-wins, now at `status/job.ts:190` (Beads cites `:189`).
- Parity probe: `ally_hit` pointing at a missing text key gives UNRESOLVED_REFERENCE at `...narration.ally_hit` in both kernels. Duplicate allies load in both (harmless).
- Fixtures: `invalid.json` additions only. PM commit `fd6dc215` (a `as string` cast in a test) is correct.
- Cites rerun: `credit.ts:94-99` and the `statusGroup` path in mechanics.md both hold.

## Findings

1. **blocker**, `kernel/ts/test/targets.test.ts` (row 6b tests): no test gives the player dodge or a shield, so the surviving mutant above stays green. Failure: a cartridge with `combat.dodge` (chance 100, skill usable) or a blocking shield makes the guard's blow on the raider come out "dodged" by the player, against mechanics.md "the target's dodge, block … apply only to blows on the player". Fix: one yard case with a 100 block shield or dodge, expecting raider 0 HP and `combat.ally_hit`.
2. **should-fix**, `docs/system/mechanics.md:654-655`: still says a combat round joins the status writer group "of its body and opponent". The new row 6b bullet says every roster member. Failure: a reader working on x2gv or row 12 takes the stale rule. Fix: link to the 6b bullet or restate it once.
3. **nit**: no `/code-review` result is reported (no PR body; the Beads handoff and commit `4096eac1` say only "self-review"). Run it in the fix round.
4. **question**, `round_attack.ts:38`: mechanics.md says the skip happens "rather than exhausting the budget". But an ally that starts with exactly two draws left, whose own hit draw is rejected, still exhausts it (`rng_budget_exhausted`, an atomic and deterministic fault, about 2e-8 per draw). Accept and state it, or not?
