/**
 * Design Variant Picker
 * Modal showing live previews of each BottomBar variant
 * User sees actual component, not just a name
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEnvironment } from './EnvironmentContext';
import {
  useDesignVariants,
  BOTTOMBAR_VARIANTS,
  BOTTOMBAR_VARIANT_LABELS,
  BOTTOMBAR_VARIANT_DESCRIPTIONS,
  BottomBarVariant,
} from '../contexts/DesignVariantsContext';
import { MinimalBottomBar } from './BottomBarVariants/MinimalBottomBar';
import { CompactBottomBar } from './BottomBarVariants/CompactBottomBar';
import { StandardBottomBar } from './BottomBarVariants/StandardBottomBar';
import { ExpandedBottomBar } from './BottomBarVariants/ExpandedBottomBar';
import { ImmersiveBottomBar } from './BottomBarVariants/ImmersiveBottomBar';
import { fonts, spacing } from '../theme';
import { gameHaptics } from '../utils/haptics';
import type { BottomBarVariantProps } from './BottomBarVariants/types';

// Sample data for preview - using partial types since this is display-only
const PREVIEW_PROPS: BottomBarVariantProps = {
  exits: [
    { direction: 'north', destination_id: '1' },
    { direction: 'east', destination_id: '2' },
    { direction: 'south', destination_id: null },
    { direction: 'west', destination_id: null },
    { direction: 'up', destination_id: '3' },
    { direction: 'down', destination_id: null },
  ],
  health: { current: 85, max: 100 },
  resources: { mv: { current: 120, max: 150 } },
  calendar: {
    phase: 'day',
    hour_char: '卯',
    hour_animal: 'Rabbit',
    day: 15,
    month: 1,
    month_name: 'Plum Blossom Month',
    month_char: '正月',
    year: 4722,
    year_animal: 'Dragon',
    year_element: 'wood',
    year_char: '甲辰',
    moon_phase: 'full',
    moon_phase_name: 'Full Moon',
    moon_phase_char: '望',
    moon_illumination: 1.0,
  },
  activeQuest: {
    id: 'monastery_intro',
    key: 'monastery_intro',
    title: 'Welcome to the Monastery',
    description: 'Begin your journey at the monastery.',
    completed: false,
    objectives: [
      { id: 'obj_1', description: 'Find the monastery gate entrance', completed: false },
    ],
  },
  onNavigate: () => {},
  onSay: () => {},
  onShout: () => {},
  onOpenMenu: () => {},
  previewMode: true,
};

// Map variant names to components
const VARIANT_COMPONENTS: Record<BottomBarVariant, React.ComponentType<BottomBarVariantProps>> = {
  minimal: MinimalBottomBar,
  compact: CompactBottomBar,
  standard: StandardBottomBar,
  expanded: ExpandedBottomBar,
  immersive: ImmersiveBottomBar,
};

export function DesignVariantPicker() {
  const insets = useSafeAreaInsets();
  const { colors: envColors } = useEnvironment();
  const {
    bottomBarVariant,
    setBottomBarVariant,
    pickerVisible,
    hidePicker,
  } = useDesignVariants();

  const dynamicStyles = useMemo(() => ({
    container: { backgroundColor: envColors.background },
    title: { color: envColors.text },
    subtitle: { color: envColors.textMuted },
    variantLabel: { color: envColors.text },
    variantDesc: { color: envColors.textMuted },
    selectedBorder: { borderColor: envColors.text },
    unselectedBorder: { borderColor: envColors.border },
    closeButton: { color: envColors.text },
  }), [envColors]);

  const handleSelect = (variant: BottomBarVariant) => {
    gameHaptics.menuSelect();
    setBottomBarVariant(variant);
  };

  const handleClose = () => {
    gameHaptics.buttonPress();
    hidePicker();
  };

  return (
    <Modal
      visible={pickerVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={[styles.container, dynamicStyles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, dynamicStyles.title]}>Bottom Bar Layout</Text>
          <Text style={[styles.subtitle, dynamicStyles.subtitle]}>
            Tap a design to select it
          </Text>
        </View>

        {/* Variants */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          {BOTTOMBAR_VARIANTS.map((variant) => {
            const isSelected = variant === bottomBarVariant;
            const VariantComponent = VARIANT_COMPONENTS[variant];

            return (
              <Pressable
                key={variant}
                style={[
                  styles.variantCard,
                  isSelected ? dynamicStyles.selectedBorder : dynamicStyles.unselectedBorder,
                  isSelected && styles.selectedCard,
                ]}
                onPress={() => handleSelect(variant)}
              >
                {/* Label and description */}
                <View style={styles.variantHeader}>
                  <Text style={[styles.variantLabel, dynamicStyles.variantLabel]}>
                    {BOTTOMBAR_VARIANT_LABELS[variant]}
                    {isSelected && ' ✓'}
                  </Text>
                  <Text style={[styles.variantDesc, dynamicStyles.variantDesc]}>
                    {BOTTOMBAR_VARIANT_DESCRIPTIONS[variant]}
                  </Text>
                </View>

                {/* Live preview */}
                <View style={styles.previewContainer}>
                  <VariantComponent {...PREVIEW_PROPS} />
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Close button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Text style={[styles.closeText, dynamicStyles.closeButton]}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.serif,
    fontSize: 14,
    fontStyle: 'italic',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
  },
  variantCard: {
    borderWidth: 2,
    borderRadius: 12,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  selectedCard: {
    borderWidth: 2,
  },
  variantHeader: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  variantLabel: {
    fontFamily: fonts.serif,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  variantDesc: {
    fontFamily: fonts.serif,
    fontSize: 13,
    fontStyle: 'italic',
  },
  previewContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  closeText: {
    fontFamily: fonts.serif,
    fontSize: 18,
    textDecorationLine: 'underline',
  },
});
