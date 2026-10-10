# Review: toolbox row G3, statuses on NPCs and things (loka-kgd.33)

- Local branch `toolbox/m5-status`, head `5ed3f6e8c057fecca5859ee8010b4382c6261dc0`, base `bb7a62ec`; no PR yet (batch M5). Fresh Opus reviewer; record kept because the slice changes the status save row, composer and protocol ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [row G3](../MECHANICS-TOOLBOX.md#ranked-toolbox); [status row 1](../system/mechanics.md#status-effects-over-time-toolbox-row-1); [reaction@1](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts); [loot row 8](../system/mechanics.md#loot-tables-and-random-drops-toolbox-row-8); [status composition](../system/protocol.md#status-composition); [status recovery](../system/save.md#status-recovery); [slice process and traps](../MECHANICS-TOOLBOX.md#toolbox-slice-process).
- Scope (PM ruling): statuses only; NPC attributes split to loka-kgd.42, not reviewed.
- Verdict: **CHANGES REQUIRED** (one blocker, two should-fix, two nits).

## Must be true (written before the diff)

1. The status row stays `{kind: status, body_id, status}`; the player's key is unchanged, so old rows and pending jobs load and run as before.
2. Both composers accept a body, NPC or item holder and refuse any other kind, fixture-backed.
3. `immune` stops the apply itself: no row, no job, no tick.
4. An NPC fatal tick runs one death sequence with no killer and no credit, any drops drawn from committed RNG state (replay-safe), and leaves no active status on the dead NPC.
5. `status_ticked` / `status_expired` reach reactions, and the documented composition (a `status.apply` on the tick's subject) works.
6. New fields gated at `kernel_api` 1.46 in compiler and loader alike; Chapter 1 and corpus bytes unchanged.
7. The group-sharing change in `runtime/proposal.ts` affects only status jobs on one holder.

## Proof

- (1) `status/job.ts` `statusHolder` scans for the active row owning the job id; for the player that matches row 1's `currentStatus` + `job_id` check. Scratch mirror of `mobile/authority/local-story/status.test.ts` on `npc_status_sampler` (real SQLite: 07:00, reopen, one active guard row, +60 s: hp 9, `groaned` true): **pass**.
- (2) `status_composition.json`: `not-a-holder-refused` (room) plus npc and item first-generation cases. Elixir mutant (`~w(body)`) fails `core/status_test.exs`. The rename and the `invalid.json` move (status_ticked is now a known variant, so the unknown-variant case uses `status_cured`) are justified and weaken nothing. The row 1 subject test now asserts the holder id instead of a count, which is stricter.
- (3) Mutant: drop `immune(...)` in `applyStatus` fails npc_status test 1.
- (4) `accepted(..., died.rng)` → `proposal.ts` `p.rng = ran.rng`. Drops roll from threaded, committed state, so the result is deterministic on replay and matches row 8's draw rule, but outside the combat round. Loot row text updated. Mutants: drop `clearStatuses` for NPCs, drop `living()`, drop status group sharing, drop the `!holders.has` guard: all fail `npc_status.test.ts` (the group mutants fault `conflicting_write`, as the handoff claims).
- (6) TS and Elixir gates match (`rowG3` / `row_g3`). Elixir mutant (1.46→1.38) fails `content_npc_status_test.exs`. No file under Chapter 1 or another cartridge changed. Only `status_sampler` used `status.apply` before, with player-only subjects.
- Focused runs at head: 9 TS files (npc_status, status, status_composition, validate, loot, reactions, reactions_sampler, death, c5_bleed_death) green; 3 Elixir files green. Hosted ci and book-e2e green (PM).
- Trial merge into `origin/toolbox/batch-m5` (`45e12917`): conflicts only in `docs/system/mechanics.md` (two appended sections at the end) and the generated `docs/system-graph.gen.json` and `docs/toolbox.gen.json`. batch-m5 keeps `INSTALLED` at 1.45, so there is no version clash.

## Findings

1. **blocker**, `kernel/ts/src/runtime/proposal.ts:294-295` with `mechanics/reaction.ts` `statusStep`: a `status_ticked` or `status_expired` reaction that applies the same status to its subject (the path `docs/system/mechanics.md:1917` documents) writes that status row in the reaction's writer group, while the job already wrote it in its own group. Scratch runs on `npc_status_sampler`: `groan` plus `status.apply poison` faults `conflicting_write` on the guard's status row at 07:01; `charred` re-applying `burning` on expiry faults the same way on the door. The elapsed command faults at that clock on every retry, so time cannot advance. This case is new in G3 (before it, status jobs emitted no events). Fix: run the job's own reactions on that row in one group, or refuse the composition in both kernels and say so in the spec. Add a test.
2. **should-fix**, `kernel/ts/src/mechanics/status/job.ts:51`: the encounter-close branch for an NPC fatal tick has no test. Mutants `true` (a pack's encounter closes when one hound dies) and `player` (a lone NPC's encounter stays open on a dead body) both stay green on npc_status, status, death, loot and c5_bleed_death. Scenario: a hit applies poison to a hound (attack_result subject is the target) and the hound dies on a tick. Add a test, or a Beads follow-up the PM accepts.
3. **should-fix**, `kernel/ts/src/mechanics/reaction.ts:139-140` and `docs/system/mechanics.md:1774`: dedupe is keyed by status only. One rule with `{burning, item: door}` and `{burning, item: table}` burns only the door. Holders do not collide in state (each holder has its own row key); the second step is just skipped, as the row 1 sentence says. G3's `item` field makes this a realistic loss. Key the set by holder and status, and amend the sentence.
4. **nit**, `kernel/ts/src/mechanics/status/shared.ts:56`: the comment "authored instances only" is wrong. `runtime/created.ts:87` copies the template, `immune` included, onto spawned NPCs, so they are immune too (as is `docs/system/mechanics.md` "on that authored instance").
5. **nit**: the handoff reports 16 mutants but no PR body yet. The `/code-review` result must be in the batch PR body.

## Other items checked

- Coordinator item 1 (tick vs reaction or combat groups): the combat or bleed case is pre-existing for the player and deferred to loka-x2gv (P2). That is acceptable, but it must land before any row that composes combat with statuses (12, 29b, W21). The reaction case is new: finding 1. Item 2 (dedupe): confirmed as finding 3; there is no state collision across holders. Item 3 (malformed reaction crashes `status.ex`): **dismissed**. Compiling with `on` or `apply` removed or mistyped returns `SCHEMA_VIOLATION`, because the schema check runs before `Loka.Content.Status`.
- Open item (b): a committed NPC SQLite reopen test is **not required**. The scratch mirror passes. Persistence is key-agnostic and the player reopen test already covers `statusHolder`, so no distinct break remains for that layer ([one test per break per layer](../../AGENTS.md#writing-tests-every-change-every-agent)).
- Disputed self-review finding 5 (status.apply needs the actor's body): the developer is right. A Story actor always has a body.
- loka-pyez (an item's status outlives a consumed item): a reasonable deferral. The ticks and the expiry are harmless and add no pool writes.
- Ungated events change `status_sampler` receipts (a `status_ticked` at every player tick). The spec says so, and the pre-production rule allows it.
