/**
 * Emotes Panel Component
 * Slide-up panel for selecting and performing emotes
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

interface EmotesPanelProps {
  visible: boolean;
  targets?: { id: string; name: string }[];
  onEmote: (emoteKey: string, targetId?: string) => void;
  onClose: () => void;
}

// Common emotes organized by category
const EMOTE_CATEGORIES = [
  {
    name: 'Greetings',
    emotes: [
      { key: 'wave', name: 'Wave' },
      { key: 'bow', name: 'Bow' },
      { key: 'nod', name: 'Nod' },
      { key: 'curtsy', name: 'Curtsy' },
    ],
  },
  {
    name: 'Expressions',
    emotes: [
      { key: 'smile', name: 'Smile' },
      { key: 'grin', name: 'Grin' },
      { key: 'laugh', name: 'Laugh' },
      { key: 'chuckle', name: 'Chuckle' },
      { key: 'giggle', name: 'Giggle' },
      { key: 'frown', name: 'Frown' },
      { key: 'sigh', name: 'Sigh' },
      { key: 'cry', name: 'Cry' },
    ],
  },
  {
    name: 'Gestures',
    emotes: [
      { key: 'shrug', name: 'Shrug' },
      { key: 'point', name: 'Point', requiresTarget: true },
      { key: 'beckon', name: 'Beckon', requiresTarget: true },
      { key: 'clap', name: 'Clap' },
      { key: 'applaud', name: 'Applaud' },
    ],
  },
  {
    name: 'Actions',
    emotes: [
      { key: 'sit', name: 'Sit' },
      { key: 'stand', name: 'Stand' },
      { key: 'kneel', name: 'Kneel' },
      { key: 'meditate', name: 'Meditate' },
      { key: 'stretch', name: 'Stretch' },
      { key: 'yawn', name: 'Yawn' },
    ],
  },
  {
    name: 'Social',
    emotes: [
      { key: 'hug', name: 'Hug', requiresTarget: true },
      { key: 'pat', name: 'Pat', requiresTarget: true },
      { key: 'poke', name: 'Poke', requiresTarget: true },
      { key: 'thank', name: 'Thank', requiresTarget: true },
      { key: 'agree', name: 'Agree' },
      { key: 'disagree', name: 'Disagree' },
    ],
  },
];

export function EmotesPanel({
  visible,
  targets = [],
  onEmote,
  onClose,
}: EmotesPanelProps) {
  const [selectedEmote, setSelectedEmote] = React.useState<{
    key: string;
    name: string;
    requiresTarget?: boolean;
  } | null>(null);

  const handleEmotePress = (emote: typeof EMOTE_CATEGORIES[0]['emotes'][0]) => {
    if (emote.requiresTarget && targets.length > 0) {
      setSelectedEmote(emote);
    } else {
      onEmote(emote.key);
      onClose();
    }
  };

  const handleTargetSelect = (targetId: string) => {
    if (selectedEmote) {
      onEmote(selectedEmote.key, targetId);
      setSelectedEmote(null);
      onClose();
    }
  };

  const handleBack = () => {
    setSelectedEmote(null);
  };

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
            {selectedEmote ? (
              <>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                  <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{selectedEmote.name} at...</Text>
              </>
            ) : (
              <Text style={styles.title}>Emotes</Text>
            )}
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {selectedEmote ? (
              // Target Selection
              <View style={styles.targetList}>
                {targets.length === 0 ? (
                  <Text style={styles.emptyText}>No targets available.</Text>
                ) : (
                  targets.map((target) => (
                    <TouchableOpacity
                      key={target.id}
                      style={styles.targetRow}
                      onPress={() => handleTargetSelect(target.id)}
                    >
                      <Text style={styles.targetName}>{target.name}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            ) : (
              // Emote Categories
              EMOTE_CATEGORIES.map((category) => (
                <View key={category.name} style={styles.categorySection}>
                  <Text style={styles.categoryTitle}>{category.name}</Text>
                  <View style={styles.emoteGrid}>
                    {category.emotes.map((emote) => (
                      <TouchableOpacity
                        key={emote.key}
                        style={styles.emoteButton}
                        onPress={() => handleEmotePress(emote)}
                      >
                        <Text style={styles.emoteText}>{emote.name}</Text>
                        {emote.requiresTarget && (
                          <Text style={styles.targetIndicator}>→</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))
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
    maxHeight: '70%',
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
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  backButton: {
    marginRight: spacing.md,
  },
  backText: {
    fontFamily: fonts.serif,
    fontSize: 16,
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
  categorySection: {
    marginBottom: spacing.lg,
  },
  categoryTitle: {
    fontFamily: fonts.serif,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  emoteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  emoteText: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.text,
  },
  targetIndicator: {
    fontFamily: fonts.serif,
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  targetList: {
    gap: spacing.sm,
  },
  targetRow: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  targetName: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
  },
  emptyText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: spacing.lg,
  },
});
