# MUD Terminal Builder Audit Tracker

> Temporary file tracking builder audit findings across sessions.
> Delete when all issues are resolved.

## Status: Pass 7 Complete (Feb 16, 2026)

---

## FIXED (Pass 1 — V1→V2 Migration)

| # | File | Fix | Status |
|---|------|-----|--------|
| P1-1 | `builder_commands.ex` | Added try/rescue around dispatch | Done |
| P1-2 | `game_channel.ex:970-988` | Wrapped AI handlers in try/rescue | Done |
| P1-3 | `builder_commands/rooms.ex` | Migrated game_state → V2 character/room assigns | Done |
| P1-4 | `builder_commands/map.ex` | Migrated game_state → V2, removed dead find_room_key_by_id | Done |
| P1-5 | `builder_commands/ai.ex:183` | get_current_room_key uses character assign | Done |
| P1-6 | `room_manager.ex:407` | to_existing_atom → to_atom | Done |
| P1-7 | `entity_manager.ex:264` | to_existing_atom → to_atom | Done |
| P1-8 | `builder_commands/entities.ex:52` | entity.data → entity.components["data"] | Done |
| P1-9 | `user_socket.ex:35` | Added is_admin: false to guest map | Done |
| P1-10 | `builder_live.ex:93` | Added Logger.error on token failure | Done |
| P1-11 | `builder_commands/entities.ex:108` | find_by_key uses Entities.find_one (not full scan) | Done |

## FIXED (Pass 2 — Data Integrity & Error Handling)

| # | File | Fix | Status |
|---|------|-----|--------|
| H1 | `entities.ex:74,87,100` | entity.id → entity.key for EntityManager calls | Done |
| H2 | `scripts.ex:235,257` | Pattern match Entities.update return in attach/detach | Done |
| H3 | `testing.ex:97,109,168` | Hard match → case for setflag/clearflag/resetquest | Done |
| H5 | `inspection.ex:207-214` | e[:name] || e[:short_desc] for find; metadata draft check | Done |
| M1 | `helpers.ex:58` | teleport_to_room now assigns :room in addition to :character | Done |
| M2 | `rooms.ex:44`, `navigation.ex:16` | Hard match → case for teleport_to_room | Done |
| M3 | `world.ex:28-29` | :errors → :error_count, :warnings → :warning_count | Done |
| M4 | `entity_manager.ex:29-63` | Added duplicate key check before entity creation | Done |
| M6 | `game_channel.ex:1431` | Removed DB query, uses player.name directly | Done |
| M8 | `command_parser.ex:364-375` | --force stripped from any position before parsing | Done |
| L1 | `room_manager.ex:260-264` | Exit metadata uses all-string keys (V2 convention) | Done |
| L2 | `rooms.ex` | RoomHelpers.clear_minimap_cache() called on dig/link/unlink | Done |
| L5 | `world.ex:8-15` | settime message clearly indicates not implemented | Done |

## FIXED (Pass 3 — Component Safety, AI, Publishing)

| # | File | Fix | Status |
|---|------|-----|--------|
| H4 | `room_manager.ex:435-476` | prepare_db_updates merges with existing entity components; coords default to existing values not 0 | Done |
| M5 | `ai.ex` + `game_channel.ex` + `command_parser.ex` | AI streaming timeout (120s) + `/ai cancel` command + streaming state tracking | Done |
| M7 | `zones.ex:52-69` | Type coercion for numeric/boolean values in zone edit | Done |
| M9 | `scripts.ex:93` | to_existing_atom → to_atom for hook names (trusted input) | Done |
| M10 | `publishing.ex:54-120` | zone_all publish checks set_draft_flag return values; extracted publish_zone_all helper | Done |
| L3 | `room_manager.ex:118-147` | Eliminated double DB fetch — uses entity from get_room_entity directly with Entities.update | Done |
| L4 | `scripts.ex:305-364` | All template config values use inspect() for safe escaping; removed manual escape_yaml_string | Done |
| L6 | `helpers.ex:35` | Removed unused _opts parameter from teleport_to_room | Done |

