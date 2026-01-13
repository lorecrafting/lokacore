/**
 * Bottom Bar Component
 * Navigation controls and vitals display
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

  // Get environment context for dynamic theming
  const { colors: envColors, visualState } = useEnvironment();

  // Create dynamic styles based on environment
  // Note: Container uses transparent background to let DynamicBackground show through
  const dynamicStyles = useMemo(() => ({
    container: { backgroundColor: 'transparent', borderTopColor: envColors.border },
    questHint: { color: envColors.textMuted },
    vital: { color: envColors.textMuted },
    dirButtonAvailable: { color: envColors.text },
    dirButtonDisabled: { color: envColors.textMuted },
    actionLink: { color: envColors.text },
    chatOverlay: { backgroundColor: envColors.background, borderTopColor: envColors.border },
    chatMode: { color: envColors.textMuted },
    chatModeActive: { color: envColors.text },
    chatModeSep: { color: envColors.textMuted },
    chatInput: { color: envColors.text, borderBottomColor: envColors.text },
    chatButton: { color: envColors.text },
    chatCancel: { color: envColors.textMuted },
  }), [envColors]);

  const availableExits = exits.filter((e) => e.destination_id);
  const hasExit = (dir: string) => availableExits.some((e) => e.direction === dir);

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

  const handleNavigate = useCallback((direction: string) => {
    gameHaptics.navigate();
    onNavigate(direction);
  }, [onNavigate]);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const mv = resources.mv || { current: 150, max: 150 };

  // Convert movement points to prose description
  const getConditionText = () => {
    const ratio = mv.current / mv.max;
    if (ratio >= 1) return 'rested';
    if (ratio >= 0.75) return 'well';
    if (ratio >= 0.5) return 'tired';
    if (ratio >= 0.25) return 'weary';
    return 'exhausted';
  };

  // Get time of day text from calendar phase
  const getTimeOfDayText = () => {
    if (!calendar?.phase) return '';
    switch (calendar.phase) {
      case 'dawn': return 'Dawn';
      case 'day': return 'Day';
      case 'dusk': return 'Dusk';
      case 'night': return 'Night';
      default: return '';
    }
  };

  // Get weather text from visual state
  const getWeatherText = () => {
    if (!visualState?.weather || visualState.weather === 'clear') return '';
    switch (visualState.weather) {
      case 'cloudy': return 'Cloudy';
      case 'rain': return 'Rain';
      case 'storm': return 'Storm';
      case 'fog': return 'Fog';
      case 'snow': return 'Snow';
      default: return '';
    }
  };

  // Get current quest objective hint
  const getQuestHint = () => {
    if (!activeQuest) return null;
    const currentObjective = activeQuest.objectives.find(obj => !obj.completed);
    return currentObjective?.description || null;
  };

  const handleOpenMenu = useCallback(() => {
    gameHaptics.menuSelect();
    onOpenMenu();
  }, [onOpenMenu]);

  const questHint = getQuestHint();
  const weatherText = getWeatherText();

  return (
    <>
      <View testID="bottom-bar" style={[styles.container, dynamicStyles.container]}>
        {/* Quest tracker row - only show if there's an active quest */}
        {questHint && (
          <View style={styles.questRow}>
            <Text style={[styles.questHint, dynamicStyles.questHint]} numberOfLines={1} ellipsizeMode="tail">
              {questHint}
            </Text>
          </View>
        )}

        {/* Main controls row */}
        <View style={styles.mainRow}>
          {/* Menu and Status */}
          <Pressable testID="menu-button" style={styles.vitals} onPress={handleOpenMenu}>
            <Text testID="vitals-display" style={[styles.vital, dynamicStyles.vital]}>
              <Text style={styles.menuLink}>Menu</Text>
              {' · '}
              {calendar?.hour_char && <Text style={styles.timeChar}>{calendar.hour_char}</Text>}
              {calendar?.hour_char && ' · '}
              {getTimeOfDayText()}
              {weatherText && ` · ${weatherText}`}
              {(getTimeOfDayText() || weatherText) && ' · '}
              {getConditionText()}
            </Text>
          </Pressable>

          {/* Compass Rose + Up/Down */}
          <View style={styles.navigationControls}>
            {/* Compass Rose */}
            <View style={styles.compassRose}>
              {/* North */}
              <View style={styles.compassRow}>
                <DirectionButton
                  testID="nav-north"
                  label="N"
                  direction="north"
                  available={hasExit('north')}
                  onPress={() => handleNavigate('north')}
                  availableColor={envColors.text}
                  disabledColor={envColors.textMuted}
                />
              </View>
              {/* West · East */}
              <View style={styles.compassRow}>
                <DirectionButton
                  testID="nav-west"
                  label="W"
                  direction="west"
                  available={hasExit('west')}
                  onPress={() => handleNavigate('west')}
                  availableColor={envColors.text}
                  disabledColor={envColors.textMuted}
                />
                <Text style={[styles.compassCenter, { color: envColors.textMuted }]}>·</Text>
                <DirectionButton
                  testID="nav-east"
                  label="E"
                  direction="east"
                  available={hasExit('east')}
                  onPress={() => handleNavigate('east')}
                  availableColor={envColors.text}
                  disabledColor={envColors.textMuted}
                />
              </View>
              {/* South */}
              <View style={styles.compassRow}>
                <DirectionButton
                  testID="nav-south"
                  label="S"
                  direction="south"
                  available={hasExit('south')}
                  onPress={() => handleNavigate('south')}
                  availableColor={envColors.text}
                  disabledColor={envColors.textMuted}
                />
              </View>
            </View>

            {/* Up/Down Stack */}
            <View style={styles.verticalStack}>
              <VerticalDirectionButton
                testID="nav-up"
                letter="U"
                arrow="↑"
                letterOnTop={true}
                direction="up"
                available={hasExit('up')}
                onPress={() => handleNavigate('up')}
                availableColor={envColors.text}
                disabledColor={envColors.textMuted}
              />
              <VerticalDirectionButton
                testID="nav-down"
                letter="D"
                arrow="↓"
                letterOnTop={false}
                direction="down"
                available={hasExit('down')}
                onPress={() => handleNavigate('down')}
                availableColor={envColors.text}
                disabledColor={envColors.textMuted}
              />
            </View>
          </View>

          {/* Chat buttons */}
          <View style={styles.actions}>
            <Pressable
              testID="chat-say-button"
              onPress={() => {
                setChatMode('say');
                setChatOpen(true);
              }}
            >
              <Text style={[styles.actionLink, dynamicStyles.actionLink]}>Say</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Chat Modal */}
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

