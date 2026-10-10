# Review: derived sky (weather, season, tide), toolbox row 31 + W5 (loka-kgd.30)

- Local branch `toolbox/m4-sky`, head `43f7c8f5b0bc75dee42e5e8047f94937fb8dcab4`, diff `3f4705d0...43f7c8f5` (merge-base with `origin/toolbox/batch-m4`, 31 files); no PR yet (batch M4). Protocol change (cartridge, policy, gameview and entity schemas, invalid fixtures, kernel_api 1.45), so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [toolbox row 31, slice process, traps 1, 5, 11, 12](../MECHANICS-TOOLBOX.md#toolbox-slice-process), [G1 leaf-set rule](../system/mechanics.md#property-tags-and-the-policy-leaf-set-toolbox-row-g1), [row 10 `sky` leaf](../system/mechanics.md#time-windows-hour-and-moon-gates-toolbox-row-10), brief in Beads `loka-kgd.30`.
- Hosted CI on the head: book-e2e success; ci failure only at `elixir bin/check_size.exs` on `lib/loka/content/checks.ex` (451 > 450, not in this diff; fixed on the batch). `mix test`, `mix credo --strict`, kernel, mobile, sim and lint all succeeded; only `red_controls.exs` was skipped.
- Verdict: **CHANGES REQUIRED** (one surviving mutant).

## Must be true

1. Weather, season and tide are derived from (world key, day or clock, authored tables); nothing stored, ticked or saved (trap 1); no authority RNG draw (trap 5).
2. `sky` takes exactly one of `lunar`, `weather`, `season`, `tide`; no new leaf, no `LEAF_REFS` entry (names no definition).
3. Both kernels refuse a `sky` field naming a phase its table does not author, a malformed table, and any new field below kernel_api 1.45.
4. An `exposed` room on a wet day refuses ignite, and the GameView offers no Ignite there; the shed and dry days are unaffected.
5. The status line shows the weather in words (trap 12); Book UI rule written, pending designer.
6. Opt-in: Chapter 1 and the corpus unchanged.

## Proof

- Baseline at head: TS `sky`, `calendar`, `tags`, `time_windows`, `light`, `validate`; mobile `book/keyboard`; Elixir `content_sky_test`, `content_time_test`, `core/contracts_test` all pass.
- Weather oracle reproduced independently: `printf 'weather:5b7d…2d4f:<d>' | shasum -a 256`, first 8 hex mod 2 gives 1,1,1,1,1,0 for days 1 to 6 (rain ×5, clear), matching `sky.test.ts` and `mechanics.md`.
- Mutants killed: M2 weather walk `< 0` to `<= 0`; M3 little-endian hash read; M4 Elixir floor without the row 31 tables; M5 Elixir duplicate-weather check removed; M7 TS floor without the row 31 tables.
- Mutant survived: M1 TS loader phase check over `['lunar', 'weather']` only (`cartridge_calendar.ts:84`), also against `tags`, `validate`, `calendar`, `time_windows`.
- Chapter 1: `mix loka.compile cartridges/ashmere_chapters` gives sha1 `ee93f779` with the base and head compilers. No corpus file in the diff.
- Saves and replay: no state, storage or save file in the diff; `rainedOut` and `sky` read only the committed clock and `World.context`; the test pins the same weather for another authority seed.
- `invalid.json`: one changed expectation (Policy `{op: sky, solar}`: `missing_property /lunar` to `exclusive_properties`), which follows from `lunar` no longer being required; the rest are additions.
- Cites rerun: `policy.ts:54` (sky case) and `light/shared.ts:49` (ignite refusal) match.
- `exposed` has no 1.45 floor; not a finding: G2's `silver` tag has none either (`cartridge_combat.ts:37-45` floors fields, not tags), and the tag is inert without a weather table, which is floored (M4, M7 killed).

## Findings

1. **blocker**, `kernel/ts/test/sky.test.ts:139-186`: the TS loader rows plant only an unauthored `weather`; M1 (season and tide dropped from the loader loop) stays green. Failure: an artifact whose variant reads `sky {tide: "slack"}` against a `low`/`high` table loads in the TS kernel and the variant silently never shows. Fix: two rows, `season: "winter"` and `tide: "slack"`, each expecting its own path (the Elixir test already has both).
2. **nit**: the developer's `/code-review medium` result is in no Beads note; add it to the batch PR body.

## Disputed /code-review findings

- Generic refusal code (`invalid_state` for rain): dismissed. `mechanics.md` rows 10 and 31 specify it; the GameView hides Ignite and the cartridge's rain variant carries the reason (trap 12).
- Meaningless `exposed` Resistances member: dismissed. `damage.test.ts:200` requires Resistances to name exactly every DamageKind and Tag.
- Presence tests differ (TS truthy / `!== undefined`, Elixir `Map.has_key?`): dismissed. They differ only for `null` or `[]`, which the schema refuses first (`cartridge.ts:65-77` runs the schema stage before `calendarStage`).
- Duplicated phase-word formatter (`play/text.ts`, `mobile/app/book/Status.tsx`): dismissed. Separate packages, and the existing solar and lunar formatting already follows this pattern.
- Status test finding the element by position (`keyboard.test.ts:314`): dismissed. It is the file's pattern (`:236`, `:265`).
- Empty world id in `clock()` (`play/text.ts:230`): dismissed. `clock()` formats only day and hh:mm, and every weather reader (`view.ts:77`, `text.ts:252`, `policy.ts:54`, `light/shared.ts:27-30`) passes `world.context`, so no player-visible weather uses `''`.

## Trial merge into `origin/toolbox/batch-m4` (`d7978157`)

Conflicts: `docs/system-graph.gen.json` (regenerate), `docs/system/mechanics.md` and `docs/system/cartridge.md` (both append sections after row 10). `invalid.json`, `policy.ts` and `contracts.gen.ts` merge cleanly. W7 (`toolbox/m4-variety`, not merged) shares seven files: `contracts.gen.md`, `system-graph.gen.json`, `cartridge.md`, `mechanics.md`, `contracts.gen.ts`, `policy.ts`, `invalid.json`.
