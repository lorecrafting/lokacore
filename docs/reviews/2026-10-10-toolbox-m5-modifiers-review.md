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
