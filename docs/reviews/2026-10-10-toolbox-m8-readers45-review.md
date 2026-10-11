# Review: status readers 4 and 5, blocks/allows and resistances on a status (loka-kgd.89, loka-kgd.90)

- Branch `toolbox/m8-readers45`, head `77cd43b3dd3026a5871c52fd4bf1f822c9174435`, diffed against `toolbox/batch-m8` `790973f7` (32 files). No PR (batch model). Contract slice: `StatusDefinition.blocks`, `.allows`, `.resistances`, kernel_api 1.54.
- Governing: [SR4 and SR5](../system/mechanics.md#command-blocks-and-resistances-on-a-status-toolbox-rows-sr4-and-sr5), [G2](../system/mechanics.md#damage-kinds-resistances-and-critical-hits-toolbox-row-g2), [status declarations](../system/cartridge.md#status-declarations), [composition](../system/architecture.md#building-mechanics-by-composition), Beads `loka-kgd.89`, `loka-kgd.90`.
- Hosted ci green at the head (`gh run list --commit`, reviewer); book-e2e in progress.
- Verdict: **APPROVE WITH NOTES** (one should-fix, one nit).

## Must be true

1. One filter, read by step, GameView and invocation alike; a barred verb is unlisted, a barred exit is unavailable with the step's code.
2. `blocks` removes a type; `allows` lists intersect; modal answers (`choose`, `close_choice`, `continue`) and `wait` always pass; time (`elapsed`) is never barred.
3. Status resistances join the NPC definition's entries in one sum for kind and materials, clamped once to -100..100, for the player's body and NPCs.
4. Both loaders: 1.54 floor for any of the three fields, UNKNOWN_COMMAND for a non-command or `run_job`/`elapsed`; such a status may omit `per_tick`.
5. No new writes, events, jobs or save rows; cartridges without the fields unchanged.

## Proof

- Focused runs green: `status_readers`, `targets`, `writer_groups`, `derived`, `fear`, `npc_status` (48 pass); `content_status_test.exs` and `content_status_readers_test.exs`; `npm run typecheck`.
- TS mutants on `status_readers.test.ts`, all red: allows united rather than intersected; `wait` dropped from always-admitted; status entry dropped from `dealt`; `barred` ignoring the composed set; the `resolved` status filter skipped (3 tests, including the `gameview_agrees_with_admission` alias check); `elapsed` exclusion dropped; floor ignoring `resistances` (floor alone). Clamp removed, or either bound moved to ±200: red on `damage.test.ts`.
- Elixir mutants on `content_status_readers_test.exs`, both red: floor ignoring `resistances`; `elapsed` exclusion dropped.
- Probe (throwaway test, deleted): with `allows: [look]` an elapsed round advances the clock; `move` is `invalid_state`, `look` accepted. Two statuses on the player at physical 60 each (120) leave the player untouched (clamp to 100).
- Keyless-spec claim (77cd43b3) holds: `schemaStage` validates the whole `CartridgeArtifact` (`kernel/ts/src/content/cartridge.ts:112`) and `key` is required, so only hand-built test specs lack it. Per-hit scan is `activeStatuses` (sort of the cartridge's statuses) once per hit; negligible.
- Parity: both loaders build the command list from `CommandPayload` (`refs.ex:24`, `CAPABILITY_OWNERS.command`); `reader?` (has_key) and `reader` (truthy) agree on every schema-valid value (`minItems: 1`). Step admission exists only in TS.
- Claims rerun: mechanics.md "a barred exit is listed unavailable with the step's code" and the sampler HP figures (8/7, 9/7, 8/5) are asserted in `status_readers.test.ts` and killed by the mutants above.

## Findings

1. **should-fix**, `kernel/ts/src/mechanics/combat/round_attack.ts:110`: mutant "status entries added outside the clamp" (sum = clamp(NPC entries), then subtract the status sum unclamped) stays green on `status_readers` and `damage` tests: no case has a status-including sum past ±100. Failure: a refactor like this passes CI while two stacked shields (120) give negative damage, against "Two shields stack up to immunity at the clamp" (`mechanics.md:2334`). Fix: one assertion with a status-including sum past the clamp (e.g. the probe above: `[10, 7]`).
2. **nit**, `kernel/ts/src/commands/actions.ts:170`: `fighting` gained a default `body` parameter that no caller passes; revert to the base form.

Not checked: chapter byte-identity (no field added to existing content); book-e2e result.
