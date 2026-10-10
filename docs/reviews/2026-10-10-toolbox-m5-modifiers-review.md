# Review: toolbox row 2c, status modifiers on attributes (loka-kgd.34, batch M5)

- Branch `toolbox/m5-modifiers`, head `319f597b62c81f9f0f00e468ca885993c5004d4a`, base `6e9401ac` (merge-base with `toolbox/batch-m5`); no PR (batch branch). Protocol schema and `kernel_api` change, so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [row 2c](../MECHANICS-TOOLBOX.md#ranked-toolbox); [mechanics.md](../system/mechanics.md) rows 1, 2, 3, G3 and the new row 2c section; [cartridge.md](../system/cartridge.md#status-declarations); PM rulings in Beads `loka-kgd.34`.
- Hosted CI on the head: ci 38053580548 and book-e2e 38053580541, both success.
- Verdict: **CHANGES REQUIRED** (one blocker, two should-fix).

## Must be true

1. A modifier is read at use from the active status row; no attribute writer or save row; replay unchanged.
2. Only active statuses count; different statuses sum, one status counts once; expiry, cure and death drop it.
3. Player `value` and NPC `npcValue` both include it, so every attributes@1 reader and row 2's tables see it.
4. A derived hp maximum is settled before every change of it (first apply, expiry, cure), and every such path composes.
5. Both kernels refuse an unresolved attribute and a floor below 1.46.
6. Chapter 1 and corpus bytes unchanged; no raised size allowance; docs match code.
7. PM ruling: a status with `modifies` may omit `per_tick` (no tick job or line, expiry kept).

## Proof

- (1, 2, 3) `attributes/shared.ts:69` reads `activeStatuses`; nothing written. Mutants on the focused files (derived, npc_status, status, food, attributes, npc_attributes): `npcValue` without modifiers caught; attribute filter dropped caught; apply without settle caught (`derived.test.ts:290`).
- (4) Expiry/cure without settle (`status/shared.ts:71`) **survived**. Probe: hardy (hp 10 of 16) takes a `con −6` might: at expiry hp is 10 of 16 with the settle, 15 of 16 without it.
- (4) Food cure ordering: ops `[hp +2, ...expire]` on the player with a con-modifying status and derived hp: compose faults `precondition_failed` on hp; settle-first order composes.
- (5) Elixir mutant dropping `modifies` from the 1.46 gate fails `content_npc_status_test.exs`; TS cases at `derived.test.ts` and `npc_status.test.ts` loader tables.
- (6) The 39 cartridges this branch does not edit (Chapter 1 and every sampler but `derived_sampler`, `npc_status_sampler`) compiled with base and head Elixir: identical bytes; the head TS loader accepts all 39 base artifacts. No `size: allow` added or raised.
- Trial merge with batch `07b0bd7d`: one conflict in `docs/system/mechanics.md` (G3 section and W23 tail). Resolve: take the batch side in the G3 section but keep this branch's linked, built-tense **Reuse** bullet; in the W23 tail drop the duplicated G3 bullets (batch side empty) and keep this branch's `## Status modifiers (toolbox row 2c)` section whole.

## Findings

1. blocker, `kernel/ts/src/mechanics/status/shared.ts:71` (`expire`): the expiry/cure settle has no test; removing it leaves the suite green. Failure: a con-lowering status pays out an hour of regen at expiry (10 to 15 of 16 above). Add the probe as a test (negative con modifier, expiry), plus a cure case (an edible eaten at full hp, `by` 0, already reaches the cure settle today).
2. should-fix, `kernel/ts/src/mechanics/food/shared.ts:57-58`: the food adjust precedes `...cured`, whose settle carries `from` read before the food. Eating an hp-restoring edible that `cures` a modifying status on a derived-hp cartridge faults `precondition_failed`. Fix: put `...cured` before the adjust; the probe shows settle-first composes (recomputing `by` against the post-cure maximum is optional). Row 18 content will reach this. Job runs (`runtime/proposal.ts` `jobs`) decide on the prefixed world, so ticks and expiries at one clock are not affected.
3. should-fix (PM ruling), `protocol/cartridge.schema.json:2384` (`per_tick` required), `status/shared.ts:117,129`, `status/job.ts:45,67`, `view/view.ts:84`: today a modify-only status must tick a nonzero pool every `tick_every`, emit `status_ticked`, and show the tick line whenever the pool is not at its bound (`might` ticks mv +1). Smallest fix: `per_tick` optional only with `modifies` (both kernels refuse otherwise; making `tick_every`, `resource`, `narration.tick` optional too is optional); apply sets `next_tick_at = ends_at` so the one job is the expiry; in `runStatus`, `due` is false without `per_tick` and the successor goes to `row.ends_at` (a refresh moves `ends_at` past the pending job, which would otherwise re-fire at the same clock); `ConditionView.per_tick` optional and its Book renderers (`mobile/app/book/model.ts:25`, `mobile/app/book/Status.tsx:92`) show no tick part without it; invalid fixtures; `might`/`fury` drop `per_tick`; one test: no `status_ticked`, no tick line, expiry after a refresh at the new `ends_at`.
4. nit, `protocol/entity.schema.json:125`: "or an active status its holder" lacks a verb ("grants its holder").
5. note (designer, no action here): the Character page value includes the status bonus while "(+N worn)" counts items only.

## Re-check: fix rounds 1 and 2 (head `0328fa1a63228f58539165ae461a16c25ab8be39`)

- Scope: the fix commits `1096edea`, `2ab84801`, `ccb7cc1f`, `0328fa1a`, plus a broad read of all of `kernel/ts/src/runtime/proposal.ts` (round 2 rewrote `now()`, WORKFLOW step 6). Hosted ci and book-e2e on the head are green (ci 38058327525, book-e2e 38058327531).
- Verdict: **APPROVE WITH NOTES** (no blocker or should-fix; three deferred writer-group items noted, none reachable by a current cartridge).

### Round 1 dispositions

- B1 fixed: `derived_status.test.ts` covers expiry (tickless con −6 after a refresh, hp 10 of 16) and cure (a tonic eaten at full hp). Mutant: settle filter widened to any `modifies`: caught by the settle-filter test.
- S2 fixed: `food/shared.ts` puts `...cured` before the meal's gain. Mutant: order reverted: caught (`hp 12 of 16` test).
- S3 fixed: `per_tick` is optional only with `modifies` (schema, `cartridge_status.ts`, `status.ex`); apply sets `next_tick_at = ends_at`; `runStatus` is never due without it and `untick` moves the successor to the refreshed end; `ConditionView.per_tick` is optional; the Book drops the tick part (`model.ts`, `Status.tsx`, story). Mutants: `untick` removed: caught; TS loader check dropped: caught; Elixir check dropped: caught (`content_npc_status_test.exs`).
- N4 fixed (`entity.schema.json:125`).
- Settle limited to statuses naming an `hp_max` term (`status/shared.ts:67`): sound; no extra hp write for a str-only status.

### Round 2 (`now()` and round groups)

- `now()` (`proposal.ts:129`) now composes the later slices from the base clock with the advance replayed, which is what `adopt` does (it applies all ops to the base world). Before, later slices composed at the advance's end clock, so a job op `at` its due time failed (`now < state.clock`) whenever another job followed. The world it returns still has the end clock. Mutant: old `now()` restored: caught (con −6 expiry plus round test).
- Round groups (`status/job.ts` `statusGroup`): a round with no status holder gets `p.group + 1` as before, so status-free play has the same groups. Mutant: round ignored: caught.
- Replay and receipt bytes. Chapter 1: the E1 suite (`kernel/ts/test/e1*.test.ts`, files unchanged) was run at base `6e9401ac` and head with the case host's records (invocations, replies, saves, digests, state hashes; 4939 lines, 384 with elapsed, 318 with attacks) also dumped in a fixed order: the two dumps are byte-identical. Corpus: `simulate` seeds 1 to 400 over the `cartridge_*hash.json` cartridges give the same digests at base and head. Chapter 1 (v042 pin) with ten trusted elapsed windows from 1 s to 100000 s: every decision accepted at base is byte-identical at head. The only change is a 5000 s window that faulted `precondition_failed` at base and is accepted at head (51 ops). That is the fix itself; the host ends an elapsed step at each due job, so real play never sent such a window.
- Two rounds of one encounter cannot share an advance (the second faults `nonfuture_job`, probed), so within one encounter the round's group reuse comes only from status jobs or reactions on its bodies (two open encounters on one body in one advance not checked).

### Deferred writer-group items (judged)

1. A round paired with a bleed (`proposal.ts:289-292`, `bleedPairs` first) skips `statusGroup`; a status writing that body's hp in the same advance would then hit `conflicting_write`. The same holds for a bleed job and a status job on the player's hp. Unreachable: no cartridge has both statuses and bleeds (statuses: derived, exposure, npc_status, status samplers; bleeds: `ashmere_missing_child` and `r9c_interactions`, neither with statuses). Keep under loka-x2gv.
2. A round whose body and opponent already hold different groups keeps the first (`status/job.ts:189`, ponytail comment), so the other holder's status write conflicts. Needs statuses on both sides of a fight; only a test-modified derived sampler does that today. Keep under loka-x2gv.
3. A round joining a lower status group makes groups non-monotonic; when a sight job completes in the same advance, `sightHandoffValid` refuses it. The same class as the G3 reuse (loka-kgd.43); no cartridge combines sight packs and statuses. Keep under loka-kgd.43.

- loka-x2gv: resolved for a status job or reaction and a combat round on the same body or opponent, in either order (tests at `derived_status.test.ts`, red controls above). Still open for items 1 and 2: narrow it, do not close it.
- loka-kgd.50 (hp maximum read from the proposal base, PM ruling): no current cartridge reaches it; `might` and `fury` modify str only, and no status names an `hp_max` term.
