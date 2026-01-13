/**
 * Haptic Feedback Utilities
 * Provides tactile feedback for game events
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Only use haptics on iOS and Android
const isHapticsSupported = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Light haptic feedback for UI interactions
 */
export const lightHaptic = () => {
  if (isHapticsSupported) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
};

/**
 * Medium haptic feedback for button presses
 */
export const mediumHaptic = () => {
  if (isHapticsSupported) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
};

/**
 * Heavy haptic feedback for important actions
 */
export const heavyHaptic = () => {
  if (isHapticsSupported) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
};

/**
 * Success haptic feedback
 */
export const successHaptic = () => {
  if (isHapticsSupported) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
};

/**
 * Warning haptic feedback
 */
export const warningHaptic = () => {
  if (isHapticsSupported) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
};

/**
 * Error haptic feedback
 */
export const errorHaptic = () => {
  if (isHapticsSupported) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
};

/**
 * Selection changed haptic feedback
 */
export const selectionHaptic = () => {
  if (isHapticsSupported) {
    Haptics.selectionAsync();
  }
};

/**
 * Game-specific haptic feedback patterns
 */
export const gameHaptics = {
  /** Combat hit received */
  combatHit: () => heavyHaptic(),

  /** Combat victory */
  combatVictory: () => successHaptic(),

  /** Combat defeat */
  combatDefeat: () => errorHaptic(),

  /** Item picked up */
  itemPickup: () => lightHaptic(),

  /** Item equipped */
  itemEquip: () => mediumHaptic(),

  /** Level up */
  levelUp: () => successHaptic(),

  /** Quest completed */
  questComplete: () => successHaptic(),

  /** Navigation/movement */
  navigate: () => lightHaptic(),

  /** Button press */
  buttonPress: () => lightHaptic(),

  /** Menu item selected */
  menuSelect: () => selectionHaptic(),

  /** Error occurred */
  error: () => errorHaptic(),
};
