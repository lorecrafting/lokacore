/**
 * Game Types - matches Phoenix channel payloads
 */

export interface Room {
  id: string;
  title: string;
  description: string;
  exits: Exit[];
  entities: Entity[];
  items: Item[];
  tags: string[];
}

export interface Exit {
  direction: string;
  destination_id: string | null;
  description?: string;
}

export interface Entity {
  id: string;
  name: string;
  type: 'npc' | 'player' | 'mob';
  long_desc?: string;
  description?: string;
  primary_keyword?: string;
  key?: string;
}

export interface Item {
  id: string;
  name: string;
  key?: string;
  long_desc?: string;
  description?: string;
  primary_keyword?: string;
  components?: Record<string, unknown>;
}

export interface Player {
  id: string;
  name: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  key?: string;
  description?: string;
  long_desc?: string;
  quantity?: number;
  // Components sent as array of component names from server
  components?: string[] | Record<string, unknown>;
}

export interface EquippedItem {
  id: string;
  name: string;
  slot: string;
}

export interface Quest {
  id: string;
  key: string;
  title: string;
  description: string;
  objectives: QuestObjective[];
  rewards?: QuestRewards;
  completed?: boolean;
}

export interface QuestObjective {
  id: string;
  description: string;
  completed: boolean;
  progress?: number;
  target?: number;
}

export interface QuestRewards {
  xp?: number;
  gold?: number;
  items?: string[];
}

export interface Resources {
  [key: string]: {
    current: number;
    max: number;
  };
}

export interface Stats {
  level?: number;
  xp?: number;
  xp_to_next?: number;
  gold?: number;
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  [key: string]: number | undefined;
}

// Combat types
export interface CombatState {
  active: boolean;
  enemy: CombatEnemy;
  enemyId: string;
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  canFlee: boolean;
  pvp?: boolean;
}

export interface CombatEnemy {
  id: string;
  name: string;
  health: { current: number; max: number };
  xp_reward?: number;
  gold_reward?: number;
}

// Shop types
export interface ShopState {
  open: boolean;
  npcId: string;
  npcName: string;
  items: ShopItem[];
  buys: string[]; // item keys the shop will buy
}

export interface ShopItem {
  key: string;
  name: string;
  description: string;
  price: number;
}

// Container types
export interface ContainerState {
  open: boolean;
  entityId: string;
  entityName: string;
  items: ContainerItem[];
}

export interface ContainerItem {
  id: string;
  name: string;
  description?: string;
}

// Bardo (death) types
export interface BardoState {
  active: boolean;
  enemyName?: string;
  canReincarnate: boolean;
  bindPoint: string;
  messages: string[];
}

// Gathering types
export interface GatheringNode {
  type: string;
  name: string;
  description?: string;
}

// Crafting types
export interface CraftingRecipe {
  key: string;
  name: string;
  description?: string;
  ingredients: CraftingIngredient[];
  canCraft: boolean;
}

export interface CraftingIngredient {
  key: string;
  name: string;
  quantity: number;
  have: number;
}

// Emote types
export interface EmoteCategory {
  name: string;
  emotes: Emote[];
}

export interface Emote {
  key: string;
  name: string;
  requiresTarget?: boolean;
}

// Social types
export interface SocialState {
  mood?: string;
  pose?: string;
}

// Calendar types (Traditional Chinese calendar)
export interface CalendarState {
  // Compact for status bar
  hour_char: string; // Earthly Branch character (子, 丑, etc.)
  hour_animal: string; // Animal name
  phase: TimePhase;
  // Full date info
  day: number;
  month: number;
  month_name: string; // Poetic month name
  month_char: string; // Chinese characters
  year: number;
  year_animal: string;
  year_element: 'wood' | 'fire' | 'earth' | 'metal' | 'water';
  year_char: string; // 60-year cycle characters
  // Moon phase info
  moon_phase: MoonPhase;
  moon_phase_name: string;
  moon_phase_char: string;
  moon_illumination: number; // 0.0 to 1.0
  // Solar term (if on special day)
  solar_term?: {
    name: string;
    char: string;
    major: boolean;
  } | null;
}

// Time phase for day/night cycle
export type TimePhase = 'dawn' | 'day' | 'dusk' | 'night';

// Moon phases
export type MoonPhase =
  | 'new'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full'
  | 'waning_gibbous'
  | 'last_quarter'
  | 'waning_crescent';

// Light source types
export type LightSource = 'candle' | 'torch' | 'lantern' | null;

// Biome types for environmental effects
export type Biome =
  | 'default'
  | 'forest'
  | 'mountain'
  | 'cave'
  | 'village'
  | 'monastery'
  | 'market'
  | 'water'
  | 'desert'
  | 'swamp'
  | 'enchanted'
  | 'bardo';

// Weather types
export type Weather = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'snow';

// Visual state for environmental effects
export interface VisualState {
  // Time information
  phase: TimePhase;
  hour: number;
  minute: number;
  light_level: number; // 0.0 to 1.0

  // Moon information
  moon_phase: MoonPhase;
  moon_illumination: number; // 0.0 to 1.0

  // Weather
  weather: Weather;

  // Player state
  player_light_source: LightSource;

  // Room properties
  is_indoor: boolean;
  biome: Biome;
}

// Sound state for ambient audio
export interface SoundState {
  ambient: string[]; // Ambient sound keys to play
  weather: string[]; // Weather overlay sound keys
  light: string[]; // Light source sound keys
  is_indoor: boolean; // Affects volume/reverb
  phase: TimePhase; // For transition timing
}

export interface GameState {
  room: Room;
  atmosphere: string;
  calendar?: CalendarState;
  visual_state?: VisualState;
  sound_state?: SoundState;
  other_players: Player[];
  inventory: InventoryItem[];
  equipped: Record<string, EquippedItem>;
  quests: Quest[];
  completedQuests?: Quest[];
  stats: Stats;
  health: { current: number; max: number };
  resources: Resources;
  player: Player;
  combat?: CombatState | null;
  shop?: ShopState | null;
  container?: ContainerState | null;
  bardo?: BardoState | null;
  social?: SocialState;
}

export interface GameEvent {
  text: string;
  timestamp?: string;
  type?: 'normal' | 'combat' | 'system' | 'chat' | 'quest';
}
