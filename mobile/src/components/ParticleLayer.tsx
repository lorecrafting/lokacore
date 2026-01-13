/**
 * ParticleLayer - Renders environmental particle effects
 *
 * Supports:
 * - Stars (twinkling white dots)
 * - Fireflies (drifting amber glow)
 * - Rain (vertical streaks)
 * - Snow (drifting white flakes)
 * - Fog (subtle white overlay)
 * - Mist (low-lying haze)
 * - Moonbeams (diagonal silver-blue gradient)
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// =============================================================================
// Types
// =============================================================================

interface ParticleLayerProps {
  activeParticles: string[];
  moonbeamOpacity: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  animValue: Animated.Value;
}

// =============================================================================
// Particle Configurations
// =============================================================================

const PARTICLE_CONFIG = {
  stars: { count: 30, minSize: 1, maxSize: 3 },
  fireflies: { count: 15, minSize: 3, maxSize: 6 },
  rain: { count: 150, minSize: 1, maxSize: 2 }, // Dense storm rain
  snow: { count: 70, minSize: 2, maxSize: 5 },
};

// =============================================================================
// Component
// =============================================================================

export function ParticleLayer({ activeParticles, moonbeamOpacity }: ParticleLayerProps) {
  return (
    <View style={styles.container} pointerEvents="none">
      {/* Moonbeam overlay */}
      {moonbeamOpacity > 0 && (
        <MoonbeamOverlay opacity={moonbeamOpacity} />
      )}

      {/* Particle effects */}
      {activeParticles.includes('stars') && <StarField />}
      {activeParticles.includes('fireflies') && <FireflyField />}
      {activeParticles.includes('rain') && <RainEffect />}
      {activeParticles.includes('snow') && <SnowEffect />}
      {/* Fog disabled for now - needs better implementation */}
      {/* {activeParticles.includes('fog') && <FogOverlay />} */}
      {activeParticles.includes('mist') && <MistOverlay />}
    </View>
  );
}

// =============================================================================
// Moonbeam Overlay
// =============================================================================

function MoonbeamOverlay({ opacity }: { opacity: number }) {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subtle shimmer animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 8000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animValue, {
          toValue: 0,
          duration: 8000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animValue]);

  const animatedOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [opacity * 0.7, opacity],
  });

  return (
    <Animated.View
      style={[
        styles.moonbeam,
        { opacity: animatedOpacity },
      ]}
    />
  );
}

// =============================================================================
// Star Field
// =============================================================================

