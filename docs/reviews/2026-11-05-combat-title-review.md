# Review: combat title names who started the fight (PR #621, loka-kgd.207)

- PR: [#621](https://github.com/lorecrafting/lokacore/pull/621), branch `toolbox/combat-title`
- Reviewed commit: `a5f6aa172743b26d79b2300dbd5f0e22a651beea`
- Governing: [book-ui.md, Live combat response, Opening](../system/book-ui.md), Beads `loka-kgd.207` and the owner's `loka-kgd.204` note, PM ruling (2): the opener is derived from the opening receipt, with no save or contract change and **Combat** as the fallback.
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit a5f6aa17...`): ci success, book-e2e success, graph-diff success.
- `/code-review medium`: reported in the PR body (three runs).

## Verdict: CHANGES REQUIRED

## Must be true (written before the diff)

1. Both title sentences come from cartridge keys; the Book adds no literal beyond the **Combat** fallback.
2. The opener is read from the receipt that holds the encounter's `encounter.open` op, with no save or schema change.
3. The title survives a cold reopen, and each encounter gets its own title.
4. Attack, cast and perform count as the player opening the fight; a move, a position change, a job or an expedition counts as the NPC opening it.
5. An unknown opener, a missing key or a foe with no name words reads **Combat**, never "undefined" and never a raw key.
6. The title is kept for the whole encounter, including its closed page, and the title focus still works.
7. No miss is cached before the opening receipt commits.

## Checks that held

- Items 1-3, 5 and 6: `combat_opener.test.ts` and `combat-title.test.ts`; Live story "Goblin combat" rendered "You attack the goblin!" over the round lines, and the static `Pages/Combat` story reads **Combat**.
- The opener ops: an `encounter.open` receipt is never coalesced away, because coalescing replaces only clock-only receipts. Fight-back opens a fight only on an NPC the player's own spell hurt, so classifying cast as the player's is correct for the current kernel.
- Fixtures: 38 transcripts, `.sql` checkpoints and the hash fixture differ from `origin/main` only by the content hash. The canonical diff is exactly the two added `text` keys.
- Closed-page title: a scratch mounted test closed fight A, went Back to World, then opened and closed fight B with no draw in between. B's page read **Combat**, not A's title. The test was not committed.
- PR claims rerun: removing `combat-title` from `lint/rules/mobile-renderer-imports.yml` is red (`ast-grep scan`, 2 errors). Renaming `combat.title_you_attack` in `text.json` is red in `cast_pick.test.ts`.

## Mutants

`bin/mutate_diff.sh origin/main` gave red-narrow 15 and SURVIVED 3, all three in `Combat.tsx`. Line 38 `[0]->[1]` is a type index, which tsc catches. Line 111 `> 0` changed to `>= 0` or to `> 1` is red-narrow in `combat-title.test.ts` (hand mutants).

Hand mutants were run against `local-story/*.test.ts` (98 files), plus `combat-title`, `cast_pick`, `combat`, `combat_flow` and `combat-book`:

| Mutant | Result |
|---|---|
| `combat-receipt.ts:58` `['attack','cast','perform']` -> `['attack','perform']` | SURVIVED |
| same -> `['attack','cast']` | SURVIVED |
| same -> `['attack']` | SURVIVED |
| `combat-receipt.ts:47` drop the `isInTransactionSync` guard | SURVIVED |
| that drop, plus `session.ts:168` dropping the `unsettled()` guard | green |

## Findings

1. **Blocker: `mobile/authority/local-story/combat-receipt.ts:58`.** Nothing tests cast or perform as player-opened. Failure: a regression that drops `'cast'` titles a spell fight-back "A goblin attacks you!" after the player cast first, and every test stays green. The brief names this exact case. Fix: add a `combat_opener.test.ts` case where the opening receipt is a cast (and one for perform), with a literal `player: true`.
2. **Should-fix: `combat-receipt.ts:47` and `session.ts:168`.** Nothing tests the two pre-commit guards, even with both removed. Failure: if a lookup ever runs inside the commit transaction, it caches a miss, and that fight reads **Combat** for its whole life without any test noticing. Fix: pin item 7 with a test that reads the opener inside an open transaction and then after commit, or delete whichever guard is unreachable.
3. **Nit (wording, for the owner): `mobile/app/book/combat-title.ts:11`.** `named` gives a definite article: "You attack the goblin!", while the owner's example reads "You attack a boar!". In a pack of two goblins, "the goblin" does not say which one is meant.
