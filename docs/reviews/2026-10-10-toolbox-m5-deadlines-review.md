# Review: toolbox row W24 engine half, quest deadlines (loka-kgd.45, batch M5)

- Local branch `toolbox/m5-w24`, head `10f79716fdc96983571bb64dbc90510696e29abc`, base `8224faeb` (merge-base with `origin/toolbox/batch-m5`), 31 files. The diff also holds the W23 fixes at `810e0afb`. There is no PR: the developer's `/code-review medium` result (9 findings: 7 fixed, 1 declined) is in the Beads `loka-kgd.45` handoff. The slice changes the protocol schemas, the loader and `kernel_api` 1.46, so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [row W24](../MECHANICS-TOOLBOX.md#ranked-toolbox); [mechanics.md W24](../system/mechanics.md#quest-deadlines-toolbox-row-w24-engine-half); [cartridge.md](../system/cartridge.md#quest-deadlines); the PM split and decisions in Beads `loka-kgd.45`. The Journal countdown, the sampler and the mobile proof are `loka-kgd.46` and are out of scope here.
- Hosted CI on the head: ci `38053633288` and book-e2e `38053633286`, both success (confirmed with `gh run list --commit`).
- Verdict: **APPROVE WITH NOTES**: no blocker, two should-fix, two nits.

## Must be true

1. `deadline` is one object. Both kernels load a legacy deadline (`at`, `fact`, `trust_fact`, `trust_amount`, no `after`) or a generic one (exactly one of `after`/`at`, no legacy field, 1.46). Any other shape is `SCHEMA_VIOLATION`. A `quest_failed` trigger also needs 1.46.
2. Every activation of a generic-deadline quest schedules one job. It is due at the cause time plus `after`, or at `at`, never at `started_at`, and never before horizon + 1. Activation never faults with `nonfuture_job`.
3. Expiry fails an open instance with the outcome and emits `quest_failed` at the due time. A missing, closed or retired instance only completes the job. A row naming a foreign quest or actor faults.
4. Legacy S2 behaviour and the Chapter 1 bytes are unchanged. `offerOf` and `debt_feature` apply to legacy deadlines only.
5. Replay is deterministic, and no size allowance was raised.

## Proof

- **(1)** Compiler probes on a `quest_sampler` copy:
  - `{at,after}`, `{at,fact}` and `{at,trust_fact,trust_amount}` each give `invalid_value` at `deadline`.
  - `deadline: 5` gives `invalid_type`.
  - `{after}` and `{at}` alone compile.
  - TS (`cartridge_quests.ts:54`) and Elixir (`quests.ex` `deadline/3`) branch in the same order. `failed_floor` matches the TS trigger floor.
- **(2)** `lifecycle.ts:72` reads the horizon as the composer does (`compose.ts:56`, the last `time.advance` in the proposal). For elapsed runs, the advance is the root op (`schedule/rule.ts:70`).
- **(4)**
  - All 39 cartridges compile byte-identical with base and head `lib/` + `protocol/`.
  - The only shipped deadline is legacy: `chandlers_debt`.
  - The `boundActivation` and `deadlineJob` paths are gated on `fact`.
  - `debt_feature` drives only the 1.14 floor (`requires.ex:85`, `cartridge_quests.ts:104`), confirmed.
- **(5)** Test 1's scenario, run twice from `fresh()`, gives identical event and state bytes. `git diff` adds no `size: allow` or credo disable.
- **Mutants and red controls.** Each was run against the focused files (`quest_deadline`, `quest_hints`, `chandlers_contracts`, `deadline_generic`, `content_quest_deadline_test`, `content_quest_hints_test`).
  - Caught:
    - clamp at `horizon` instead of `horizon + 1`;
    - prior ops dropped from the horizon;
    - closed-instance skip removed;
    - event stamped at the advance target;
    - TS `legacy ||` dropped;
    - Elixir `legacy > 0 or` dropped;
    - Elixir `failed_floor` dropped;
    - `deadline-save.ts:38` gate reverted;
    - W23 tip skipped on a failed check.
  - **Survived:** due from `world.state.clock` instead of the cause time (finding 1).
- **Lint allowlist** (`ts-rule-module-imports.yml:12`): `quest/job.ts` joins the `(bleed|status)/job.ts` precedent and is imported only by the schedule dispatcher. Accepted.
- **Trial merge into `origin/toolbox/batch-m5` (`07b0bd7d`).** Four conflicts:
  - `docs/system-graph.gen.json`, `docs/toolbox.gen.json` and `kernel/ts/src/contracts.gen.ts` are generated: regenerate them.
  - `protocol/fixtures/invalid.json` is two appends at one spot: keep both.

## Findings

1. **should-fix**, `kernel/ts/src/mechanics/quest/lifecycle.ts:86`: the mutant `add(world.state.clock, d.after!)` passes the whole suite. Every test activates at cause time = clock.
   - Failure scenario: a status job at t > from emits an event, and the reaction chain resolves quest A, then activates quest B (`after` 100) through a `quest_resolved` reaction. With the mutant, B's job is due at `max(from + 100, until + 1)`, not t + 100, so B expires early and the suite stays green.
   - Fix: one `begun` unit row with `at` = 10, clock 0, no advance and `after` 100, expecting `due_time` 110.
2. **should-fix (carry to loka-kgd.46, which owns the mobile proof)**, `mobile/authority/local-story/deadline-save.ts:38`: the field shapes of generic job rows are checked (`:27-33`), but how a row relates to the save is not.
   - Failure scenario: a save row whose instance belongs to another quest or actor, or whose job names a quest with no deadline, loads. Then every elapsed run faults (`job.ts:21-25` or the legacy `deadlineJob` path), so time stops and there is no `save_corrupt` or Start over.
   - Not blocking now: no shipped cartridge has a generic deadline, so no save can hold such a row before kgd.46's sampler. Status job rows share this posture ([save.md Status recovery](../system/save.md#status-recovery)).
3. **nit**, `docs/MECHANICS-TOOLBOX.md:114`: the row still says `after` is "resolved against W23's `started_at`". That contradicts the PM decision and mechanics.md ("never from `started_at`"), which kgd.46 will read.
4. **nit**, `kernel/ts/src/mechanics/reaction.ts:247`: `resolvedActor` covers only `quest_resolved`, so a `quest_failed` reaction runs as the command's actor. This is latent: a TS world holds one character (`world.ts:184`). Add `quest_failed` before a multi-character host runs TS rules.

## Developer open items

- **(1)** `containment/shared.ts:39` refuses giving away a bound item for any deadline quest. It is reachable only through bound activation, and it matches the legacy rule. The spec is silent, so this is a question for kgd.46 to state in mechanics.md and not a defect.
- **(2)** See nit 4.
- **(3)** A `quest.fail` reaction emitting no `quest_failed` is specified behaviour (mechanics.md W24 Expiry; the `event.schema.json` description). Accepted.
- **(4)** See finding 2: should-fix in kgd.46, not a blocker for kgd.45.

## Disposition

Mergeable into batch M5 after finding 1 (one test row). Finding 2 goes to loka-kgd.46. The nits can ride either slice.
