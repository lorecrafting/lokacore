/**
 * Immersive BottomBar Variant
 * Large touch targets, minimal chrome, designed for flow state
 *
 * Layout:
 * ────────────────────────────────────────
 *                    ↑
 *        Menu      ← · →      Say
 *                    ↓
 * ────────────────────────────────────────
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useEnvironment } from '../EnvironmentContext';
import { fonts, spacing } from '../../theme';
import { gameHaptics } from '../../utils/haptics';
import { BottomBarVariantProps, hasExit } from './types';

export function ImmersiveBottomBar({
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
    touchTarget: { backgroundColor: envColors.background },
    touchTargetBorder: { borderColor: envColors.border },
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

  const handleSay = useCallback(() => {
    if (previewMode) return;
    gameHaptics.buttonPress();
    onSay('');
  }, [onSay, previewMode]);

  const DirectionCircle = ({ dir, symbol }: { dir: string; symbol: string }) => {
    const available = hasExit(exits, dir);
    return (
      <Pressable
        onPress={() => handleNavigate(dir)}
        disabled={!available || previewMode}
        style={({ pressed }) => [
          styles.dirCircle,
          dynamicStyles.touchTarget,
          dynamicStyles.touchTargetBorder,
          !available && styles.circleDisabled,
          pressed && available && styles.circlePressed,
        ]}
      >
        <Text
          style={[
            styles.dirSymbol,
            available ? dynamicStyles.text : styles.symbolDisabled,
          ]}
        >
          {symbol}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      {/* Menu */}
      <Pressable
        style={[styles.actionButton, dynamicStyles.touchTarget, dynamicStyles.touchTargetBorder]}
        onPress={handleOpenMenu}
        disabled={previewMode}
      >
        <Text style={[styles.actionText, dynamicStyles.text]}>Menu</Text>
      </Pressable>

      {/* Compass - large circular touch targets */}
      <View style={styles.compass}>
        {/* North */}
        <View style={styles.compassTop}>
          <DirectionCircle dir="north" symbol="↑" />
        </View>

        {/* West · East */}
        <View style={styles.compassMiddle}>
          <DirectionCircle dir="west" symbol="←" />
          <View style={styles.centerDot}>
            <Text style={[styles.dot, dynamicStyles.textMuted]}>·</Text>
          </View>
          <DirectionCircle dir="east" symbol="→" />
        </View>

        {/* South */}
        <View style={styles.compassBottom}>
          <DirectionCircle dir="south" symbol="↓" />
        </View>
      </View>

      {/* Say */}
      <Pressable
        style={[styles.actionButton, dynamicStyles.touchTarget, dynamicStyles.touchTargetBorder]}
        onPress={handleSay}
        disabled={previewMode}
      >
        <Text style={[styles.actionText, dynamicStyles.text]}>Say</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    backgroundColor: 'transparent',
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontFamily: fonts.serif,
    fontSize: 13,
    textAlign: 'center',
  },
  compass: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassTop: {
    marginBottom: spacing.xs,
  },
  compassMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compassBottom: {
    marginTop: spacing.xs,
  },
  centerDot: {
    width: 32,
    alignItems: 'center',
  },
  dot: {
    fontFamily: fonts.serif,
    fontSize: 20,
  },
  dirCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleDisabled: {
    opacity: 0.3,
    borderStyle: 'dashed',
  },
  circlePressed: {
    opacity: 0.6,
    transform: [{ scale: 0.95 }],
  },
  dirSymbol: {
    fontFamily: fonts.serif,
    fontSize: 22,
  },
  symbolDisabled: {
    opacity: 0.4,
  },
});
