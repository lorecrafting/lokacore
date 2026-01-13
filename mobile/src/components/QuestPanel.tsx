/**
 * Quest Panel Component
 * Slide-up panel for viewing active and completed quests
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
import type { Quest } from '../types/game';

interface QuestPanelProps {
  visible: boolean;
  activeQuests: Quest[];
  completedQuests?: Quest[];
  onClose: () => void;
}

export function QuestPanel({
  visible,
  activeQuests,
  completedQuests = [],
  onClose,
}: QuestPanelProps) {
  const [selectedQuest, setSelectedQuest] = React.useState<Quest | null>(null);
  const [tab, setTab] = React.useState<'active' | 'completed'>('active');

  const quests = tab === 'active' ? activeQuests : completedQuests;

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
            <Text style={styles.title}>Quests</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, tab === 'active' && styles.tabActive]}
              onPress={() => setTab('active')}
            >
              <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
                Active ({activeQuests.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'completed' && styles.tabActive]}
              onPress={() => setTab('completed')}
            >
              <Text style={[styles.tabText, tab === 'completed' && styles.tabTextActive]}>
                Completed ({completedQuests.length})
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {quests.length === 0 ? (
              <Text style={styles.emptyText}>
                {tab === 'active'
                  ? 'No active quests. Talk to NPCs to find quests!'
                  : 'No completed quests yet.'}
              </Text>
            ) : (
              <View style={styles.questList}>
                {quests.map((quest) => (
                  <TouchableOpacity
                    key={quest.id}
                    style={[
                      styles.questRow,
                      selectedQuest?.id === quest.id && styles.questRowSelected,
                    ]}
                    onPress={() => setSelectedQuest(
                      selectedQuest?.id === quest.id ? null : quest
                    )}
                  >
                    <Text style={styles.questTitle}>{quest.title}</Text>

                    {selectedQuest?.id === quest.id && (
                      <View style={styles.questDetails}>
                        <Text style={styles.questDescription}>
                          {quest.description}
                        </Text>

                        {quest.objectives && quest.objectives.length > 0 && (
                          <View style={styles.objectivesSection}>
                            <Text style={styles.objectivesTitle}>Objectives:</Text>
                            {quest.objectives.map((obj, idx) => (
                              <View key={idx} style={styles.objectiveRow}>
                                <Text style={[
                                  styles.objectiveCheckbox,
                                  obj.completed && styles.objectiveCompleted,
                                ]}>
                                  {obj.completed ? '☑' : '☐'}
                                </Text>
                                <Text style={[
                                  styles.objectiveText,
                                  obj.completed && styles.objectiveTextCompleted,
                                ]}>
                                  {obj.description}
                                  {obj.target && ` (${obj.progress || 0}/${obj.target})`}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {quest.rewards && (
                          <View style={styles.rewardsSection}>
                            <Text style={styles.rewardsTitle}>Rewards:</Text>
                            <Text style={styles.rewardsText}>
                              {quest.rewards.xp && `${quest.rewards.xp} XP`}
                              {quest.rewards.xp && quest.rewards.gold && ' • '}
                              {quest.rewards.gold && `${quest.rewards.gold} Gold`}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
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
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.text,
  },
  tabText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  content: {
    padding: spacing.md,
  },
  emptyText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: spacing.lg,
  },
  questList: {
    gap: spacing.sm,
  },
  questRow: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  questRowSelected: {
    backgroundColor: colors.border,
  },
  questTitle: {
    fontFamily: fonts.serif,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  questDetails: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  questDescription: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  objectivesSection: {
    marginBottom: spacing.md,
  },
  objectivesTitle: {
    fontFamily: fonts.serif,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  objectiveRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.xs,
  },
  objectiveCheckbox: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
    marginRight: spacing.sm,
  },
  objectiveCompleted: {
    color: colors.success,
  },
  objectiveText: {
    flex: 1,
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.text,
  },
  objectiveTextCompleted: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  rewardsSection: {
    backgroundColor: colors.border,
    padding: spacing.sm,
    borderRadius: 4,
  },
  rewardsTitle: {
    fontFamily: fonts.serif,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  rewardsText: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.text,
  },
});
