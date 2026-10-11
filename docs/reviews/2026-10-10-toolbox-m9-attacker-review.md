# Review: M9 attacker filter + tilt pack (loka-kgd.79, loka-y6yg.11, loka-kgd.103)

- Branch `toolbox/m9-attacker` (no PR; merges into `toolbox/batch-m9`), head `486253008a57c693f07902d74f3dd2ceed61cba0`, base main `82cefdf2`. Hosted ci and book-e2e succeed at this head. The E1 recorder (`e1_cases.ts`) skips on an item branch and did not run at this head; its proof is the `toolbox/batch-m9` head.
- Governing: [reaction@1 filter table](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts), [row 6b Reactions](../system/mechanics.md#npc-vs-npc-damage-allies-and-kill-credit-toolbox-row-6b), [row W3 entrant filter](../system/mechanics.md#rumour-by-co-presence-toolbox-row-w3), [fire W22](../system/mechanics.md#fire-toolbox-row-w22), [combat district Built](../showcase/combat-district.md), [CHECKS size rule](../CHECKS.md), Beads `loka-kgd.79` PM comment (Q3 to Q5).
- Verdict: **APPROVE WITH NOTES** (two should-fix in content, two nits; no blocker).

## Must be true

1. `attacker` on `attack_result` holds only when `attacker_id` is the named NPC's authored instance. The player, a spawned member and other NPCs never match.
2. Both loaders refuse the filter below 1.58 (KERNEL_API_RANGE_INVALID), on an unknown NPC (UNRESOLVED_REFERENCE) and on a spawn template (SCHEMA_VIOLATION at `on.attacker`). The schema admits it only on `attack_result`.
3. TS `FILTERS` and the schema's filter set agree (loka-kgd.25 item 2).
4. In the tilt yard a goblin's hit never applies the boar's wound. A boar's hit still does.
5. The tag lockout reads only the trigger room's exits, and only when the rule filters `room`. That room is then `eventRooms`' room (`payload.room_id`).
6. Chapter 1 bytes are unchanged. The showcase hash equals the compiler output.

## Proof

- Named TS files (75 tests), `npm run typecheck` and the two `.exs` files pass at the head.
- (1, 4) Mutant: the `attacker` filter always true (`reaction.ts:57`) turns the tilt-yard test red. Removing `attacker` from `tilt_boar_gore` in the loaded content turns it red too.
- (2) Mutants turn the loader tests red in each kernel (Elixir: "attacker filter needs API 1.58 and an authored NPC", mix exit 2): floor 58 to 57 (`cartridge_reactions.ts:76`, `reactions.ex:100`), and the spawn-template check reduced to `npc` (`cartridge_reactions.ts:88`, `reactions.ex:66`).
- (3) Removing the `attacker` entry from `FILTERS` turns the parity test red.
- (5) Ignoring the room in `barrierSet` (TS) or `exit_barriers` (Elixir) turns the fire loader test red. The equality holds by construction: `room` matches `p.room_id` (`reaction.ts:53`), and `eventRooms` reads `payload.room_id` first (`lookups.ts:23`).
- (6) No Chapter 1 file is touched. `content_showcase_test.exs` holds the hash fixture to the source.
- Developer claims rerun: (a) dropping `boar_gore`'s `when` turns combat 6, 8 and 9 red, so the woken-at-inn wound is real (loka-kgd.105). (b) Dropping `o.to === step.to` in `e1_barrier.ts:17` survives, as reported.
- E1 hook (48625300): removing `e1_barrier.ts` from `CHECK_FILES` turns `e1.test.ts` ("check_hash covers every local module e1_cases.ts imports") red.
- Size: the `e1_obligations.ts` allowance goes from 540 to 542. CHECKS allows this: "Test files keep the escape hatch". The new witness already sits in its own module, so no split is needed.
- Q5 probe (sword damage set to 5 so that a goblin drops to hp 1): the goblin flees north into `gate_yard` and stays passive at hp 1. It does not join the raider fight. The raider dies normally. Attacking the goblin afterwards closes the fight, and its kill pays 10. No fault. No test pins this; at the shipped sword damage (2) a goblin never falls below 25%.

## Findings

1. should-fix, `cartridges/toolbox_showcase/npcs/boar.json:20` and `npcs/tilt_boar.json:20`: PM Q3 is not applied, and the boars still carry `immune`. The dead `immune` hides a regression: removing `attacker: boar` from `boar_gore` keeps every test green, because the player's blows land on an immune boar. Dropping `immune` alone keeps every test green, so Q3 is safe. Dropping `immune` and the filter together turns combat 8 and combat 9 red. Once Q3 lands, combat 8 pins `boar_gore`'s filter.
2. should-fix, `cartridges/toolbox_showcase/text.json:489`: PM Q4 is not applied. The sign still says the tilt yard "has all of it and a draught". A player who reads it goes south and expects Aldous's lesson, Gil or the raider bounty, and finds none of them.
3. nit, `kernel/ts/test/e1_barrier.ts:17,29`: both the `o.to === step.to` match and the `barrierState(after, …) === step.to` guard survive mutants. Example: rule A opens a door and rule B closes it in the same advance. A's witness then depends on the untested guard. Pin that case or delete the guard.
4. nit, branch `toolbox/m9-attacker`: there is no PR body, so no developer `/code-review` result is reported. Run it in the fix round, or record that it was run.

Open (not findings): the E1 recorder must run on the batch head. Q5 is unpinned (see the probe above). The PM keeps loka-kgd.25 open for item 1 and has filed loka-kgd.105 for the fatal-blow reaction.

## Disposition
