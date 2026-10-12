# Review: M10 balance tool 7, fight matrix and encounter rating (loka-kgd.107.7)

- Written 2026-10-12 09:50 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer, Pi session 01a12f7f).
- Branch `toolbox/m10-fights`, head `cec404bf`, diffed against `8ce408ac` (`toolbox/batch-m10`). No PR (batch model). Commits `86b52c24` (spec), `cec404bf` (code).
- Governing: [Fight matrix and encounter rating (balance tool 7)](../system/cartridge.md#fight-matrix-and-encounter-rating-balance-tool-7) (added here), Beads `loka-kgd.107.7` brief (acceptance a-e, red controls), study `docs/rnd/balance-diagnostics-2026-10-11.md` §4 F1, F2.
- Hosted CI on the head: book-e2e green; ci red (TypeScript size gate, finding 1).
- Verdict: **CHANGES REQUIRED** (one must-fix: the size gate; two should-fix). The matrix itself is correct.

## Must be true

1. Each fight plays the real kernel: player body in the target's room, one Attack, then one combat round per elapsed `world.combat.interval`; win, death or timeout read from the step's `entity_died`.
2. The level and build override reaches the derived combat values the round code reads.
3. Encounter plans are elapsed to a birth; `unborn` only for plans; `opportunities_per_day` is a two-place string.
4. `first_win_level`, `death_pct_level_1` and the cell percentages follow the spec.
5. Expected test values are hand-read; `play/` adds no reverse import.

## Proof

- Hand-play outside the tool (scratch driver on `step`/`stepElapsed`, not committed), `toolbox_showcase`, seed 1, allies removed, level 1, build none, against `npc/raider` (hp 3, sure 1): start hp player 10/10, raider 3/3, same room. Attack accepted; every round narrates `combat.player_miss` and `combat.npc_hit`; player hp 9, 8 ... 1, dies in round 10; raider stays at 3. The tool agrees: seed-1 cell is a death; with `--rounds 9` the same cell is a timeout, with `--rounds 10` a death.
- Level 3, str build: level reads 3, derived damage +2 (str 12, pivot 10); the hit chance stays 0, so the override reaches the derived values but cannot change a miss.
- Warden: attacks back every round (`combat.npc_miss`), chance 0.
- **Cause (content, not the tool):** `world.combat.player_attack.chance` is 0, there is no `world.derived.hit_chance`, and the only weapon (`training_sword`, chance 100) comes from the `aldous_lesson` dialogue, so the start-gear player never hits; the warden's `attack.chance` is 0, so it never hits back (timeouts). With `player_attack.chance` 100 in a copy, the raider falls in round 3 (hp left 8) and the warden in round 5.
- Tests at head: `fight.test.ts` and `flows.test.ts` 10/10. Literals are hand-read (no expected value computed by the tool).
- Mutants (each run under `perl -e 'alarm 300'`, file restored and compared): level row not overridden, red; player death read as timeout, red (the developer's two). Surviving: refused-Attack branch removed (`fight.ts:152`); `>= 50` to `> 50` (`fight.ts:57`); `experience: 0` (equivalent for combat, see finding 2).
- Seed-1 fallback: every seed checked against seed 1 only (3 seeds, showcase) gave byte-identical output.
- Imports: `play/fight.ts` imports `src/`, `test/sim.ts` and `play/flows.ts`; nothing in `src/` imports `play/`. `test/sim.ts` already imports `play/obs.ts` and `play/run.ts` (not this diff).

## Findings

1. **Must-fix.** `kernel/ts/play/fight.ts:29` (`fights`, 54 lines) and `fight.ts:112` (`fight`, 54 lines) exceed the 40-line limit: `node bin/check_ts_size.mjs` exits 1 (reproduced from the repo root and from `kernel/ts`); hosted ci is red on the head. Fix: split both (for example `target` and the rating out of `fights`; the birth loop and the round loop out of `fight`), no size allow comment. Question for the developer: the handback claimed the size checks passed; which command ran (only `elixir bin/check_size.exs`?).
2. **Should-fix (PM ruling).** `kernel/ts/play/fight.ts:57`: `first_win_level` reads only the `none` build, but no combat code reads the level, so a `none` build plays every level the same: the rating can only be 1 or null. Scenario: showcase with `player_attack.chance` 100, `npc/boar`: level 2 str wins 100%, every `none` cell 0%, rating `first_win_level` null. Fix: the brief's question 2 alternative (lowest level where any build reaches 50.00), spec line at `docs/system/cartridge.md:536`.
3. **Should-fix.** `kernel/ts/play/fight.ts:154-164`: a target that flees, ending the encounter, is played to the round cap and counted as a timeout. Scenario: showcase goblins with a sure player hit: the target flees at hp 1 in round 5, the second goblin dies in round 11 and the pack withdraws; the cell reads 100% timeouts, 0 deaths, after 100 rounds each. Fix: stop when the player has no open encounter and count it as its own outcome (for example `fled`), one spec line.
4. **Nit, not required.** The refused-Attack cell (`fight.ts:152`, `cell` at :175) has no test; the kernel refuses only content the tool does not produce (non-room host, suppressed hound, player not standing).
5. **Nit, not required.** The 50.00 boundary (`fight.ts:57`) is untested; an exact 50% cell needs RNG-dependent content, and finding 2 may change the rule.

## Departures

- `world.combat.allies` dropped from a copy: accepted (spec line, Al in the clone test).
- Seed 1 checked, the rest plain: accepted (brief's fallback; output identical above).
- `experience: 0` mutant survives: accepted as equivalent for combat; it is the root of finding 2.
