import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import {
  Canvas,
  Vertices,
  ImageShader,
  Group,
  Rect,
  LinearGradient,
  vec,
  type SkImage,
  type SkPoint,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  withTiming,
  runOnJS,
  Easing,
  useDerivedValue,
} from 'react-native-reanimated';

interface PageCurlAnimationProps {
  animating: boolean;
  departingImage: SkImage | null;
  onComplete: () => void;
  direction?: 'forward' | 'back';
  width?: number;
  height?: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Godot STANDARD_PAPER preset ──
const SUBDIV_X = 8;
const SUBDIV_Y = 5;
const COLS = SUBDIV_X + 1; // 9
const ROWS = SUBDIV_Y + 1; // 6
const VERTEX_COUNT = COLS * ROWS; // 54
const STIFFNESS = 2.5;
const LIFT_BEND = -12.0;
const LAND_BEND = 3.0;
const CURL_LAG = 0.4;
const DURATION = 0.65;
const T_PEAK_LIFT = 0.12;
const T_PEAK_LAND = 0.88;
const DEG2RAD = Math.PI / 180;

// Parchment back-face color
const PARCHMENT_HEX = '#D1C0A3';

// ── Worklet math helpers ──

function clamp(v: number, lo: number, hi: number): number {
  'worklet';
  return Math.min(Math.max(v, lo), hi);
}

function lerp(a: number, b: number, t: number): number {
  'worklet';
  return a + (b - a) * t;
}

/**
 * Root bone (spine hinge) rotation in degrees.
 * 0° = flat right (page at rest) → -90° = perpendicular → -180° = flat left (turned)
 */
function computeRootAngle(
  t: number,
  tLift: number,
  tMid: number,
  tLand: number,
  dur: number,
  rowFactor: number,
): number {
  'worklet';
  const tSettle = lerp(tLand, dur, 0.7);
  const liftAngle = -15.0 * rowFactor;
  const landAngle = lerp(-90, -180, 0.88); // -169.2
  const settleAngle = lerp(landAngle, -179.9, 0.85); // ~-178

  if (t <= 0) return 0;
  if (t <= tLift) return lerp(0, liftAngle, t / tLift);
  if (t <= tMid) return lerp(liftAngle, -90, (t - tLift) / (tMid - tLift));
  if (t <= tLand) return lerp(-90, landAngle, (t - tMid) / (tLand - tMid));
  if (t <= tSettle) return lerp(landAngle, settleAngle, (t - tLand) / (tSettle - tLand));
  if (t <= dur) return lerp(settleAngle, -179.9, (t - tSettle) / (dur - tSettle));
  return -179.9;
}

/**
 * Surface bone bend (relative to parent) in degrees.
 * Creates the paper stiffness curve — tip bends more than spine.
 */
function computeSurfaceBend(
  t: number,
  tLift: number,
  tLand: number,
  dur: number,
  rowFactor: number,
  influence: number,
): number {
  'worklet';
  const tSettle = lerp(tLand, dur, 0.7);
  const liftVal = LIFT_BEND * rowFactor * influence;
  const landVal = LAND_BEND * rowFactor * influence;
  const settleVal = landVal * 0.15;

  if (t <= 0) return 0;
  if (t <= tLift) return lerp(0, liftVal, t / tLift);
  if (t <= tLand) return lerp(liftVal, landVal, (t - tLift) / (tLand - tLift));
  if (t <= tSettle) return lerp(landVal, settleVal, (t - tLand) / (tSettle - tLand));
  if (t <= dur) return lerp(settleVal, 0, (t - tSettle) / (dur - tSettle));
  return 0;
}

/**
 * Scale squash at midpoint — page goes edge-on, briefly compress x to 0.88.
 */
function computeSquash(t: number, dur: number): number {
  'worklet';
  const tMid = dur * 0.5;
  const tSquashPeak = tMid + dur * 0.1;
  const tSquashEnd = dur * 0.85;

  if (t <= tMid) return 1.0;
  if (t <= tSquashPeak) return lerp(1.0, 0.88, (t - tMid) / (tSquashPeak - tMid));
  if (t <= tSquashEnd) return lerp(0.88, 1.0, (t - tSquashPeak) / (tSquashEnd - tSquashPeak));
  return 1.0;
}

/** Build triangle indices for the quad grid (static, computed once) */
function buildQuadIndices(): number[] {
  const indices: number[] = [];
  for (let row = 0; row < SUBDIV_Y; row++) {
    for (let col = 0; col < SUBDIV_X; col++) {
      const i = row * COLS + col;
      indices.push(i, i + 1, i + COLS + 1);
      indices.push(i, i + COLS + 1, i + COLS);
    }
  }
  return indices;
}

const TRIANGLE_INDICES = buildQuadIndices();

function fireOnComplete(ref: React.RefObject<(() => void) | null>) {
  ref.current?.();
}

export function PageCurlAnimation({
  animating,
  departingImage,
  onComplete,
  direction: _direction = 'forward',
  width = SCREEN_WIDTH,
  height = SCREEN_HEIGHT,
}: PageCurlAnimationProps) {
  const progress = useSharedValue(0);
  const onCompleteRef = useRef<(() => void) | null>(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!animating) {
      progress.value = 0;
      return;
    }
    progress.value = withTiming(
      1,
      { duration: 650, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(fireOnComplete)(onCompleteRef);
        }
      },
    );
  }, [animating, progress]);

  const stepX = width / SUBDIV_X;
  const stepY = height / SUBDIV_Y;

  // Static UVs for front face — maps 1:1 to the captured image
  const frontTextures = useMemo(() => {
    const uvs: SkPoint[] = [];
    for (let row = 0; row <= SUBDIV_Y; row++) {
      for (let col = 0; col <= SUBDIV_X; col++) {
        uvs.push(vec(col * stepX, row * stepY));
      }
    }
    return uvs;
  }, [stepX, stepY]);

  // Parchment vertex colors for back face (one color per vertex)
  const parchmentColors = useMemo(
    () => Array(VERTEX_COUNT).fill(PARCHMENT_HEX),
    [],
  );

  /**
   * Vertex positions — recomputed every frame on UI thread.
   *
   * Spine is at x=0 (left edge). Bone chain extends rightward at rest (angle 0°).
   * As root bone rotates 0° → -180°, the chain sweeps up and over to the left.
   *
   * Grid layout (row-major):
   *   col 0 = spine (x=0), col 8 = tip (x=width at rest)
   *   row 0 = top, row 5 = bottom
   */
  const animatedVertices = useDerivedValue(() => {
    const t = progress.value * DURATION;
    const tMid = DURATION * 0.5;
    const squash = computeSquash(t, DURATION);

    const verts: { x: number; y: number }[] = [];

    for (let row = 0; row <= SUBDIV_Y; row++) {
      const yRatio = row / SUBDIV_Y;
      const rowFactor = lerp(1.0, 1.0 - CURL_LAG, yRatio);
      const timeOffset = (1.0 - rowFactor) * DURATION * 0.1;

      const tLift = clamp(DURATION * T_PEAK_LIFT + timeOffset, 0, tMid - 0.05);
      const tLand = clamp(DURATION * T_PEAK_LAND - timeOffset, tMid + 0.05, DURATION);

      const rootAngleDeg = computeRootAngle(t, tLift, tMid, tLand, DURATION, rowFactor);
      const baseY = row * stepY;

      // Chain starts at spine (x=0)
      let chainX = 0;
      let chainY = baseY;
      let chainAngle = rootAngleDeg;

      for (let col = 0; col <= SUBDIV_X; col++) {
        if (col === 0) {
          // Root bone — pinned at the spine
          verts.push({ x: 0, y: baseY });
        } else {
          // Surface bone — extends from previous bone
          const xRatio = col / SUBDIV_X;
          const influence = Math.pow(xRatio, STIFFNESS);
          const surfaceBend = computeSurfaceBend(
            t, tLift, tLand, DURATION, rowFactor, influence,
          );

          const totalAngle = chainAngle + surfaceBend;
          const rad = totalAngle * DEG2RAD;
          chainX = chainX + Math.cos(rad) * stepX;
          chainY = chainY + Math.sin(rad) * stepX;
          chainAngle = totalAngle;

          // Apply squash toward spine (x=0) for display only
          verts.push({ x: chainX * squash, y: chainY });
        }
      }
    }

    return verts;
  });

  // Front face: visible 100% early, fades out as page passes vertical
  const frontOpacity = useDerivedValue(() => {
    const p = progress.value;
    if (p < 0.38) return 1.0;
    if (p < 0.52) return lerp(1.0, 0.0, (p - 0.38) / 0.14);
    return 0.0;
  });

  // Back face: invisible early, fades in as page passes vertical
  const backOpacity = useDerivedValue(() => {
    const p = progress.value;
    if (p < 0.38) return 0.0;
    if (p < 0.52) return lerp(0.0, 1.0, (p - 0.38) / 0.14);
    return 1.0;
  });

  // Spine shadow: 0 → 0.65 → 0 with cubic easing
  const shadowOpacity = useDerivedValue(() => {
    const p = progress.value;
    if (p <= 0.5) {
      const f = p / 0.5;
      return 0.65 * (1 - Math.pow(1 - f, 3));
    } else {
      const f = Math.min((p - 0.5) / 0.4, 1.0);
      return 0.65 * (1 - Math.pow(f, 3));
    }
  });

  if (!animating || !departingImage) return null;

  return (
    <View style={[styles.container, { width, height }]} pointerEvents="none">
      <Canvas style={{ width, height }}>
        {/* Layer 1: Back face (parchment) — drawn first, behind front */}
        <Group opacity={backOpacity}>
          <Vertices
            vertices={animatedVertices}
            indices={TRIANGLE_INDICES}
            colors={parchmentColors}
          />
        </Group>

        {/* Layer 2: Front face (captured page image) — drawn on top */}
        <Group opacity={frontOpacity}>
          <ImageShader
            image={departingImage}
            fit="fill"
            rect={{ x: 0, y: 0, width, height }}
          />
          <Vertices
            vertices={animatedVertices}
            textures={frontTextures}
            indices={TRIANGLE_INDICES}
          />
        </Group>

        {/* Layer 3: Spine shadow — gradient along left edge (book binding) */}
        <Group opacity={shadowOpacity}>
          <Rect x={0} y={0} width={35} height={height}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(35, 0)}
              colors={['rgba(18, 14, 8, 0.6)', 'rgba(18, 14, 8, 0)']}
            />
          </Rect>
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 100,
  },
});
