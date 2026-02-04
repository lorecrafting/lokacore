# Phoenix Channel API Contract

This document defines the API contract between the Loka server and mobile/web clients. Changes to this contract should follow semantic versioning.

## Version Information

| Property | Value |
|----------|-------|
| Current API Version | 1.0.0 |
| Minimum Client Version | 1.0.0 |
| Protocol | phoenix_channel_v2 |

## Versioning Policy

### Semantic Versioning

- **MAJOR (x.0.0)**: Breaking changes - client MUST update
- **MINOR (1.x.0)**: New features - backwards compatible, client SHOULD update
- **PATCH (1.0.x)**: Bug fixes - no action needed

### Breaking vs Non-Breaking Changes

| Change Type | Breaking? | Example |
|-------------|-----------|---------|
| Add new field to response | No | Adding `stamina` to resources |
| Add new event type | No | New `achievement_unlocked` event |
| Remove field from response | **Yes** | Removing `gold` from inventory |
| Rename field | **Yes** | `hp` → `health_points` |
| Change field type | **Yes** | `"100"` → `100` |
| Add required join param | **Yes** | Requiring `device_id` |
| Remove event type | **Yes** | Removing `room_update` |

### When to Bump Versions

1. **Bump server `min_client_version`** when making breaking changes
2. **Bump server `current_api_version`** for any API change
3. **Bump client `CLIENT_VERSION`** with each app release

## Connection Flow

```
Client                                  Server
  |                                        |
  |------ Socket Connect (JWT) ----------->|
  |                                        |
  |<----- Socket Open ---------------------|
  |                                        |
  |------ Channel Join ------------------->|
  |       {client_version: "1.0.0"}        |
  |                                        |
  |       [Version Check]                  |
  |       if version < min_version:        |
  |<----- Error: update_required ----------|
  |       else:                            |
  |<----- OK + game_state -----------------|
  |       (includes server capabilities)   |
  |                                        |
```

## Channel: `game:lobby`

### Join Parameters

```typescript
{
  client_version: string  // Required: semantic version (e.g., "1.0.0")
}
```

### Join Responses

**Success:**
```typescript
// Server pushes "game_state" event immediately after join
```

**Error - Update Required:**
```typescript
{
  reason: "update_required",
  min_version: "1.0.0"
}
```

**Error - Character Not Created:**
```typescript
{
  reason: "character_not_created"
}
```

---

## Server → Client Events

### Core State Events

#### `game_state`
Full game state sent on join. Includes server capabilities for version negotiation.

```typescript
{
  room: Room,
  atmosphere: string,
  other_players: Player[],
  inventory: InventoryItem[],
  equipped: Record<string, EquippedItem>,
  quests: Quest[],
  stats: Stats,
  health: { current: number, max: number },
  resources: Resources,
  timers: Timer[],
  player: { id: string, name: string },
  server: {                              // Added in 1.0.0
    api_version: string,
    min_client_version: string,
    features: string[],
    protocol: string
  }
}
```

#### `room_update`
Sent when player moves or room contents change.

```typescript
{
  room: Room,
  atmosphere: string,
  other_players: Player[]
}
```

#### `output`
Text output for MUD clients (room descriptions, command responses, builder output).

```typescript
{
  text: string  // May be prefixed with "[BUILDER]" for admin command output
}
```

#### `event`
Generic game event (chat, combat feedback, notifications).

```typescript
{
  text: string,
  type?: "normal" | "combat" | "quest" | "system"
}
```

#### `broadcast`
System-wide announcements and event messages.

```typescript
{
  text: string,
  type: "announcement" | "event" | "emergency"
}
```

### Resource Events

#### `resources_update`
```typescript
{
  resources: {
    health: { current: number, max: number, regen_rate: number },
    mana: { current: number, max: number, regen_rate: number },
    movement: { current: number, max: number, regen_rate: number }
  }
}
```

#### `stats_update`
```typescript
{
  stats: Stats
}
```

#### `health_update`
```typescript
{
  health: { current: number, max: number }
}
```

### Inventory Events

#### `inventory_update`
```typescript
{
  inventory: InventoryItem[]
}
```

#### `equipped_update`
```typescript
{
  equipped: Record<string, EquippedItem>
}
```

### Combat Events

#### `combat_start`
```typescript
{
  enemy: {
    id: string,
    name: string,
    health: { current: number, max: number }
  },
  pvp?: boolean
}
```

#### `combat_update`
```typescript
{
  player_hp?: number,
  player_max_hp?: number,
  enemy_hp?: number,
  enemy_max_hp?: number,
  can_flee?: boolean
}
```

#### `combat_end`
```typescript
{
  result: "victory" | "defeat" | "fled"
}
```

### Dialogue Events

#### `dialogue_start`
```typescript
{
  entity_id: string,
  node_id: string,
  text: string,
  speaker?: string,
  choices: { text: string }[]
}
```

#### `dialogue_update`
```typescript
{
  node_id: string,
  text: string,
  speaker?: string,
  choices: { text: string }[]
}
```

#### `dialogue_end`
```typescript
{}
```

### Shop Events

#### `shop_open`
```typescript
{
  npc_id: string,
  npc_name: string,
  items: ShopItem[],
  buys: string[]
}
```

#### `shop_close`
```typescript
{}
```

### Container Events

#### `container_open`
```typescript
{
  entity_id: string,
  entity_name: string,
  items: ContainerItem[]
}
```

