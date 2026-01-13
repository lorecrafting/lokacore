/**
 * EnvironmentContext - Provides environmental visual state to all components
 *
 * Manages:
 * - Dynamic theming based on time phase
 * - Particle effects (stars, fireflies, weather)
 * - Moonlight overlays
 * - Light source visibility
 * - Phase transitions
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  ReactNode,
} from 'react';
import { Animated, Easing } from 'react-native';
import type { VisualState, TimePhase } from '../types/game';
import {
  PhaseColors,
  getPhaseColors,
  getTextVisibility,
  getMoonbeamOpacity,
  getActiveParticles,
  getTransitionEffect,
  LightSourceEffect,
} from '../theme';
import { AudioManager } from '../audio';

// =============================================================================
// Context Types
// =============================================================================

// Animated color values for smooth phase transitions
interface AnimatedColors {
  background: Animated.AnimatedInterpolation<string>;
  backgroundAlt: Animated.AnimatedInterpolation<string>;
  text: Animated.AnimatedInterpolation<string>;
  textMuted: Animated.AnimatedInterpolation<string>;
  textFaint: Animated.AnimatedInterpolation<string>;
  border: Animated.AnimatedInterpolation<string>;
  accent: Animated.AnimatedInterpolation<string>;
}

interface EnvironmentContextValue {
  // Current visual state from server
  visualState: VisualState;

  // Computed theme colors (static, for non-animated use)
  colors: PhaseColors;

  // Animated colors for smooth phase transitions
  animatedColors: AnimatedColors;

  // Text visibility effect (for light source mechanic)
  textVisibility: LightSourceEffect;

  // Candle/torch flicker effect (animated opacity multiplier)
  candleFlicker: Animated.AnimatedInterpolation<number>;

  // Whether flicker effect is active (candle or torch equipped)
  hasFlicker: boolean;

  // Moonbeam overlay opacity
  moonbeamOpacity: number;

  // Active particle effects
  activeParticles: string[];

  // Current transition (sunrise/sunset/fade/none)
  transition: 'sunrise' | 'sunset' | 'fade' | 'none';

  // Is currently transitioning between phases
  isTransitioning: boolean;

  // Lightning flash state (for storm weather)
  lightningFlash: Animated.Value;
  isLightningActive: boolean;

  // Legacy animated values (use animatedColors instead)
  animatedBackground: Animated.AnimatedInterpolation<string>;
  animatedText: Animated.AnimatedInterpolation<string>;
}

// Default visual state (day, clear weather)
const defaultVisualState: VisualState = {
  phase: 'day',
  hour: 12,
  minute: 0,
  light_level: 1.0,
  moon_phase: 'full',
  moon_illumination: 1.0,
  weather: 'clear',
  player_light_source: null,
  is_indoor: false,
  biome: 'default',
};

const EnvironmentContext = createContext<EnvironmentContextValue | null>(null);

// =============================================================================
// Provider Component
// =============================================================================

interface EnvironmentProviderProps {
  children: ReactNode;
  visualState?: VisualState;
  /** Use fast transitions for debug/testing (1.5s instead of 30-60s) */
  fastTransitions?: boolean;
}

