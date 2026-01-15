/**
 * Design Variants Context
 * Manages UI variant preferences with AsyncStorage persistence
 * Enables rapid iteration by toggling between different component layouts
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Available BottomBar layout variants
export type BottomBarVariant =
  | 'minimal'      // Just text direction links
  | 'compact'      // Compass rose only
  | 'standard'     // Compass + vitals (current default)
  | 'expanded'     // Compass + vitals + quest + more actions
  | 'immersive';   // Large touch targets, clean aesthetic

export const BOTTOMBAR_VARIANTS: BottomBarVariant[] = [
  'minimal',
  'compact',
  'standard',
  'expanded',
  'immersive',
];

export const BOTTOMBAR_VARIANT_LABELS: Record<BottomBarVariant, string> = {
  minimal: 'Minimal',
  compact: 'Compact',
  standard: 'Standard',
  expanded: 'Expanded',
  immersive: 'Immersive',
};

export const BOTTOMBAR_VARIANT_DESCRIPTIONS: Record<BottomBarVariant, string> = {
  minimal: 'Text-only navigation links. Maximum reading space.',
  compact: 'Compass rose only. Clean and focused.',
  standard: 'Compass with vitals and time. Balanced.',
  expanded: 'Everything visible including quest tracker.',
  immersive: 'Large touch targets. Designed for flow.',
};

interface DesignVariantsContextType {
  bottomBarVariant: BottomBarVariant;
  setBottomBarVariant: (variant: BottomBarVariant) => void;
  pickerVisible: boolean;
  showPicker: () => void;
  hidePicker: () => void;
}

const DesignVariantsContext = createContext<DesignVariantsContextType | null>(null);

const STORAGE_KEY = '@loka_design_variants';

interface StoredVariants {
  bottomBar: BottomBarVariant;
}

interface DesignVariantsProviderProps {
  children: ReactNode;
}

export function DesignVariantsProvider({ children }: DesignVariantsProviderProps) {
  const [bottomBarVariant, setBottomBarVariantState] = useState<BottomBarVariant>('standard');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    async function loadVariants() {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: StoredVariants = JSON.parse(stored);
          if (parsed.bottomBar && BOTTOMBAR_VARIANTS.includes(parsed.bottomBar)) {
            setBottomBarVariantState(parsed.bottomBar);
          }
        }
      } catch (e) {
        console.warn('Failed to load design variants:', e);
      } finally {
        setLoaded(true);
      }
    }
    loadVariants();
  }, []);

  // Save preferences when they change
  const setBottomBarVariant = useCallback(async (variant: BottomBarVariant) => {
    setBottomBarVariantState(variant);
    try {
      const stored: StoredVariants = { bottomBar: variant };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch (e) {
      console.warn('Failed to save design variants:', e);
    }
  }, []);

  const showPicker = useCallback(() => setPickerVisible(true), []);
  const hidePicker = useCallback(() => setPickerVisible(false), []);

  // Don't render children until we've loaded preferences
  // This prevents flash of default variant
  if (!loaded) {
    return null;
  }

  return (
    <DesignVariantsContext.Provider
      value={{
        bottomBarVariant,
        setBottomBarVariant,
        pickerVisible,
        showPicker,
        hidePicker,
      }}
    >
      {children}
    </DesignVariantsContext.Provider>
  );
}

export function useDesignVariants() {
  const context = useContext(DesignVariantsContext);
  if (!context) {
    throw new Error('useDesignVariants must be used within a DesignVariantsProvider');
  }
  return context;
}
