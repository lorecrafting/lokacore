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

## Re-check at 68bc1582e3436f316555f8ddf3415bae1d74432b

Scoped to the fix commits (`git diff 9d29ad1a5 HEAD`). Verdict: **APPROVE WITH NOTES**. CI at this head: ci, book-e2e and graph-diff completed success.

| Finding | Disposition | Proof |
|---|---|---|
| B1 same-due refill and bleed tick fault `conflicting_write` | Fixed | The first-round probe at due 65250 is now accepted with refill 1 to 10, then tick 10 to 9. `pooled` (`kernel/ts/src/mechanics/resource.ts`) takes the pool's group, else the body's holder, else its own, and holds the body, so `statusGroup` joins. Both job orders save and reopen in `refill_same_due.test.ts`. |
| S1 refill overrides the death's return | Fixed | Probe: ops 10 to 0, 0 to 3; hp stays 3, also at +1 s. Tests cover level_two, an attack_result rule and a delayed rule, each reopened at every prefix; a refill due later in the advance still raises the return. |
| S2 negative `by` | Fixed | `REACTION_DRAINS_BODY` at `lib/loka/content/reactions.ex:160`. `by` 0 compiles. A behaviour's rule is refused too (probe, `behaviours/spoils.reactions.take.steps[1].by`). The negative `by` in shipped content, `furnish_sampler/actions/temper.json:27`, is an action, which the check does not cover. |

Mutants, singly, narrow suite `levelling.test.ts` plus `refill_same_due.test.ts`: the null control survived; red for dropping the body holder from the chain, dropping the pool holder, removing the holder write, removing the death check, `logical_time` check to `true`, `poolWriters(joins.ops, holders)` to `holders`, `position: Infinity` to 0, `by < 0` to `<= 0` and to `< -1`.

Findings:

- nit: PR #566 body, `/code-review` section lines 37-38, still lists the fixed refill and death items as Open at `shared.ts`, a file the code has left. Update it in the fix round.

Writer groups, by reading: bleed (`bleed/job.ts:150`), status (`status/job.ts:72`), rounds and the death sequence hold the body; player-initiated root writes are found by `poolWriters`.

Questions, not blocking:

- `kernel/ts/src/mechanics/water/expiry.ts:24` holds no body, so by reading a refill that writes at a drowning's due, ahead of it, would leave the water job in a fresh group and fault `conflicting_write`, and repeat. Not reproduced: a probe of 59 command ids with a delayed rule due with the water job, all accepted, 26 with the other job first, never produced a refill op. `docs/system/mechanics.md:2148` discloses the class. Is that disclosure enough here?
- `kernel/ts/src/mechanics/escort/job.ts:57` is the same shape, for a refill of a purse pool; read only.
- A death and a refill at one clock split across two stored proposals by a budget stop: `events` covers one proposal, so could the refill miss the death? Reasoned only.

Not checked: the full `bin/mutate_diff.sh`, by the brief.
