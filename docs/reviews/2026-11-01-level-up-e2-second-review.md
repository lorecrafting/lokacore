# Level-up E2: second review (PR #566)

- PR: [#566](https://github.com/lorecrafting/lokacore/pull/566), loka-g5hh.2.2
- Commit reviewed: `0ee74dd3b41e2307e7c8459e10b2cfd8d6f80d1e`
- Verdict: **CHANGES REQUIRED**
- CI at that head (`gh run list --commit`): ci, book-e2e and graph-diff all success.
- Governing: [Level-up refill](../system/mechanics.md#experience-and-levelling-toolbox-row-4), [Reviewer](../WORKFLOW.md), [storage lessons](../lessons/storage.md), [contract lessons](../lessons/contracts.md).

## What must be true (written before the diff)

1. Content with no reaction `resource.adjust`: ops, groups, events and receipts unchanged.
2. No silent conflict: a refill joins only a group that wrote that pool; everything else still faults.
3. Replay is deterministic: the stored op carries its time.
4. A refill clamps, composes, and writes nothing when the value is unchanged.
5. A death in the refill's round is consistent, and the same after reopen.

## Findings

**Blocker: a refill and a same-due hp job stop the save's time for good.** `kernel/ts/src/mechanics/levelling/shared.ts:149`; contract sentence `docs/system/mechanics.md:2148` ("never faults").
- Input: bleed sampler plus a kill-1000-XP `level_reached` refill. Player kills the hound at round due 65250, also the bleed tick's due (pending dues `npc` 65250, `bleed` 65250). The player's kill means the round wrote no hp, so the refill takes a fresh group; `statusGroup` (`status/job.ts:264`) looks up bodies only, so the tick takes another group.
- Result: `fault conflicting_write` on hp, clock stays 65150; repeat calls give the same.
- The host cannot pass it (by reading elapsed.ts; ClockDriver not run): `mobile/authority/local-story/elapsed.ts:75` caps `until` at the next due, so it resends 65250, and the Book shows "Time stopped: conflicting_write". `until` 65251 and 65300 also fault; 66000 is accepted, but the host never sends it. Stretch length changes the outcome.
- Control without the refill rule: accepted. The PR lists this at shared.ts:149 as "Not reproduced".
- Repro conditions: a scratch sampler; hound chance and player damage were set in the world to force the round. No shipped cartridge has both a refill and a timed hp job today; `levelling_sampler` has the refill only. Prologue content is the intended user.
- No test covers a same-due refill and hp job.

**Should-fix: the refill overrides the death's return hp.** `shared.ts:144`. Rule on `entity_died` granting the XP: ops hp 10→0, 0→3 (`world.death.restore.hp`), 3→10. Disclosed in the PR; spec silent.

**Should-fix: a negative `by` leaves a living body at hp 0, unkillable.** `lib/loka/content/steps.ex:36` admits it. `by` -2147483647: hp 10→0, no `entity_died`; a rat with 3 damage then hits for two rounds with no hp op and no death. Disclosed without this consequence.

## Focus questions

- Content without level-ups: unchanged by reading and evidence. `pool()` keys are encoded objects, so they cannot equal an id or fact row; the only map iteration (`status/job.ts:286`) relabels values. Seven `.sql` fixtures: green.sql diff is the pin only; all seven have one changed row each. CI green.
- Silent conflict: none found; the conflict faults loudly (the blocker).
- Body at 0 with a refill in the same round: **dead** (`entity_died`, moved to the shrine hall), returned alive at hp 10. Same after a cold SQLite reopen: state bytes identical, and replaying the same elapsed request returns saved at hp 10.

## Test the tests

- `MUTATE_MINUTES=20 bin/mutate_diff.sh origin/main`: 10 of 10 red-narrow, no TIMEBOX; exit 0. The PR did not run it.
- Narrow, singly, with null control: comment change SURVIVED (control). `holders.get(pool(op)) ?? group`→`group`, scan disabled, `at` dropped, `levels[pool(o)]` removed, no-op check removed: all red.
- PR claims rerun: "Not reproduced" (shared.ts:149) refuted above. "compiler rejects" undeclared resource: backed, `Nothing defines the resource`.

## Not checked

NPC-subject level event; non-hp regen pools (both PR-listed open items). The death refill was run with an `entity_died` rule, not a pack round.