export function EnvironmentProvider({
  children,
  visualState = defaultVisualState,
  fastTransitions = false,
}: EnvironmentProviderProps) {
  const [previousPhase, setPreviousPhase] = useState<TimePhase>(visualState.phase);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionAnim = useRef(new Animated.Value(1)).current;

  // Candle flicker animation
  const flickerAnim = useRef(new Animated.Value(1)).current;
  const flickerAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Lightning flash animation
  const lightningFlash = useRef(new Animated.Value(0)).current;
  const lightningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLightningActive, setIsLightningActive] = useState(false);

  // Detect phase changes and trigger transitions
  useEffect(() => {
    if (visualState.phase !== previousPhase) {
      const transitionType = getTransitionEffect(previousPhase, visualState.phase);

      if (transitionType !== 'none') {
        setIsTransitioning(true);

        // Reset animation to 0 (old phase colors)
        transitionAnim.setValue(0);

        // Animate to 1 (new phase colors) over transition duration
        let duration: number;
        if (fastTransitions) {
          duration = 1500; // 1.5 seconds for debug mode
        } else {
          duration = transitionType === 'sunrise' || transitionType === 'sunset'
            ? 60000  // 60 seconds for sunrise/sunset
            : 30000; // 30 seconds for other transitions
        }

        Animated.timing(transitionAnim, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false, // Colors can't use native driver
        }).start(() => {
          setIsTransitioning(false);
          setPreviousPhase(visualState.phase);
        });
      } else {
        setPreviousPhase(visualState.phase);
      }
    }
  }, [visualState.phase, previousPhase, transitionAnim, fastTransitions]);

  // Get colors for previous and current phase
  const prevColors = useMemo(() => getPhaseColors(previousPhase), [previousPhase]);
  const currentColors = useMemo(() => getPhaseColors(visualState.phase), [visualState.phase]);

  // Create animated color interpolations for all color properties
  const animatedColors: AnimatedColors = useMemo(() => ({
    background: transitionAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [prevColors.background, currentColors.background],
    }),
    backgroundAlt: transitionAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [prevColors.backgroundAlt, currentColors.backgroundAlt],
    }),
    text: transitionAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [prevColors.text, currentColors.text],
    }),
    textMuted: transitionAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [prevColors.textMuted, currentColors.textMuted],
    }),
    textFaint: transitionAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [prevColors.textFaint, currentColors.textFaint],
    }),
    border: transitionAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [prevColors.border, currentColors.border],
    }),
    accent: transitionAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [prevColors.accent, currentColors.accent],
    }),
  }), [transitionAnim, prevColors, currentColors]);

  // Legacy animated values (for backwards compatibility)
  const animatedBackground = animatedColors.background;
  const animatedText = animatedColors.text;

  // Compute current effective colors (for non-animated use)
  const colors = useMemo(() => {
    return isTransitioning ? prevColors : currentColors;
  }, [isTransitioning, prevColors, currentColors]);

  // Compute text visibility based on light source
  const textVisibility = useMemo(() => {
    return getTextVisibility(
      visualState.phase,
      visualState.player_light_source,
      visualState.is_indoor
    );
  }, [visualState.phase, visualState.player_light_source, visualState.is_indoor]);

  // Compute moonbeam opacity
  const moonbeamOpacity = useMemo(() => {
    if (visualState.phase !== 'night') return 0;
    return getMoonbeamOpacity(
      visualState.moon_phase,
      visualState.weather,
      visualState.is_indoor
    );
  }, [visualState.phase, visualState.moon_phase, visualState.weather, visualState.is_indoor]);

  // Determine if flicker effect should be active (any light source at night outdoors)
  const hasFlicker = useMemo(() => {
    const lightSource = visualState.player_light_source;
    // Flicker for any light source when it matters (night, outdoors)
    if (lightSource === 'candle' || lightSource === 'torch' || lightSource === 'lantern') {
      // Only flicker when the light source is actually providing visibility
      if (visualState.phase === 'night' && !visualState.is_indoor) {
        return true;
      }
    }
    return false;
  }, [visualState.player_light_source, visualState.phase, visualState.is_indoor]);

  // Start/stop flicker animation based on light source
  useEffect(() => {
    if (hasFlicker) {
      // Create gentle candle-like flicker - subtle and smooth, not stroby
      const runFlickerCycle = () => {
        // Gentle flicker intensity - like a steady candle with slight wavering
        const baseIntensity = 0.04; // Very subtle base dimming
        const variation = Math.random() * 0.03; // Small random variation
        const intensity = baseIntensity + variation;

        // Longer, smoother timing for gentle effect
        const dimDuration = 400 + Math.random() * 600; // 400-1000ms
        const brightDuration = 500 + Math.random() * 700; // 500-1200ms
        const pauseDuration = 200 + Math.random() * 800; // 200-1000ms pause

        Animated.sequence([
          // Gentle dim - like candle slightly wavering
          Animated.timing(flickerAnim, {
            toValue: 1 - intensity,
            duration: dimDuration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          // Smoothly return to full brightness
          Animated.timing(flickerAnim, {
            toValue: 1,
            duration: brightDuration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          // Rest at full brightness
          Animated.delay(pauseDuration),
        ]).start(() => {
          // Continue the cycle if still active
          if (flickerAnimRef.current) {
            runFlickerCycle();
          }
        });
      };

      // Mark as active and start
      flickerAnimRef.current = { stop: () => { flickerAnimRef.current = null; } } as any;
      runFlickerCycle();
    } else {
      // Stop flicker and reset to full brightness
      if (flickerAnimRef.current) {
        flickerAnimRef.current.stop();
        flickerAnimRef.current = null;
      }
      flickerAnim.setValue(1);
    }

    return () => {
      if (flickerAnimRef.current) {
        flickerAnimRef.current.stop();
        flickerAnimRef.current = null;
      }
    };
  }, [hasFlicker, flickerAnim]);

  // Create flicker interpolation
  const candleFlicker = flickerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Lightning effect during storms
  useEffect(() => {
    const isStorm = visualState.weather === 'storm' && !visualState.is_indoor;

    if (isStorm) {
      setIsLightningActive(true);

      const triggerLightning = () => {
        // Quick flash sequence (multiple flashes for realism)
        const numFlashes = Math.random() > 0.7 ? 2 : 1; // Sometimes double flash
        const flashSequence: Animated.CompositeAnimation[] = [];

        for (let i = 0; i < numFlashes; i++) {
          flashSequence.push(
            // Flash on
            Animated.timing(lightningFlash, {
              toValue: Math.random() * 0.3 + 0.7, // 0.7-1.0 intensity
              duration: 50,
              useNativeDriver: true,
            }),
            // Flash off
            Animated.timing(lightningFlash, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
          );
          // Small gap between double flashes
          if (i < numFlashes - 1) {
            flashSequence.push(Animated.delay(100));
          }
        }

        Animated.sequence(flashSequence).start();

        // Play thunder sound after a delay (simulating distance)
        // Delay varies from 0.5-2 seconds to simulate varying lightning distance
        const thunderDelay = Math.random() * 1500 + 500;
        setTimeout(() => {
          AudioManager.playOneShot('thunder_rumble', 'event');
        }, thunderDelay);

        // Schedule next lightning strike (5-20 seconds apart)
        const nextDelay = Math.random() * 15000 + 5000;
        lightningTimerRef.current = setTimeout(triggerLightning, nextDelay);
      };

      // Initial delay before first lightning
      const initialDelay = Math.random() * 3000 + 1000;
      lightningTimerRef.current = setTimeout(triggerLightning, initialDelay);
    } else {
      setIsLightningActive(false);
      lightningFlash.setValue(0);
    }

    return () => {
      if (lightningTimerRef.current) {
        clearTimeout(lightningTimerRef.current);
        lightningTimerRef.current = null;
      }
    };
  }, [visualState.weather, visualState.is_indoor, lightningFlash]);

  // Compute active particles
  const activeParticles = useMemo(() => {
    return getActiveParticles(
      visualState.phase,
      visualState.weather,
      visualState.biome,
      visualState.is_indoor
    );
  }, [visualState.phase, visualState.weather, visualState.biome, visualState.is_indoor]);

  // Compute current transition type
  const transition = useMemo(() => {
    if (!isTransitioning) return 'none' as const;
    return getTransitionEffect(previousPhase, visualState.phase);
  }, [isTransitioning, previousPhase, visualState.phase]);

  const value: EnvironmentContextValue = {
    visualState,
    colors,
    animatedColors,
    textVisibility,
    candleFlicker,
    hasFlicker,
    moonbeamOpacity,
    activeParticles,
    transition,
    isTransitioning,
    lightningFlash,
    isLightningActive,
    animatedBackground,
    animatedText,
  };

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useEnvironment(): EnvironmentContextValue {
  const context = useContext(EnvironmentContext);
  if (!context) {
    // Return defaults if used outside provider
    const defaultColors = getPhaseColors('day');
    const staticAnim = new Animated.Value(1);
    const createStaticInterpolation = (color: string) =>
      staticAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [color, color],
      });

    return {
      visualState: defaultVisualState,
      colors: defaultColors,
      animatedColors: {
        background: createStaticInterpolation(defaultColors.background),
        backgroundAlt: createStaticInterpolation(defaultColors.backgroundAlt),
        text: createStaticInterpolation(defaultColors.text),
        textMuted: createStaticInterpolation(defaultColors.textMuted),
        textFaint: createStaticInterpolation(defaultColors.textFaint),
        border: createStaticInterpolation(defaultColors.border),
        accent: createStaticInterpolation(defaultColors.accent),
      },
      textVisibility: { textOpacity: 1, blur: 0, glowColor: 'transparent', glowOpacity: 0 },
      candleFlicker: staticAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1] }),
      hasFlicker: false,
      moonbeamOpacity: 0,
      activeParticles: [],
      transition: 'none',
      isTransitioning: false,
      lightningFlash: new Animated.Value(0),
      isLightningActive: false,
      animatedBackground: createStaticInterpolation(defaultColors.background),
      animatedText: createStaticInterpolation(defaultColors.text),
    };
  }
  return context;
}

export default EnvironmentContext;
