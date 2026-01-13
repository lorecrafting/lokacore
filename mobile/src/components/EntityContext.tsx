/**
 * Entity Context Modal
 * Shows entity details and available actions when clicking on NPCs, items, or players
 * Matches the web client's "Living Ebook" aesthetic
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { View, Modal, StyleSheet, Pressable, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EbookTitle, EbookProse, EbookLink } from './EbookText';
import { useEnvironment } from './EnvironmentContext';
import { colors, fonts, spacing } from '../theme';
import type { EntityContext, DialogueState, DialogueHistoryEntry } from '../hooks/usePhoenix';

interface EntityContextModalProps {
  entity: EntityContext | null;
  roomTitle: string;
  dialogueState: DialogueState | null;
  dialogueHistory: DialogueHistoryEntry[];
  onAction: (action: string) => void;
  onDialogueChoice: (choiceIndex: number) => void;
  onClose: () => void;
}

export function EntityContextModal({
  entity,
  roomTitle,
  dialogueState,
  dialogueHistory,
  onAction,
  onDialogueChoice,
  onClose,
}: EntityContextModalProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  // Get environment context for dynamic theming
  const { colors: envColors } = useEnvironment();

  // Create dynamic styles based on environment
  const dynamicStyles = useMemo(() => ({
    container: {
      backgroundColor: envColors.background,
    },
    menuLink: {
      color: envColors.text,
    },
    dialogueText: {
      color: envColors.text,
    },
    dialogueTextPlayer: {
      color: envColors.textMuted,
    },
  }), [envColors]);

  // Auto-scroll to bottom when dialogue history changes
  useEffect(() => {
    if (dialogueHistory.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [dialogueHistory.length]);

  if (!entity) return null;

  const inDialogue = dialogueState !== null;

  // Helper to check if entity has a specific component
  // Components come as an array of string keys from the server
  const hasComponent = (componentName: string) => {
    if (!entity.components) return false;
    if (Array.isArray(entity.components)) {
      return entity.components.includes(componentName);
    }
    return componentName in entity.components;
  };

  // Helper to check if entity has a specific tag
  const hasTag = (tagName: string) => {
    return entity.tags && entity.tags.includes(tagName);
  };

  // Get available actions - prefer server-resolved actions, fall back to client-side logic
  const getActions = (): { action: string; label: string }[] => {
    // If server provided resolved actions, use them directly
    // Server-resolved actions that consider player state,
    // equipment, status effects, room restrictions, and conditions
    if (entity.actions && entity.actions.length > 0) {
      return entity.actions.map(action => ({
        action: action.key,
        label: action.label,
      }));
    }

    // Fallback: client-side action determination for backwards compatibility
    // This will be used if server doesn't send actions (older server versions)
    const actions: { action: string; label: string }[] = [];

    if (entity.type === 'item' && !hasComponent('container')) {
      actions.push({ action: 'get', label: 'Get' });
    } else if (entity.type === 'player') {
      actions.push({ action: 'invite_to_group', label: 'Invite to Group' });
      actions.push({ action: 'whisper_to', label: `Whisper to ${entity.name}` });
      actions.push({ action: 'tell_to', label: `Tell ${entity.name}` });
      actions.push({ action: 'view_profile', label: 'View Profile' });
      actions.push({ action: 'attack_player', label: 'Attack' });
    } else {
      // NPC or mob
      if (hasComponent('dialogue_tree')) {
        actions.push({ action: 'talk', label: 'Talk' });
      }
      if (hasComponent('shop')) {
        actions.push({ action: 'shop', label: 'Browse Wares' });
      }
      if (hasComponent('combatant') && !hasTag('friendly')) {
        actions.push({ action: 'attack', label: 'Attack' });
      }
      if (hasComponent('container')) {
        actions.push({ action: 'open', label: 'Open' });
      }
    }

    return actions;
  };

  const actions = getActions();

  // Render dialogue UI when in conversation
  const renderDialogue = () => (
    <View testID="dialogue-content">
      {/* Dialogue history */}
      <View testID="dialogue-history" style={styles.dialogueHistory}>
        {dialogueHistory.map((entry, index) => (
          <View key={index} style={styles.dialogueEntry}>
            <Text testID={`dialogue-text-${index}`} style={[styles.dialogueText, dynamicStyles.dialogueText, entry.isPlayer && dynamicStyles.dialogueTextPlayer]}>
              {entry.isPlayer ? 'You say' : `${entry.speaker} says`}, "{entry.text}"
            </Text>
          </View>
        ))}
      </View>

      {/* Current choices */}
      {dialogueState && dialogueState.choices.length > 0 && (
        <View testID="dialogue-choices" style={styles.menu}>
          {dialogueState.choices.map((choice, index) => (
            <Pressable
              testID={`dialogue-choice-${index}`}
              key={index}
              style={styles.menuItem}
              onPress={() => onDialogueChoice(index)}
            >
              {({ pressed }) => (
                <Text style={[styles.menuLink, dynamicStyles.menuLink, pressed && styles.menuLinkPressed]}>
                  {choice.text}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      )}

      {/* Leave button when no more choices (dialogue ended) */}
      {(!dialogueState || dialogueState.choices.length === 0) && (
        <View style={styles.menu}>
          <Pressable testID="dialogue-leave" style={styles.menuItem} onPress={onClose}>
            {({ pressed }) => (
              <Text style={[styles.menuLink, dynamicStyles.menuLink, pressed && styles.menuLinkPressed]}>
                Leave
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );

  // Normalize description text - replace line breaks with spaces for continuous paragraph
  const normalizeDescription = (text: string): string => {
    return text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  };

  // Render action menu when not in dialogue
  const renderActionMenu = () => (
    <View testID="action-menu">
      {/* Entity description */}
      <EbookProse testID="entity-description" style={[styles.description, { color: envColors.text }]}>
        {normalizeDescription(entity.description || entity.long_desc || `You see ${entity.name}.`)}
      </EbookProse>

      {/* Action menu - left aligned */}
      <View testID="action-list" style={styles.menu}>
        {actions.map((action) => (
          <Pressable
            testID={`action-${action.action}`}
            key={action.action}
            style={styles.menuItem}
            onPress={() => onAction(action.action)}
          >
            {({ pressed }) => (
              <Text style={[styles.menuLink, dynamicStyles.menuLink, pressed && styles.menuLinkPressed]}>
                {action.label}
              </Text>
            )}
          </Pressable>
        ))}

        {/* Leave button (always shown) */}
        <Pressable testID="close-modal" style={styles.menuItem} onPress={onClose}>
          {({ pressed }) => (
            <Text style={[styles.menuLink, dynamicStyles.menuLink, pressed && styles.menuLinkPressed]}>
              Leave
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );

  return (
    <Modal testID="entity-context-modal" visible={true} animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, dynamicStyles.container]}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.lg }]}
        >
          {/* Centered book-style container */}
          <View style={styles.bookContainer}>
            {/* Entity name as title - matches room title styling */}
            <EbookTitle testID="entity-name" style={{ color: envColors.textMuted }}>
              {entity.name}
            </EbookTitle>

            {inDialogue ? renderDialogue() : renderActionMenu()}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  bookContainer: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  description: {
    marginBottom: spacing.lg,
    textAlign: 'left',
  },
  menu: {
    width: '100%',
    alignItems: 'flex-start',
  },
  menuItem: {
    paddingVertical: 2,
    minHeight: 32,
    justifyContent: 'center',
  },
  menuLink: {
    fontFamily: fonts.serif,
    fontSize: 18,
    color: colors.text,
    textDecorationLine: 'underline',
    textAlign: 'left',
  },
  menuLinkPressed: {
    opacity: 0.6,
  },
  dialogueHistory: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  dialogueEntry: {
    marginBottom: spacing.md,
  },
  dialogueText: {
    fontFamily: fonts.serif,
    fontSize: 18,
    color: colors.text,
    lineHeight: 28,
  },
  dialogueTextPlayer: {
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
