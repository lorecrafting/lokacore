# Review: mechanics batch M12 (Fable batch review, final head)

- Branch: `toolbox/batch-m12`, head `c42b7981b0638677caf4091012bf404ea88e20ce`; base `origin/main` `f359df25` (merged into the batch at `374413a9`).
- Reviewer: Claude Fable 5.1, independent; authored nothing in the batch.
- Governing: [Review stance](../WORKFLOW.md#review-stance), AGENTS.md "Writing tests",
  [composition](../system/architecture.md#building-mechanics-by-composition),
  [Realm seams](../decisions/owner-decision-realm-seams-2026-10-13.md), the mechanics.md sections
  for rows 37a/37b, W13, 39, FD4, W12 and the FD8 bullet under row 31.
- Slices already reviewed one by one (records `2026-10-13-m12-raid`, `2026-10-14-m12-two-shops`,
  `-tracks`, `-pairs`; Beads notes for `.132`, `.145`, `.135`, `.134`). This review is the batch
  angle: cross-slice interactions, the PM's hand merges (`2dba7bcb`, `6ff47306`, `5ca548d8`,
  `548669d8`, FD4 and FD8 merges), the table commits (`92a93d5f`, `c42b7981`).

## Must be true (written before the diff)

1. `kernel_api` 1.89 installed; floors 1.84 (spawn step), 1.85 (trails), 1.86 (W12 fields and
   leaf), 1.87 (`resource_compare` subject/percent, `target` filter), 1.89 (`npc_pair`, `with`)
   each refused below the floor in both kernels; a cartridge at 1.88 (unused) passes every
   1.84 to 1.87 feature and is refused `with`.
2. Chapter 1 and every pre-M12 sampler compile to the same bytes as on `main`.
3. `population/settle.ts`: a spawned member is `held` (no wander, no hunt); W12 `wander_when`
   gates every move including a hunt step; floor refill and hunt read the occurrence's logical
   time, not `world.state.clock` (one long advance must equal hourly steps).
4. facts_typed: a room subject is admitted only for the compiler's trail facts; `with_id` exists
   exactly on `npc_pair` rows; a trail fact is never `npc_pair`.
5. `policy.ts`: `population_count` and `resource_compare {subject, at_least_percent}` both
   evaluate after the import union; `subject` outside a reaction reads the actor's body.
6. `reaction.ts`: `target` filter on `attack_result`; FD4 fact steps take the declared subject,
   never the listener; 37b's `fact_changed` fires once per cycle inside one long advance.
7. Mobile cold reopen: a save holding trail rows (room subject), pair rows (`with_id`), spawned
   members and boss facts reopens to the same world.
8. Realm seams answers agree across rows (world events and pair/trail rows at `instance`).
9. Toolbox table links resolve; the `done` cells name a sampler and section that exist.

## Verdict: APPROVE WITH NOTES

CI on the head: `gh run list --commit c42b7981b0638677caf4091012bf404ea88e20ce` shows `ci` and
`book-e2e` success. Head matches `origin/toolbox/batch-m12`.

## Findings

- nit: `kernel/ts/test/tracks.test.ts` has no cold reopen of a save holding W13 trail rows (room
  `subject_id`); `mobile/authority/local-story/` covers boss, pair facts, raid aftermath and scoped
  facts but not tracks. Failure scenario: a SQLite fact-row decoder that rejects a room id as
  `subject_id` would refuse the reopen and no test would see it. The live invariant
  (`kernel/ts/src/mechanics/fact_typed.ts:52-60`, `trailFact`) is the same code the reopen runs,
  so the risk is low; housekeeping `loka-dgl6` (shared cold-reopen helper per sampler) covers it.
  No new Beads issue.

No blocker, no should-fix.

## Disposition proof (must-be-true list)

1. Floors: TS `cartridge_reactions.ts:93-94` (`minor < floor`), `apiFloor` gives `target` 87,
   `attacker` 58; Elixir `reactions.ex:112-116`, `population.ex:104-106`, `trails.ex:102-104`,
   `scoped_facts.ex:26-28` (`api < [1, 89]` only for `npc_pair`/`with`), `variants.ex:23-26`,
   all list `<` compares, so a 1.88 cartridge passes every 1.84 to 1.87 feature and is refused
   `with`. Installed `kernel/ts/src/runtime/world.ts:107` = `1.89`.
2. Chapter 1 bytes: v042 hash pins pass on the head (TS `d10_contracts`, `d10_knowledge`,
   `e1_dialogue_circuit`; Elixir `content_missing_child_test.exs`, 11 passed).
3. `population/settle.ts`: `held` (`:261-263`) excludes a 37a spawn from `wanderable` (`:276`);
   the W12 `wander_when` gate (`:167`) returns before `wanderOne`, so a W13 `chase` is gated too;
   `gate` (`:55`) and `eligible` read the job's due time; a reaction's `population.spawn` runs on
   the cause's logical-time world (`reaction.ts:120,156`, `population/react.ts:28-30`), so one long
   wait equals hourly steps for the spawn. `fen.test.ts:155,172` pin the gates under one long wait.
4. `fact_typed.ts:28` pins `with_id` exactly to `npc_pair`; `:52-60` admits a room subject only
   for compiler-reserved trail keys (`cartridge_trails.ts:35-40`).
5. `policy.ts` import union (`548669d8`) compiles; fen, boss, tracks, raid suites pass on the head.
6. 37b: `mobile/authority/local-story/raid_aftermath.test.ts:21` counts the aftermath once over
   two new-moon hours across a cold reopen.
7. Mobile reopen: boss, pair_facts, raid_aftermath, scoped_facts tests present; tracks gap above.
8. Realm seams: rows 37b (`mechanics.md:2824`), W13 (`:2855`), 39 (`:2889`), FD4 (`:2918`),
   W12 (`:2952`) all answer `instance` scope, no actor read; consistent with the decision record.
9. Table: all 6 links added by `92a93d5f` and `c42b7981` resolve to existing anchors;
   `mechanics.md` has no duplicate `##`/`###` heading after the hand merge `2dba7bcb` (its
   `world.ts` resolution was the 1.84 to 1.85 bump only; head is 1.89).

## Mutants (focused tests only; worktree restored, `git status` clean)

- M1 `settle.ts` floor refill branch: `fen.test.ts` 2 failures (deer above the floor / floor rebirth).
- M2 `settle.ts` hunt hold in the player's room: `tracks.test.ts` 1 failure (hunter holds).
- M3 boss `at_least_percent` compare: `boss.test.ts` 1 failure (summon at 61% of 100).
- M4 `population/react.ts` spawn slot pick: `raid.test.ts` 2 failures (slot 1 refill, both job orders).

All four red. Logs in the session scratchpad (`m12fable-M1..M4.log`).

## Deferred, not re-raised

`loka-kgd.151`/`.152` (one long wait faults; `boss.test.ts:54` steps by 50 for it), FD1 `.138`,
row 38 `.133`, W12 prey hunt, FD3 `.140`, `.153`, `loka-b60`. No merged slice makes them worse.
