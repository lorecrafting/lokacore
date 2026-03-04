import { create } from "zustand";
import type {
  PageType,
  MenuTab,
  Room,
  GameEvent,
  DialogueState,
  EntityDetail,
  InventoryItem,
  Quest,
  ShopState,
  ContainerState,
  CharacterStats,
  CutsceneLine,
  Atmosphere,
  Direction,
} from "../types/game";

interface GameStore {
  // Connection
  connected: boolean;
  setConnected: (connected: boolean) => void;

  // Auth
  token: string | null;
  playerName: string | null;
  setAuth: (token: string, name: string) => void;
  clearAuth: () => void;

  // Page navigation
  currentPage: PageType;
  previousPage: PageType | null;
  menuTab: MenuTab;
  setPage: (page: PageType) => void;
  setMenuTab: (tab: MenuTab) => void;

  // Room
  room: Room | null;
  setRoom: (room: Room) => void;

  // Events
  events: GameEvent[];
  addEvent: (text: string, eventClass?: string) => void;
  clearEvents: () => void;

  // Dialogue
  dialogue: DialogueState | null;
  startDialogue: (dialogue: DialogueState) => void;
  updateDialogue: (dialogue: Partial<DialogueState>) => void;
  endDialogue: () => void;

  // Entity detail
  currentEntity: EntityDetail | null;
  setCurrentEntity: (entity: EntityDetail) => void;

  // Inventory
  inventory: InventoryItem[];
  updateInventory: (items: InventoryItem[]) => void;

  // Quests
  quests: Quest[];
  updateQuests: (quests: Quest[]) => void;
  updateQuestProgress: (questKey: string, objectiveId: string) => void;

  // Character
  character: CharacterStats | null;
  setCharacter: (stats: CharacterStats) => void;
  updateCharacter: (stats: Partial<CharacterStats>) => void;

  // Shop
  shop: ShopState | null;
  openShop: (shop: ShopState) => void;
  closeShop: () => void;

  // Container
  container: ContainerState | null;
  openContainer: (container: ContainerState) => void;
  updateContainer: (container: ContainerState) => void;
  closeContainer: () => void;

  // Cutscene
  cutscene: CutsceneLine[] | null;
  startCutscene: () => void;
  addCutsceneLine: (line: CutsceneLine) => void;
  endCutscene: () => void;

  // Atmosphere
  atmosphere: Atmosphere;
  setAtmosphere: (atmosphere: Atmosphere) => void;

  // Minimap
  visitedRooms: Map<string, { exits: Direction[] }>;
  markRoomVisited: (
    key: string,
    exits: Direction[],
  ) => void;
}

const MOCK_ROOM: Room = {
  id: "mock-1",
  key: "awakening_clearing",
  name: "Awakening Clearing",
  description:
    "Soft light filters through a canopy of silver leafed trees, casting dappled patterns across a carpet of luminescent moss. The air tastes faintly of copper and dew. A stone bench sits at the clearing's heart, its surface worn smooth by countless hands. Somewhere above, the canopy rustles without wind.",
  exits: [
    { direction: "north", destination_key: "heartwood_path" },
    { direction: "east", destination_key: "eastern_trail" },
    { direction: "south", destination_key: "stream_bank" },
  ],
  npcs: [
    { id: "npc-1", key: "thera", name: "Thera", type: "npc" },
    { id: "npc-2", key: "elder_maren", name: "Elder Maren", type: "npc" },
  ],
  items: [
    {
      id: "item-1",
      key: "worn_journal",
      name: "a worn journal",
      type: "item",
    },
  ],
  players: [],
};

