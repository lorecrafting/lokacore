import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, spacing } from '../../theme/colors';
import { useGameStore } from '../../store/gameStore';
import { useNavigation } from '../NavigationContext';
import type { Direction } from '../../types/game';
import { CompassRose } from './CompassRose';
import { Minimap } from './Minimap';

export function BottomBar() {
  const room = useGameStore((s) => s.room);
  const setPage = useGameStore((s) => s.setPage);
  const { navigate } = useNavigation();

  const exits: Direction[] = room?.exits.map((e) => e.direction) ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.separator} />

      <View style={styles.content}>
        <View style={styles.minimapContainer}>
          <Minimap />
        </View>

        <View style={styles.compassContainer}>
          <CompassRose exits={exits} onNavigate={navigate} />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setPage('MENU')}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonText}>Menu</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.sayButton]}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonText}>Say</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: spacing.bottomBarHeight,
    backgroundColor: colors.barBg,
  },
  separator: {
    height: 1,
    backgroundColor: colors.barSeparator,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  minimapContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compassContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    width: 80,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 72,
    height: 36,
    backgroundColor: colors.barActive,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sayButton: {
    backgroundColor: colors.barActiveHover,
  },
  actionButtonText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.small,
    color: colors.barBg,
  },
});
