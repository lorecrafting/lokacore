/**
 * DynamicBackground - Animated background with environmental effects
 *
 * Combines:
 * - Animated background color based on time phase
 * - Weather tint overlay
 * - Particle effects layer
 * - Moonbeam overlay
 * - Sunrise/sunset transition effects
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useEnvironment } from './EnvironmentContext';
import ParticleLayer from './ParticleLayer';
import { weatherModifiers } from '../theme';

interface DynamicBackgroundProps {
  children: React.ReactNode;
}

export function DynamicBackground({ children }: DynamicBackgroundProps) {
  const {
    visualState,
    animatedBackground,
    moonbeamOpacity,
    activeParticles,
    transition,
    isTransitioning,
    lightningFlash,
    isLightningActive,
  } = useEnvironment();

  // Transition overlay animations
  const sunriseAnim = useRef(new Animated.Value(0)).current;
  const sunsetAnim = useRef(new Animated.Value(0)).current;

  // Trigger transition effects
  useEffect(() => {
    if (transition === 'sunrise') {
      sunriseAnim.setValue(0);
      Animated.sequence([
        // Rays appear
        Animated.timing(sunriseAnim, {
          toValue: 1,
          duration: 30000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        // Rays fade
        Animated.timing(sunriseAnim, {
          toValue: 0,
          duration: 30000,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }

    if (transition === 'sunset') {
      sunsetAnim.setValue(0);
      Animated.sequence([
        // Glow appears
        Animated.timing(sunsetAnim, {
          toValue: 1,
          duration: 30000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        // Glow fades
        Animated.timing(sunsetAnim, {
          toValue: 0,
          duration: 30000,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [transition, sunriseAnim, sunsetAnim]);

  // Get weather tint
  const weatherMod = weatherModifiers[visualState.weather] || weatherModifiers.clear;

  return (
    <View style={styles.container}>
      {/* Base animated background */}
      <Animated.View
        style={[
          styles.background,
          { backgroundColor: animatedBackground },
        ]}
      />

      {/* Weather tint overlay */}
      {weatherMod.backgroundOpacity > 0 && (
        <View
          style={[
            styles.weatherTint,
            {
              backgroundColor: weatherMod.backgroundTint,
            },
          ]}
        />
      )}

      {/* Lightning flash overlay (during storms) */}
      {isLightningActive && (
        <Animated.View
          style={[
            styles.lightningFlash,
            {
              opacity: lightningFlash,
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Sunrise transition effect */}
      {transition === 'sunrise' && (
        <Animated.View
          style={[
            styles.sunriseOverlay,
            {
              opacity: sunriseAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.3, 0.15],
              }),
            },
          ]}
        />
      )}

      {/* Sunset transition effect */}
      {transition === 'sunset' && (
        <Animated.View
          style={[
            styles.sunsetOverlay,
            {
              opacity: sunsetAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.25, 0.1],
              }),
            },
          ]}
        />
      )}

      {/* Content */}
      <View style={styles.content}>
        {children}
      </View>

      {/* Particle effects layer - rendered after content so particles appear on top */}
      <ParticleLayer
        activeParticles={activeParticles}
        moonbeamOpacity={moonbeamOpacity}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  weatherTint: {
    ...StyleSheet.absoluteFillObject,
  },
  lightningFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  sunriseOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Golden rays from the right side
    backgroundColor: 'transparent',
    // Gradient would be ideal but RN doesn't support it natively
    // Using a semi-transparent gold overlay instead
    borderLeftWidth: 0,
    borderRightWidth: 100,
    borderRightColor: 'rgba(255, 200, 100, 0.3)',
  },
  sunsetOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Amber glow from bottom-left
    backgroundColor: 'rgba(200, 100, 50, 0.15)',
  },
  content: {
    flex: 1,
  },
});

export default DynamicBackground;
