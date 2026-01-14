// =============================================================================
// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// =============================================================================
//
// Generated from: server/lib/loka/channel/events.ex
// Generated at: 2026-01-13T22:37:07.227339Z
//
// To regenerate: cd server && mix loka.gen.channel_types
//
// This file defines all channel events between server and client.
// The source of truth is the Elixir events.ex file.
// =============================================================================

// =============================================================================
// Server -> Client Event Payloads
// =============================================================================

export interface AtmosphereUpdatePayload {
  atmosphere: string;
  calendar?: Record<string, unknown>;
  sound_state?: Record<string, unknown>;
  visual_state?: Record<string, unknown>;
}

export interface BardoCanReincarnatePayload {}

export interface BardoEnterPayload {
  bind_point: string;
}

export interface BardoExitPayload {}

export interface CaptureScreenshotPayload {}

export interface CombatEndPayload {
  reason?: string;
  result?: "victory" | "defeat" | "fled";
  rewards?: Record<string, unknown>;
}

export interface CombatStartPayload {
  enemy: { health: { current: number; max: number }; id: string; name: string };
  pvp?: boolean;
}

export interface CombatUpdatePayload {
  can_flee?: boolean;
  enemy_health?: { current: number; max: number };
  player_health?: { current: number; max: number };
}

export interface ContainerClosePayload {}

export interface ContainerOpenPayload {
  entity_id: string;
  entity_name: string;
  items: unknown[];
}

export interface ContainerUpdatePayload {
  items: unknown[];
}

export interface DialogueEndPayload {}

export interface DialogueStartPayload {
  choices: unknown[];
  entity_id: string;
  node_id: string;
  speaker?: string;
  text: string;
}

export interface DialogueUpdatePayload {
  choices: unknown[];
  node_id: string;
  speaker?: string;
  text: string;
}

export interface EntityContextPayload {
  entity: Record<string, unknown>;
}

export interface EquipmentUpdatePayload {
  equipped: Record<string, unknown>;
}

export interface EventPayload {
  text: string;
  type?: string;
}

export interface ForceDisconnectPayload {
  reason: string;
}

export interface GameStatePayload {
  atmosphere: string;
  equipped: Record<string, unknown>;
  health: { current: number; max: number };
  inventory: unknown[];
  other_players: unknown[];
  quests: unknown[];
  resources: Record<string, unknown>;
  room: Record<string, unknown>;
  server?: Record<string, unknown>;
  stats: Record<string, unknown>;
}

export interface InventoryUpdatePayload {
  action?: string;
  inventory?: unknown[];
  item_id?: string;
}

export interface PlayersUpdatePayload {
  players: unknown[];
}

export interface QuestAcceptedPayload {
  name: string;
  quest?: Record<string, unknown>;
  quest_id: string;
}

export interface QuestCompletedPayload {
  quest_id: string;
  rewards?: Record<string, unknown>;
  title: string;
}

export interface QuestProgressPayload {
  quests: unknown[];
}

export interface ResourcesUpdatePayload {
  resources: Record<string, unknown>;
}

export interface RoomUpdatePayload {
  atmosphere: string;
  other_players: unknown[];
  room: Record<string, unknown>;
  sound_state?: Record<string, unknown>;
  visual_state?: Record<string, unknown>;
}

export interface ShopClosePayload {}

export interface ShopOpenPayload {
  buys: unknown[];
  items: unknown[];
  npc_id: string;
  npc_name: string;
}

export interface StatsUpdatePayload {
  stats: Record<string, unknown>;
}

export interface TimerCompletedPayload {
  completed_at?: string;
  data?: Record<string, unknown>;
  scheduled_at?: string;
  timer_id?: string;
  timer_type: string;
}
// =============================================================================
// Client -> Server Event Requests
// =============================================================================

export interface ActionRequest {
  action: string;
  entity_id: string;
}

export interface BardoRequest {
  action: "reincarnate";
}

