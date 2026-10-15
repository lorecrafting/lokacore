# Review: long-wait mechanics batch (loka-kgd.152 + FD1 + perf), batch head

- Branch `toolbox/batch-longwait`, exact head `abcba9838711c59699038b6c29b8bb4264b2a374`, base `origin/main` 930731e9. No PR (batch model). Fable batch review; each slice already reviewed ([.152](2026-10-14-loka-kgd.152-longwait-review.md), [second opinion](2026-10-14-loka-kgd.152-longwait-second-opinion.md), [FD1 final](2026-10-14-loka-kgd.138-fd1-final-review.md)). Weight on the unreviewed parts: main merge 071955f8, the PM's refusal ruling, perf commits 09074b31/0f6f959f, size marker abcba983.
- Governing: [Delayed reactions](../system/mechanics.md#delayed-reactions-toolbox-row-fd1) (`mechanics.md:3034-3041`); [realm seams](../decisions/owner-decision-realm-seams-2026-10-13.md) Brief checklist 1, 2, 4; `mechanics.md:711` (jobs schedule strictly after the current time); AGENTS.md "Writing tests".
- Verdict: **APPROVE WITH NOTES**. No blocker. One should-fix (a wrong-target case the refusal list misses), one carried-over should-fix, one nit.
- Written 2026-10-14 by anthropic/claude-fable-5-1.

## Must be true (written before the diff)

1. A delayed rule's `job.schedule` stores RS-4's resolved delivery actor; the fire never reads `world.character` (checklist 1, 2).
2. Every step whose effect depends on the event subject, or fans out beyond the stored actor, is refused at load in both kernels or documented as writing nothing at fire.
3. Logical time only (checklist 4); due `max(cause+after, clock+1)` for a root delivery, `cause+after` inside a job run.
4. The perf commits leave the drain's ops and events identical; the "latest position per writer group" index holds under every `merge` remap.
5. The size-marker commit is mechanical and touches nothing else.

## Findings

**Should-fix 1. A delayed `status.apply`/`status.cure` with no `npc`/`item`/`room` lands on the stored actor's body, which for an NPC-subject trigger is the player.** `kernel/ts/src/mechanics/reaction.ts:257` (`subject(cause, body)` fallback), `delayed.ts:50` (stand-in `custom_event`, no subject), `deliveryActor` `reaction.ts:360` (NPC subject that is not a character resolves to `cause.actor_id ?? root`). Scenario: `{on: entity_died (victim an NPC hound), after: 30, apply: [status.apply rotting]}`: the immediate rule rots the hound's corpse; the delayed rule rots the player 30 s later. Same class as the NPC-entrant `quest.activate` the PM refused (`cartridge_delayed.ts:11-18`); not in `EVENT_BOUND`, not in `mechanics.md:3034`. Not live: `cartridges/raid_sampler/reactions/aftershock.json` is `fact_changed` + `fact.adjust`. Fix: either refuse at load, in both kernels (`cartridge_delayed.ts`, `lib/loka/content/delayed.ex`), an untargeted `status.apply`/`status.cure` under `after` when the trigger's subject is not the doer (doer triggers such as `drank`, `custom_event`, `clock_hour`, `quest_resolved` stay legal: "60 s after drinking, apply drunk" is the intended use), or land loka-v86w (store subject on the job) before any cartridge uses `after` with an untargeted status step; and name the limit in `mechanics.md:3034` either way.

**Should-fix 2 (carried over, still open). Choice-before-job precedence not pinned.** `.152` record should-fix 4: `compose.ts:78-81` vs `compose.ex:42-43`; `protocol/fixtures/composition.json` has `job-unrun-faults-in-key-order` but no choice-at-limit-plus-unrun-job case (checked the case list at this head). Condition from the `.152` record: land before the batch head goes ready.

**Nit 1. `proposal_hours.ts:36` relies on an unstated invariant.** `queueScheduled` splices into the array the drain iterates (`for ... of due`); it is correct only because every `job.schedule` from a run is due strictly after the run's time (`mechanics.md:711`; `delayed()` uses `after >= 1`), so the insert lands at or after the cursor. A future op scheduling at `due_time <= now` inside a run would be skipped silently. One-line comment naming the invariant.

## Rulings on the PM's questions

- **Item 2, refusal list.** Complete for everything that reads the event's room or subject in a non-body way: `quest.*`, `population.suppress` (cause room), `barrier.set`, `item.move`, `status.apply` with `co_present`/`tag`, `when` leaf `subject: "subject"` (both kernels; Elixir `@event_bound` matches TS `EVENT_BOUND`). Entity/pair facts without `npc`/`item` write nothing at fire (documented `reaction.ts:266-270`); `population.spawn`, `experience.grant`, player-scope facts and `fact.stamp` are subject-free. The one hole is should-fix 1: the status body fallback. **Known limit, not a blocker**, because no shipped content hits it and `after` is behind kernel_api 1.90; it must not stay undocumented.
- **Item 3, index invariant.** Holds. Compaction (`proposal_hours.ts:67-68`) only collapses when the last indexed position for the key currently carries the new op's group; the consumer needs only the set of groups and "any position >= cut", and `merge` (`status/job.ts:193-197`) remaps whole groups while the index stores positions (reads `all[i].writer_group` live). Non-adjacent same-group positions are simply not compacted (a superset; still correct). `enqueue` back-scan is equivalent to the old forward `findIndex` because `due` is built sorted and never has entries removed. `proposal.ts:297-298`: `own` differs from the committed ops only in `writer_group`, and `joinEarlier` reads `own` only through `opKey` (targets). No behaviour change found.
- **Item 3, `:36` a bug?** No (nit 1).
- **Item 1, merge 071955f8.** `reaction.ts:129-135` keeps RS-4's `deliveryActor`, `npc ||` guard and once-set as `own.seen` (no collision with `status/shared.ts`, barrier or containment readers); FD1's `if (rule.after && !fired) return delayed(...)` sits after `when`. `decision.ts:218` adds `'fact'` to `COMPOSES.schedule` for the delayed `fact_changed`; `proposal_admit.ts:15` checks events only, so `experience.grant` and status in a job run need nothing more. `compose_job.ts` admits `reaction` jobs with `actor_id` and without `encounter_id`; `compose_job.ex` is the twin (times, unrun).
- **Item 4.** `abcba983` changes only `raid.test.ts:1` (698 to 700); the file is 700 lines.
- **Realm seams checklist 1, 2, 4.** Met: the job stores `actor_id` (`compose_job.ts:132`), `runDelayed` passes `row.actor_id` and never `world.character`; logical time only (`due_time` from `cause.logical_time`).

## Mutants (detached worktree `review-longwait`, each reverted; focused files under `nice -n 10`)

- `cartridge_delayed.ts` drop `'quest.fail'` from `EVENT_BOUND`: raid + cartridge tests 104 pass / 1 fail (`FD1: the loader keeps API 1.90 ...`). Caught.
- `lib/loka/content/delayed.ex` drop `quest.fail` from `@event_bound`: `test/loka/content_raid_test.exs` 2/3, 1 fail. Caught.
- `proposal_hours.ts:25` `due_time >` to `>=`: `longwait.test.ts` 2 pass / 1 fail (`enqueue keeps the drain ... order`). Caught.
- `proposal_hours.ts:67` compaction regardless of group: longwait + raid 28 pass / 1 fail (`a later run joins every earlier writer group`). Caught.
- Baseline at the head: longwait + raid 29/29.

## Not done

No full suite, Storybook, e2e or sim; CI on `abcba983` not awaited (PM watches). Elixir twin of the perf code: none exists (perf is TS runtime only). Did not re-run the three prior records' mutants.
