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

## Fix round 1 recheck (head `524a49a3d1a9b250a66e25e71496ca6df333f558`; fixes `8ec83f65`, `524a49a3`)

Verdict: **CHANGES REQUIRED** (finding R1-1 is new: the refusal breaks two existing tests).

Dispositions:
- Finding 1: entry reactions that apply a concealment are now refused with OUTCOME_MISMATCH at `apply[i].op` (`kernel/ts/src/content/cartridge_reactions.ts:133-147`, `lib/loka/content/reactions.ex:214`). The narrower runtime fix waits on loka-5i4c (PM ruling). Red controls rerun: removing the refusal turns `sneak.test.ts` red (TS) and `content_status_test.exs` red (Elixir).
- Finding 2 (now 3): the attribute rows are added in both twins and are green on the clean head. Not re-mutated.
- Nit 3: fixed (`mechanics.md:3025`).
- Nit 4: kept, as the developer chose.

Reachability: the only shipped concealment status is `sneak_sampler` `hidden`. It is applied only on `check_passed` from the `hide` recipe, which does not move the player, so no shipped path reaches the cure conflict. Nothing is a blocker now on reachability.

Findings:
- **R1-1 Blocker.** The refusal also catches a status that an existing test makes concealing. `kernel/ts/test/status_readers.test.ts:422` and `test/loka/content_status_readers_test.exs:49` both fail at 524a49a3: `ward_sampler` `reaction/blessing` (entity_entered_room, shrine) applies `warded`, and the test gives `warded` `concealment: hidden`. Expected `loaded`; got OUTCOME_MISMATCH at `reactions["ward_sampler@0.0.1:reaction/blessing"].apply[0].op`. Hosted CI will go red. Fix: have the readers tests make a status that no entry reaction applies concealing, or narrow the refusal. Do not change the expected values.
- **R1-2 Should-fix.** The Known limits sentence at `docs/system/mechanics.md:3039` names only the entry-reaction refusal. It does not name the other unhandled paths: a fact_changed chain, patrol or expedition events, or an entry reaction that cures a concealment. It also does not name follow-up loka-5i4c, which drops the refusal. That is the PM's stated remaining item.

## Fix round 2 recheck (head `28142ab1b2d2d55bec99e275d92e1d791aca2bcc`)

Verdict: **APPROVE WITH NOTES**.

- R1-1: fixed. The loader rows now use `soaked`. Its only writer is `ward_sampler/reactions/drench.json`, on `spoken`, not on entry. Every test file that names `concealment` is green at this head: `kernel/ts/test/sneak.test.ts` and `status_readers.test.ts` (16 pass); `test/loka/content_status_readers_test.exs`, `content_status_test.exs`, `content_status_movement_test.exs` and `content_reactions_test.exs` (exit 0).
- R1-2: fixed. `docs/system/mechanics.md:3039` names the fact_changed chain, the patrol and expedition events, the entry cure and loka-5i4c.
- Developer open notes, none a blocker, all for loka-5i4c: the refusal is broader than needed; the doc says "still fault" without its condition (engaged on that move while already concealed); the engage tests build a `warded` concealment in memory that the loader would refuse; nothing pins that no entry reaction applies `soaked`. If a later entry reaction applies `soaked`, the loader rows go red loudly, not silently.
