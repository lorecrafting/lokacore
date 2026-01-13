/**
 * Bardo Overlay Component
 * Full-screen overlay for the death/reincarnation sequence
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { colors, fonts, spacing } from '../theme';
import type { BardoState } from '../types/game';

interface BardoOverlayProps {
  bardo: BardoState;
  onReincarnate: () => void;
}

export function BardoOverlay({ bardo, onReincarnate }: BardoOverlayProps) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scrollRef = React.useRef<ScrollView>(null);

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [bardo.messages.length]);

  return (
    <Animated.View testID="bardo-overlay" style={[styles.overlay, { opacity: fadeAnim }]}>
      <View style={styles.content}>
        {/* Title */}
        <Text testID="bardo-title" style={styles.title}>The Bardo</Text>
        <Text testID="bardo-subtitle" style={styles.subtitle}>Between Worlds</Text>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          testID="bardo-messages"
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          <Text style={styles.introText}>
            You have fallen in battle...
          </Text>
          {bardo.messages.map((message, index) => (
            <Animated.Text
              key={index}
              testID={`bardo-message-${index}`}
              style={[
                styles.messageText,
                { opacity: fadeAnim },
              ]}
            >
              {message}
            </Animated.Text>
          ))}
        </ScrollView>

        {/* Reincarnate Button */}
        {bardo.canReincarnate ? (
          <View testID="bardo-action-section" style={styles.actionSection}>
            <Text testID="bardo-ready-text" style={styles.readyText}>
              You may now return to the world of the living.
            </Text>
            <TouchableOpacity
              testID="reincarnate-button"
              style={styles.reincarnateButton}
              onPress={onReincarnate}
            >
              <Text style={styles.reincarnateButtonText}>Reincarnate</Text>
            </TouchableOpacity>
            <Text testID="bardo-bind-point" style={styles.bindPointText}>
              You will return to: {bardo.bindPoint.replace(/_/g, ' ')}
            </Text>
          </View>
        ) : (
          <View testID="bardo-waiting-section" style={styles.actionSection}>
            <Text testID="bardo-waiting-text" style={styles.waitingText}>
              The wheel of fate turns...
            </Text>
            <View style={styles.dotsContainer}>
              <LoadingDots />
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

function LoadingDots() {
  const dot1 = React.useRef(new Animated.Value(0)).current;
  const dot2 = React.useRef(new Animated.Value(0)).current;
  const dot3 = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateDot(dot1, 0);
    animateDot(dot2, 200);
    animateDot(dot3, 400);

    return () => {
      dot1.stopAnimation();
      dot2.stopAnimation();
      dot3.stopAnimation();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.dots}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            { opacity: dot },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bardoBackground,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 400,
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 36,
    fontWeight: '700',
    color: colors.bardoText,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.serif,
    fontSize: 18,
    fontStyle: 'italic',
    color: colors.bardoTextMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  messagesContainer: {
    flex: 1,
    maxHeight: 300,
  },
  messagesContent: {
    paddingVertical: spacing.md,
  },
  introText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.bardoText,
    textAlign: 'center',
    marginBottom: spacing.lg,
    fontStyle: 'italic',
  },
  messageText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.bardoText,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 24,
  },
  actionSection: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  readyText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.bardoText,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  reincarnateButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.bardoText,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  reincarnateButtonText: {
    fontFamily: fonts.serif,
    fontSize: 18,
    color: colors.bardoText,
    fontWeight: '600',
  },
  bindPointText: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.bardoTextMuted,
    fontStyle: 'italic',
    textTransform: 'capitalize',
  },
  waitingText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.bardoTextMuted,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  dotsContainer: {
    height: 20,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bardoText,
  },
});
