# Review: toolbox row 16, sneak and hide (loka-nfdq, batch M13)

- Local branch `toolbox/m13-sneak`, head `741a30dbe802bb99adff149b21e2d50651854c36`, base `origin/main` `930731e9`. No PR yet (merges into `toolbox/batch-m13`).
- Governing: [mechanics.md row 16 section](../system/mechanics.md) (Declaration, Engage, Known limits), [G5 opposed checks](../system/mechanics.md#skill-growth-and-opposed-checks-toolbox-rows-5-and-g5), [G3 npcValue](../system/mechanics.md#statuses-on-npcs-and-things-toolbox-row-g3), [Realm seams decision](../decisions/owner-decision-realm-seams-2026-10-13.md) seams 1, 4, 5; [composition](../system/architecture.md#building-mechanics-by-composition); AGENTS.md "Writing tests".
- Verdict: **CHANGES REQUIRED** (finding 1: the brief's named scope trigger fires and is neither reported nor documented; finding 3: two surviving loader mutants).
- Written 2026-10-14 by anthropic/claude-opus-5-5 (independent reviewer).

## Must be true (written before the diff)

1. R1 `pierces`: seer attribute strictly greater than the holder's G5 skill level; equal stays hidden; no RNG; holder without a character never pierced; NPC seer via `npcValue`, player seer via its character.
2. R2 `concealed` adds the pierce clause only for statuses with `pierced_by`.
3. R3 Entry engagement cures every active concealment on the entering body, writer group 0, with no `conflicting_write` against another status write in the same move (brief scope trigger: stop and ask).
4. R4 Loader twins: `pierced_by` without `concealment` SCHEMA_VIOLATION at `pierced_by`; unresolved skill/attribute UNRESOLVED_REFERENCE at `pierced_by.skill`/`.attribute`; floor 1.93 KERNEL_API_RANGE_INVALID.
5. R5 kernel_api 1.93, no stale pins.
6. R6 view callers pass the viewer (RS-5); no new `world.character` read (seams 1, 4, 5).
7. R7 status_readers and transcript fixtures unchanged and green.

## Check against the list

1. Met. `kernel/ts/src/mechanics/skills.ts:87` (`sees > level`, `actorOf` holder).
2. Met. `kernel/ts/src/mechanics/status/shared.ts:230`.
3. Not met for conflicts. Finding 1.
4. Met by probe (TS loader and Elixir `mix` compile on copies of the sampler): missing attribute and string `pierced_by` give SCHEMA_VIOLATION at `statuses/hidden.pierced_by[.attribute]`; bad attribute gives UNRESOLVED_REFERENCE at `.pierced_by.attribute` in both. `lib/loka/content/status.ex`, `kernel/ts/src/content/cartridge_status.ts:31,153-164`.
5. Met. `kernel/ts/src/world.ts:107`.
6. Met. Callers `disposition.ts:84`, `light/shared.ts:113`, `movement/rule.ts:68` pass the command body or viewer body; `ast-grep scan` clean.
7. Met. No fixture under `protocol/fixtures` changed; focused sneak and status_readers green.

## Findings

1. **Blocker.** `kernel/ts/src/mechanics/disposition.ts:50-60`. The engage cure (group 0) collides with an entry reaction that writes the same status. Repro: `sneak_sampler` plus reaction `{on: {event: entity_entered_room, room: keep}, apply: [{op: status.apply, status: hidden}]}`; `hide`, `east`, `east` gives `fault conflicting_write` target `{kind: status, status: hidden}`; the whole move is discarded and the hidden player cannot enter the keep. This is the brief's named stop-and-ask trigger; the handback and Known limits are silent. Fix by PM ruling: a loader refusal of such content, or a composition rule for the cure, or a Known limit plus a test that pins the fault.
2. Nit. `docs/system/mechanics.md:3025` cites `pierces` in `status/shared.ts`; it is in `kernel/ts/src/mechanics/skills.ts:87`.
3. **Blocker** (surviving mutants). The attribute half of the new `pierced_by` reference check has no red test in either twin. Dropping it (`lib/loka/content/status.ex:165`, the `"attribute"` `Refs.reference`; `kernel/ts/src/content/cartridge_status.ts:159`, the `['attribute', 'attributes']` row) leaves `test/loka/content_status_test.exs` and `kernel/ts/test/sneak.test.ts` green: a cartridge with `pierced_by.attribute: none` would load and `pierces` would read an undefined value (never pierced). Behaviour correct today by probe. Fix: one UNRESOLVED_REFERENCE case at `pierced_by.attribute` in each twin.
4. Nit. `disposition.ts:51-59` filters `activeStatuses` and then `cureOps` rescans them; small duplication.
5. Nit. No PR, so no `/code-review` result is reported; run it in the fix round.

## Claims rerun

No PR body yet; reran two doc cites. `mechanics.md:3025` "`pierces`, `status/shared.ts`": not backed (nit 2). Same line, "both kernels" emit the `pierced_by` codes and paths: backed by the R4 probes.

## Mutants (TS rows via `bin/mutate.sh`, narrow: `sneak.test.ts`, `status_readers.test.ts`; Elixir rows: `content_status_test.exs`)

| Mutant | Result |
|---|---|
| `skills.ts` `sees > level` to `>=` | red |
| `disposition.ts` cure list to `[]` | red |
| `status/shared.ts` pierce clause to `true` | red |
| `skills.ts` drop `actor === undefined` guard | red |
| `cartridge_status.ts` `s.concealment ? [] :` to `true ? [] :` | red |
| `status.ex` concealment guard to `true` | red |
| `status.ex` drop attribute `Refs.reference` | **green** (finding 3) |
| `cartridge_status.ts` drop `['attribute', 'attributes']` | **green** (finding 3; `sneak.test.ts` only) |
