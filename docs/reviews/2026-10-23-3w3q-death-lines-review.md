# Review: death lines outside a combat round, Book World page on death (loka-3w3q, loka-x6t.26, PR #455, kernel_api 1.117)

- Branch `toolbox/batch-death-lines-e1`, range `4f08cfc5e..8a68a017d577e9752ab05ec5af1083971b5b923d` (`4f08cfc5e` is the designer's book-ui.md line).
- Governing: designer ruling in Beads `loka-3w3q` notes, [book-ui.md World log](../system/book-ui.md) line 70 and [Away recap](../system/book-ui.md#away-recap), [save.md](../system/save.md), [Review stance](../WORKFLOW.md#review-stance).
- Reviewer: anthropic/claude-opus-5-5, independent, authored none of the work.
- Verdict: **APPROVE WITH NOTES** (one should-fix in the PR body, two nits, one follow-up filed).

## Must be true (written before reading the diff)

1. A player's bleed or status-tick death outside a combat round tells exactly one fall line (`world.death.narration.player_died`, else combat's), never a second one inside a combat round; drowning keeps its own line.
2. Every player death adds `woke` after the penalty line; an NPC death adds none.
3. Receipt order is tick, fall, penalty, woke.
4. `world.death.narration` is a closed object of two optional TextKeys. Both loaders refuse it below 1.117 and refuse a key outside the catalog, and a `loader_floors.json` case is red in both.
5. kernel_api 1.117 follows main's 1.116 with no collision with open PRs.
6. Old saves: say exactly what happens to them.
7. The Book: a death's room change ends the away recap. The recovery room's log opens with the death lines in order; they never enter a recap.

1 to 5 and 7 hold for the cases the PR covers. 6 does not hold as worded (finding 1). 7 has one uncovered case (Q1).

## Findings

1. **Should-fix**, PR body "Save impact", first bullet ("older saves replay to the same state (narration is not state)"). Reopen replays receipts and compares the whole decision, narration included (`mobile/authority/local-story/receipt-history.ts:38`, `same`). Failure: take a cartridge whose bytes are unchanged but that has a stored bleed or status-tick death. The kernel now adds the combat fallback fall line (`kernel/ts/src/mechanics/death/lines.ts:6`) or `npc_died` (`status/fatal.ts:36`). The replay differs and the save opens as `save_corrupt`. Shipped app today: the showcase hash changes, so old showcase saves get `pinned_release_missing` and are offered a new game (save.md). No save is corrupted, but the claim is wrong. Fix: reword the bullet to "old showcase saves are refused by the hash pin; narration is compared on replay".
2. **Nit**, `docs/system/book-ui.md:70`. The death rule does not exclude a death while a fight is open, so it reads as conflicting with Closure. Failure: a reader takes the recovery log as the place for the lines of a tick death during a fight. Designer wording.
3. **Nit**, `kernel/ts/src/runtime/proposal.ts:100`. `woke` is pushed after every other producer, with no trim against the DecisionResult `narration` maxItems 64, as `levelUp` already is (that predates this PR). No test covers the cap. Failure: a receipt already at 64 lines that has a death gets 65 and fails the schema check (`invariants.ts:122`). No content comes near this.

Self-review items judged:
- `woke()` does not check that the victim is the actor. **Question, accepted for now**: single-player, so every player death is the actor's.
- 64-line cap untested: finding 3.

## Open questions ruled

1. A death in the recovery room itself still recaps. This breaks book-ui.md:70, but it is rare: a drain or tick death at crossroads_inn. **Follow-up `loka-3tc7`**, not a blocker. It is an implementation matter (a host-projection death signal); no designer needed.
2. A background room change without a death now ends the recap. **Accept.** No shipped elapsed path moves the player except a death: arrest follows a press or a move, transport is a press, and job transfers move NPCs and items only. No designer needed.
3. A tick death during an open fight: `closing()` unchanged is **correct** per Closure and the ruling's item 2. The wording is finding 2, for the designer.

## Checks run

- Baseline green on head: kernel `npc_status`, `showcase_combat`, `c5_bleed`, `c5_bleed_death`, `bleed_composition`, `loader_floors`, `penalty`; mobile `recap.test.ts`; Elixir `loader_floors_test`, `content_penalty_test`.
- Mutants, all red, tree clean afterwards:
  - A: `fatal.ts` lines placed before the tick narration. Fails `combat 8` and `combat 9`, and `recap` "a poison death while away".
  - B: the bleed fall line placed before the tick. Fails `c5_bleed` "fatal tick closes bleed before same-body shrine return".
  - C: TS floor `1.116`. Fails `loader_floors` and `penalty` "refuses each malformed death narration".
  - D: Elixir floor `[1,116]`. Fails `LoaderFloorsTest`.
- Floors: origin/main is at 1.116 and is an ancestor of the head. Open PR #454 stays at 1.116 and touches none of these files.
- Elixir parity: `death.ex` uses the same floor order and the same `cartridge.world.death.narration.<field>` error path as `cartridge_death.ts`.
- Fixtures: the 7 showcase transcripts and the 7 stories `.sql` files differ from main only in `content_hash` (checked by substituting the hash). `loader_floors.json` adds one case.
- PR claims rerun: "a player's entity_died has no victim_definition" holds (`death/sequence.ts:270,294`). "resetLogs already clears the old room's log and held lines" holds (`mobile/app/book/logs.ts:103-106`).
- Hosted on 8a68a017d: ci 39938666995, book-e2e 39938667116 and graph-diff 39938711305 all pass.
- The PR body reports `/code-review medium` (8 findings).
