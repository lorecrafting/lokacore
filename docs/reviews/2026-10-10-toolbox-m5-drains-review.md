# Review: hunger and thirst drains, toolbox row G13, and W25 `dry` (loka-kgd.36, loka-kgd.44)

- Branch `toolbox/m5-drains`, head `74370920959085753ff4bdbbec576eb0eccace2e`, diff `e8f8f64f...74370920` (33 files); no PR yet (batch M5). Kernel and protocol contract change (`LiquidDefinition.cures`, `kernel_api` 1.46), so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [toolbox rows G13 and W25](../MECHANICS-TOOLBOX.md#ranked-toolbox), [mechanics.md G13/W25 dry](../system/mechanics.md#hunger-thirst-and-dry-days-toolbox-rows-g13-and-w25-dry), [row 1](../system/mechanics.md#status-effects-over-time-toolbox-row-1), [cartridge.md need declarations](../system/cartridge.md#need-declarations), briefs in Beads `loka-kgd.36` and `loka-kgd.44`.
- Hosted CI on the head: ci 38060228661 success, book-e2e 38060228574 success.
- Verdict: **CHANGES REQUIRED** (one surviving mutant on the Drink-only guard; one merge instruction for row 2c).

## Must be true

1. Hunger drains one point an hour; bread ends the drain (G13 proof).
2. A drought day on exposed ground drains thirst until any drink; the drain refreshes silently, expires in shelter and never kills (thirst floors at 0, hp untouched).
3. Liquid `cures` is accepted and refused the same way by the schema, the TS loader and the Elixir compiler, at the same `kernel_api` floor.
4. A Drink cure ends statuses as Eat does; after row 2c it also settles a derived hp maximum before the status ends.
5. Chapter 1 bytes unchanged; no source `size: allow` raised; capability code names no content.

## Proof

- Baseline green: `needs`, `food`, `liquid`, `status` (TS); `content_needs_test.exs`.
- Killed: M1 Drink drops cure ops (`needs` both drain tests); M2 `cureOps` filter negated (`needs`, `status`); M4 loader g3 without `drinks.length` (`needs` loader test); M5 Elixir `api_146` without `drinks(defs)` (`content_needs_test.exs`).
- Survived: M3, see finding 2.
- Silent refresh (W25 ruling): a throwaway probe on the flats over three drought hours saw six `status_ticked` events for `parched` and no re-apply event; the hourly reaction takes `applyStatus`'s active branch, as W25's test covers.
- Proof judged met: the row says "bread ends it" (the drain); refilling a need pool is not in the row. Open item: no restore path for a need pool (engine; Beads comment on `loka-kgd.36`).
- Chapter 1: `mix loka.compile cartridges/ashmere_chapters` byte-identical at base and head (sha1 `ee93f779`). `bin/check_size.exs`, `bin/check_ts_size.mjs` exit 0; no `size: allow` line in the diff.
- Fixtures: `invalid.json` addition only. Developer cite `liquid/shared.ts:83-88` and the "thirst 0, hp 10 after a drought day" claim checked: both hold (`kernel/ts/test/needs.test.ts` drought test).
- Trial merge onto `origin/toolbox/batch-m5` (b8c45a8d): conflicts in `food/shared.ts`, `cartridge_status.ts`, `status.ex`, `invalid.json`, `mechanics.md`, `system-graph.gen.json`, `toolbox.gen.json`; `status/shared.ts` merges cleanly.

## Findings

1. **should-fix (merge)** `kernel/ts/src/mechanics/status/shared.ts:124`: `cureOps` maps `endStatus`. Row 2c replaced that with `expire` (settle hp, then end). `status/shared.ts` auto-merges, so resolving the `food/shared.ts` conflict with the branch's `cureOps` drops 2c's settle: `derived_status.test.ts` "a tonic cures a refreshed might ... hp reads 10 of 16" fails, and a Drink cure of a modifying status would settle nothing with no test to notice. Order: Drink adjusts no pool (B7), so appending its cures after `plan.ops` cannot misread hp; only Eat's order matters. Resolution checked: `.flatMap(({ status, row }) => expire(world, body, status, row, 0))` in `cureOps` and Eat's `...cured` before the meal's gain; then `derived_status`, `derived`, `needs`, `status_composition`, `npc_status`, `food*`, `liquid*` pass. In the same merge, combine `api_146` with 2c's `modifies` (both kernels) and add the hp settle to the composition record's writes (`docs/system/mechanics.md:2005`).
2. **blocker** (surviving mutant) `kernel/ts/src/mechanics/liquid/shared.ts:85`: removing `|| p.type !== 'drink'` (Pour also cures) stays green on `needs`, `food`, `liquid`, `status`. Failure: a regression lets pouring the waterskin onto the ground end `thirsty`. Add one Pour assertion to `needs.test.ts`.
3. **nit** No PR body reports the developer's `/code-review` result (commits cite "review finding 8"); the batch M5 PR body must.
