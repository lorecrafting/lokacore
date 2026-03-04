import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BookController } from '../components/BookController';
import { ParchmentTextureOverlay } from '../components/ParchmentTextureOverlay';
import { PageEffectsOverlay } from '../components/PageEffectsOverlay';
import { usePhoenixChannel } from '../hooks/usePhoenixChannel';

/**
 * GameScreen is the main in-game view.
 *
 * It wires up the Phoenix Channel connection via usePhoenixChannel and
 * renders the BookController (which manages all page routing and the
 * page-turn animation state machine). The PageEffectsOverlay sits above
 * everything to apply atmosphere tints without intercepting touches.
 *
 * No safe-area padding is applied — the parchment background fills the
 * entire screen for immersion. The BookController and its pages handle
 * their own internal padding.
 */
export function GameScreen() {
  // Connects to Phoenix Channel and registers all server event handlers.
  // The returned action helpers are available here if GameScreen needs to
  // dispatch commands directly; page-level components call phoenixClient
  // directly for now.
  usePhoenixChannel();

  return (
    <View style={styles.container}>
      <BookController />
      <ParchmentTextureOverlay />
      <PageEffectsOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
