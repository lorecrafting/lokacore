/**
 * Combat Overlay Component
 * Displays during active combat with health bars and action buttons
 */

import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ViewStyle,
} from 'react-native';
import { colors, fonts, spacing } from '../theme';
import { gameHaptics } from '../utils/haptics';
import type { CombatState } from '../types/game';

interface CombatOverlayProps {
  combat: CombatState;
  playerHealth: { current: number; max: number };
  onFlee: () => void;
}

const HealthBar = React.memo(function HealthBar({
  current,
  max,
  label,
  color = colors.error,
  testID,
}: {
  current: number;
  max: number;
  label: string;
  color?: string;
  testID?: string;
}) {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));

  // Memoize the fill style to avoid creating new objects on each render
  const fillStyle = useMemo<ViewStyle>(
    () => ({
      width: `${percentage}%` as any,
      backgroundColor: color,
      height: '100%',
      borderRadius: 8,
    }),
    [percentage, color]
  );

  return (
    <View testID={testID} style={styles.healthBarContainer}>
      <Text style={styles.healthLabel}>{label}</Text>
      <View style={styles.healthBarTrack}>
        <View style={fillStyle} />
      </View>
      <Text style={styles.healthText}>
        {current} / {max}
      </Text>
    </View>
  );
});

export function CombatOverlay({ combat, playerHealth, onFlee }: CombatOverlayProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const prevPlayerHealth = useRef(playerHealth.current);
  const prevEnemyHealth = useRef(combat.enemyHp);

  // Haptic feedback when health changes
  useEffect(() => {
    if (playerHealth.current < prevPlayerHealth.current) {
      // Player took damage
      gameHaptics.combatHit();
    }
    prevPlayerHealth.current = playerHealth.current;
  }, [playerHealth.current]);

  useEffect(() => {
    prevEnemyHealth.current = combat.enemyHp;
  }, [combat.enemyHp]);

  useEffect(() => {
    // Pulse animation for combat indicator
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    return () => pulseAnim.stopAnimation();
  }, [pulseAnim]);

  const handleFlee = useCallback(() => {
    gameHaptics.buttonPress();
    onFlee();
  }, [onFlee]);

  return (
    <View testID="combat-overlay" style={styles.overlay}>
      {/* Combat Header */}
      <View style={styles.header}>
        <Animated.View style={[styles.combatIndicator, { transform: [{ scale: pulseAnim }] }]}>
          <Text testID="combat-indicator" style={styles.combatIndicatorText}>COMBAT</Text>
        </Animated.View>
        <Text testID="combat-enemy-name" style={styles.enemyName}>vs {combat.enemy.name}</Text>
      </View>

      {/* Health Bars */}
      <View testID="combat-health-section" style={styles.healthSection}>
        <HealthBar
          testID="combat-player-health"
          current={playerHealth.current}
          max={playerHealth.max}
          label="You"
          color={colors.success}
        />
        <HealthBar
          testID="combat-enemy-health"
          current={combat.enemyHp}
          max={combat.enemyMaxHp}
          label={combat.enemy.name}
          color={colors.error}
        />
      </View>

      {/* Combat Info */}
      <View testID="combat-info" style={styles.infoSection}>
        <Text style={styles.infoText}>
          Auto-combat in progress...
        </Text>
        <Text style={styles.infoSubtext}>
          Combat resolves automatically every 3 seconds
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          testID="combat-flee-button"
          style={[styles.actionButton, !combat.canFlee && styles.actionButtonDisabled]}
          onPress={handleFlee}
          disabled={!combat.canFlee}
          accessibilityLabel="Flee from combat"
          accessibilityRole="button"
          accessibilityState={{ disabled: !combat.canFlee }}
        >
          <Text style={[styles.actionButtonText, !combat.canFlee && styles.actionButtonTextDisabled]}>
            Flee
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(139, 0, 0, 0.1)',
    borderBottomWidth: 2,
    borderBottomColor: colors.error,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  combatIndicator: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  combatIndicatorText: {
    fontFamily: fonts.serif,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  enemyName: {
    fontFamily: fonts.serif,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  healthSection: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  healthBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  healthLabel: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.text,
    width: 80,
  },
  healthBarTrack: {
    flex: 1,
    height: 16,
    backgroundColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  // healthBarFill styles are now handled inline with useMemo for performance
  healthText: {
    fontFamily: fonts.serif,
    fontSize: 12,
    color: colors.textMuted,
    width: 60,
    textAlign: 'right',
  },
  infoSection: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  infoText: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.text,
    fontStyle: 'italic',
  },
  infoSubtext: {
    fontFamily: fonts.serif,
    fontSize: 12,
    color: colors.textMuted,
  },
  actionSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  actionButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  actionButtonDisabled: {
    borderColor: colors.textFaint,
    backgroundColor: colors.border,
  },
  actionButtonText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
  },
  actionButtonTextDisabled: {
    color: colors.textFaint,
  },
});
