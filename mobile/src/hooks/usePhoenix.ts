/**
 * Phoenix Channel Hook for Loka Game
 *
 * Connects to the Phoenix backend via WebSocket and manages game state.
 * Handles all game features: combat, inventory, shop, quests, etc.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Config-based server URL
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Socket, Channel } from 'phoenix';
import { AppState, AppStateStatus } from 'react-native';
import { config } from '../config';
import type {
  GameState,
  GameEvent,
  Room,
  Player,
  Resources,
  CombatState,
  ShopState,
  ContainerState,
  BardoState,
  InventoryItem,
  Quest,
  Stats,
  EquippedItem,
  CalendarState,
  VisualState,
  SoundState,
} from '../types/game';

interface UsePhoenixOptions {
  token: string | null;
  onDisconnect?: () => void;
  onUpdateRequired?: (minVersion: string) => void;
}

// Server capabilities received on join
export interface ServerCapabilities {
  api_version: string;
  min_client_version: string;
  features: string[];
  protocol: string;
}

// Action definition from server
export interface EntityAction {
  key: string;
  label: string;
  icon?: string;
}

// Entity context from server when clicking on an entity
export interface EntityContext {
  id: string;
  name: string;
  type: string;
  long_desc?: string;
  description?: string;
  primary_keyword?: string;
  components?: string[];
  tags?: string[];
  actions?: EntityAction[];  // Server-resolved actions
}

// Dialogue state from server
export interface DialogueState {
  entityId: string;
  nodeId: string;
  text: string;
  speaker?: string;
  choices: { text: string }[];
}

// Dialogue history entry
export interface DialogueHistoryEntry {
  speaker: string;
  text: string;
  isPlayer: boolean;
}

interface UsePhoenixReturn {
  // Connection state
  connected: boolean;
  connecting: boolean;
  error: string | null;
  updateRequired: { required: boolean; minVersion: string | null };
  serverCapabilities: ServerCapabilities | null;

  // Game state
  gameState: GameState | null;
  events: GameEvent[];

  // Entity interaction state
  entityContext: EntityContext | null;
  dialogueState: DialogueState | null;
  dialogueHistory: DialogueHistoryEntry[];

  // Feature states
  combatState: CombatState | null;
  shopState: ShopState | null;
  containerState: ContainerState | null;
  bardoState: BardoState | null;

  // Navigation
  navigate: (direction: string) => void;

  // Communication
  say: (message: string) => void;
  shout: (message: string) => void;

  // Entity interaction
  clickEntity: (entityId: string) => void;
  performAction: (action: string, entityId: string) => void;
  closeEntityContext: () => void;

  // Dialogue
  selectDialogueOption: (choiceIndex: number) => void;
  endDialogue: () => void;

  // Inventory
  dropItem: (itemId: string) => void;
  equipItem: (itemId: string) => void;
  unequipItem: (slot: string) => void;
  useItem: (itemId: string) => void;

  // Combat
  flee: () => void;

  // Shop
  buyItem: (itemKey: string) => void;
  sellItem: (itemId: string) => void;
  closeShop: () => void;

  // Container
  takeFromContainer: (index: number) => void;
  closeContainer: () => void;

  // Gathering/Crafting
  gather: (nodeType: string) => void;
  craft: (recipeKey: string) => void;

  // Emotes
  emote: (emoteKey: string, targetId?: string) => void;

  // Social
  setMood: (mood: string) => void;
  setPose: (pose: string) => void;

  // Bardo
  reincarnate: () => void;

  // Utility
  clearEvents: () => void;

  // Channel access (for debug features)
  channel: Channel | null;
}

export function usePhoenix({ token, onDisconnect, onUpdateRequired }: UsePhoenixOptions): UsePhoenixReturn {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateRequired, setUpdateRequired] = useState<{ required: boolean; minVersion: string | null }>({
    required: false,
    minVersion: null,
  });
  const [serverCapabilities, setServerCapabilities] = useState<ServerCapabilities | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [entityContext, setEntityContext] = useState<EntityContext | null>(null);
  const [dialogueState, setDialogueState] = useState<DialogueState | null>(null);
  const [dialogueHistory, setDialogueHistory] = useState<DialogueHistoryEntry[]>([]);

  // Feature-specific state
  const [combatState, setCombatState] = useState<CombatState | null>(null);
  const [shopState, setShopState] = useState<ShopState | null>(null);
  const [containerState, setContainerState] = useState<ContainerState | null>(null);
  const [bardoState, setBardoState] = useState<BardoState | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const channelRef = useRef<Channel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const gameStateRef = useRef<GameState | null>(null);
  // Track intentional disconnection to prevent reconnect during cleanup
  const isIntentionalDisconnectRef = useRef(false);

  // Keep gameStateRef in sync for use in event handlers
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Add event to the log (ring buffer)
  const addEvent = useCallback((event: GameEvent) => {
    setEvents((prev) => {
      const newEvents = [...prev, event];
      return newEvents.length > config.maxEvents
        ? newEvents.slice(-config.maxEvents)
        : newEvents;
    });
  }, []);

  // Clear events
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Calculate reconnection delay with exponential backoff
  const getReconnectDelay = useCallback(() => {
    const baseDelay = config.reconnectInitialDelay;
    const maxDelay = config.reconnectMaxDelay;
    return Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), maxDelay);
  }, []);

  // Attempt to reconnect
  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= config.reconnectMaxAttempts) {
      setError('Unable to reconnect. Please restart the app.');
      return;
    }

    const delay = getReconnectDelay();
    console.log(`Attempting reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);

    reconnectTimerRef.current = setTimeout(() => {
      reconnectAttemptsRef.current += 1;
      // Force re-render to trigger connection attempt
      setConnecting(true);
    }, delay);
  }, [getReconnectDelay]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - check connection
        if (!connected && token && !connecting) {
          console.log('App resumed, checking connection...');
          attemptReconnect();
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [connected, connecting, token, attemptReconnect]);

  // Connect to Phoenix
  useEffect(() => {
    console.log('usePhoenix effect running, token:', token ? 'present' : 'missing');
    if (!token) {
      console.log('No token, not connecting');
      setConnected(false);
      return;
    }

    // Reset intentional disconnect flag - we're starting a new connection
    isIntentionalDisconnectRef.current = false;

    // Clear any pending reconnect timer
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    setConnecting(true);
    setError(null);

    const socket = new Socket(config.socketUrl, {
      params: { token },
    });

    socket.onOpen(() => {
      console.log('Socket connected to:', config.socketUrl);
      reconnectAttemptsRef.current = 0;
    });

    socket.onError((err: unknown) => {
      console.error('Socket error:', err);
      setError('Connection error');
      setConnecting(false);
    });

    socket.onClose(() => {
      console.log('Socket closed');
      setConnected(false);
      onDisconnect?.();

      // Only attempt reconnection for unexpected disconnections
      // Don't reconnect if we intentionally disconnected (cleanup/unmount)
      if (token && !isIntentionalDisconnectRef.current) {
        attemptReconnect();
      }
    });

    socket.connect();
    socketRef.current = socket;

    // Join the game channel with client version for compatibility checking
    const channel = socket.channel('game:lobby', {
      client_version: config.clientVersion,
    });

    console.log('Attempting to join channel...');
    channel
      .join()
      .receive('ok', (resp) => {
        console.log('Joined game channel successfully:', resp);
        setConnected(true);
        setConnecting(false);
        setUpdateRequired({ required: false, minVersion: null });
      })
      .receive('error', (resp: { reason?: string; min_version?: string }) => {
        console.error('Failed to join channel:', resp);

        // Handle update required error
        if (resp.reason === 'update_required' && resp.min_version) {
          setUpdateRequired({ required: true, minVersion: resp.min_version });
          setError(`App update required. Minimum version: ${resp.min_version}`);
          onUpdateRequired?.(resp.min_version);
        } else {
          setError(resp.reason || 'Failed to join game');
        }

        setConnecting(false);
      });

    // ==========================================================================
    // Core game state events
    // ==========================================================================

    channel.on('game_state', (payload: GameState & { server?: ServerCapabilities }) => {
      console.log('Received game state:', payload);
      console.log('Room in payload:', payload.room);

      // Extract and store server capabilities
      if (payload.server) {
        console.log('Server capabilities:', payload.server);
        setServerCapabilities(payload.server);
      }

      setGameState(payload);
      clearEvents();
      // Reset feature states
      setCombatState(null);
      setShopState(null);
      setContainerState(null);
      setBardoState(null);
    });

    channel.on('room_update', (payload: { room: Room; atmosphere: string; visual_state?: VisualState; sound_state?: SoundState; other_players: Player[] }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        if (prev.room.id !== payload.room.id) {
          clearEvents();
        }
        return {
          ...prev,
          room: payload.room,
          atmosphere: payload.atmosphere,
          visual_state: payload.visual_state || prev.visual_state,
          sound_state: payload.sound_state || prev.sound_state,
          other_players: payload.other_players,
        };
      });
    });

    channel.on('event', (payload: { text: string; type?: string }) => {
      addEvent({
        text: payload.text,
        timestamp: new Date().toISOString(),
        type: (payload.type as GameEvent['type']) || 'normal',
      });
    });

    channel.on('players_update', (payload: { players: Player[] }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return { ...prev, other_players: payload.players };
      });
    });

    channel.on('atmosphere_update', (payload: { atmosphere: string; calendar?: CalendarState; visual_state?: VisualState; sound_state?: SoundState }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          atmosphere: payload.atmosphere,
          ...(payload.calendar && { calendar: payload.calendar }),
          ...(payload.visual_state && { visual_state: payload.visual_state }),
          ...(payload.sound_state && { sound_state: payload.sound_state }),
        };
      });
      if (payload.atmosphere) {
        addEvent({ text: payload.atmosphere, timestamp: new Date().toISOString() });
      }
    });

    channel.on('resources_update', (payload: { resources: Resources }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return { ...prev, resources: payload.resources };
      });
    });

    channel.on('stats_update', (payload: { stats: Stats }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return { ...prev, stats: payload.stats };
      });
    });

    channel.on('health_update', (payload: { health: { current: number; max: number } }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return { ...prev, health: payload.health };
      });
    });

    // ==========================================================================
    // Entity context
    // ==========================================================================

    channel.on('entity_context', (payload: { entity: EntityContext }) => {
      console.log('Entity context:', payload.entity);
      setEntityContext(payload.entity);
    });

    // ==========================================================================
    // Dialogue events
    // ==========================================================================

    channel.on('dialogue_start', (payload: {
      entity_id: string;
      node_id: string;
      text: string;
      speaker?: string;
      choices: { text: string }[];
    }) => {
      console.log('Dialogue start:', payload);
      setDialogueState({
        entityId: payload.entity_id,
        nodeId: payload.node_id,
        text: payload.text,
        speaker: payload.speaker,
        choices: payload.choices || [],
      });
      setDialogueHistory([{
        speaker: payload.speaker || 'NPC',
        text: payload.text,
        isPlayer: false,
      }]);
    });

    channel.on('dialogue_update', (payload: {
      node_id: string;
      text: string;
      speaker?: string;
      choices: { text: string }[];
    }) => {
      console.log('Dialogue update:', payload);
      setDialogueState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          nodeId: payload.node_id,
          text: payload.text,
          speaker: payload.speaker,
          choices: payload.choices || [],
        };
      });
      setDialogueHistory((prev) => [...prev, {
        speaker: payload.speaker || 'NPC',
        text: payload.text,
        isPlayer: false,
      }]);
    });

    channel.on('dialogue_end', () => {
      console.log('Dialogue end');
      setDialogueState(null);
    });

    // ==========================================================================
    // Inventory events
    // ==========================================================================

    channel.on('inventory_update', (payload: { inventory?: InventoryItem[], action?: string }) => {
      // Only update if we receive the full inventory array
      // (ignores legacy delta format with action/item_id)
      if (payload.inventory) {
        setGameState((prev) => {
          if (!prev) return prev;
          return { ...prev, inventory: payload.inventory };
        });
      }
    });

    channel.on('equipped_update', (payload: { equipped: Record<string, EquippedItem> }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return { ...prev, equipped: payload.equipped };
      });
    });

    // ==========================================================================
    // Combat events
    // ==========================================================================

    channel.on('combat_start', (payload: {
      enemy: { id: string; name: string; health: { current: number; max: number } };
      pvp?: boolean;
    }) => {
      console.log('Combat start:', payload);
      // Use gameStateRef to get current gameState without stale closure
      const currentGameState = gameStateRef.current;
      setCombatState({
        active: true,
        enemy: payload.enemy,
        enemyId: payload.enemy.id,
        playerHp: currentGameState?.health?.current ?? 100,
        playerMaxHp: currentGameState?.health?.max ?? 100,
        enemyHp: payload.enemy.health.current,
        enemyMaxHp: payload.enemy.health.max,
        canFlee: true,
        pvp: payload.pvp,
      });
      addEvent({
        text: `Combat begins with ${payload.enemy.name}!`,
        timestamp: new Date().toISOString(),
        type: 'combat',
      });
    });

    channel.on('combat_update', (payload: {
      player_hp?: number;
      player_max_hp?: number;
      enemy_hp?: number;
      enemy_max_hp?: number;
      can_flee?: boolean;
    }) => {
      setCombatState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          playerHp: payload.player_hp ?? prev.playerHp,
          playerMaxHp: payload.player_max_hp ?? prev.playerMaxHp,
          enemyHp: payload.enemy_hp ?? prev.enemyHp,
          enemyMaxHp: payload.enemy_max_hp ?? prev.enemyMaxHp,
          canFlee: payload.can_flee ?? prev.canFlee,
        };
      });
    });

    channel.on('combat_end', (payload: { result: 'victory' | 'defeat' | 'fled' }) => {
      console.log('Combat end:', payload);
      setCombatState(null);
      addEvent({
        text: payload.result === 'victory' ? 'Victory!' : payload.result === 'fled' ? 'You fled!' : 'You were defeated.',
        timestamp: new Date().toISOString(),
        type: 'combat',
      });
    });

    // ==========================================================================
    // Bardo (death) events
    // ==========================================================================

    channel.on('bardo_start', (payload: { bind_point: string }) => {
      console.log('Bardo start:', payload);
      setBardoState({
        active: true,
        bindPoint: payload.bind_point,
        messages: [],
        canReincarnate: false,
      });
    });

    channel.on('bardo_message', (payload: { text: string }) => {
      setBardoState((prev) => {
        if (!prev) return prev;
        return { ...prev, messages: [...prev.messages, payload.text] };
      });
    });

    channel.on('bardo_ready', () => {
      setBardoState((prev) => {
        if (!prev) return prev;
        return { ...prev, canReincarnate: true };
      });
    });

    channel.on('bardo_end', () => {
      console.log('Bardo end');
      setBardoState(null);
    });

    // ==========================================================================
    // Shop events
    // ==========================================================================

    channel.on('shop_open', (payload: {
      npc_id: string;
      npc_name: string;
      items: ShopState['items'];
      buys: string[];
    }) => {
      console.log('Shop open:', payload);
      setShopState({
        open: true,
        npcId: payload.npc_id,
        npcName: payload.npc_name,
        items: payload.items,
        buys: payload.buys || [],
      });
    });

    channel.on('shop_close', () => {
      setShopState(null);
    });

    // ==========================================================================
    // Container events
    // ==========================================================================

    channel.on('container_open', (payload: {
      entity_id: string;
      entity_name: string;
      items: ContainerState['items'];
    }) => {
      console.log('Container open:', payload);
      setContainerState({
        open: true,
        entityId: payload.entity_id,
        entityName: payload.entity_name,
        items: payload.items,
      });
    });

    channel.on('container_update', (payload: { items: ContainerState['items'] }) => {
      setContainerState((prev) => {
        if (!prev) return prev;
        return { ...prev, items: payload.items };
      });
    });

    channel.on('container_close', () => {
      setContainerState(null);
    });

    // ==========================================================================
    // Quest events
    // ==========================================================================

    channel.on('quests_update', (payload: { quests: Quest[]; completed_quests?: Quest[] }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          quests: payload.quests,
          completedQuests: payload.completed_quests || prev.completedQuests,
        };
      });
    });

    channel.on('quest_started', (payload: { quest: Quest }) => {
      addEvent({
        text: `Quest started: ${payload.quest.title}`,
        timestamp: new Date().toISOString(),
        type: 'quest',
      });
      setGameState((prev) => {
        if (!prev) return prev;
        return { ...prev, quests: [...prev.quests, payload.quest] };
      });
    });

    channel.on('quest_updated', (payload: { quest: Quest }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          quests: prev.quests.map((q) => q.id === payload.quest.id ? payload.quest : q),
        };
      });
    });

    channel.on('quest_completed', (payload: { quest?: Quest; quest_id?: string; title?: string }) => {
      const title = payload.quest?.title || payload.title || 'Unknown Quest';
      addEvent({
        text: `Quest completed: ${title}`,
        timestamp: new Date().toISOString(),
        type: 'quest',
      });
    });

    channelRef.current = channel;

    // Cleanup
    return () => {
      // Mark as intentional disconnect to prevent reconnection attempts
      isIntentionalDisconnectRef.current = true;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      channel.leave();
      socket.disconnect();
    };
  }, [token, onDisconnect, onUpdateRequired, addEvent, clearEvents, attemptReconnect]);

  // ==========================================================================
  // Navigation actions
  // ==========================================================================

  const navigate = useCallback((direction: string) => {
    channelRef.current?.push('navigate', { direction });
  }, []);

  // ==========================================================================
  // Communication actions
  // ==========================================================================

  const say = useCallback((message: string) => {
    channelRef.current?.push('chat', { mode: 'say', message });
  }, []);

  const shout = useCallback((message: string) => {
    channelRef.current?.push('chat', { mode: 'shout', message });
  }, []);

  // ==========================================================================
  // Entity interaction actions
  // ==========================================================================

  const clickEntity = useCallback((entityId: string) => {
    channelRef.current?.push('click_entity', { entity_id: entityId });
  }, []);

  const performAction = useCallback((action: string, entityId: string) => {
    console.log('performAction called:', action, entityId);
    channelRef.current?.push('action', { action, entity_id: entityId });
  }, []);

  const closeEntityContext = useCallback(() => {
    setEntityContext(null);
    setDialogueState(null);
    setDialogueHistory([]);
  }, []);

  // ==========================================================================
  // Dialogue actions
  // ==========================================================================

  const selectDialogueOption = useCallback((choiceIndex: number) => {
    if (!dialogueState) return;

    const choice = dialogueState.choices[choiceIndex];
    if (choice) {
      setDialogueHistory((prev) => [...prev, {
        speaker: 'You',
        text: choice.text,
        isPlayer: true,
      }]);
    }

    channelRef.current?.push('dialogue_select', { choice_index: choiceIndex });
  }, [dialogueState]);

  const endDialogue = useCallback(() => {
    setDialogueState(null);
    setDialogueHistory([]);
  }, []);

  // ==========================================================================
  // Inventory actions
  // ==========================================================================

  const dropItem = useCallback((itemId: string) => {
    channelRef.current?.push('inventory', { action: 'drop', item_id: itemId });
  }, []);

  const equipItem = useCallback((itemId: string) => {
    channelRef.current?.push('inventory', { action: 'equip', item_id: itemId });
  }, []);

  const unequipItem = useCallback((slot: string) => {
    channelRef.current?.push('inventory', { action: 'unequip', slot });
  }, []);

  const useItem = useCallback((itemId: string) => {
    channelRef.current?.push('use_item', { item_id: itemId });
  }, []);

  // ==========================================================================
  // Combat actions
  // ==========================================================================

  const flee = useCallback(() => {
    channelRef.current?.push('combat_action', { action: 'flee' });
  }, []);

  // ==========================================================================
  // Shop actions
  // ==========================================================================

  const buyItem = useCallback((itemKey: string) => {
    if (!shopState) return;
    channelRef.current?.push('shop', {
      action: 'buy',
      item_key: itemKey,
      npc_id: shopState.npcId,
    });
  }, [shopState]);

  const sellItem = useCallback((itemId: string) => {
    if (!shopState) return;
    channelRef.current?.push('shop', {
      action: 'sell',
      item_id: itemId,
      npc_id: shopState.npcId,
    });
  }, [shopState]);

  const closeShop = useCallback(() => {
    channelRef.current?.push('shop', { action: 'close' });
    setShopState(null);
  }, []);

  // ==========================================================================
  // Container actions
  // ==========================================================================

  const takeFromContainer = useCallback((index: number) => {
    channelRef.current?.push('container', { action: 'take', index });
  }, []);

  const closeContainer = useCallback(() => {
    channelRef.current?.push('container', { action: 'close' });
    setContainerState(null);
  }, []);

  // ==========================================================================
  // Gathering/Crafting actions
  // ==========================================================================

  const gather = useCallback((nodeType: string) => {
    channelRef.current?.push('gather', { node_type: nodeType });
  }, []);

  const craft = useCallback((recipeKey: string) => {
    channelRef.current?.push('craft', { recipe_key: recipeKey, tool_id: null });
  }, []);

  // ==========================================================================
  // Emote actions
  // ==========================================================================

  const emote = useCallback((emoteKey: string, targetId?: string) => {
    if (targetId) {
      channelRef.current?.push('emote', { emote_key: emoteKey, target_id: targetId });
    } else {
      channelRef.current?.push('emote', { emote_key: emoteKey });
    }
  }, []);

  // ==========================================================================
  // Social actions
  // ==========================================================================

  const setMood = useCallback((mood: string) => {
    channelRef.current?.push('social', { action: 'set_mood', mood });
  }, []);

  const setPose = useCallback((pose: string) => {
    channelRef.current?.push('social', { action: 'set_pose', pose });
  }, []);

  // ==========================================================================
  // Bardo actions
  // ==========================================================================

  const reincarnate = useCallback(() => {
    channelRef.current?.push('bardo', { action: 'reincarnate' });
  }, []);

  return {
    connected,
    connecting,
    error,
    updateRequired,
    serverCapabilities,
    gameState,
    events,
    entityContext,
    dialogueState,
    dialogueHistory,
    combatState,
    shopState,
    containerState,
    bardoState,
    channel: channelRef.current,
    navigate,
    say,
    shout,
    clickEntity,
    performAction,
    closeEntityContext,
    selectDialogueOption,
    endDialogue,
    dropItem,
    equipItem,
    unequipItem,
    useItem,
    flee,
    buyItem,
    sellItem,
    closeShop,
    takeFromContainer,
    closeContainer,
    gather,
    craft,
    emote,
    setMood,
    setPose,
    reincarnate,
    clearEvents,
  };
}
