/**
 * SkyBackground
 *
 * Full-screen Skia canvas that renders a living sky behind the book UI.
 * Visible in the safe area insets — top strip (Dynamic Island area) and
 * bottom strip (home indicator area). The book parchment covers the middle.
 *
 * Features:
 *   - Day/night sky gradient transitions (midnight → dawn → day → dusk → night)
 *   - Sun and moon orbiting the Dynamic Island pill
 *   - Stars at night with per-star twinkling animation
 *   - Accepts optional gameTime (0–24) to sync with in-game time
 *     or auto-animates a sped-up demo cycle if not provided
 *
 * Dynamic Island approximation (iPhone 14 Pro+):
 *   - Pill centered at top, ~12 pt from screen edge, 126 × 37 pt
 *   - We approximate its centre from TOP_INSET without needing safe-area-context
 */

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import {
  Easing,
  SharedValue,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Approximate top safe-area inset (pt) on iPhone 14 Pro+ */
const TOP_INSET = 59;

/** Demo cycle length (120 s = one full animated day) */
const DEMO_CYCLE_MS = 120_000;

// ─── Star sub-component ───────────────────────────────────────────────────────
// Extracted so each star can call useDerivedValue at its own component top level,
// avoiding the hooks-in-loop violation.

interface StarProps {
  x: number;
  y: number;
  r: number;
  baseOpacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
  nightOpacity: SharedValue<number>;
  elapsed: SharedValue<number>;
}

function Star({ x, y, r, baseOpacity, twinkleSpeed, twinklePhase, nightOpacity, elapsed }: StarProps) {
  const opacity = useDerivedValue(() => {
    const phase = elapsed.value * twinkleSpeed + twinklePhase;
    const twinkle = Math.sin(phase) * 0.22 + 0.78;
    return nightOpacity.value * baseOpacity * twinkle;
  });
  return <Circle cx={x} cy={y} r={r} color="white" opacity={opacity} />;
}

// ─── Star seed helper ─────────────────────────────────────────────────────────

function makeStar(seed: number, width: number) {
  let s = seed;
  const next = () => {
    s = ((s * 1664525 + 1013904223) | 0) >>> 0;
    return s / 0xffffffff;
  };
  return {
    x: next() * width,
    y: next() * TOP_INSET * 0.88,
    r: next() * 1.2 + 0.4,
    baseOpacity: next() * 0.35 + 0.55,
    twinkleSpeed: next() * 1.8 + 0.4,
    twinklePhase: next() * Math.PI * 2,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SkyBackgroundProps {
  /** In-game hour (0–24). Drives the sky when provided. Auto-animates if omitted. */
  gameTime?: number;
}

export function SkyBackground({ gameTime }: SkyBackgroundProps) {
  const { width, height } = useWindowDimensions();

  // ── Shared values ──────────────────────────────────────────────────────────
  // timeOfDay: 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk
  const timeOfDay = useSharedValue(0.25);
  // elapsed seconds (for twinkling), loops every 60 s
  const elapsed = useSharedValue(0);

  useEffect(() => {
    if (gameTime !== undefined) {
      timeOfDay.value = withTiming(gameTime / 24, { duration: 2000 });
    } else {
      timeOfDay.value = withRepeat(
        withTiming(1, { duration: DEMO_CYCLE_MS, easing: Easing.linear }),
        -1,
        false,
      );
    }
    elapsed.value = withRepeat(
      withTiming(60, { duration: 60_000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [gameTime]);

  // ── Stars ──────────────────────────────────────────────────────────────────
  const stars = useMemo(
    () => Array.from({ length: 48 }, (_, i) => makeStar(i * 2731 + 17, width)),
    [width],
  );

  // ── Phase opacities ────────────────────────────────────────────────────────
  //   night:  0.00–0.18  and  0.82–1.00  (fully dark)
  //   dawn:   0.18–0.32  (bell curve)
  //   day:    0.30–0.70
  //   dusk:   0.68–0.82  (bell curve)

  const nightOpacity = useDerivedValue(() => {
    const t = timeOfDay.value;
    if (t < 0.18) return 1;
    if (t < 0.30) return 1 - (t - 0.18) / 0.12;
    if (t < 0.70) return 0;
    if (t < 0.82) return (t - 0.70) / 0.12;
    return 1;
  });

  const dawnOpacity = useDerivedValue(() => {
    const t = timeOfDay.value;
    if (t < 0.18 || t > 0.32) return 0;
    return Math.sin(((t - 0.18) / 0.14) * Math.PI);
  });

  const dayOpacity = useDerivedValue(() => {
    const t = timeOfDay.value;
    if (t < 0.28) return 0;
    if (t < 0.36) return (t - 0.28) / 0.08;
    if (t < 0.64) return 1;
    if (t < 0.72) return 1 - (t - 0.64) / 0.08;
    return 0;
  });

  const duskOpacity = useDerivedValue(() => {
    const t = timeOfDay.value;
    if (t < 0.68 || t > 0.82) return 0;
    return Math.sin(((t - 0.68) / 0.14) * Math.PI);
  });

  // ── Sun / moon orbit ───────────────────────────────────────────────────────
  //
  // Both bodies share the same orbital ellipse, centred on the Dynamic Island.
  // The sun sweeps the upper half (θ: 0 → -π, i.e. right → top → left).
  // The moon sweeps the opposite half, passing above the island at midnight.
  //
  //   orbitRX ≈ 46% of screen width → sun touches both side edges
  //   orbitRY ≈ 38% of TOP_INSET   → keeps orbit inside the top strip
  //   islandCY ≈ 46% of TOP_INSET  → matches pill vertical centre

  const cx = width / 2;
  const islandCY = TOP_INSET * 0.46;    // ~27 pt
  const orbitRX = width * 0.46;         // ~212 pt on a 390-wide phone
  const orbitRY = TOP_INSET * 0.40;     // ~24 pt

  // Sun
  const sunX = useDerivedValue(() => {
    const prog = Math.max(0, Math.min(1, (timeOfDay.value - 0.25) / 0.5));
    return cx + Math.cos(-prog * Math.PI) * orbitRX;
  });
  const sunY = useDerivedValue(() => {
    const prog = Math.max(0, Math.min(1, (timeOfDay.value - 0.25) / 0.5));
    return islandCY + Math.sin(-prog * Math.PI) * orbitRY;
  });
  const sunOpacity = useDerivedValue(() => {
    const t = timeOfDay.value;
    if (t < 0.20 || t > 0.80) return 0;
    if (t < 0.26) return (t - 0.20) / 0.06;
    if (t > 0.74) return 1 - (t - 0.74) / 0.06;
    return 1;
  });

  // Moon (night half: dusk → midnight → dawn)
  const moonX = useDerivedValue(() => {
    const t = timeOfDay.value;
    const mt = t < 0.25 ? t + 1.0 : t; // shift to [0.75, 1.25]
    const prog = Math.max(0, Math.min(1, (mt - 0.75) / 0.5));
    return cx + Math.cos(-prog * Math.PI) * orbitRX;
  });
  const moonY = useDerivedValue(() => {
    const t = timeOfDay.value;
    const mt = t < 0.25 ? t + 1.0 : t;
    const prog = Math.max(0, Math.min(1, (mt - 0.75) / 0.5));
    return islandCY + Math.sin(-prog * Math.PI) * orbitRY;
  });
  const moonOpacity = useDerivedValue(() => {
    const t = timeOfDay.value;
    if (t > 0.22 && t < 0.78) return 0;
    if (t < 0.16) return 1;
    if (t < 0.22) return 1 - (t - 0.16) / 0.06;
    if (t > 0.84) return (t - 0.84) / 0.06;
    return 1;
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">

      {/* Night sky */}
      <Group opacity={nightOpacity}>
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(cx, 0)}
            end={vec(cx, TOP_INSET)}
            colors={['#010208', '#050a1e', '#0a0e28']}
          />
        </Rect>
      </Group>

      {/* Dawn glow */}
      <Group opacity={dawnOpacity}>
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(cx, 0)}
            end={vec(cx, TOP_INSET)}
            colors={['#2a1240', '#a03830', '#d4622a', '#f0a050', '#f5d080']}
          />
        </Rect>
      </Group>

      {/* Day sky */}
      <Group opacity={dayOpacity}>
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(cx, 0)}
            end={vec(cx, TOP_INSET)}
            colors={['#1155bb', '#2288dd', '#55aaee']}
          />
        </Rect>
      </Group>

      {/* Dusk glow */}
      <Group opacity={duskOpacity}>
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(cx, 0)}
            end={vec(cx, TOP_INSET)}
            colors={['#1a0c35', '#7a2020', '#c04020', '#e07030', '#f0b060']}
          />
        </Rect>
      </Group>

      {/* Stars — each rendered by its own sub-component so hooks are valid */}
      {stars.map((star, i) => (
        <Star
          key={i}
          {...star}
          nightOpacity={nightOpacity}
          elapsed={elapsed}
        />
      ))}

      {/* Sun — layered circles for corona → glow → disk */}
      <Group opacity={sunOpacity}>
        <Circle cx={sunX} cy={sunY} r={22} color="rgba(255, 220, 80, 0.18)">
          <BlurMask blur={12} style="normal" />
        </Circle>
        <Circle cx={sunX} cy={sunY} r={13} color="rgba(255, 200, 50, 0.55)">
          <BlurMask blur={5} style="normal" />
        </Circle>
        <Circle cx={sunX} cy={sunY} r={7} color="#FFE060" />
      </Group>

      {/* Moon — halo → glow → disk */}
      <Group opacity={moonOpacity}>
        <Circle cx={moonX} cy={moonY} r={18} color="rgba(190, 210, 255, 0.15)">
          <BlurMask blur={8} style="normal" />
        </Circle>
        <Circle cx={moonX} cy={moonY} r={10} color="rgba(210, 225, 255, 0.45)">
          <BlurMask blur={3} style="normal" />
        </Circle>
        <Circle cx={moonX} cy={moonY} r={7} color="#DDE8F8" />
      </Group>

    </Canvas>
  );
}