export interface ChatRequest {
  message: string;
  mode: "say" | "shout";
}

export interface ClickEntityRequest {
  entity_id?: string;
  id?: string;
  type?: string;
}

export interface CombatActionRequest {
  action: "flee";
}

export interface ContainerRequest {
  action: "take" | "close";
  index?: number;
}

export interface CraftRequest {
  recipe_key: string;
  tool_id?: string;
}

export interface DialogueSelectRequest {
  choice_index: number;
}

export interface EmoteRequest {
  emote_key: string;
  target_id?: string;
}

export interface GatherRequest {
  node_type: string;
}

export interface InventoryRequest {
  action: "drop" | "equip" | "unequip";
  item_id?: string;
  slot?: string;
}

export interface NavigateRequest {
  direction: "north" | "south" | "east" | "west" | "up" | "down" | "n" | "s" | "e" | "w" | "u" | "d";
}

export interface ShopRequest {
  action: "buy" | "sell" | "close";
  item_id?: string;
  item_key?: string;
  npc_id?: string;
}

export interface SocialRequest {
  action: "set_mood" | "set_pose";
  mood?: string;
  pose?: string;
}

export interface UseItemRequest {
  item_id: string;
}
// =============================================================================
// Event Name Types
// =============================================================================

export type ServerEventName =
  | "atmosphere_update"
  | "bardo_can_reincarnate"
  | "bardo_enter"
  | "bardo_exit"
  | "capture_screenshot"
  | "combat_end"
  | "combat_start"
  | "combat_update"
  | "container_close"
  | "container_open"
  | "container_update"
  | "dialogue_end"
  | "dialogue_start"
  | "dialogue_update"
  | "entity_context"
  | "equipment_update"
  | "event"
  | "force_disconnect"
  | "game_state"
  | "inventory_update"
  | "players_update"
  | "quest_accepted"
  | "quest_completed"
  | "quest_progress"
  | "resources_update"
  | "room_update"
  | "shop_close"
  | "shop_open"
  | "stats_update"
  | "timer_completed";

export type ClientEventName =
  | "action"
  | "bardo"
  | "chat"
  | "click_entity"
  | "combat_action"
  | "container"
  | "craft"
  | "dialogue_select"
  | "emote"
  | "gather"
  | "inventory"
  | "navigate"
  | "shop"
  | "social"
  | "use_item";

// =============================================================================
// Runtime Schemas - for client-side validation
// =============================================================================

export interface FieldSchema {
  type: 'string' | 'integer' | 'boolean' | 'map' | 'list' | 'enum' | 'object';
  required: boolean;
  enumValues?: string[];
  nested?: Record<string, FieldSchema>;
}

export type EventSchema = Record<string, FieldSchema>;

