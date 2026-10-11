# Review: M9 NPC movement permits (loka-kgd.102)

- Branch `toolbox/m9-npc-move`, head `f4b48016b0f14b42c460d024b67969f697618fff`, diffed against `d4848cf5` (`toolbox/batch-m9`). No PR (batch model). Installed `kernel_api` 1.62 to 1.63, no field, no floor.
- Governing: [Command blocks on a status, SR4](../system/mechanics.md#command-blocks-and-resistances-on-a-status-toolbox-rows-sr4-and-sr5) (`mechanics.md:2351`, amended here), toolbox row SR4 (`docs/MECHANICS-TOOLBOX.md`), Beads `loka-kgd.102`.
- Hosted ci and book-e2e green on the head (`gh run list --commit`, reviewer).
- Verdict: **CHANGES REQUIRED** (one blocker: five of six mover guards are unpinned).

## Must be true

1. Every NPC mover named in the rule (schedule, wander, refuge, pack flight, crow legs, patrol Continue) leaves an NPC whose statuses bar or leave out `move` in its room.
2. A rooted mover never faults or loops: jobs complete and reschedule at a later time; the crow keeps a valid row.
3. Unrooted behaviour and Chapter 1 receipts unchanged (no status declares `blocks`/`allows` there, so `statusAllows` short-circuits).
4. No import cycle: `status/shared.ts` imports no dialogue or combat module.

## Proof

- Named files green at head: `npc_status`, `patrol`, `patrol_contracts`, `schedule`, `population_composition`, `crow`, `crow_composition`, `e1_creatures`, `transcripts`, `c4_pack_flight`, `hounds`; `npm run typecheck` exit 0. No frozen fixture or expected answer touched.
- 2: crow return retry uses `next(..., job.due_time, 'return')`, due `+interval`, schema `interval minimum 1` (`protocol/cartridge.schema.json:1639`); schedule keeps its own `nextHour` reschedule and emits no `entered` when `stays` (`schedule/rule.ts:112-130`). Rooted outbound leg goes to the existing `discharge(..., 'fallback')`.
- 4: `status/shared.ts` imports only foundation, runtime, `death/shared`, `resource` (which import `attributes/shared`, `position/shared`).
- Mutants (reverted, worktree clean): `moves` forced true (`status/shared.ts:251`) red. Survivors, all green on the named files: `settle.ts:141` guard dropped; `crow/shared.ts:125` `moves` dropped; `crow/job.ts:72` forced true; `patrol/shared.ts:74` replaced by `undefined`; `combat/behavior.ts:70` forced true; `population/behavior.ts:147` forced true.

## Findings

1. **Blocker**, `kernel/ts/test/npc_status.test.ts:351` (only pin). Six guards survive their mutants. Scenario: a refactor drops `crow/job.ts:72`; a rooted crow mid-return walks home, or the `room === home` clause is dropped and a rooted crow at home reschedules forever instead of clearing; nothing fails. Required, three tests: (a) crow return rooted mid-route keeps its room with the row `return` and a job at `+interval`, and rooted at home clears the row (kills both `job.ts:72` variants); (b) patrol Continue on a rooted NPC refused `invalid_state` (`patrol/shared.ts:74`, protocol-visible); (c) one of wander (`settle.ts:141`) or pack flight (`combat/behavior.ts:70`), same shape. Refuge and crow-leg tests not required; the `allows`-omits path is already pinned on `statusAllows` (`status_readers.test.ts:176-180`).

No other findings. Escort and terrain limits are documented (`mechanics.md:2352`, terrain known limit).
