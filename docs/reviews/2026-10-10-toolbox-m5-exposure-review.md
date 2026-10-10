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

## Fix re-check (head `3d334b7138083af57ec916745dadaa74953f3701`)

Scope: `ba438342` and `3d334b71`, plus merge `68f3e33f` (batch-m5 `9a9a97d5`). Hosted ci and book-e2e green per PM. Verdict: **APPROVE WITH NOTES** (one should-fix, docs only).

- F1 resolved. `levelling/shared.ts` is byte-identical to base `45e12917`. `exposure.test.ts` expects generation 2 for the 1000 case, and the "Pending PM ruling" text is gone. The tie case at 10800 asserts one active row, `ends_at` 19800 and hp 9, with no pinned generation. Accepted: both orders follow row 1 and give the same end, and pinning the generation would only detect a change in job-id order. A fault or a wrong end still fails the test. Mutants: restoring the `statusChain` file, and keeping the generation on re-activation (`status/shared.ts`), each turn the W25 test and G3's `npc_status.test.ts` "an expiry re-sets the door burning" red.
- F2 resolved. `reaction.ts:195` emits the applied line only when `applyStatus` schedules a tick job, which happens only on a first application. Its only caller is `sequence`. Mutants: `ops.length` (refreshes repeat the line) and `false` (the line is lost) each turn the new silent-refresh test red.
- F3 resolved. `resources.json:36` sets minimum 1. The new whole-day test is red with minimum 0. The death content (the `player_corpse` and `npc_corpse` items) stays: status@1 requires death@1, which names both templates (`cartridge.md:448`), so deleting them breaks the compile. No nit.
- Merge resolution: `invalid.json` is exactly base, plus batch-m5 `9a9a97d5`, plus the W25 rows (827, none missing, none extra). Both schemas carry `clock_hour`, `status_ticked` and `status_expired`. `mechanics.md` keeps both sections and both reaction-table rows, with no conflict markers. `elixir bin/contracts.exs --check` exits 0. Focused kernel files (exposure, npc_status, status, reactions, reactions_sampler, levelling) and host files (exposure, status) are green.

### Finding

1. **should-fix**, `docs/system/mechanics.md:1932`. The PM accepted "clock_hour fires once per elapsed step while other jobs are pending" as a documented limit, but the text does not state it. It says only that "a long absence is one firing, not one per elapsed hour". Scenario: a chilled body away for ten game hours stops at each 7200 tick, so the host commits one `clock_hour` per tick step (about five), not one. Add one sentence naming the limit and loka-kgd.47.

Note: `origin/toolbox/batch-m5` has moved on to `c0e1ac7b` since `9a9a97d5`, so the batch needs another sync. That is not a finding.
