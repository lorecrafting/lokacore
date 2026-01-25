/**
 * INTEGRATION EXAMPLE: Using Book Renderer with Phoenix Channels
 *
 * This shows how to connect the full stack:
 *   Server → Phoenix Channels → React Native → Rust Book Renderer
 *
 * File location: This would go in app/game.tsx or similar
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Button } from 'react-native';
import { usePhoenixChannel } from '../src/hooks/usePhoenixChannel';
import { useBookRenderer } from '../src/hooks/useBookRenderer';
import { BookView } from '../src/components/BookView';

export default function GameScreen() {
  // Connect to Phoenix Channel (existing hook)
  const { channel, connected } = usePhoenixChannel();

  // Connect to Rust book renderer (new hook)
  const {
    bridge,
    pageContent,
    isReady,
    // Channel event handlers
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
  } = useBookRenderer();

  // === Connect Channel Events to Rust Bridge ===
  useEffect(() => {
    if (!channel || !bridge) return;

    console.log('[Game] Connecting channel events to book renderer');

    // Game state events
    channel.on('game_state', handleGameState);
    channel.on('room_update', handleRoomUpdate);
    channel.on('event', handleEvent);

    // Dialogue events
    channel.on('dialogue_start', handleDialogueStart);
    channel.on('dialogue_update', handleDialogueUpdate);
    channel.on('dialogue_end', handleDialogueEnd);

    // Combat events
    channel.on('combat_start', handleCombatStart);
    channel.on('combat_update', handleCombatUpdate);

    // Container events
    channel.on('container_open', handleContainerOpen);

    return () => {
      // Clean up listeners
      channel.off('game_state');
      channel.off('room_update');
      channel.off('event');
      channel.off('dialogue_start');
      channel.off('dialogue_update');
      channel.off('dialogue_end');
      channel.off('combat_start');
      channel.off('combat_update');
      channel.off('container_open');
    };
  }, [
    channel,
    bridge,
    handleGameState,
    handleRoomUpdate,
    handleEvent,
    handleDialogueStart,
    handleDialogueUpdate,
    handleDialogueEnd,
    handleCombatStart,
    handleCombatUpdate,
    handleContainerOpen,
  ]);

  // === Handle Tap Results ===
  const onBookTap = async (x: number, y: number) => {
    const result = await handleTap(x, y);

    // Process tap result
    switch (result.action_type) {
      case 'navigate':
        // Send navigation command to server
        if (result.target && channel) {
          channel.push('move', { direction: result.target });
        }
        break;

      case 'entity_click':
        // Open entity interaction
        if (result.target && channel) {
          channel.push('click_entity', { entity_id: result.target });
        }
        break;

      case 'dialogue_choice':
        // Select dialogue choice
        if (result.target && channel) {
          channel.push('dialogue_choice', { choice_id: result.target });
        }
        break;

      case 'menu':
        // Menu button tapped (handled by Rust, no server call needed)
        openMenu();
        break;

      case 'none':
      default:
        // No action
        break;
    }

    return result;
  };

  // Show loading while connecting
  if (!connected || !isReady) {
    return (
      <View style={styles.container}>
        <BookView
          content="Connecting to server..."
          onTap={async () => ({ action_type: 'none' })}
          isLoading={true}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Main book display */}
      <BookView content={pageContent} onTap={onBookTap} />

      {/* Debug controls (remove in production) */}
      {__DEV__ && (
        <View style={styles.debugPanel}>
          <Button title="Open Menu" onPress={openMenu} />
          <Button
            title="Test Room Update"
            onPress={() => {
              // Simulate room update from server
              handleRoomUpdate({
                room: {
                  key: 'test_room',
                  name: 'Test Room',
                  description: 'A test room for debugging.',
                },
              } as any);
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  debugPanel: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
  },
});