#### `container_update`
```typescript
{
  items: ContainerItem[]
}
```

#### `container_close`
```typescript
{}
```

### Bardo (Death) Events

#### `bardo_start`
```typescript
{
  bind_point: string
}
```

#### `bardo_message`
```typescript
{
  text: string
}
```

#### `bardo_ready`
```typescript
{}
```

#### `bardo_end`
```typescript
{}
```

### Quest Events

#### `quest_started`
```typescript
{
  quest: Quest
}
```

#### `quest_updated`
```typescript
{
  quest: Quest
}
```

#### `quest_completed`
```typescript
{
  quest: Quest
}
```

### Presence Events

#### `players_update`
```typescript
{
  players: Player[]
}
```

---

## Client → Server Events

### Navigation

#### `navigate`
```typescript
{
  direction: string  // "north", "south", "east", "west", "up", "down"
}
```

### Entity Interaction

#### `click_entity`
```typescript
{
  id: string,
  type: string  // "npc", "item", etc.
}
```

#### `action`
Generic action on entity.

```typescript
{
  action: "talk" | "attack" | "get" | "open" | "shop",
  entity_id: string
}
```

### Dialogue

#### `dialogue_select`
```typescript
{
  choice_index: number
}
```

### Inventory

#### `inventory`
```typescript
{
  action: "drop" | "equip" | "unequip",
  item_id?: string,  // For drop, equip
  slot?: string      // For unequip
}
```

#### `use_item`
```typescript
{
  item_id: string
}
```

### Combat

#### `combat_action`
```typescript
{
  action: "flee"
}
```

### Shop

#### `shop`
```typescript
{
  action: "buy" | "sell" | "close",
  item_key?: string,  // For buy
  item_id?: string,   // For sell
  npc_id?: string     // For buy/sell
}
```

### Container

#### `container`
```typescript
{
  action: "take" | "close",
  index?: number  // For take
}
```

### Gathering & Crafting

#### `gather`
```typescript
{
  node_type: string
}
```

#### `craft`
```typescript
{
  recipe_key: string,
  tool_id: string | null
}
```

### Social

#### `emote`
```typescript
{
  emote_key: string,
  target_id?: string  // Optional target
}
```

#### `social`
```typescript
{
  action: "set_mood" | "set_pose",
  mood?: string,  // For set_mood
  pose?: string   // For set_pose
}
```

#### `chat`
```typescript
{
  mode: "say" | "shout",
  message: string
}
```

### Bardo

#### `bardo`
```typescript
{
  action: "reincarnate"
}
```

### Text Commands

#### `command`
Raw text input for MUD-style interaction. Parsed by `CommandParser` into structured actions.

```typescript
{
  input: string  // e.g., "north", "look monk", "goto tavern"
}
```

**Player commands**: `north`, `look`, `talk <npc>`, `inventory`, `get <item>`, `drop <item>`, `say <msg>`, `attack <target>`, `flee`, `equip <item>`, `unequip <slot>`, `who`, `help`

**Builder commands** (admin-only, silently rejected for non-admins):
`goto <room>`, `rooms`, `where`, `find <search>`, `info <entity>`, `list npcs|items|quests`, `spawn <npc>`, `purge`, `give <item>`, `setflag <flag>`, `clearflag <flag>`, `flags`, `startquest <key>`, `completequest <key>`, `resetquest <key>`, `quests`, `settime dawn|noon|dusk|midnight`, `reload`, `validate`, `godmode`

### Spark Companion

#### `spark`
```typescript
{
  action: "status" | "updates" | "dismiss" | "ask",
  question?: string  // Required for "ask"
}
```

---

## Type Definitions

### Room
```typescript
interface Room {
  id: string;
  title: string;
  description: string;
  exits: Record<string, string>;  // direction -> room_id
  entities: Entity[];
  items: Item[];
}
```

### Player
```typescript
interface Player {
  id: string;
  name: string;
}
```

### Entity
```typescript
interface Entity {
  id: string;
  name: string;
  type: string;
  description?: string;
}
```

### InventoryItem
```typescript
interface InventoryItem {
  id: string;
  key: string;
  name: string;
  description?: string;
  slot?: string;
  stackable?: boolean;
  quantity?: number;
}
```

### Quest
```typescript
interface Quest {
  id: string;
  title: string;
  description: string;
  objectives: QuestObjective[];
  status: "active" | "completed" | "failed";
}
```

---

## Changelog

### Version 1.0.0 (Initial)
- Initial API contract
- All core game features: navigation, combat, inventory, dialogue, shops, crafting
- Version negotiation on channel join
- Server capabilities reporting

---

## Migration Guide

### Upgrading Clients

When the server bumps `min_client_version`, clients below that version will receive an `update_required` error on join. Handle this by:

1. Detecting the error in `channel.join().receive('error', ...)`
2. Showing an update prompt to the user
3. Linking to app store for update

### Server-Side Version Bumps

When making breaking changes:

1. Update `@min_client_version` in `VersionCompatibility`
2. Update `@current_api_version` in `VersionCompatibility`
3. Add entry to this changelog
4. Coordinate mobile app release

### Feature Flags

For gradual rollouts, use the `features` array in server capabilities:

```elixir
# Server
@version_features %{
  "1.0.0" => [:navigation, :combat, ...],
  "1.1.0" => [:navigation, :combat, :new_feature, ...]
}
```

```typescript
// Client
if (serverCapabilities?.features.includes('new_feature')) {
  // Show new feature UI
}
```
