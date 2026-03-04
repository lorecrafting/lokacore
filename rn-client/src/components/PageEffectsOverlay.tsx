import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { colors } from '../theme/colors';

/**
 * PageEffectsOverlay renders a semi-transparent color tint over the entire
 * page to reflect the current atmosphere (time of day + weather). It sits
 * above all page content but uses pointerEvents='none' so it never
 * intercepts touches.
 */
export function PageEffectsOverlay() {
  const atmosphere = useGameStore((s) => s.atmosphere);

  const tintColor = resolveTint(atmosphere.phase, atmosphere.weather);

  if (!tintColor) return null;

  return (
    <View
      style={[styles.overlay, { backgroundColor: tintColor }]}
      pointerEvents="none"
    />
  );
}

function resolveTint(phase: string, weather: string): string | null {
  // Weather takes precedence over phase when it has a strong effect
  if (weather === 'rain' || weather === 'rainy') {
    return colors.atmosphereRain;
  }
  if (weather === 'storm' || weather === 'stormy') {
    return colors.atmosphereStorm;
  }

  // Phase-based tints
  switch (phase) {
    case 'night':
      return colors.atmosphereNight;
    case 'dawn':
      return colors.atmosphereDawn;
    case 'dusk':
      return colors.atmosphereDusk;
    case 'day':
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    // Rendered above page content, below interactive chrome
    zIndex: 50,
  },
});
