# Builder Scrub Session Prompt

Copy-paste this into a new Claude Code session to continue scrubbing:

---

## Prompt:

> Continue the MUD terminal builder scrub. Read `docs/temp/builder-audit-tracker.md` first — it has all findings from previous passes with status tracking.
>
> **Your job:**
> 1. Read the tracker to see what's OPEN vs FIXED
> 2. Fix the highest-priority OPEN items (High first, then Medium)
> 3. After fixing, compile with `mix compile --warnings-as-errors` and run `mix test test/loka_web/channels/builder_commands/ test/loka_web/channels/builder_crud_test.exs test/loka_web/channels/builder_workflow_test.exs test/loka_web/channels/builder_command_security_test.exs`
> 4. Update the tracker MD file — move fixed items to FIXED section
> 5. Then do ONE MORE audit pass looking for NEW issues. Areas to check:
>    - Any remaining V1 patterns (game_state, entity.data, TypedObject.Loader direct access)
>    - Hard pattern matches (`{:ok, x} = potentially_failing_call()`) that should be `case`
>    - Silent error swallowing (return values discarded)
>    - Key vs UUID confusion in entity lookups
>    - Data integrity (partial operations that could leave inconsistent state)
>    - Missing input validation in command handlers
>    - Race conditions in YAML + DB dual-write operations
> 6. Add any new findings to the tracker
> 7. Compile and test again
>
> **Key context:**
> - V2 uses `socket.assigns.character` (Entity struct) and `socket.assigns.room` (room entity)
> - V1 used `socket.assigns.game_state` (DELETED — should not exist anywhere)
> - Entity data is in `entity.components` (string keys), NOT `entity.data`
> - `Entities.find_one(key: key)` searches by key. Entity.id is a UUID. Don't mix them.
> - `EntityManager.update_entity/delete_entity` expect keys, not UUIDs
> - YAML keys are always strings: `data["key"]` not `data.key`
> - Builder commands should never crash the channel — use `case` not hard matches
> - All builder commands are wrapped in try/rescue at the dispatch level, but proper error handling is still needed for good UX
>
> **Files to focus on:**
> - `server/lib/loka_web/channels/builder_commands/*.ex` (16 sub-modules)
> - `server/lib/loka_web/channels/game_channel.ex` (dispatch, AI handlers)
> - `server/lib/loka/world_builder/*.ex` (room_manager, entity_manager, respawner)
> - `server/lib/loka_web/channels/room_helpers.ex`
> - `server/lib/loka_web/channels/command_parser.ex`
