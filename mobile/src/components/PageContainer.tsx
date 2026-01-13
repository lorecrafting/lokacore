/**
 * Page Container Component
 * Constrains content to a max-width for ebook aesthetic
 * Includes dynamic background with environmental effects
 */

import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { DynamicBackground } from './DynamicBackground';

interface PageContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const MAX_PAGE_WIDTH = 600;

export function PageContainer({ children, style }: PageContainerProps) {
  return (
    <DynamicBackground>
      <View style={styles.outer}>
        <View style={[styles.inner, style]}>{children}</View>
      </View>
    </DynamicBackground>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_PAGE_WIDTH,
  },
});
