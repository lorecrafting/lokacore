# Review: M9 status reader 9, a room as status holder (loka-kgd.94)

- Branch `toolbox/m9-room-status`, head `756096c954ddf5e3c3c291b0a679d8d5424214b2`, diffed against `d4848cf5` (`toolbox/batch-m9`). No PR (batch model). Installed `kernel_api` 1.61 to 1.65.
- Governing: [A room as a status holder](../system/mechanics.md#a-room-as-a-status-holder-status-reader-9) (added here), [Blind (SR6)](../system/mechanics.md#perception-and-concealment-on-a-status-toolbox-rows-sr6-and-sr8), [row G3 holders](../system/mechanics.md#statuses-on-npcs-and-things-toolbox-row-g3), [status composition](../system/protocol.md#status-composition), toolbox row SR9, Beads `loka-kgd.94`. PM decisions not reopened: room-held blind = darkness for whoever stands there; ungated room event subjects; NPC blindness deferred (`loka-kgd.106`); room-status Book line deferred (`loka-x6t.37`).
- Hosted book-e2e green on the head; ci was still running at writing (`gh run list --commit`, reviewer); ci and book-e2e were green at `0cebea09`.
- Verdict: **APPROVE WITH NOTES** (no blocker; two should-fix test gaps on spec-stated behaviour).

## Must be true

1. Both composers accept a room as holder, still refuse a detail or slot; both answer `status_composition.json`.
2. `status.apply` may name `room`; it lands only there; compiler and loader refuse an unknown room, `room` beside `item`/`npc`/`co_present`, and `kernel_api` below 1.65; the compiler expands the short key the loader then accepts.
3. A room tick changes no pool (any resource, hp included), never kills, still emits `status_ticked`; expiry and sub-steps as row 1; player death or NPC death never clears a room's rows.
4. A blind room status darkens `dark()`/`visible()` for the body standing in it only, whatever a held light or dark sight says; scan from outside does not see in; it ends at expiry.
5. GameView and step agree (one `dark()`); Chapter 1 bytes and receipts unchanged.

## Proof

- Named files green at head: TS `status_room`, `status`, `status_composition`, `light`, `status_readers`, `senses` (49 pass); Elixir `content_status_readers_test`, `core/status_test`.
- Mutants (reverted): room clause dropped from `blinded` (`light/shared.ts:87`) red; `perceives(there)` dropped (`movement/rule.ts:55`) red; `visit.rooms[body]` dropped (`status/job.ts:80`) red (room writes an mv `resource.adjust`); `apply?.room` ignored (`reaction.ts:210`) red; `room` dropped from `HOLDERS` (`compose_status.ts:7`) red on `room-holder-accepted`; `room` dropped from `compose_status.ex:8` red; the 1.65 `step_floor` clause (`reactions.ex:115`) dropped red.
- Survivors: findings 1 and 2.
- Probe: `ward_sampler` copy with a `gloom` status (`resource: hp`, `per_tick: -50`, `perception: blind`) and the shrine step `{status: gloom, room: den}` at 1.65 compiles with `mix loka.compile` and loads in TS; entry applies the row to the den, a 60 s advance ticks with no `resource.adjust` and no `entity_died`, the den is dark (point 2, 3).
- Cites rerun: room cues come from the room itself (`roomOf`, `senses.ts:27`); conditions list only `world.body` (`view/resources.ts:50`); death clears only the victim's rows (`clearStatuses(world, victim_id, …)`, `death/sequence.ts:78`). TS/Elixir: only the composer and the content checks exist in both; no divergence found.
- Fixture: `status_composition.json` refusal case moved room to detail and a room-accepted case added; a spec change (pre-production decision), not a fit to code.

## Findings

1. **should-fix**, `kernel/ts/test/status_room.test.ts:121`: the den is a lit room with no light source, so "a held light or dark sight does not pierce" (spec, toolbox row SR9 acceptance) is unpinned. Mutants `blinded … && !illuminated(…)` and `… && !perceives(body, 'dark_sight')` in `light/shared.ts:87` stay green across `status_room`, `light`, `status_readers`. Scenario: a refactor lets a torch light a darkened den. Pin one case (den unlit with `dark_description` plus a held lit source, or a `dark_sight` body).
2. **should-fix**, `test/loka/content_status_readers_test.exs:85` and `kernel/ts/test/status_room.test.ts:149`: only `room`+`npc` is tested. Dropping `s["item"]` or `s["co_present"]` from `reactions.ex:248`, or `s.item` from `cartridge_status.ts:123`, stays green. Scenario: `room`+`item` loads and the item is silently ignored (`holdersOf` prefers `room`). Add `item` (both kernels) and `co_present` (Elixir) rows to the existing tables.
3. **nit**, `docs/system/mechanics.md` SR9 composition record and toolbox row SR9 Code column omit movement@1 `sight` as a consumer (added by `756096c9`).
4. **nit**: no PR body, so no developer `/code-review` result is reported; run it in the fix round.
