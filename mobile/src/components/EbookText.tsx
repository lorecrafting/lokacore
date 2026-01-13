/**
 * Ebook-styled text components
 * Matches the "Living Ebook" aesthetic from the web client
 *
 * Uses Animated.Text to support smooth color transitions during phase changes.
 */

import React from 'react';
import { View, StyleSheet, TextStyle, StyleProp, Pressable, Animated, Text } from 'react-native';
import { colors, fonts } from '../theme';

interface EbookTextProps {
  children: React.ReactNode;
  // Accepts both static TextStyle and animated color values
  style?: StyleProp<TextStyle> | { color: Animated.AnimatedInterpolation<string> };
  testID?: string;
}

export function EbookTitle({ children, style, testID }: EbookTextProps) {
  return <Animated.Text testID={testID} style={[styles.title, style] as any}>{children}</Animated.Text>;
}

export function EbookProse({ children, style, testID }: EbookTextProps) {
  return <Animated.Text testID={testID} style={[styles.prose, style] as any}>{children}</Animated.Text>;
}

export function EbookMuted({ children, style }: EbookTextProps) {
  return <Animated.Text style={[styles.muted, style] as any}>{children}</Animated.Text>;
}

export function EbookAtmosphere({ children, style }: EbookTextProps) {
  return <Animated.Text style={[styles.atmosphere, style] as any}>{children}</Animated.Text>;
}

interface EbookLinkProps {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<TextStyle>;
}

export function EbookLink({ children, onPress, disabled, style }: EbookLinkProps) {
  return (
    <Pressable onPress={onPress} disabled={disabled}>
      {({ pressed }) => (
        <Text
          style={[
            styles.link,
            pressed && styles.linkPressed,
            disabled && styles.linkDisabled,
            style,
          ]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Ornamental divider - replaces ugly "---" with book-style flourish
 */
export function EbookDivider({ style }: { style?: StyleProp<TextStyle> }) {
  return (
    <Animated.Text style={[styles.divider, style] as any}>
      ❧
    </Animated.Text>
  );
}

/**
 * Subtle spacer - just whitespace, for lighter separation
 */
export function EbookSpacer({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const height = size === 'sm' ? 12 : size === 'lg' ? 32 : 20;
  return <View style={{ height }} />;
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 32,
    letterSpacing: 1,
  },
  prose: {
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 28,
    color: colors.text,
  },
  muted: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textMuted,
  },
  atmosphere: {
    fontFamily: fonts.serif,
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
  },
  link: {
    fontFamily: fonts.serif,
    fontSize: 17,
    color: colors.text,
    textDecorationLine: 'underline',
    lineHeight: 28,
  },
  linkPressed: {
    opacity: 0.6,
  },
  linkDisabled: {
    color: colors.textMuted,
  },
  divider: {
    fontFamily: fonts.serif,
    fontSize: 18,
    color: colors.textFaint,
    textAlign: 'center',
    marginVertical: 16,
    letterSpacing: 8,
  },
});