export const SERVER_EVENT_SCHEMAS: Record<string, EventSchema> = {
  "atmosphere_update": {
    "atmosphere": { type: 'string', required: true },
    "calendar": { type: 'map', required: false },
    "sound_state": { type: 'map', required: false },
    "visual_state": { type: 'map', required: false }
  },
  "bardo_can_reincarnate": {},
  "bardo_enter": {
    "bind_point": { type: 'string', required: true }
  },
  "bardo_exit": {},
  "capture_screenshot": {},
  "combat_end": {
    "reason": { type: 'string', required: false },
    "result": { type: 'enum', required: false, enumValues: ["victory", "defeat", "fled"] },
    "rewards": { type: 'map', required: false }
  },
  "combat_start": {
    "enemy": { type: 'object', required: true, nested: {
    "health": { type: 'object', required: true, nested: {
    "current": { type: 'integer', required: true },
    "max": { type: 'integer', required: true }
  } },
    "id": { type: 'string', required: true },
    "name": { type: 'string', required: true }
  } },
    "pvp": { type: 'boolean', required: false }
  },
  "combat_update": {
    "can_flee": { type: 'boolean', required: false },
    "enemy_health": { type: 'object', required: false, nested: {
    "current": { type: 'integer', required: false },
    "max": { type: 'integer', required: false }
  } },
    "player_health": { type: 'object', required: false, nested: {
    "current": { type: 'integer', required: false },
    "max": { type: 'integer', required: false }
  } }
  },
  "container_close": {},
  "container_open": {
    "entity_id": { type: 'string', required: true },
    "entity_name": { type: 'string', required: true },
    "items": { type: 'list', required: true }
  },
  "container_update": {
    "items": { type: 'list', required: true }
  },
  "dialogue_end": {},
  "dialogue_start": {
    "choices": { type: 'list', required: true },
    "entity_id": { type: 'string', required: true },
    "node_id": { type: 'string', required: true },
    "speaker": { type: 'string', required: false },
    "text": { type: 'string', required: true }
  },
  "dialogue_update": {
    "choices": { type: 'list', required: true },
    "node_id": { type: 'string', required: true },
    "speaker": { type: 'string', required: false },
    "text": { type: 'string', required: true }
  },
  "entity_context": {
    "entity": { type: 'map', required: true }
  },
  "equipment_update": {
    "equipped": { type: 'map', required: true }
  },
  "event": {
    "text": { type: 'string', required: true },
    "type": { type: 'string', required: false }
  },
  "force_disconnect": {
    "reason": { type: 'string', required: true }
  },
  "game_state": {
    "atmosphere": { type: 'string', required: true },
    "equipped": { type: 'map', required: true },
    "health": { type: 'object', required: true, nested: {
    "current": { type: 'integer', required: true },
    "max": { type: 'integer', required: true }
  } },
    "inventory": { type: 'list', required: true },
    "other_players": { type: 'list', required: true },
    "quests": { type: 'list', required: true },
    "resources": { type: 'map', required: true },
    "room": { type: 'map', required: true },
    "server": { type: 'map', required: false },
    "stats": { type: 'map', required: true }
  },
  "inventory_update": {
    "action": { type: 'string', required: false },
    "inventory": { type: 'list', required: false },
    "item_id": { type: 'string', required: false }
  },
  "players_update": {
    "players": { type: 'list', required: true }
  },
  "quest_accepted": {
    "name": { type: 'string', required: true },
    "quest": { type: 'map', required: false },
    "quest_id": { type: 'string', required: true }
  },
  "quest_completed": {
    "quest_id": { type: 'string', required: true },
    "rewards": { type: 'map', required: false },
    "title": { type: 'string', required: true }
  },
  "quest_progress": {
    "quests": { type: 'list', required: true }
  },
  "resources_update": {
    "resources": { type: 'map', required: true }
  },
  "room_update": {
    "atmosphere": { type: 'string', required: true },
    "other_players": { type: 'list', required: true },
    "room": { type: 'map', required: true },
    "sound_state": { type: 'map', required: false },
    "visual_state": { type: 'map', required: false }
  },
  "shop_close": {},
  "shop_open": {
    "buys": { type: 'list', required: true },
    "items": { type: 'list', required: true },
    "npc_id": { type: 'string', required: true },
    "npc_name": { type: 'string', required: true }
  },
  "stats_update": {
    "stats": { type: 'map', required: true }
  },
  "timer_completed": {
    "completed_at": { type: 'string', required: false },
    "data": { type: 'map', required: false },
    "scheduled_at": { type: 'string', required: false },
    "timer_id": { type: 'string', required: false },
    "timer_type": { type: 'string', required: true }
  }
};