function StarField() {
  const starsRef = useRef(
    Array.from({ length: PARTICLE_CONFIG.stars.count }, (_, i) => ({
      id: i,
      x: Math.random() * SCREEN_WIDTH,
      y: Math.random() * (SCREEN_HEIGHT * 0.6), // Top 60% of screen
      size: PARTICLE_CONFIG.stars.minSize +
        Math.random() * (PARTICLE_CONFIG.stars.maxSize - PARTICLE_CONFIG.stars.minSize),
      opacity: 0.4 + Math.random() * 0.6,
      animValue: new Animated.Value(Math.random()), // Start at random twinkle phase
      twinkleSpeed: 2000 + Math.random() * 3000,
    }))
  );
  const stars = starsRef.current;
  const animationsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    // Start all animations immediately
    animationsRef.current = stars.map((star) => {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(star.animValue, {
            toValue: 1,
            duration: star.twinkleSpeed / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(star.animValue, {
            toValue: 0,
            duration: star.twinkleSpeed / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return animation;
    });

    // Cleanup on unmount
    return () => {
      animationsRef.current.forEach((anim) => anim.stop());
    };
  }, [stars]);

  return (
    <>
      {stars.map((star) => (
        <Animated.View
          key={star.id}
          style={[
            styles.star,
            {
              left: star.x,
              top: star.y,
              width: star.size,
              height: star.size,
              borderRadius: star.size / 2,
              opacity: star.animValue.interpolate({
                inputRange: [0, 1],
                outputRange: [star.opacity * 0.3, star.opacity],
              }),
            },
          ]}
        />
      ))}
    </>
  );
}

// =============================================================================
// Firefly Field
// =============================================================================

function FireflyField() {
  const firefliesRef = useRef(
    Array.from({ length: PARTICLE_CONFIG.fireflies.count }, (_, i) => ({
      id: i,
      startX: Math.random() * SCREEN_WIDTH,
      startY: SCREEN_HEIGHT * 0.4 + Math.random() * (SCREEN_HEIGHT * 0.5),
      size: PARTICLE_CONFIG.fireflies.minSize +
        Math.random() * (PARTICLE_CONFIG.fireflies.maxSize - PARTICLE_CONFIG.fireflies.minSize),
      animX: new Animated.Value(Math.random()),
      animY: new Animated.Value(Math.random()),
      animOpacity: new Animated.Value(Math.random()),
      driftSpeed: 4000 + Math.random() * 4000,
      glowSpeed: 1500 + Math.random() * 2000,
    }))
  );
  const fireflies = firefliesRef.current;
  const animationsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    // Start all animations immediately
    animationsRef.current = fireflies.flatMap((firefly) => {
      // Drift animation
      const driftAnim = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(firefly.animX, {
              toValue: 1,
              duration: firefly.driftSpeed,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(firefly.animX, {
              toValue: 0,
              duration: firefly.driftSpeed,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(firefly.animY, {
              toValue: 1,
              duration: firefly.driftSpeed * 0.7,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(firefly.animY, {
              toValue: 0,
              duration: firefly.driftSpeed * 0.7,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      driftAnim.start();

      // Glow animation (fade in/out)
      const glowAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(firefly.animOpacity, {
            toValue: 1,
            duration: firefly.glowSpeed / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(firefly.animOpacity, {
            toValue: 0,
            duration: firefly.glowSpeed / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(500 + Math.random() * 1500),
        ])
      );
      glowAnim.start();

      return [driftAnim, glowAnim];
    });

    // Cleanup on unmount
    return () => {
      animationsRef.current.forEach((anim) => anim.stop());
    };
  }, [fireflies]);

  return (
    <>
      {fireflies.map((firefly) => (
        <Animated.View
          key={firefly.id}
          style={[
            styles.firefly,
            {
              width: firefly.size,
              height: firefly.size,
              borderRadius: firefly.size / 2,
              opacity: firefly.animOpacity,
              transform: [
                {
                  translateX: Animated.add(
                    firefly.startX,
                    firefly.animX.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 30],
                    })
                  ),
                },
                {
                  translateY: Animated.add(
                    firefly.startY,
                    firefly.animY.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -20],
                    })
                  ),
                },
              ],
            },
          ]}
        />
      ))}
    </>
  );
}

// =============================================================================
// Rain Effect - Diagonal streaks falling from upper-left to lower-right
// =============================================================================

// Horizontal drift distance for diagonal rain
const RAIN_DRIFT = 80;
// Angle for the rain streak rotation (in degrees)
const RAIN_ANGLE = 15;
// Total travel distance
const RAIN_TRAVEL = SCREEN_HEIGHT + 100;

function RainEffect() {
  // Create drops with random starting positions in their cycle
  const dropsRef = useRef(
    Array.from({ length: PARTICLE_CONFIG.rain.count }, (_, i) => {
      const startProgress = Math.random(); // Store initial progress
      return {
        id: i,
        x: Math.random() * (SCREEN_WIDTH + RAIN_DRIFT * 2) - RAIN_DRIFT,
        animValue: new Animated.Value(startProgress),
        startProgress, // Keep track for duration calculation
        speed: 400 + Math.random() * 400, // 400-800ms per drop (faster for storm)
        length: 20 + Math.random() * 25, // Varied streak lengths
        opacity: 0.4 + Math.random() * 0.4, // More variation in visibility
      };
    })
  );
  const drops = dropsRef.current;
  const isActiveRef = useRef(true);

  useEffect(() => {
    isActiveRef.current = true;

    // Recursive animation function for continuous rain
    const animateDrop = (drop: typeof drops[0], isInitial: boolean) => {
      if (!isActiveRef.current) return;

      // For initial animation, calculate remaining duration from starting position
      const duration = isInitial
        ? drop.speed * (1 - drop.startProgress)
        : drop.speed;

      // Reset to 0 for non-initial cycles
      if (!isInitial) {
        drop.animValue.setValue(0);
      }

      Animated.timing(drop.animValue, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(() => {
        // Recursively start the next cycle
        animateDrop(drop, false);
      });
    };

    // Start all drops
    drops.forEach((drop) => animateDrop(drop, true));

    return () => {
      isActiveRef.current = false;
    };
  }, []);

  return (
    <>
      {drops.map((drop) => (
        <Animated.View
          key={drop.id}
          style={[
            styles.raindrop,
            {
              left: drop.x,
              height: drop.length,
              opacity: drop.opacity,
              transform: [
                { rotate: `${RAIN_ANGLE}deg` },
                {
                  translateY: drop.animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50, SCREEN_HEIGHT + 50],
                  }),
                },
                {
                  translateX: drop.animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, RAIN_DRIFT],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </>
  );
}

// =============================================================================
// Snow Effect
// =============================================================================

function SnowEffect() {
  const flakesRef = useRef(
    Array.from({ length: PARTICLE_CONFIG.snow.count }, (_, i) => ({
      id: i,
      startX: Math.random() * SCREEN_WIDTH,
      size: PARTICLE_CONFIG.snow.minSize +
        Math.random() * (PARTICLE_CONFIG.snow.maxSize - PARTICLE_CONFIG.snow.minSize),
      animY: new Animated.Value(Math.random()), // Start at random positions
      animX: new Animated.Value(Math.random()),
      speed: 3000 + Math.random() * 4000,
      drift: 20 + Math.random() * 30,
    }))
  );
  const flakes = flakesRef.current;
  const animationsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    // Start all animations immediately
    animationsRef.current = flakes.map((flake) => {
      const animation = Animated.loop(
        Animated.parallel([
          Animated.timing(flake.animY, {
            toValue: 1,
            duration: flake.speed,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(flake.animX, {
              toValue: 1,
              duration: flake.speed / 2,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(flake.animX, {
              toValue: 0,
              duration: flake.speed / 2,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      animation.start();
      return animation;
    });

    // Cleanup on unmount
    return () => {
      animationsRef.current.forEach((anim) => anim.stop());
    };
  }, [flakes]);

  return (
    <>
      {flakes.map((flake) => (
        <Animated.View
          key={flake.id}
          style={[
            styles.snowflake,
            {
              width: flake.size,
              height: flake.size,
              borderRadius: flake.size / 2,
              opacity: 0.8,
              transform: [
                {
                  translateX: Animated.add(
                    flake.startX,
                    flake.animX.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, flake.drift],
                    })
                  ),
                },
                {
                  translateY: flake.animY.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-flake.size, SCREEN_HEIGHT + flake.size],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </>
  );
}

// =============================================================================
// Fog Overlay - Cloud-like fog with soft organic shapes
// =============================================================================

// Create cloud-like fog puffs
const FOG_CLOUD_COUNT = 12;

function FogOverlay() {
  // Create cloud-like fog puffs - elliptical shapes that drift and fade
  const cloudsRef = useRef(
    Array.from({ length: FOG_CLOUD_COUNT }, (_, i) => {
      const startX = Math.random();
      const startOpacity = Math.random();
      // Clouds concentrated more in lower 2/3 of screen
      const y = SCREEN_HEIGHT * (0.2 + Math.random() * 0.7);
      // Wide elliptical clouds
      const width = 150 + Math.random() * 250;
      const height = 60 + Math.random() * 100;

      return {
        id: i,
        x: Math.random() * SCREEN_WIDTH - width / 2,
        y,
        width,
        height,
        opacity: 0.12 + Math.random() * 0.15,
        driftSpeed: 25000 + Math.random() * 35000,
        driftDistance: 60 + Math.random() * 100,
        animX: new Animated.Value(startX),
        animY: new Animated.Value(Math.random()),
        animOpacity: new Animated.Value(startOpacity),
        pulseSpeed: 10000 + Math.random() * 15000,
        verticalDrift: 15 + Math.random() * 25,
        verticalSpeed: 18000 + Math.random() * 25000,
        // Track directions
        driftingRight: startX < 0.5,
        driftingUp: Math.random() > 0.5,
        fadingIn: startOpacity < 0.5,
      };
    })
  );
  const clouds = cloudsRef.current;
  const isActiveRef = useRef(true);

  useEffect(() => {
    isActiveRef.current = true;

    const animateCloud = (cloud: typeof clouds[0]) => {
      if (!isActiveRef.current) return;

      // Horizontal drift
      const targetX = cloud.driftingRight ? 1 : 0;
      cloud.driftingRight = !cloud.driftingRight;

      Animated.timing(cloud.animX, {
        toValue: targetX,
        duration: cloud.driftSpeed,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start(() => animateCloud(cloud));
    };

    const animateVertical = (cloud: typeof clouds[0]) => {
      if (!isActiveRef.current) return;

      const targetY = cloud.driftingUp ? 0 : 1;
      cloud.driftingUp = !cloud.driftingUp;

      Animated.timing(cloud.animY, {
        toValue: targetY,
        duration: cloud.verticalSpeed,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start(() => animateVertical(cloud));
    };

    const animateOpacity = (cloud: typeof clouds[0]) => {
      if (!isActiveRef.current) return;

      const targetOpacity = cloud.fadingIn ? 1 : 0;
      cloud.fadingIn = !cloud.fadingIn;

      Animated.timing(cloud.animOpacity, {
        toValue: targetOpacity,
        duration: cloud.pulseSpeed,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start(() => animateOpacity(cloud));
    };

    clouds.forEach((cloud) => {
      animateCloud(cloud);
      animateVertical(cloud);
      animateOpacity(cloud);
    });

    return () => {
      isActiveRef.current = false;
    };
  }, []);

  return (
    <>
      {/* Subtle overall fog tint */}
      <View style={styles.fogBase} />

      {/* Cloud-like fog puffs */}
      {clouds.map((cloud) => (
        <Animated.View
          key={cloud.id}
          style={[
            styles.fogCloud,
            {
              left: cloud.x,
              top: cloud.y,
              width: cloud.width,
              height: cloud.height,
              borderRadius: cloud.height / 2, // Elliptical shape
              opacity: cloud.animOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [cloud.opacity * 0.3, cloud.opacity],
              }),
              transform: [
                {
                  translateX: cloud.animX.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-cloud.driftDistance, cloud.driftDistance],
                  }),
                },
                {
                  translateY: cloud.animY.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-cloud.verticalDrift, cloud.verticalDrift],
                  }),
                },
              ],
            },
          ]}
        />
      ))}

      {/* Ground fog - gradient effect at bottom */}
      <View style={styles.groundFog} />
    </>
  );
}

// =============================================================================
// Mist Overlay (dawn effect)
// =============================================================================

function MistOverlay() {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 8000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animValue, {
          toValue: 0,
          duration: 8000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animValue]);

  return (
    <Animated.View
      style={[
        styles.mist,
        {
          opacity: animValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0.1, 0.2],
          }),
        },
      ]}
    />
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 1, // Render particles above content background but pointerEvents="none" allows interaction
  },
  moonbeam: {
    ...StyleSheet.absoluteFillObject,
    // Diagonal gradient effect simulated with semi-transparent blue
    backgroundColor: 'rgba(180, 200, 220, 0.1)',
  },
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  firefly: {
    position: 'absolute',
    backgroundColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  raindrop: {
    position: 'absolute',
    width: 1.5,
    backgroundColor: 'rgba(180, 200, 230, 0.6)',
    borderRadius: 1,
  },
  snowflake: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  fogBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(200, 205, 215, 0.08)',
  },
  fogCloud: {
    position: 'absolute',
    backgroundColor: 'rgba(230, 235, 245, 0.4)',
    // Soft shadow to create depth and blur effect
    shadowColor: 'rgba(220, 225, 235, 1)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 40,
  },
  groundFog: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT * 0.2,
    backgroundColor: 'rgba(220, 225, 235, 0.15)',
  },
  mist: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
});

export default ParticleLayer;
