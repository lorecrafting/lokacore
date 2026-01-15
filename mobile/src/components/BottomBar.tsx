/**
 * Bottom Bar Component
 * Navigation controls and vitals display
 * Delegates to variant components based on user preference
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useEnvironment } from './EnvironmentContext';
import { useDesignVariants, BottomBarVariant } from '../contexts/DesignVariantsContext';
import { MinimalBottomBar } from './BottomBarVariants/MinimalBottomBar';
import { CompactBottomBar } from './BottomBarVariants/CompactBottomBar';
import { StandardBottomBar } from './BottomBarVariants/StandardBottomBar';
import { ExpandedBottomBar } from './BottomBarVariants/ExpandedBottomBar';
import { ImmersiveBottomBar } from './BottomBarVariants/ImmersiveBottomBar';
import type { BottomBarVariantProps } from './BottomBarVariants/types';
import { colors, fonts, spacing } from '../theme';
import { gameHaptics } from '../utils/haptics';
import type { Exit, Resources, CalendarState, Quest } from '../types/game';

interface BottomBarProps {
  exits: Exit[];
  health: { current: number; max: number };
  resources: Resources;
  calendar?: CalendarState;
  activeQuest?: Quest | null;
  onNavigate: (direction: string) => void;
  onSay: (message: string) => void;
  onShout: (message: string) => void;
  onOpenMenu: () => void;
}

// Map variant names to components
const VARIANT_COMPONENTS: Record<BottomBarVariant, React.ComponentType<BottomBarVariantProps>> = {
  minimal: MinimalBottomBar,
  compact: CompactBottomBar,
  standard: StandardBottomBar,
  expanded: ExpandedBottomBar,
  immersive: ImmersiveBottomBar,
};

export function BottomBar({
  exits,
  health,
  resources,
  calendar,
  activeQuest,
  onNavigate,
  onSay,
  onShout,
  onOpenMenu,
}: BottomBarProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMode, setChatMode] = useState<'say' | 'shout'>('say');
  const [message, setMessage] = useState('');

  // Get variant preference
  const { bottomBarVariant } = useDesignVariants();

  // Get environment context for dynamic theming
  const { colors: envColors } = useEnvironment();

  // Handle say - if empty string, open chat modal; otherwise send directly
  const handleSay = useCallback((msg: string) => {
    if (msg === '') {
      setChatMode('say');
      setChatOpen(true);
    } else {
      onSay(msg);
    }
  }, [onSay]);

  // Handle shout - same pattern
  const handleShout = useCallback((msg: string) => {
    if (msg === '') {
      setChatMode('shout');
      setChatOpen(true);
    } else {
      onShout(msg);
    }
  }, [onShout]);

  // Get the variant component
  const VariantComponent = VARIANT_COMPONENTS[bottomBarVariant];

  // Props to pass to variant
  const variantProps: BottomBarVariantProps = {
    exits,
    health,
    resources,
    calendar,
    activeQuest,
    onNavigate,
    onSay: handleSay,
    onShout: handleShout,
    onOpenMenu,
  };

  // Dynamic styles for chat modal
  const dynamicStyles = useMemo(() => ({
    chatOverlay: { backgroundColor: envColors.background, borderTopColor: envColors.border },
    chatMode: { color: envColors.textMuted },
    chatModeActive: { color: envColors.text },
    chatModeSep: { color: envColors.textMuted },
    chatInput: { color: envColors.text, borderBottomColor: envColors.text },
    chatButton: { color: envColors.text },
    chatCancel: { color: envColors.textMuted },
  }), [envColors]);

  const handleSubmit = useCallback(() => {
    if (!message.trim()) return;
    gameHaptics.buttonPress();
    if (chatMode === 'say') {
      onSay(message);
    } else {
      onShout(message);
    }
    setMessage('');
    setChatOpen(false);
    Keyboard.dismiss();
  }, [message, chatMode, onSay, onShout]);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  return (
    <>
      {/* Render the selected variant */}
      <View testID="bottom-bar">
        <VariantComponent {...variantProps} />
      </View>

      {/* Chat Modal (shared across all variants) */}
      <Modal testID="chat-modal" visible={chatOpen} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.chatModalContainer}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={[styles.chatOverlay, dynamicStyles.chatOverlay]}>
                <View style={styles.chatModes}>
                  <Pressable testID="chat-mode-say" onPress={() => { gameHaptics.menuSelect(); setChatMode('say'); }}>
                    <Text style={[styles.chatMode, dynamicStyles.chatMode, chatMode === 'say' && dynamicStyles.chatModeActive]}>
                      say
                    </Text>
                  </Pressable>
                  <Text style={[styles.chatModeSep, dynamicStyles.chatModeSep]}>·</Text>
                  <Pressable testID="chat-mode-shout" onPress={() => { gameHaptics.menuSelect(); setChatMode('shout'); }}>
                    <Text style={[styles.chatMode, dynamicStyles.chatMode, chatMode === 'shout' && dynamicStyles.chatModeActive]}>
                      shout
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.chatForm}>
                  <TextInput
                    testID="chat-input"
                    style={[styles.chatInput, dynamicStyles.chatInput]}
                    value={message}
                    onChangeText={setMessage}
                    placeholder={chatMode === 'say' ? 'Say something...' : 'Shout to adjacent rooms...'}
                    placeholderTextColor={envColors.textMuted}
                    autoFocus
                    onSubmitEditing={handleSubmit}
                    returnKeyType="send"
                  />
                  <Pressable testID="chat-send-button" onPress={handleSubmit}>
                    <Text style={[styles.chatButton, dynamicStyles.chatButton]}>{chatMode === 'say' ? 'Say' : 'Shout'}</Text>
                  </Pressable>
                  <Pressable testID="chat-cancel-button" onPress={() => { Keyboard.dismiss(); setChatOpen(false); }}>
                    <Text style={[styles.chatButton, dynamicStyles.chatCancel]}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Chat overlay styles
  chatModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  chatOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  chatModes: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  chatMode: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  chatModeActive: {
    color: colors.text,
    fontWeight: '500',
  },
  chatModeSep: {
    color: colors.textMuted,
    opacity: 0.5,
  },
  chatForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  chatInput: {
    flex: 1,
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
    paddingVertical: spacing.xs,
  },
  chatButton: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
    textDecorationLine: 'underline',
  },
  chatCancel: {
    color: colors.textMuted,
  },
});