export const CLIENT_EVENT_SCHEMAS: Record<string, EventSchema> = {
  "action": {
    "action": { type: 'string', required: true },
    "entity_id": { type: 'string', required: true }
  },
  "bardo": {
    "action": { type: 'enum', required: true, enumValues: ["reincarnate"] }
  },
  "chat": {
    "message": { type: 'string', required: true },
    "mode": { type: 'enum', required: true, enumValues: ["say", "shout"] }
  },
  "click_entity": {
    "entity_id": { type: 'string', required: false },
    "id": { type: 'string', required: false },
    "type": { type: 'string', required: false }
  },
  "combat_action": {
    "action": { type: 'enum', required: true, enumValues: ["flee"] }
  },
  "container": {
    "action": { type: 'enum', required: true, enumValues: ["take", "close"] },
    "index": { type: 'integer', required: false }
  },
  "craft": {
    "recipe_key": { type: 'string', required: true },
    "tool_id": { type: 'string', required: false }
  },
  "dialogue_select": {
    "choice_index": { type: 'integer', required: true }
  },
  "emote": {
    "emote_key": { type: 'string', required: true },
    "target_id": { type: 'string', required: false }
  },
  "gather": {
    "node_type": { type: 'string', required: true }
  },
  "inventory": {
    "action": { type: 'enum', required: true, enumValues: ["drop", "equip", "unequip"] },
    "item_id": { type: 'string', required: false },
    "slot": { type: 'string', required: false }
  },
  "navigate": {
    "direction": { type: 'enum', required: true, enumValues: ["north", "south", "east", "west", "up", "down", "n", "s", "e", "w", "u", "d"] }
  },
  "shop": {
    "action": { type: 'enum', required: true, enumValues: ["buy", "sell", "close"] },
    "item_id": { type: 'string', required: false },
    "item_key": { type: 'string', required: false },
    "npc_id": { type: 'string', required: false }
  },
  "social": {
    "action": { type: 'enum', required: true, enumValues: ["set_mood", "set_pose"] },
    "mood": { type: 'string', required: false },
    "pose": { type: 'string', required: false }
  },
  "use_item": {
    "item_id": { type: 'string', required: true }
  }
};

// =============================================================================
// Payload Type Maps - for type-safe handlers
// =============================================================================

export interface ServerEventPayloads {
  atmosphere_update: AtmosphereUpdatePayload;
  bardo_can_reincarnate: BardoCanReincarnatePayload;
  bardo_enter: BardoEnterPayload;
  bardo_exit: BardoExitPayload;
  capture_screenshot: CaptureScreenshotPayload;
  combat_end: CombatEndPayload;
  combat_start: CombatStartPayload;
  combat_update: CombatUpdatePayload;
  container_close: ContainerClosePayload;
  container_open: ContainerOpenPayload;
  container_update: ContainerUpdatePayload;
  dialogue_end: DialogueEndPayload;
  dialogue_start: DialogueStartPayload;
  dialogue_update: DialogueUpdatePayload;
  entity_context: EntityContextPayload;
  equipment_update: EquipmentUpdatePayload;
  event: EventPayload;
  force_disconnect: ForceDisconnectPayload;
  game_state: GameStatePayload;
  inventory_update: InventoryUpdatePayload;
  players_update: PlayersUpdatePayload;
  quest_accepted: QuestAcceptedPayload;
  quest_completed: QuestCompletedPayload;
  quest_progress: QuestProgressPayload;
  resources_update: ResourcesUpdatePayload;
  room_update: RoomUpdatePayload;
  shop_close: ShopClosePayload;
  shop_open: ShopOpenPayload;
  stats_update: StatsUpdatePayload;
  timer_completed: TimerCompletedPayload;
}

export interface ClientEventPayloads {
  action: ActionRequest;
  bardo: BardoRequest;
  chat: ChatRequest;
  click_entity: ClickEntityRequest;
  combat_action: CombatActionRequest;
  container: ContainerRequest;
  craft: CraftRequest;
  dialogue_select: DialogueSelectRequest;
  emote: EmoteRequest;
  gather: GatherRequest;
  inventory: InventoryRequest;
  navigate: NavigateRequest;
  shop: ShopRequest;
  social: SocialRequest;
  use_item: UseItemRequest;
}