## FIXED (Pass 4 — Edge Cases & Consistency)

| # | File | Fix | Status |
|---|------|-----|--------|
| M11 | `entities.ex:69-77` | edit_entity now type-coerces values (integers, bools) like zones.ex | Done |
| M12 | `rooms.ex:36-37` | dig command checks add_exit return values; warns on exit creation failures | Done |
| M13 | `testing.ex:175` | resetquest uses Map.merge instead of update syntax to avoid crash on empty quests map | Done |
| M14 | `ai.ex:105-119` | Chat mode messages now get same streaming timeout as /ai command | Done |

## FIXED (Pass 5 — Enrichment & Consistency)

| # | File | Fix | Status |
|---|------|-----|--------|
| M15 | `entity_manager.ex` + `room_manager.ex` | Added `metadata` to enriched maps so `find` command shows draft status correctly | Done |
| M16 | `testing.ex:22,79` | `Map.get(entity, :name, key)` → `entity.short_desc \|\| key` (Entity struct has no `:name` field) | Done |
| M17 | `rooms.ex:14` | `@valid_directions` expanded from 6 to 10 (added diagonals) to match `reverse_direction` | Done |
| L11 | `publishing.ex:68` | Error message now mentions `zone_all` as valid type | Done |
| L12 | `publishing.ex:125-133` | Rollback errors now collected and logged instead of silently swallowed | Done |

## FIXED (Pass 6 — Delete Return Handling)

| # | File | Fix | Status |
|---|------|-----|--------|
| M18 | `quest_manager.ex:160-163` | delete_quest now checks Entities.delete_entity return before reporting success | Done |
| M19 | `dialogue_manager.ex:61-64` | delete_dialogue now checks Entities.delete_entity return before reporting success | Done |
| M20 | `entity_manager.ex:152-155` | delete_entity now checks Entities.delete_entity return before reporting success | Done |

## FIXED (Pass 7 — Dead Code & Redundancy Cleanup)

| # | File | Fix | Status |
|---|------|-----|--------|
| L7 | `entity_manager.ex` | Eliminated double DB fetch in update/delete — uses `Entities.update`/`Entities.delete` (UUID path) instead of `get_entity_by_key` + `update_entity`/`delete_entity` (schema path) | Done |
| L8 | `entity_manager.ex:233-236` | Removed dead atom key fallbacks in enrich_for_ui — V2 always uses string keys in components | Done |
| L9 | `rooms.ex:29` | Removed dead `:zone` field from dig params — enriched rooms don't have zone, always defaulted to "default" | Done |
| M21 | `entity_manager.ex` | Deleted dead `search_entities/2` (no callers) and `duplicate_entity/2` + `generate_duplicate_key/1` (no callers) | Done |
| M22 | `quest_manager.ex` | Deleted dead `get_quest/1` (only tests) and `search_quests/1` (only tests) + removed associated tests | Done |
| L13 | `helpers.ex:138` | Deleted dead `format_typed_object` alias — updated tests to use `format_entity` directly | Done |
| L14 | `quest_manager.ex`, `dialogue_manager.ex` | Removed `to_existing_atom` trap in `ensure_atom_keys` — simplified to `to_atom` (trusted builder input) | Done |
| L15 | `tool_executor.ex:1346,1677` | Same `to_existing_atom` → `to_atom` cleanup + removed unnecessary try/rescue wrappers | Done |

---

## FIXED (Pass 7b — Coerce Value Consolidation)

| # | File | Fix | Status |
|---|------|-----|--------|
| L10 | `content.ex:33` | edit_quest now coerces string values (integers, bools) before passing to QuestManager | Done |
| L16 | `helpers.ex` | Extracted shared `coerce_value/1` into Helpers — was duplicated in entities.ex and zones.ex | Done |

---

## Summary

**52 issues resolved** across 7 audit passes. All items resolved.

---

## Reusable Audit Prompt

See `docs/temp/builder-scrub-prompt.md`
