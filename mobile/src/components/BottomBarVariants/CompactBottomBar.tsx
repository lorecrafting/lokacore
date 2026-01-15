/**
 * Compact BottomBar Variant
 * Compass rose only, clean and focused
 *
 * Layout:
 * ────────────────────────────────────────
 *   Menu              N              Say
 *                   W · E
 *                     S
 * ────────────────────────────────────────
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useEnvironment } from '../EnvironmentContext';
import { fonts, spacing } from '../../theme';
import { gameHaptics } from '../../utils/haptics';
import { BottomBarVariantProps, hasExit } from './types';

export function CompactBottomBar({
  exits,
  onNavigate,
  onSay,
  onOpenMenu,
  previewMode,
}: BottomBarVariantProps) {
  const { colors: envColors } = useEnvironment();

  const dynamicStyles = useMemo(() => ({
    container: { borderTopColor: envColors.border },
    text: { color: envColors.text },
    textMuted: { color: envColors.textMuted },
  }), [envColors]);

  const handleNavigate = useCallback((direction: string) => {
    if (previewMode) return;
    gameHaptics.navigate();
    onNavigate(direction);
  }, [onNavigate, previewMode]);

  const handleOpenMenu = useCallback(() => {
    if (previewMode) return;
    gameHaptics.menuSelect();
    onOpenMenu();
  }, [onOpenMenu, previewMode]);

  const DirectionButton = ({ dir, label }: { dir: string; label: string }) => {
    const available = hasExit(exits, dir);
    return (
      <Pressable
        onPress={() => handleNavigate(dir)}
        disabled={!available || previewMode}
      >
        <Text
          style={[
            styles.dirButton,
            available ? [styles.available, dynamicStyles.text] : styles.disabled,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      {/* Menu */}
      <Pressable style={styles.side} onPress={handleOpenMenu} disabled={previewMode}>
        <Text style={[styles.link, dynamicStyles.text]}>Menu</Text>
      </Pressable>

      {/* Compass Rose */}
      <View style={styles.compass}>
        <View style={styles.compassRow}>
          <DirectionButton dir="north" label="N" />
        </View>
        <View style={styles.compassRow}>
          <DirectionButton dir="west" label="W" />
          <Text style={[styles.center, dynamicStyles.textMuted]}>·</Text>
          <DirectionButton dir="east" label="E" />
        </View>
        <View style={styles.compassRow}>
          <DirectionButton dir="south" label="S" />
        </View>
      </View>

      {/* Say */}
      <View style={styles.side}>
        <Pressable onPress={() => !previewMode && onSay('')} disabled={previewMode}>
          <Text style={[styles.link, dynamicStyles.text]}>Say</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    backgroundColor: 'transparent',
  },
  side: {
    width: 60,
    alignItems: 'center',
  },
  link: {
    fontFamily: fonts.serif,
    fontSize: 14,
    textDecorationLine: 'underline',
    minHeight: 44,
    textAlignVertical: 'center',
    paddingVertical: spacing.sm,
  },
  compass: {
    alignItems: 'center',
  },
  compassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    fontFamily: fonts.serif,
    fontSize: 14,
    width: 24,
    textAlign: 'center',
  },
  dirButton: {
    fontFamily: fonts.serif,
    fontSize: 14,
    minWidth: 28,
    minHeight: 24,
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  available: {
    textDecorationLine: 'underline',
  },
  disabled: {
    opacity: 0.3,
  },
});
