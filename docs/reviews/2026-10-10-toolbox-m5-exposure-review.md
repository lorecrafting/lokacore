# Item review: toolbox row W25, exposure (loka-kgd.39, batch M5)

- Local branch `toolbox/m5-exposure`, head `0fbf2d6b975b4c56eda6a4c87ad7ffeaeea39f69`, base `45e12917` (batch-m5 when the branch was cut). Trial merge into `origin/toolbox/batch-m5` `9a9a97d5` (adds row G3). No PR yet (batch lane). The slice changes protocol schemas and `kernel_api` (1.46), so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [toolbox row W25 and Traps](../MECHANICS-TOOLBOX.md#ranked-toolbox); [mechanics.md](../system/mechanics.md) row 1 statuses, G1 leaf set, G2 resistances, row 31 sky, M1-A elapsed; [book-ui.md](../system/book-ui.md) conditions; PM rulings in Beads `loka-kgd.39` (2026-10-10 11:47).
- Hosted on the head: ci and book-e2e, both success (`gh run list --commit`).
- Verdict: **CHANGES REQUIRED** (one blocker, two should-fix).

## Must be true

1. `wearing {tag}` follows the G1 leaf-set rule: one owner, schema branch, invalid fixtures, a `holds()` case, no `LEAF_REFS` entry because it names no definition. Worn means slot holders only.
2. The four tags are in the closed `Tag` enum. A `Resistances` member per tag follows the row 31 `exposed` precedent.
3. `clock_hour` comes from one calendar job per world and only when a cartridge opts in. Chapter 1 and the corpus are byte-identical. After a long gap one settlement emits at most one `clock_hour`, and a test proves it.
4. Status re-application follows row 1: a refresh while active keeps the generation; a re-application after expiry or cure opens the next generation. No stale job acts on a new application.
5. A refresh is silent: the applied line comes only on first application (PM ruling 2). Real-time drains are gentle (trap 6), and the sampler cannot kill (PM ruling 3).
6. The host elapsed change is safe for every other job kind and on replay and reopen. The TypeScript and Elixir `kernel_api` floors agree.

## Proof

- (1) `capability_registry.json`: `wearing` under equipment@1; `policy.ts:69`; 4 new `invalid.json` rows. `attributes/shared.ts` `wornItems` reads slot holders only. Mutant: treat carried items as worn. Result: `exposure.test.ts` red.
- (2) Accepted. `Resistances` is keyed by every `Tag` (G1/G2; row 31 `exposed`).
- (3) `firstClock` (`schedule/behavior.ts:85`) returns `{}` before it mints, so no ids shift. Only `cartridges/exposure_sampler` changed, and CI is green. Catch-up is tested in `kernel/ts/test/exposure.test.ts:95` (one firing at 10h+1800; the next due at 11h) and in `mobile/authority/local-story/exposure.test.ts:33` (real driver: one firing). Mutants, all red: successor computed from its own due time (4 failures); event stamped at `row.due_time` (2); host boundary not skipping the calendar job (`mobile/.../exposure.test.ts` red).
- Stamp dispute: accepted. The event carries the step clock. `applyStatus` and the `sky` leaf read that same committed clock, and it is in the same hour and day as the last boundary. In host steps every other due job is a stop, so it lands exactly at the step's target.
- (6) `elapsed.ts:67` skips only kind `calendar`. Bleed, status, population and deadline jobs still bound the step. The calendar successor and every status a reaction opens are due strictly after the target, so the `already-due` guard still holds. Host reopen test, plus the elapsed, elapsed-driver, r9c and status host files: green on head and on the merge. Elixir red control: dropping `clock_hour?` from `exposure.ex` turns `content_exposure_test.exs` red.
- Trial merge: conflicts in `docs/contracts.gen.md`, `docs/system-graph.gen.json`, `docs/toolbox.gen.json`, `kernel/ts/src/contracts.gen.ts` (regenerate), `docs/system/mechanics.md`, `protocol/event.schema.json`, `protocol/reaction.schema.json` and `protocol/fixtures/invalid.json`. All are additive unions. On the resolved merge, the 8 kernel status/reaction/levelling/exposure files, the 5 host files and the 2 Elixir files ran.

## Findings

1. **blocker**, `kernel/ts/src/mechanics/levelling/shared.ts:47,72-90` (`statusChain`). On the merge, G3's `npc_status.test.ts:183` (batch-m5) ("an expiry re-sets the door burning") fails: expected generation 2, actual 1. An expiry and a re-application in one settlement keep the old generation, against row 1 (ruling 1). G3's per-holder writer groups make the status branch unnecessary. With `levelling/shared.ts` reverted to base on the merge, every W25 test except the one below passes: tick+refresh, the 1800 expiry/calendar tie and the host reopen. The tie composes at generation 2. Same-generation is job-safe (jobs are owned by `job_id`, not by generation), but it still breaks row 1 and G3. The branch also makes the levelling module name status (composition). Fix: merge batch-m5; drop the status branch; change `exposure.test.ts:151` to expect generation 2; remove "Pending PM ruling" at `docs/system/mechanics.md:1932`.
2. **should-fix**, `kernel/ts/src/mechanics/reaction.ts:141-142` (and G3's `statusStep`, which gates only on `ops.length`, true on a refresh). Every hourly refresh emits the applied line again (ruling 2). Today the line does not reach the player only because `runtime/proposal.ts` `react()` (around line 238) never copies a reaction's narration into the decision. A probe showed no applied key on the first entry either. Gate the line on a first application.
3. **should-fix**, `cartridges/exposure_sampler/resources.json:36` (hp minimum 0, gain 0, `per_tick` -1 every 7200). Probe: a cloakless body on the fell on day 1 reaches hp 1 at 64800 and dies at 72000, about 24 real minutes (same-body return: hp 10, conditions cleared). This breaks trap 6 and ruling 3.

## Question

- Reaction narration never reaches the receipt (`proposal.ts` `react()`), so row 1's applied line never shows. That contradicts `book-ui.md:989` ("appear once"). The defect predates W25. Should the PM file a Beads issue?
