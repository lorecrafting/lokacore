/**
 * Minimal BottomBar Variant
 * Text-only navigation links for maximum reading space
 *
 * Layout:
 * ────────────────────────────────────────
 *   Menu                    N · E · S · W
 * ────────────────────────────────────────
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useEnvironment } from '../EnvironmentContext';
import { fonts, spacing } from '../../theme';
import { gameHaptics } from '../../utils/haptics';
import { BottomBarVariantProps, hasExit } from './types';

export function MinimalBottomBar({
  exits,
  onNavigate,
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

  const directions = ['north', 'east', 'south', 'west'];
  const labels = { north: 'N', east: 'E', south: 'S', west: 'W' };

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      {/* Menu link */}
      <Pressable onPress={handleOpenMenu} disabled={previewMode}>
        <Text style={[styles.link, dynamicStyles.text]}>Menu</Text>
      </Pressable>

      {/* Direction links */}
      <View style={styles.directions}>
        {directions.map((dir, index) => {
          const available = hasExit(exits, dir);
          return (
            <React.Fragment key={dir}>
              {index > 0 && (
                <Text style={[styles.separator, dynamicStyles.textMuted]}> · </Text>
              )}
              <Pressable
                onPress={() => handleNavigate(dir)}
                disabled={!available || previewMode}
              >
                <Text
                  style={[
                    styles.dirLink,
                    available ? dynamicStyles.text : styles.disabled,
                    available && styles.underline,
                  ]}
                >
                  {labels[dir as keyof typeof labels]}
                </Text>
              </Pressable>
            </React.Fragment>
          );
        })}
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
    paddingVertical: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    backgroundColor: 'transparent',
  },
  link: {
    fontFamily: fonts.serif,
    fontSize: 16,
    textDecorationLine: 'underline',
    minHeight: 44,
    textAlignVertical: 'center',
    paddingVertical: spacing.sm,
  },
  directions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dirLink: {
    fontFamily: fonts.serif,
    fontSize: 16,
    minWidth: 32,
    minHeight: 44,
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingHorizontal: spacing.xs,
  },
  underline: {
    textDecorationLine: 'underline',
  },
  separator: {
    fontFamily: fonts.serif,
    fontSize: 16,
  },
  disabled: {
    opacity: 0.3,
  },
});
