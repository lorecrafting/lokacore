/**
 * Social Panel Component
 * Panel for setting player mood and pose (roleplay/social features)
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

interface SocialPanelProps {
  visible: boolean;
  currentMood?: string;
  currentPose?: string;
  onSetMood: (mood: string) => void;
  onSetPose: (pose: string) => void;
  onClose: () => void;
}

// Available moods matching server-side @valid_moods
const MOODS = [
  { key: 'neutral', name: 'Neutral', description: 'Your natural demeanor' },
  { key: 'cheerful', name: 'Cheerful', description: 'Bright and upbeat' },
  { key: 'melancholy', name: 'Melancholy', description: 'Thoughtful and subdued' },
  { key: 'fierce', name: 'Fierce', description: 'Intense and determined' },
  { key: 'distracted', name: 'Distracted', description: 'Lost in thought' },
  { key: 'formal', name: 'Formal', description: 'Proper and dignified' },
  { key: 'playful', name: 'Playful', description: 'Light-hearted and mischievous' },
  { key: 'weary', name: 'Weary', description: 'Tired but persevering' },
];

// Available poses
const POSES = [
  { key: 'standing', name: 'Standing', description: 'Standing normally' },
  { key: 'sitting', name: 'Sitting', description: 'Seated comfortably' },
  { key: 'kneeling', name: 'Kneeling', description: 'Down on one knee' },
  { key: 'meditating', name: 'Meditating', description: 'In peaceful meditation' },
  { key: 'resting', name: 'Resting', description: 'Relaxing against something' },
  { key: 'alert', name: 'Alert', description: 'Watchful and ready' },
];

interface OptionButtonProps {
  selected: boolean;
  name: string;
  description: string;
  onPress: () => void;
}

function OptionButton({ selected, name, description, onPress }: OptionButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.optionButton, selected && styles.optionButtonSelected]}
      onPress={onPress}
    >
      <View style={styles.optionContent}>
        <Text style={[styles.optionName, selected && styles.optionNameSelected]}>
          {name}
        </Text>
        <Text style={[styles.optionDesc, selected && styles.optionDescSelected]}>
          {description}
        </Text>
      </View>
      {selected && <Text style={styles.checkmark}>✓</Text>}
    </TouchableOpacity>
  );
}

export function SocialPanel({
  visible,
  currentMood = 'neutral',
  currentPose = 'standing',
  onSetMood,
  onSetPose,
  onClose,
}: SocialPanelProps) {
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
            <Text style={styles.title}>Social</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Mood Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Mood</Text>
              <Text style={styles.sectionHint}>
                Your mood affects how you appear to others and how NPCs react to you.
              </Text>
              <View style={styles.optionGrid}>
                {MOODS.map((mood) => (
                  <OptionButton
                    key={mood.key}
                    selected={currentMood === mood.key}
                    name={mood.name}
                    description={mood.description}
                    onPress={() => onSetMood(mood.key)}
                  />
                ))}
              </View>
            </View>

            {/* Pose Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pose</Text>
              <Text style={styles.sectionHint}>
                Your pose describes your current physical state to other players.
              </Text>
              <View style={styles.optionGrid}>
                {POSES.map((pose) => (
                  <OptionButton
                    key={pose.key}
                    selected={currentPose === pose.key}
                    name={pose.name}
                    description={pose.description}
                    onPress={() => onSetPose(pose.key)}
                  />
                ))}
              </View>
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
    fontSize: 22,
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
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionHint: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  optionGrid: {
    gap: spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  optionButtonSelected: {
    borderColor: colors.text,
    backgroundColor: colors.border,
  },
  optionContent: {
    flex: 1,
  },
  optionName: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  optionNameSelected: {
    fontWeight: '700',
  },
  optionDesc: {
    fontFamily: fonts.serif,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  optionDescSelected: {
    color: colors.text,
  },
  checkmark: {
    fontFamily: fonts.serif,
    fontSize: 18,
    color: colors.text,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
});
