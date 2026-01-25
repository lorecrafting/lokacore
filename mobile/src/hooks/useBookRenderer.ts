/**
 * Hook for integrating Rust book renderer with Phoenix Channels
 *
 * Architecture:
 *   Phoenix Channel → This Hook → Rust Bridge → Book Renderer
 */

import { useEffect, useState, useCallback } from 'react';
import LokaBook from '../nativeModules/LokaBook';
import type {
  GameStatePayload,
  RoomUpdatePayload,
  DialogueStartPayload,
  DialogueUpdatePayload,
  CombatStartPayload,
  CombatUpdatePayload,
  ContainerOpenPayload,
} from '../types/channel.generated';

export interface BookRendererState {
  bridge: number | null;
  pageContent: string;
  isReady: boolean;
}

export function useBookRenderer() {
  const [bridge, setBridge] = useState<number | null>(null);
  const [pageContent, setPageContent] = useState<string>('');
  const [isReady, setIsReady] = useState(false);

  // Initialize bridge on mount
  useEffect(() => {
    let mounted = true;

    LokaBook.createBridge()
      .then((handle) => {
        if (mounted) {
          setBridge(handle);
          setIsReady(true);
          console.log('[BookRenderer] Bridge initialized:', handle);
        }
      })
      .catch((error) => {
        console.error('[BookRenderer] Failed to create bridge:', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // === Channel Event Handlers ===

  /**
   * Handle game_state event from server
   */
  const handleGameState = useCallback(
    (payload: GameStatePayload) => {
      if (!bridge) return;

      try {
        LokaBook.updateGameState(bridge, JSON.stringify(payload));
        // Refresh page content
        refreshPageContent();
      } catch (error) {
        console.error('[BookRenderer] Failed to update game state:', error);
      }
    },
    [bridge]
  );

  /**
   * Handle room_update event
   */
  const handleRoomUpdate = useCallback(
    (payload: RoomUpdatePayload) => {
      if (!bridge) return;

      try {
        LokaBook.updateRoom(bridge, JSON.stringify(payload));
        refreshPageContent();
      } catch (error) {
        console.error('[BookRenderer] Failed to update room:', error);
      }
    },
    [bridge]
  );

  /**
   * Handle event (game log message)
   */
  const handleEvent = useCallback(
    (payload: { text: string; type?: string }) => {
      if (!bridge) return;

      try {
        LokaBook.addEvent(bridge, payload.text, payload.type);
        refreshPageContent();
      } catch (error) {
        console.error('[BookRenderer] Failed to add event:', error);
      }
    },
    [bridge]
  );

  /**
   * Handle dialogue_start event
   */
  const handleDialogueStart = useCallback(
    (payload: DialogueStartPayload) => {
      if (!bridge) return;

      try {
        LokaBook.startDialogue(
          bridge,
          payload.entity_id,
          payload.node_id,
          payload.text,
          JSON.stringify(payload.choices)
        );
        refreshPageContent();
      } catch (error) {
        console.error('[BookRenderer] Failed to start dialogue:', error);
      }
    },
    [bridge]
  );

  /**
   * Handle dialogue_update event
   */
  const handleDialogueUpdate = useCallback(
    (payload: DialogueUpdatePayload) => {
      if (!bridge) return;

      try {
        LokaBook.updateDialogue(
          bridge,
          payload.node_id,
          payload.text,
          JSON.stringify(payload.choices)
        );
        refreshPageContent();
      } catch (error) {
        console.error('[BookRenderer] Failed to update dialogue:', error);
      }
    },
    [bridge]
  );

  /**
   * Handle dialogue_end event
   */
  const handleDialogueEnd = useCallback(() => {
    if (!bridge) return;

    try {
      LokaBook.endDialogue(bridge);
      refreshPageContent();
    } catch (error) {
      console.error('[BookRenderer] Failed to end dialogue:', error);
    }
  }, [bridge]);

  /**
   * Handle combat_start event
   */
  const handleCombatStart = useCallback(
    (payload: CombatStartPayload) => {
      if (!bridge) return;

      try {
        LokaBook.startCombat(
          bridge,
          payload.enemy.id,
          payload.enemy.name,
          payload.enemy.health.current,
          payload.enemy.health.max
        );
        refreshPageContent();
      } catch (error) {
        console.error('[BookRenderer] Failed to start combat:', error);
      }
    },
    [bridge]
  );

  /**
   * Handle combat_update event
   */
  const handleCombatUpdate = useCallback(
    (payload: CombatUpdatePayload) => {
      if (!bridge) return;

      try {
        LokaBook.updateCombat(
          bridge,
          payload.enemy_health?.current,
          payload.player_health?.current,
          payload.can_flee
        );
        refreshPageContent();
      } catch (error) {
        console.error('[BookRenderer] Failed to update combat:', error);
      }
    },
    [bridge]
  );

  /**
   * Handle container_open event
   */
  const handleContainerOpen = useCallback(
    (payload: ContainerOpenPayload) => {
      if (!bridge) return;

      try {
        LokaBook.openContainer(
          bridge,
          payload.entity_id,
          payload.entity_name,
          JSON.stringify(payload.items)
        );
        refreshPageContent();
      } catch (error) {
        console.error('[BookRenderer] Failed to open container:', error);
      }
    },
    [bridge]
  );

  // === User Actions (RN → Rust) ===

  /**
   * Handle tap on the book
   * @param x Normalized X coordinate (0-1)
   * @param y Normalized Y coordinate (0-1)
   */
  const handleTap = useCallback(
    async (x: number, y: number): Promise<TapResult> => {
      if (!bridge) {
        return { action_type: 'none' };
      }

      try {
        return await LokaBook.handleTap(bridge, x, y);
      } catch (error) {
        console.error('[BookRenderer] Failed to handle tap:', error);
        return { action_type: 'none' };
      }
    },
    [bridge]
  );

  /**
   * Open menu
   */
  const openMenu = useCallback(() => {
    if (!bridge) return;

    try {
      LokaBook.turnToMenu(bridge);
      refreshPageContent();
    } catch (error) {
      console.error('[BookRenderer] Failed to open menu:', error);
    }
  }, [bridge]);

  // === Content Retrieval ===

  /**
   * Refresh page content from Rust
   */
  const refreshPageContent = useCallback(async () => {
    if (!bridge) return;

    try {
      const content = await LokaBook.getCurrentPageContent(bridge);
      setPageContent(content);
    } catch (error) {
      console.error('[BookRenderer] Failed to get page content:', error);
    }
  }, [bridge]);

  /**
   * Get current player stats
   */
  const getPlayerStats = useCallback(async (): Promise<PlayerStatsData | null> => {
    if (!bridge) return null;

    try {
      return await LokaBook.getPlayerStats(bridge);
    } catch (error) {
      console.error('[BookRenderer] Failed to get player stats:', error);
      return null;
    }
  }, [bridge]);

  // Initial content load when bridge ready
  useEffect(() => {
    if (bridge) {
      refreshPageContent();
    }
  }, [bridge, refreshPageContent]);

  return {
    // State
    bridge,
    pageContent,
    isReady,

    // Channel event handlers (connect these to Phoenix Channel)
    handleGameState,
    handleRoomUpdate,
    handleEvent,
    handleDialogueStart,
    handleDialogueUpdate,
    handleDialogueEnd,
    handleCombatStart,
    handleCombatUpdate,
    handleContainerOpen,

    // User actions
    handleTap,
    openMenu,

    // Queries
    refreshPageContent,
    getPlayerStats,
  };
}
