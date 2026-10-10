# Review: mechanics batch M5, Fable batch review (PR #359, loka-kgd)

- PR [#359](https://github.com/lorecrafting/lokacore/pull/359), branch `toolbox/batch-m5`, head `9cd6ab1195a94e1b115f260b64395445a4cf87cb`, diff `068b02c7...9cd6ab11` (267 files). Kernel, protocol and save contracts change (`kernel_api` 1.46, status holders, `started_at`, generic deadline job rows), so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)). One Fable review per mechanics batch head ([review models](../WORKFLOW.md#review-stance)); the eleven per-item Opus records are `2026-10-10-toolbox-m5-*-review.md`.
- Governing: [mechanics.md](../system/mechanics.md) sections G3, 2c, 13/G12, W25, G13, 18/42, W24, W23, W6 (and the reaction@1 table, status row 1); [cartridge.md](../system/cartridge.md) declaration sections; [save.md status and quest deadline recovery](../system/save.md#status-recovery); [composition](../system/architecture.md#building-mechanics-by-composition).
- Hosted CI on the head: ci 38062983451 success, book-e2e 38062983457 success, graph-diff 38062918192 success.
- Verdict: **APPROVE WITH NOTES** (one nit; the stated known limits hold for every shipped cartridge).

## Must be true (written before the diff)

1. Status rows are keyed by holder (body, living NPC, item); every status write on one holder in one advance shares a writer group, and a combat round joins its body's and opponent's group, so no shipped wait faults `conflicting_write`.
2. An NPC's fatal tick runs the death sequence with no killer and ends its other statuses; no later job lands on the dead NPC.
3. Modifiers are read at use (player `value`, NPC `npcValue`), a pure-modifier status has one job (its expiry), a refresh moves `ends_at` only, and the hp settle writes only for a status naming an `hp_max` term on the player's body.
4. `clock_hour` fires once per settlement at the advance target, its successor strictly after; a refresh is silent; need and exposure drains saturate at the pool floor and never kill.
5. A liquid's `cures` ends statuses through the same `cureOps` as Eat; `status.apply` `npc` lands on the authored instance, dead or immune takes nothing.
6. A generic deadline schedules one job per activation at cause time plus `after`, never before horizon + 1; expiry fails only an open instance and emits `quest_failed`; a stale job completes harmlessly.
7. `now()` composes a multi-job advance from the base clock, so job ops `at` their due time lie inside the advance; Chapter 1 and the corpus keep their bytes.
8. Every new field is gated at 1.46 by both the compiler and the loader; older saves (status rows, quest rows without `started_at`, legacy deadline jobs) load.

## Proof

- Focused tests at the head (`nice -n 10`): 16 kernel files incl. `e1_cases` (Chapter 1 traces), 106 pass; `validate` (`invalid.json` "exactly the listed errors") pass; 11 Elixir files incl. `contracts_test`, `registries_test`, 39 pass; mobile `exposure`, `quest_deadline`, `quest_started_at` pass.
- Bytes: every cartridge compiled at base (068b02c7) and head: 35 identical, `ashmere_chapters` sha1 `ee93f779` (PR claim backed); only `derived_sampler` differs (its shrine and `might` are the row 2c sampler change). Replay/receipts: `e1_cases.test.ts` green at the head with its frozen digests untouched.
- Mutants, all killed: M1 `statusGroup` never shares (`npc_status`, `derived_status`: 6 fail); M2 `now()` without the base-clock replay (`derived_status`: the +3600/+3650 wait and the attack_result might fail); M3 deadline `horizon` for `horizon + 1` (`quest_deadline`: 2 fail); M4 refresh narrates (`exposure`: silent-refresh test fails); M6 fatal tick always closes the fight (`npc_status`: lone/pack test fails; this reruns the status record's `status/job.ts:51` cite, backed); M5 Elixir `ComposeQuest.transition` keeps the old `started_at` (`compose_quest_test` fails).
- Probes (throwaway, removed): (A) `derived_sampler`, strong, might applied, attack timed so the expiry and the first round are due at one clock, one elapsed: accepted, str 15 after, dummy hp consistent. (C) Chapter 1 GameView spends 121 (fresh) and 308 (ancestry chosen) query steps of 32768: W6's second variant set per entity cannot plausibly reach `budget_exceeded`.
- Cross-item combinations judged from code: a pure-modifier expiry, an hp tick and a deadline expiry in one advance write disjoint targets or share the holder's group (`proposal.ts:289-293`, `reaction.ts statusStep`); a Drink cure is a root command (no mid-wait path); an NPC dying by tick while buffed ends the buff in the death sequence (`death/sequence.ts:77`) and its pending job completes without a row (`status/job.ts statusHolder`); a repeatable quest re-runs through `quest.retire` (resolved only) plus a new instance, so no stale deadline job can reach a re-activated instance.
- Known limits hold for every shipped cartridge: loka-x2gv (2) needs an hp-ticking status on a fighting NPC; `derived_sampler` is the only combat cartridge with statuses, its dummy has no schedule and its reactions apply pure-modifier `might` only. loka-kgd.50: every shipped `modifies` names `str` or `dex`; every `hp_max` term is `con`. loka-6ztc: the host's `boundary` (`elapsed.ts`) stops at every non-calendar pending job, and the calendar successor is strictly after the target. loka-kgd.43: no cartridge declares both `sight` and `status`.
- Parity: `compose_quest.ex` and `compose_quest.ts` treat `started_at` the same (replaced or removed by each transition); `compose_status` accepts body, npc, item in both; the 1.46 gate sets match (`status.ex api_146`, `cartridge_status.ts api146`: immune, item/npc steps, `status_` triggers, `modifies`, liquid `cures`).
- PM-authored code: `earnedExit` (nit below); `Loka.Content.RecipeTips` mirrors the loader (tip fact only for keys of at most 55 chars, with the matching `SCHEMA_VIOLATION`); e8f8f64f adds five lines to the mobile deadline test (a retired instance's stale job loads), green; `invalid.json` parses and its fixture tests pass in both kernels; `mechanics.md` has no duplicated heading or bullet and every item's section is present; the loka-kgd.50 gating text is in both `mechanics.md` and `cartridge.md`.

## Findings

1. **nit**, `kernel/ts/src/runtime/proposal.ts:208`: `at: Parameters<typeof stamp>[2]` is `number`; write `number` (over-engineering, no behaviour change).

Notes (no finding): the `clock_hour` event and the statuses its reactions apply carry the advance's target, while status and deadline job events carry the job's due time; the spec says so for W25, and through the host a step never ends at the calendar job, so an exposure status applied by the hourly reaction starts at the step's end, up to one elapsed step after the hour boundary. Deterministic under replay; a design note for the W25 follow-up (loka-kgd.47).

Disposition: nothing open on the head; the nit can ride the next fix or merge.
