/**
 * Native module bridge to Rust book renderer
 *
 * This TypeScript interface matches the uniffi-generated bindings.
 * Once uniffi-bindgen-react-native runs, this file will be auto-generated.
 *
 * For now, this is a manual type definition to enable development.
 */

/**
 * Result of a tap gesture on the book
 */
export interface TapResult {
  action_type: 'none' | 'navigate' | 'menu' | 'entity_click' | 'dialogue_choice' | 'button';
  target?: string;  // entity_key, direction, choice_id, etc.
  details?: string; // Optional JSON details
}

/**
 * Player stats for UI display
 */
export interface PlayerStatsData {
  hp: number;
  max_hp: number;
  qi: number;
  max_qi: number;
  stamina: number;
  max_stamina: number;
  level: number;
  xp: number;
  xp_to_next_level: number;
  gold: number;
}

/**
 * A single dialogue choice
 */
export interface DialogueChoiceData {
  id: string;
  text: string;
}

/**
 * Active dialogue state
 */
export interface DialogueStateData {
  entity_id: string;
  node_id: string;
  current_text: string;
  choices: DialogueChoiceData[];
}

/**
 * Main bridge interface to Rust book renderer
 *
 * Architecture:
 *   Server (Elixir) → Phoenix Channels → This Bridge → Rust Renderer
 */
export interface LokaBookBridge {
  // === Lifecycle ===

  /**
   * Create a new bridge instance
   * @returns Bridge handle/ID
   */
  createBridge(): Promise<number>;

  // === Game State Updates (from Phoenix Channel events) ===

  /**
   * Update game state from game_state event
   * @param handle Bridge instance handle
   * @param jsonPayload JSON string matching GameStatePayload
   */
  updateGameState(handle: number, jsonPayload: string): void;

  /**
   * Update room from room_update event
   * @param handle Bridge instance handle
   * @param jsonPayload JSON string matching RoomUpdatePayload
   */
  updateRoom(handle: number, jsonPayload: string): void;

  /**
   * Add event to game log
   * @param handle Bridge instance handle
   * @param text Event text
   * @param eventType Optional event type
   */
  addEvent(handle: number, text: string, eventType?: string): void;

  // === Dialogue System ===

  /**
   * Start dialogue from dialogue_start event
   */
  startDialogue(
    handle: number,
    entityId: string,
    nodeId: string,
    text: string,
    choicesJson: string  // JSON array of DialogueChoiceData
  ): void;

  /**
   * Update dialogue from dialogue_update event
   */
  updateDialogue(
    handle: number,
    nodeId: string,
    text: string,
    choicesJson: string
  ): void;

  /**
   * End dialogue from dialogue_end event
   */
  endDialogue(handle: number): void;

  // === Combat System ===

  /**
   * Start combat from combat_start event
   */
  startCombat(
    handle: number,
    enemyId: string,
    enemyName: string,
    enemyHp: number,
    enemyMaxHp: number
  ): void;

  /**
   * Update combat state from combat_update event
   */
  updateCombat(
    handle: number,
    enemyHp?: number,
    playerHp?: number,
    canFlee?: boolean
  ): void;

  /**
   * End combat from combat_end event
   */
  endCombat(
    handle: number,
    result: string,
    rewardsJson?: string
  ): void;

  // === Container/Loot System ===

  /**
   * Open container from container_open event
   */
  openContainer(
    handle: number,
    entityId: string,
    entityName: string,
    itemsJson: string
  ): void;

  /**
   * Close container from container_close event
   */
  closeContainer(handle: number): void;

  // === Navigation & UI ===

  /**
   * Turn to menu page
   */
  turnToMenu(handle: number): void;

  /**
   * Turn to entity interaction page
   */
  turnToEntityPage(handle: number, entityKey: string): void;

  /**
   * Go back to previous page
   */
  goBack(handle: number): void;

  // === User Input (RN → Rust) ===

  /**
   * Handle tap at screen coordinates
   * @param x Normalized X coordinate (0-1)
   * @param y Normalized Y coordinate (0-1)
   * @returns Action to perform
   */
  handleTap(handle: number, x: number, y: number): Promise<TapResult>;

  // === Content Retrieval (Rust → RN) ===

  /**
   * Get current page content as formatted text
   */
  getCurrentPageContent(handle: number): Promise<string>;

  /**
   * Get player stats for UI overlays
   */
  getPlayerStats(handle: number): Promise<PlayerStatsData>;

  /**
   * Get available exits for navigation buttons
   */
  getAvailableExits(handle: number): Promise<string[]>;

  /**
   * Get current menu tab (if on menu page)
   */
  getCurrentMenuTab(handle: number): Promise<string | null>;

  /**
   * Get active dialogue state (if in dialogue)
   */
  getDialogueState(handle: number): Promise<DialogueStateData | null>;
}

// Export a typed version of the native module
// This will be replaced by uniffi-generated bindings
declare const LokaBook: LokaBookBridge;

export default LokaBook;