export const useGameStore = create<GameStore>((set, get) => ({
  // Connection
  connected: false,
  setConnected: (connected) => set({ connected }),

  // Auth
  token: null,
  playerName: null,
  setAuth: (token, name) => set({ token, playerName: name }),
  clearAuth: () => set({ token: null, playerName: null }),

  // Page navigation
  currentPage: "ROOM",
  previousPage: null,
  menuTab: "INVENTORY",
  setPage: (page) =>
    set((s) => ({ currentPage: page, previousPage: s.currentPage })),
  setMenuTab: (tab) => set({ menuTab: tab }),

  // Room — use mock data for dev
  room: MOCK_ROOM,
  setRoom: (room) => {
    const { markRoomVisited } = get();
    markRoomVisited(
      room.key,
      room.exits.map((e) => e.direction),
    );
    set({ room });
  },

  // Events
  events: [
    { text: "You open your eyes slowly.", class: "event", timestamp: Date.now() - 3000 },
    { text: "The grove hums with a quiet energy.", class: "ambient", timestamp: Date.now() - 1000 },
  ],
  addEvent: (text, eventClass) =>
    set((s) => ({
      events: [
        ...s.events.slice(-19),
        { text, class: eventClass, timestamp: Date.now() },
      ],
    })),
  clearEvents: () => set({ events: [] }),

  // Dialogue
  dialogue: null,
  startDialogue: (dialogue) =>
    set((s) => ({ dialogue, currentPage: "DIALOGUE", previousPage: s.currentPage })),
  updateDialogue: (partial) =>
    set((s) => ({
      dialogue: s.dialogue ? { ...s.dialogue, ...partial } : null,
    })),
  endDialogue: () =>
    set((s) => ({
      dialogue: null,
      currentPage: s.previousPage ?? "ROOM",
    })),

  // Entity detail
  currentEntity: null,
  setCurrentEntity: (entity) =>
    set((s) => ({ currentEntity: entity, currentPage: "ENTITY", previousPage: s.currentPage })),

  // Inventory
  inventory: [],
  updateInventory: (items) => set({ inventory: items }),

  // Quests
  quests: [],
  updateQuests: (quests) => set({ quests }),
  updateQuestProgress: (questKey, objectiveId) =>
    set((s) => ({
      quests: s.quests.map((q) =>
        q.key === questKey
          ? {
              ...q,
              objectives: q.objectives.map((o) =>
                o.id === objectiveId ? { ...o, completed: true } : o,
              ),
            }
          : q,
      ),
    })),

  // Character
  character: null,
  setCharacter: (stats) => set({ character: stats }),
  updateCharacter: (stats) =>
    set((s) => ({
      character: s.character
        ? { ...s.character, ...stats }
        : (stats as CharacterStats),
    })),

  // Shop
  shop: null,
  openShop: (shop) =>
    set((s) => ({ shop, currentPage: "SHOP", previousPage: s.currentPage })),
  closeShop: () =>
    set((s) => ({
      shop: null,
      currentPage: s.previousPage ?? "ROOM",
    })),

  // Container
  container: null,
  openContainer: (container) =>
    set((s) => ({ container, currentPage: "CONTAINER", previousPage: s.currentPage })),
  updateContainer: (container) => set({ container }),
  closeContainer: () =>
    set((s) => ({
      container: null,
      currentPage: s.previousPage ?? "ROOM",
    })),

  // Cutscene
  cutscene: null,
  startCutscene: () => set({ cutscene: [] }),
  addCutsceneLine: (line) =>
    set((s) => ({
      cutscene: s.cutscene ? [...s.cutscene, line] : [line],
    })),
  endCutscene: () =>
    set((s) => ({
      cutscene: null,
      currentPage: s.previousPage ?? "ROOM",
    })),

  // Atmosphere
  atmosphere: { phase: "day", weather: "clear" },
  setAtmosphere: (atmosphere) => set({ atmosphere }),

  // Minimap
  visitedRooms: new Map([
    ["awakening_clearing", { exits: ["north", "east", "south"] as Direction[] }],
  ]),
  markRoomVisited: (key, exits) =>
    set((s) => {
      const next = new Map(s.visitedRooms);
      next.set(key, { exits });
      return { visitedRooms: next };
    }),
}));
