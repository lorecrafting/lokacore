/**
 * Expanded BottomBar Variant
 * Everything visible including quest tracker and multiple actions
 *
 * Layout:
 * ────────────────────────────────────────
 *    ◇ Find the monastery gate entrance
 * ────────────────────────────────────────
 *   Menu · Dawn · rested     N    U
 *                          W · E  D
 *   Say · Look · Rest        S
 * ────────────────────────────────────────
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useEnvironment } from '../EnvironmentContext';
import { fonts, spacing } from '../../theme';
import { gameHaptics } from '../../utils/haptics';
import { BottomBarVariantProps, hasExit, getConditionText, getTimeOfDayText } from './types';

export function ExpandedBottomBar({
  exits,
  resources,
  calendar,
  activeQuest,
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

  const questHint = activeQuest?.objectives.find(obj => !obj.completed)?.description;

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
      {/* Quest tracker - always show slot */}
      <View style={styles.questRow}>
        <Text
          style={[styles.questHint, dynamicStyles.textMuted]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {questHint ? `◇ ${questHint}` : '◇ No active quest'}
        </Text>
      </View>

      {/* Main controls */}
      <View style={styles.mainRow}>
        {/* Left column - status and actions */}
        <View style={styles.leftColumn}>
          <Pressable onPress={handleOpenMenu} disabled={previewMode}>
            <Text style={[styles.statusText, dynamicStyles.textMuted]}>
              <Text style={styles.menuLink}>Menu</Text>
              {' · '}
              {timeText}
              {weatherText && ` · ${weatherText}`}
              {(timeText || weatherText) && ' · '}
              {getConditionText(mv)}
            </Text>
          </Pressable>

          {/* Action row */}
          <View style={styles.actionRow}>
            <Pressable onPress={() => !previewMode && onSay('')} disabled={previewMode}>
              <Text style={[styles.actionLink, dynamicStyles.text]}>Say</Text>
            </Pressable>
            <Text style={[styles.separator, dynamicStyles.textMuted]}>·</Text>
            <Pressable disabled={previewMode}>
              <Text style={[styles.actionLink, dynamicStyles.text]}>Look</Text>
            </Pressable>
            <Text style={[styles.separator, dynamicStyles.textMuted]}>·</Text>
            <Pressable disabled={previewMode}>
              <Text style={[styles.actionLink, dynamicStyles.text]}>Rest</Text>
            </Pressable>
          </View>
        </View>

        {/* Navigation Controls */}
        <View style={styles.navControls}>
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

          <View style={styles.verticalStack}>
            <VerticalButton dir="up" label="U" arrow="↑" arrowFirst={false} />
            <VerticalButton dir="down" label="D" arrow="↓" arrowFirst={true} />
          </View>
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
  questRow: {
    paddingBottom: spacing.xs,
    marginBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  questHint: {
    fontFamily: fonts.serif,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftColumn: {
    flexShrink: 1,
    gap: spacing.xs,
  },
  statusText: {
    fontFamily: fonts.serif,
    fontSize: 12,
    fontStyle: 'italic',
  },
  menuLink: {
    textDecorationLine: 'underline',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionLink: {
    fontFamily: fonts.serif,
    fontSize: 14,
    textDecorationLine: 'underline',
    minHeight: 32,
    textAlignVertical: 'center',
  },
  separator: {
    fontFamily: fonts.serif,
    fontSize: 14,
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
});
