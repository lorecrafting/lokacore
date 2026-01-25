/**
 * BookView component - Renders the Rust book renderer output
 *
 * This component displays the formatted text content from the Rust
 * book renderer and handles tap interactions.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import type { TapResult } from '../nativeModules/LokaBook';

interface BookViewProps {
  /** Formatted text content from Rust renderer */
  content: string;
  /** Handle tap on the book */
  onTap: (x: number, y: number) => Promise<TapResult>;
  /** Optional loading state */
  isLoading?: boolean;
}

export function BookView({ content, onTap, isLoading = false }: BookViewProps) {
  const handlePress = async (event: any) => {
    // Get tap coordinates
    const { locationX, locationY } = event.nativeEvent;
    const { width, height } = Dimensions.get('window');

    // Normalize to 0-1 range
    const normalizedX = locationX / width;
    const normalizedY = locationY / height;

    // Send to Rust for hit detection
    const result = await onTap(normalizedX, normalizedY);

    console.log('[BookView] Tap result:', result);

    // Handle tap result
    // This will be connected to navigation/actions in Phase 8
    if (result.action_type !== 'none') {
      console.log(`[BookView] Action: ${result.action_type}, Target: ${result.target}`);
    }
  };

  if (isLoading || !content) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={1}
      onPress={handlePress}
    >
      <View style={styles.bookPage}>
        <Text style={styles.pageText}>{content}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5dc', // Beige/parchment
  },
  bookPage: {
    width: '90%',
    maxWidth: 600,
    padding: 20,
    backgroundColor: '#faf8f3',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pageText: {
    fontFamily: 'System',
    fontSize: 14,
    lineHeight: 20,
    color: '#2c1810',
    fontVariant: ['tabular-nums'], // For aligned stat bars
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
});
