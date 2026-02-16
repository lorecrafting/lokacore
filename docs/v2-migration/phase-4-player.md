# Phase 4: Player Migration

> Full spec: `docs/architecture/unified-object-system-v2.md` Section 16 (Steps 4.1-4.3) + Section 5 (Players as Entities) + Section 39 (GameChannel)
> **Depends on**: Phase 3 | **Can run in parallel with Phase 5**

## Task 4.1: Player Data Migration + Login/Logout

### Data Migration

Create `priv/repo/migrations/TIMESTAMP_migrate_players_to_entities.exs`:

Read each `player_game_states` row and create a character entity:

```elixir
components = %{
  "player" => %{"settings" => gs.settings},
  "combatant" => %{"health" => gs.health["current"], "max_health" => gs.health["max"]},
  "stats" => gs.stats,
  "quest_progress" => gs.quests,
  "resources" => gs.resources,
  "skills" => gs.skills,
  "equipment" => gs.equipment
}
```

- `account_id` is a **top-level indexed column**, NOT in components
- Inventory items: set `location_id` = character entity ID
- Character `location_id` = the room they were last in

### Login Flow (game_channel.ex join/3)

```elixir
# Before (V1)
game_state = PlayerGameState.get_or_create_state(player.id)
room = RoomHelpers.load_room_for_display(game_state.current_room_id)

# After (V2)
{:ok, character} = Entities.find_one(account_id: player.id)
{:ok, _pid} = EntityRegistry.get_or_start(character.id)
{:ok, room} = EntityServer.get(character.location_id)
Entities.add_tag(character.id, "online")
```

### Logout Flow

```elixir
Entities.remove_tag(character.id, "online")
# EntityServer stays running (idle timeout will stop it)
```

### Session.Server

Session stores ephemeral connection state (clients, current room reference, combat/dialogue flags). It does NOT store game state — that's the character entity. Update any `GameState` refs to read from the character entity instead.

## Task 4.2: GameState Consumers (Batch 1: Core Framework)

### Pattern

Every `GameState` reference follows one of these patterns:

```elixir
# Read pattern
# Before:
health = PlayerGameState.get_field(gs, :health)
# After:
health = get_in(entity.components, ["combatant", "health"])
# Or with component accessors (Phase 7):
health = Components.Combatant.health(entity)

# Write pattern
# Before:
{:ok, gs} = PlayerGameState.update_state(gs, %{health: new_health})
# After:
EntityServer.update(char_id, fn e ->
  put_in(e.components, ["combatant", "health"], new_health)
end, force_save: true)
```

### Files in this batch

**Quest system** (~10 files):
- `framework/quest/progress.ex` — quest state reads/writes
- `framework/quest/progress/tracking.ex`
- `framework/quest/progress/rewards.ex`
- `framework/quest/state_helper.ex`
- `framework/quest/handlers/*.ex` (5 handlers)

**Inventory** (~4 files):
- `framework/inventory/inventory.ex`
- `framework/inventory/equipable.ex`
- `framework/inventory/equipment.ex`
- `framework/inventory/container.ex`

**Combat** (~3 files):
- `framework/combat/combat.ex`
- `framework/combat/combat_server.ex`
- `framework/combat/respawn_manager.ex`

**Skills** (~2 files):
- `framework/skills/skill_manager.ex`
- `framework/skills/binary_skill_manager.ex`

**Other**:
- `framework/conditions/evaluator.ex`
- `framework/dialogue/dialogue.ex`

## Task 4.3: GameState Consumers (Batch 2: Channel + Remaining)

### game_channel.ex (~50 refs)

The largest single file. Four replacement patterns:

```elixir
# Pattern 1: GameState reads
PlayerGameState.get_field(socket.assigns.game_state, :health)
→ get_in(socket.assigns.character.components, ["combatant", "health"])

# Pattern 2: GameState writes
PlayerGameState.update_state(gs, %{health: new_health})
→ EntityServer.update(char_id, fn e -> ... end)

# Pattern 3: Room loading
RoomHelpers.load_room_for_display(room_id)
→ EntityServer.get(room_id)

# Pattern 4: TypedObject lookups (these move to Phase 5)
TypedObject.Loader.get("intro_welcome")
→ Entities.find_one(key: "intro_welcome", type: :quest)
```

Note: game_channel has BOTH GameState refs (Phase 4) and TypedObject refs (Phase 5). It gets touched in both phases. In Phase 4, focus on GameState refs only.

### Other files
- `game_channel/action_bridge.ex`
- `channels/room_helpers.ex`
- `session/server.ex` (if any remaining refs)

### Final step
- Delete `lib/loka/framework/player/game_state.ex`
- Delete any orphaned GameState tests
- Run full test suite
