# Second review: cartridge fault batch, PR #545 (loka-vduxr.7, save behaviour)

- PR [#545](https://github.com/lorecrafting/lokacore/pull/545) `engine/cartridge-faults` at `6e470c5c60f237ef4851fd021c8b0f2cda424b43`.
- Governing: `br show loka-vduxr`, B1, B2, each bead in the PR body; [Review stance](../WORKFLOW.md); [storage lessons](../lessons/storage.md); `docs/system/mechanics.md` (plan move, status, escort).
- Reviewer: independent; authored none of the work. Does not repeat the [first review](2026-10-31-loka-vduxr.7-cartridge-faults-review.md); its rulings stand.
- Verdict: CHANGES REQUIRED.
- CI at the head (`gh run list --commit`): ci, book-e2e, graph-diff completed success.

## Must be true (written before reading the diff)

(a) Any state lawful play writes reopens identically through `openGame`. (b) The loader still refuses forged rows. (c) No mover separates a following escort; a non-following one is not held. (d) An eaten holder's status ends silently; row and job reconcile. (e) A blow never takes hp below the floor or heals; death at 0 still fires. (f) Receipts unchanged for content not involved. (g) A compile refusal refuses only content that faults, and what compiles does not fault.

(a), (c) behaviour, (d), (e), (f) hold. (b) and (c) are not pinned; (g) has a gap.

## Findings

**Blocker: nothing pins `!s.npc`. `kernel/ts/src/runtime/created.ts:113`.**
`(s.plan ? key(s.plan) === key(plan) : true)` is green on all 15 test files naming `hydrate`, `save_corrupt` or `restorable`. In that state, with a rule `npc.move {npc: guard, room: vault}`, a save forged to put a plan's member in `vault` passes the loader. The forged-row test in `settle.test.ts` names no such rule. Throwaway copy of that test with `npc.move {npc: raider, room: hills}` and a member forged to `hills`: head refuses, mutant loads it, test goes red. Must-be-true (b). Fix: add that move to the test's rules.

**Blocker: nothing pins `e.status === 'following'`. `kernel/ts/src/mechanics/escort/shared.ts:115`.**
`e?.npc_id === npc` is green on all 8 test files naming escorts. Throwaway test: rescue, `fallInCellar` (status `separated`), child's schedule `20: village_green`, `elapsed(w, 72000, 200)`. Head: the child walks to `village_green`. Mutant: it stays in `lantern_cellar`, the test goes red. This clause now also gates `schedule/rule.ts:150`, and the first review's `&&` test covers another NPC, not this one. Fix: that test.

**Should-fix: kgd.104 still faults through a custom event. `lib/loka/content/reactions.ex:62`.**
`timed_status` covers only `action_completed`. Copy of `identity_sampler`: no `time_policy`, no `regen`; `actions/don_hood.json` `duration: 5000` with step `event.emit hood`; `reactions/hood.json` `on {event: custom_event, custom: hood}`, step `status.apply disguised`. `mix loka.compile` accepts it; every cast returns fault `precondition_failed`; same on main. At `duration: 300` the same content works, so the fault turns on the action's duration against the status's first tick (`next_tick_at` 3600), not the event type; by reading, other events raised during the action (`fact_changed` from a `fact.set`) take the same path. No save harm: reopen succeeds. Must-be-true (g). Fix: refuse the whole class, or reopen the bead narrowed to it; the developer's choice.

**Question: conflicting_write wedge, not from this PR.** `reactions_sampler` crow plan plus a `clock_hour` `npc.move {plan: crow, room: reed_path}`: seed walker, pulse 23 at about time 68250 returns `conflicting_write` and every later command faults, `look` too. Main gives the same receipts. By reading, the crow job's transfer earlier in the advance is not in `holders`. kgd.159 names spawn plus move only. Should this have its own bead?

**Question: raid and boss sampler views differ on reopen** only in the order of `exits[].sight.entities`, on main too. Cosmetic.

**Nit: `lib/loka/content/reactions.ex:66`.** A rule with `on.action` nil and a `when` that excludes the timed action is refused though it cannot fault. Naming its action is the workaround.

## Checked, no finding

- Receipts (f): walker, 80 rounds, 17 samplers, 3 seeds, head against merge base: every sha identical.
- Reopen (a): plan-moved members, 60 rounds, seeds 1-3, cold reopen: no refusal at head; main refuses `save_corrupt`. Eaten status via `decay_sampler` with food, reopen at each stage, 14 pulses past the end and a catching-up absence (#535 fold, #541 refusal both in the head): all open; final row `{"active":false,"generation":1}`. Escort with schedule: rescue, move, 4 hours, reopen each stage; child stays. Hp floor: `boss_sampler` floor 1 (294 attacks, 0 deaths), floor -5 (2 deaths), state rows equal after reopen every 3 rounds.
- Mutants, source restored, null green: `homeRoom` any plan, area only, slot origin area only (`deer.test.ts`), spawn no holder, schedule ignores escort, react move ignores escort (`reactions_sampler.test.ts`), eaten keeps ticking, floor ignored, floor negative all red. `if (!loss) return` stays green: pre-existing, ruled follow-up.
- A hand-edited canonical giving `duration` plus `time_policy` reopens `save_corrupt`, but the compiler refuses that pair (`scripted_actions.ex:88`): unreachable, no finding.
- Claims rerun: `transcripts.test.ts` passes (PR body line 19); `round_attack.ts:92` cite right. Story SQL diffs are `kernel_api` lines only. Compile refusals: no sampler refused.

Not checked: escort quest's `keeper_home` end through a later hour; no full-suite or `mutate_diff` sweep (brief).
