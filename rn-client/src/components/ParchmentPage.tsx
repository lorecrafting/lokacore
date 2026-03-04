import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors, spacing } from '../theme/colors';

interface ParchmentPageProps {
  children: React.ReactNode;
  bottomBarVisible?: boolean;
  style?: ViewStyle;
}

export function ParchmentPage({
  children,
  bottomBarVisible = false,
  style,
}: ParchmentPageProps) {
  return (
    <View style={[styles.container, style]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          bottomBarVisible && styles.scrollContentWithBar,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingH,
    paddingTop: spacing.pagePaddingTop,
    paddingBottom: spacing.pagePaddingBottom,
  },
  scrollContentWithBar: {
    paddingBottom: spacing.bottomBarHeight,
  },
});
