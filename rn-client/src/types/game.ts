export type Direction = "north" | "south" | "east" | "west" | "up" | "down";

export type PageType =
  | "ROOM"
  | "DIALOGUE"
  | "ENTITY"
  | "MENU"
  | "SHOP"
  | "CONTAINER";

export type MenuTab =
  | "INVENTORY"
  | "EQUIPMENT"
  | "CHARACTER"
  | "QUESTS"
  | "MAP"
  | "SOCIAL"
  | "SETTINGS"
  | "DEV";

export interface RoomExit {
  direction: Direction;
  destination_key?: string;
}

export interface EntitySummary {
  id: string;
  key: string;
  name: string;
  long_desc?: string;
  description?: string;
  primary_keyword?: string;
  type: "npc" | "item" | "player";
}

export interface Room {
  id: string;
  key: string;
  name: string;
  description: string;
  exits: RoomExit[];
  npcs: EntitySummary[];
  items: EntitySummary[];
  players: EntitySummary[];
}

export interface GameEvent {
  text: string;
  class?: string;
  timestamp: number;
}

export interface DialogueChoice {
  index: number;
  text: string;
}

export interface DialogueEntry {
  speaker?: string;
  text: string;
  type: "npc" | "player" | "narration";
}

export interface DialogueState {
  speaker: string;
  text: string;
  choices: DialogueChoice[];
  history: DialogueEntry[];
}

export interface EntityDetail {
  id: string;
  key: string;
  name: string;
  description: string;
  type: "npc" | "item";
  actions: string[];
}

export interface InventoryItem {
  id: string;
  key: string;
  name: string;
  quantity: number;
  equipped?: boolean;
}

export interface QuestObjective {
  id: string;
  description: string;
  completed: boolean;
}

export interface Quest {
  id: string;
  key: string;
  name: string;
  description: string;
  status: "active" | "completed";
  objectives: QuestObjective[];
}

export interface ShopItem {
  index: number;
  name: string;
  price: number;
  description?: string;
}

export interface ShopState {
  name: string;
  items: ShopItem[];
  gold: number;
}

export interface ContainerState {
  name: string;
  items: InventoryItem[];
}

export interface CharacterStats {
  name: string;
  level: number;
  health: number;
  max_health: number;
  gold: number;
}

export interface CutsceneLine {
  speaker?: string;
  text: string;
  type?: string;
}

export interface Atmosphere {
  phase: string;
  weather: string;
}

export interface MinimapNode {
  key: string;
  x: number;
  y: number;
  current: boolean;
  exits: Direction[];
}
