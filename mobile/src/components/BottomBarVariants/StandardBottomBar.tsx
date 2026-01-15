/**
 * Standard BottomBar Variant
 * Compass with vitals and time - the balanced default
 *
 * Layout:
 * ────────────────────────────────────────
 *   Menu · 卯 · Dawn · rested     N    U
 *                               W · E  D  Say
 *                                 S
 * ────────────────────────────────────────
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useEnvironment } from '../EnvironmentContext';
import { fonts, spacing } from '../../theme';
import { gameHaptics } from '../../utils/haptics';
import { BottomBarVariantProps, hasExit, getConditionText, getTimeOfDayText } from './types';

export function StandardBottomBar({
  exits,
  resources,
  calendar,
  onNavigate,
  onSay,
  onOpenMenu,
  previewMode,
}: BottomBarVariantProps) {
  const { colors: envColors, visualState } = useEnvironment();

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

  const mv = resources.mv || { current: 150, max: 150 };
  const timeText = getTimeOfDayText(calendar?.phase);
  const weatherText = visualState?.weather && visualState.weather !== 'clear'
    ? visualState.weather.charAt(0).toUpperCase() + visualState.weather.slice(1)
    : '';

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

  const VerticalButton = ({ dir, label, arrow, arrowFirst }: {
    dir: string;
    label: string;
    arrow: string;
    arrowFirst: boolean;
  }) => {
    const available = hasExit(exits, dir);
    return (
      <Pressable
        onPress={() => handleNavigate(dir)}
        disabled={!available || previewMode}
        style={styles.verticalButton}
      >
        {arrowFirst ? (
          <>
            <Text style={[styles.arrow, available ? dynamicStyles.text : styles.disabled]}>{arrow}</Text>
            <Text style={[styles.verticalLabel, available ? dynamicStyles.text : styles.disabled]}>{label}</Text>
          </>
        ) : (
          <>
            <Text style={[styles.verticalLabel, available ? dynamicStyles.text : styles.disabled]}>{label}</Text>
            <Text style={[styles.arrow, available ? dynamicStyles.text : styles.disabled]}>{arrow}</Text>
          </>
        )}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      <View style={styles.mainRow}>
        {/* Menu and Status */}
        <Pressable style={styles.vitals} onPress={handleOpenMenu} disabled={previewMode}>
          <Text style={[styles.vitalText, dynamicStyles.textMuted]}>
            <Text style={styles.menuLink}>Menu</Text>
            {' · '}
            {calendar?.hour_char && <Text style={styles.hourChar}>{calendar.hour_char}</Text>}
            {calendar?.hour_char && ' · '}
            {timeText}
            {weatherText && ` · ${weatherText}`}
            {(timeText || weatherText) && ' · '}
            {getConditionText(mv)}
          </Text>
        </Pressable>

        {/* Navigation Controls */}
        <View style={styles.navControls}>
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

          {/* Up/Down Stack */}
          <View style={styles.verticalStack}>
            <VerticalButton dir="up" label="U" arrow="↑" arrowFirst={false} />
            <VerticalButton dir="down" label="D" arrow="↓" arrowFirst={true} />
          </View>
        </View>

        {/* Say */}
        <View style={styles.actions}>
          <Pressable onPress={() => !previewMode && onSay('')} disabled={previewMode}>
            <Text style={[styles.actionLink, dynamicStyles.text]}>Say</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    backgroundColor: 'transparent',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vitals: {
    flexShrink: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  vitalText: {
    fontFamily: fonts.serif,
    fontSize: 13,
    fontStyle: 'italic',
  },
  menuLink: {
    textDecorationLine: 'underline',
  },
  hourChar: {
    fontStyle: 'normal',
  },
  navControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
    width: 20,
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
  verticalStack: {
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 66,
  },
  verticalButton: {
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  verticalLabel: {
    fontFamily: fonts.serif,
    fontSize: 12,
    lineHeight: 14,
  },
  arrow: {
    fontFamily: fonts.serif,
    fontSize: 14,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionLink: {
    fontFamily: fonts.serif,
    fontSize: 14,
    textDecorationLine: 'underline',
    minHeight: 32,
    textAlignVertical: 'center',
    paddingHorizontal: spacing.xs,
  },
});
