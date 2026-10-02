# Review: Early R7/R8 Q-fix, quest delivery eligibility at emission and delivery budget

- PR: #96 (branch `r78-qfix`)
- Commit reviewed: `9575a005a9f6e5a269bf7b9e4a83fcb9d423f22d`
- Reviewer: independent Opus reviewer (authored none of the work)
- Verdict: **APPROVE WITH NOTES**

## What must be true (from the spec, written before reading the diff)

1. 04 §5.2 step 5 and QuestObjective `post_activation_event` (docs/contracts.gen.md:443): an
   event's eligible quest instances are fixed at its emission position. An acquisition after an
   activation in the same sequence is eligible; one before it never is, even when delivery happens later.
2. Step 5: delivery visits that captured set and checks the current overlay. An instance the
   decision already moved out of `active` is skipped silently (brief).
3. 04 §5.4: every eligible delivery counts toward the one `deliveries` budget (8192) shared by
   root, reactions and jobs. 8192 is accepted and 8193 is `budget_exceeded`, with nothing committed.
4. Stable delivery order: DefinitionRefString, then instance id.
5. The same capture applies to every sequence that can emit: root, reaction and job.
6. Elixir parity, if Elixir has a twin.

## Checks against the list

1. Met: `proposal.ts:196-214` keeps a per-position `active` map seeded from the state before the
   sequence and updated by `quest_activated`/`quest_resolved`, with rows read in `after`. Both
   orders are tested (`quest_delivery.test.ts:128-155`).
2. Met: `proposal.ts:228-232` charges first, then skips an instance that is no longer active.
3. Met: the 8192 and 8193 cases are in `quest_delivery.test.ts:205-231`. Their expected values are
   hand-derived (8x1024, 9+8x1023) and the 1025 events stay under the 4096 events limit.
4. Unchanged (`quest.ts:61-65`).
5. Root: `proposal.ts:168`. Job: `:275`. Reaction sequences join with no events
   (`:251`), and `factChanged` adds only fact_changed, so they cannot emit acquisitions.
6. None: `lib/loka/core` has no delivery or post_activation code (only compose/invariants mention quests).

No protocol fixtures or schemas were touched. The only changed expectation is the old wrong
exclusion, which the brief asked to correct.

## PM ruling: activation then acquisition faults `conflicting_write`

Confirmed as safe and unreachable today. The only rule that activates is `rules/quest.ts:15-18`
(accept_quest), and it emits only `quest_activated`. The fault discards the whole proposal, so
nothing wrong is committed. R1's `composition-cases.json` "activation-before-emission" expects a
delivery, but its rule writes a different target, so it does not contradict the fault. The carry
to chapter-one content stands.

## Ponytail known limit (`proposal.ts:187-188`)

Acceptable. No shipped op moves an instance out of `active` inside one sequence without an event:
`resolution` emits `quest_resolved` (`quest.ts:93-100`), and delivery transitions land in `react`,
where later joins see them through `now()`. The worst case is overcharging the budget. A delivery
is never wrongly credited, because the current-state skip still applies.

## Mutants (throwaway detached worktree, `node --test test/quest_delivery.test.ts`)

| Mutant | Result |
|---|---|
| M1 post-increment charge (`p.deliveries++`, one fewer counted) | killed (5 failures) |
| M3 `earned(before, …)` (rows from before the sequence, new instance missing) | killed (3) |
| M4 unknown instance treated as active (`!== false`) | killed (3) |
| M6 activation/resolution events ignored in `active` | killed (5) |
| M5 `before = p.world` instead of `now(p)` | **survives**: equivalent today (see nit 2) |

## Findings

1. **nit**, `kernel/ts/src/proposal.ts:251`: `react` discards `join`'s new return value.
   Today it is always `undefined`, because `evs` is `[]`. If a reaction sequence ever emits an
   acquisition, a compose fault from `join` would be dropped and that sequence's events would never
   be queued. `adopt`'s full recompose would probably still fault, but the deliveries would already
   be lost. Use `?? ` or return it as the job path does (`:275`).
2. **nit**, `kernel/ts/src/proposal.ts:198`: `before = now(p)` matters only for a job that emits
   `item_acquired`, and no job does. Mutant M5 survives the suite. This is not wrong today. Add a
   test when a job can emit an acquisition.

Open items: the activation-then-acquisition fault (PM ruling, carried).
