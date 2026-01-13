/**
 * Stats Panel Component
 * Slide-up panel for viewing character stats and attributes
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { colors, fonts, spacing } from '../theme';
import type { Stats, Resources } from '../types/game';

interface StatsPanelProps {
  visible: boolean;
  playerName: string;
  stats: Stats;
  health: { current: number; max: number };
  resources: Resources;
  onClose: () => void;
}

function StatBar({
  label,
  current,
  max,
  color = colors.success,
}: {
  label: string;
  current: number;
  max: number;
  color?: string;
}) {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));

  return (
    <View style={styles.statBarContainer}>
      <Text style={styles.statBarLabel}>{label}</Text>
      <View style={styles.statBarTrack}>
        <View
          style={[
            styles.statBarFill,
            { width: `${percentage}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={styles.statBarValue}>
        {current}/{max}
      </Text>
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function StatsPanel({
  visible,
  playerName,
  stats,
  health,
  resources,
  onClose,
}: StatsPanelProps) {
  const xpProgress = stats.xp_to_next
    ? Math.floor(((stats.xp || 0) / stats.xp_to_next) * 100)
    : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{playerName}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Level & XP */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Progress</Text>
              <StatRow label="Level" value={stats.level || 1} />
              <View style={styles.xpBar}>
                <Text style={styles.xpLabel}>Experience</Text>
                <View style={styles.xpTrack}>
                  <View
                    style={[styles.xpFill, { width: `${xpProgress}%` }]}
                  />
                </View>
                <Text style={styles.xpText}>
                  {stats.xp || 0} / {stats.xp_to_next || 100}
                </Text>
              </View>
            </View>

            {/* Vitals */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vitals</Text>
              <StatBar
                label="Health"
                current={health.current}
                max={health.max}
                color={colors.error}
              />
              {Object.entries(resources).map(([key, res]) => (
                <StatBar
                  key={key}
                  label={key.charAt(0).toUpperCase() + key.slice(1)}
                  current={res.current}
                  max={res.max}
                  color={key === 'mana' ? '#4A90D9' : colors.success}
                />
              ))}
            </View>

            {/* Attributes */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Attributes</Text>
              <View style={styles.attributeGrid}>
                {stats.strength !== undefined && (
                  <View style={styles.attributeBox}>
                    <Text style={styles.attributeValue}>{stats.strength}</Text>
                    <Text style={styles.attributeLabel}>STR</Text>
                  </View>
                )}
                {stats.dexterity !== undefined && (
                  <View style={styles.attributeBox}>
                    <Text style={styles.attributeValue}>{stats.dexterity}</Text>
                    <Text style={styles.attributeLabel}>DEX</Text>
                  </View>
                )}
                {stats.constitution !== undefined && (
                  <View style={styles.attributeBox}>
                    <Text style={styles.attributeValue}>{stats.constitution}</Text>
                    <Text style={styles.attributeLabel}>CON</Text>
                  </View>
                )}
                {stats.intelligence !== undefined && (
                  <View style={styles.attributeBox}>
                    <Text style={styles.attributeValue}>{stats.intelligence}</Text>
                    <Text style={styles.attributeLabel}>INT</Text>
                  </View>
                )}
                {stats.wisdom !== undefined && (
                  <View style={styles.attributeBox}>
                    <Text style={styles.attributeValue}>{stats.wisdom}</Text>
                    <Text style={styles.attributeLabel}>WIS</Text>
                  </View>
                )}
                {stats.charisma !== undefined && (
                  <View style={styles.attributeBox}>
                    <Text style={styles.attributeValue}>{stats.charisma}</Text>
                    <Text style={styles.attributeLabel}>CHA</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Wealth */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Wealth</Text>
              <StatRow label="Gold" value={stats.gold || 0} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  content: {
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.xs,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  statLabel: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.textMuted,
  },
  statValue: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  statBarContainer: {
    marginVertical: spacing.xs,
  },
  statBarLabel: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 2,
  },
  statBarTrack: {
    height: 12,
    backgroundColor: colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  statBarValue: {
    fontFamily: fonts.serif,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 2,
  },
  xpBar: {
    marginTop: spacing.sm,
  },
  xpLabel: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textMuted,
  },
  xpTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 4,
  },
  xpFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 4,
  },
  xpText: {
    fontFamily: fonts.serif,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },
  attributeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  attributeBox: {
    width: '30%',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
  },
  attributeValue: {
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  attributeLabel: {
    fontFamily: fonts.serif,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