interface DirectionButtonProps {
  label: string;
  direction: string;
  available: boolean;
  onPress: () => void;
  testID?: string;
  availableColor: string;
  disabledColor: string;
}

function DirectionButton({ label, direction, available, onPress, testID, availableColor, disabledColor }: DirectionButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!available}
      accessibilityLabel={`Go ${direction}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: !available }}
    >
      {({ pressed }) => (
        <Text
          style={[
            styles.dirButton,
            available && [styles.dirButtonAvailable, { color: availableColor }],
            !available && [styles.dirButtonDisabled, { color: disabledColor }],
            pressed && available && styles.dirButtonPressed,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

interface VerticalDirectionButtonProps {
  letter: string;
  arrow: string;
  letterOnTop: boolean;
  direction: string;
  available: boolean;
  onPress: () => void;
  testID?: string;
  availableColor: string;
  disabledColor: string;
}

function VerticalDirectionButton({ letter, arrow, letterOnTop, direction, available, onPress, testID, availableColor, disabledColor }: VerticalDirectionButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!available}
      accessibilityLabel={`Go ${direction}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: !available }}
    >
      {({ pressed }) => (
        <View style={styles.verticalButton}>
          {letterOnTop ? (
            <>
              <Text style={[
                styles.verticalLetter,
                available && [styles.dirButtonAvailable, { color: availableColor }],
                !available && [styles.dirButtonDisabled, { color: disabledColor }],
                pressed && available && styles.dirButtonPressed
              ]}>{letter}</Text>
              <Text style={[
                styles.verticalArrow,
                available && { color: availableColor },
                !available && [styles.dirButtonDisabled, { color: disabledColor }],
                pressed && available && styles.dirButtonPressed
              ]}>{arrow}</Text>
            </>
          ) : (
            <>
              <Text style={[
                styles.verticalArrow,
                available && { color: availableColor },
                !available && [styles.dirButtonDisabled, { color: disabledColor }],
                pressed && available && styles.dirButtonPressed
              ]}>{arrow}</Text>
              <Text style={[
                styles.verticalLetter,
                available && [styles.dirButtonAvailable, { color: availableColor }],
                !available && [styles.dirButtonDisabled, { color: disabledColor }],
                pressed && available && styles.dirButtonPressed
              ]}>{letter}</Text>
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.lg, // Extra padding for home indicator
  },
  questRow: {
    paddingBottom: spacing.xs,
    marginBottom: spacing.xs,
  },
  questHint: {
    fontFamily: fonts.serif,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.textMuted,
    textAlign: 'center',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vitals: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    flexShrink: 1,
  },
  vital: {
    fontFamily: fonts.serif,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  menuLink: {
    textDecorationLine: 'underline',
  },
  timeChar: {
    fontFamily: fonts.serif,
    fontSize: 14,
    fontStyle: 'normal',
  },
  navigationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  compassRose: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassCenter: {
    fontFamily: fonts.serif,
    fontSize: 14,
    width: 20,
    textAlign: 'center',
  },
  verticalStack: {
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 66,  // Match compass rose height so U aligns with N, D aligns with S
  },
  verticalButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  verticalLetter: {
    fontFamily: fonts.serif,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 14,
  },
  verticalArrow: {
    fontFamily: fonts.serif,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 16,
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
  dirButtonAvailable: {
    color: colors.text,
    textDecorationLine: 'underline',
  },
  dirButtonDisabled: {
    color: colors.textMuted,
    opacity: 0.4,
  },
  dirButtonPressed: {
    opacity: 0.6,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionLink: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.text,
    textDecorationLine: 'underline',
    minHeight: 32,
    textAlignVertical: 'center',
    paddingHorizontal: spacing.xs,
  },
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
