import React, { useEffect, useLayoutEffect, useRef, useMemo } from 'react';
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
  useAnimatedReaction,
} from 'react-native-reanimated';

// ── Curl mode enum ──
// 0 = STRAIGHT, 1 = TOP_CORNER_FIRST, 2 = BOTTOM_CORNER_FIRST
type CurlMode = 0 | 1 | 2;

export interface CurlPreset {
  name: string;
  stiffness: number;
  liftBend: number;
  landBend: number;
  curlMode: CurlMode;
  curlLag: number;
  duration: number; // seconds
  peakLift: number;
  peakLand: number;
}

export const CURL_PRESETS: Record<string, CurlPreset> = {
  DEFAULT: {
    name: 'Default',
    stiffness: 2.0, liftBend: -15.0, landBend: 5.0,
    curlMode: 1, curlLag: 0.5, duration: 0.75,
    peakLift: 0.15, peakLand: 0.85,
  },
  STANDARD_PAPER: {
    name: 'Standard Paper',
    stiffness: 2.5, liftBend: -12.0, landBend: 3.0,
    curlMode: 1, curlLag: 0.4, duration: 0.65,
    peakLift: 0.12, peakLand: 0.88,
  },
  HEAVY_GRIMOIRE: {
    name: 'Heavy Grimoire',
    stiffness: 4.0, liftBend: -3.0, landBend: 1.0,
    curlMode: 0, curlLag: 0.1, duration: 1.1,
    peakLift: 0.25, peakLand: 0.75,
  },
  LIGHT_MAGAZINE: {
    name: 'Light Magazine',
    stiffness: 0.8, liftBend: -16.0, landBend: 0.0,
    curlMode: 2, curlLag: 0.6, duration: 0.8,
    peakLift: 0.10, peakLand: 0.92,
  },
  OLD_SCROLL: {
    name: 'Old Scroll',
    stiffness: 1.8, liftBend: -20.0, landBend: 8.0,
    curlMode: 1, curlLag: 0.9, duration: 0.9,
    peakLift: 0.18, peakLand: 0.82,
  },
  RIGID_BOARD: {
    name: 'Rigid Board',
    stiffness: 5.0, liftBend: 0.0, landBend: 0.0,
    curlMode: 0, curlLag: 0.0, duration: 0.8,
    peakLift: 0.2, peakLand: 0.8,
  },
  WET_CLOTH: {
    name: 'Wet Cloth',
    stiffness: 0.3, liftBend: -28.0, landBend: 0.0,
    curlMode: 2, curlLag: 0.6, duration: 1.3,
    peakLift: 0.2, peakLand: 0.95,
  },
  PLASTIC_SHEET: {
    name: 'Plastic Sheet',
    stiffness: 3.5, liftBend: -12.0, landBend: 12.0,
    curlMode: 1, curlLag: 0.2, duration: 0.5,
    peakLift: 0.08, peakLand: 0.92,
  },
  METAL_PLATE: {
    name: 'Metal Plate',
    stiffness: 5.0, liftBend: 0.0, landBend: 0.0,
    curlMode: 0, curlLag: 0.0, duration: 1.4,
    peakLift: 0.15, peakLand: 0.98,
  },
};

export const PRESET_KEYS = Object.keys(CURL_PRESETS);

interface PageCurlAnimationProps {
  animating: boolean;
  departingImage: SkImage | null;
  onComplete: () => void;
  // Called when progress is within nearCompleteThreshold of landing. Fires on the
  // JS thread via runOnJS — use it to switch displayedPage before the overlay fades.
  onNearComplete?: () => void;
  preset?: string;
  direction?: 'forward' | 'reverse';
  width?: number;
  height?: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SUBDIV_X = 8;
const SUBDIV_Y = 5;
const COLS = SUBDIV_X + 1;
const VERTEX_COUNT = COLS * (SUBDIV_Y + 1);
const DEG2RAD = Math.PI / 180;
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

function computeRootAngle(
  t: number, tLift: number, tMid: number, tLand: number,
  dur: number, rowFactor: number,
): number {
  'worklet';
  const tSettle = lerp(tLand, dur, 0.7);
  const liftAngle = -15.0 * rowFactor;
  const landAngle = lerp(-90, -180, 0.88);
  const settleAngle = lerp(landAngle, -179.9, 0.85);

  if (t <= 0) return 0;
  if (t <= tLift) return lerp(0, liftAngle, t / tLift);
  if (t <= tMid) return lerp(liftAngle, -90, (t - tLift) / (tMid - tLift));
  if (t <= tLand) return lerp(-90, landAngle, (t - tMid) / (tLand - tMid));
  if (t <= tSettle) return lerp(landAngle, settleAngle, (t - tLand) / (tSettle - tLand));
  if (t <= dur) return lerp(settleAngle, -179.9, (t - tSettle) / (dur - tSettle));
  return -179.9;
}

function computeSurfaceBend(
  t: number, tLift: number, tLand: number, dur: number,
  liftBend: number, landBend: number,
  rowFactor: number, influence: number,
): number {
  'worklet';
  const tSettle = lerp(tLand, dur, 0.7);
  const liftVal = liftBend * rowFactor * influence;
  const landVal = landBend * rowFactor * influence;
  const settleVal = landVal * 0.15;

  if (t <= 0) return 0;
  if (t <= tLift) return lerp(0, liftVal, t / tLift);
  if (t <= tLand) return lerp(liftVal, landVal, (t - tLift) / (tLand - tLift));
  if (t <= tSettle) return lerp(landVal, settleVal, (t - tLand) / (tSettle - tLand));
  if (t <= dur) return lerp(settleVal, 0, (t - tSettle) / (dur - tSettle));
  return 0;
}

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

function fireOnNearComplete(ref: React.RefObject<(() => void) | null>) {
  ref.current?.();
}

export function PageCurlAnimation({
  animating,
  departingImage,
  onComplete,
  onNearComplete,
  preset: presetKey = 'STANDARD_PAPER',
  direction = 'forward',
  width = SCREEN_WIDTH,
  height = SCREEN_HEIGHT,
}: PageCurlAnimationProps) {
  const p = CURL_PRESETS[presetKey] ?? CURL_PRESETS.STANDARD_PAPER;

  const progress = useSharedValue(0);
  const onCompleteRef = useRef<(() => void) | null>(onComplete);
  onCompleteRef.current = onComplete;
  const onNearCompleteRef = useRef<(() => void) | null>(onNearComplete ?? null);
  onNearCompleteRef.current = onNearComplete ?? null;
  // Guards so onNearComplete fires at most once per animation.
  const firedNearComplete = useSharedValue(0);

  // Track direction as a shared value so worklets can read it without closure capture.
  const sDirection = useSharedValue(direction === 'reverse' ? 1 : 0);
  useEffect(() => {
    sDirection.value = direction === 'reverse' ? 1 : 0;
  }, [direction, sDirection]);

  // Pass preset values into shared values so worklets can read them
  const sStiffness = useSharedValue(p.stiffness);
  const sLiftBend = useSharedValue(p.liftBend);
  const sLandBend = useSharedValue(p.landBend);
  const sCurlMode = useSharedValue(p.curlMode);
  const sCurlLag = useSharedValue(p.curlLag);
  const sDuration = useSharedValue(p.duration);
  const sPeakLift = useSharedValue(p.peakLift);
  const sPeakLand = useSharedValue(p.peakLand);

  // Sync shared values when preset changes
  useEffect(() => {
    sStiffness.value = p.stiffness;
    sLiftBend.value = p.liftBend;
    sLandBend.value = p.landBend;
    sCurlMode.value = p.curlMode;
    sCurlLag.value = p.curlLag;
    sDuration.value = p.duration;
    sPeakLift.value = p.peakLift;
    sPeakLand.value = p.peakLand;
  }, [p, sStiffness, sLiftBend, sLandBend, sCurlMode, sCurlLag, sDuration, sPeakLift, sPeakLand]);

  const durationMs = Math.round(p.duration * 1000);

  // useLayoutEffect fires after React commits but before the native layer paints,
  // so setting progress.value here ensures the correct starting position (spine=1
  // for reverse, flat=0 for forward) is applied before the first frame is drawn.
  // Using useEffect instead would allow one painted frame at progress=0, which
  // causes the reverse animation to flash its full front-face image briefly.
  useLayoutEffect(() => {
    firedNearComplete.value = 0;
    if (!animating) {
      progress.value = 0;
      return;
    }
    // Forward: page curls from right to left (spine at x=0, progress 0→1).
    // Reverse: page starts folded on the left (progress=1) and returns right (progress→0).
    // Same spine, same pivot — opposite time direction.
    if (direction === 'reverse') {
      progress.value = 1;
      progress.value = withTiming(
        0,
        { duration: durationMs, easing: Easing.inOut(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(fireOnComplete)(onCompleteRef);
        },
      );
    } else {
      progress.value = 0;
      progress.value = withTiming(
        1,
        { duration: durationMs, easing: Easing.inOut(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(fireOnComplete)(onCompleteRef);
        },
      );
    }
  }, [animating, direction, progress, durationMs, firedNearComplete]);

  // Fire onNearComplete when progress is within this threshold of landing.
  // Must be larger than landingFadeOpacity's fadeWindow (0.02) so displayedPage
  // switches to the destination BEFORE the fade begins — that way ROOM (not ENTITY)
  // shows through as the overlay becomes transparent.
  const NEAR_COMPLETE_THRESHOLD = 0.05;

  useAnimatedReaction(
    () => {
      const pg = progress.value;
      const distFromLanding = sDirection.value === 1 ? pg : 1 - pg;
      return distFromLanding < NEAR_COMPLETE_THRESHOLD;
    },
    (isNear, wasNear) => {
      if (isNear && !wasNear && firedNearComplete.value === 0) {
        firedNearComplete.value = 1;
        runOnJS(fireOnNearComplete)(onNearCompleteRef);
      }
    },
  );

  const stepX = width / SUBDIV_X;
  const stepY = height / SUBDIV_Y;

  const frontTextures = useMemo(() => {
    const uvs: SkPoint[] = [];
    for (let row = 0; row <= SUBDIV_Y; row++) {
      for (let col = 0; col <= SUBDIV_X; col++) {
        uvs.push(vec(col * stepX, row * stepY));
      }
    }
    return uvs;
  }, [stepX, stepY]);

  const parchmentColors = useMemo(
    () => Array(VERTEX_COUNT).fill(PARCHMENT_HEX),
    [],
  );

  const animatedVertices = useDerivedValue(() => {
    const dur = sDuration.value;
    const stiffness = sStiffness.value;
    const liftBend = sLiftBend.value;
    const landBend = sLandBend.value;
    const curlMode = sCurlMode.value;
    const curlLag = sCurlLag.value;
    const peakLift = sPeakLift.value;
    const peakLand = sPeakLand.value;

    const t = progress.value * dur;
    const tMid = dur * 0.5;
    const squash = computeSquash(t, dur);
    const sx = width / SUBDIV_X;
    const sy = height / SUBDIV_Y;

    const verts: { x: number; y: number }[] = [];

    for (let row = 0; row <= SUBDIV_Y; row++) {
      const yRatio = row / SUBDIV_Y;

      // Curl mode determines which corner leads
      let lagRatio: number;
      if (curlMode === 0) {
        // STRAIGHT — no lag, all rows turn together
        lagRatio = 0;
      } else if (curlMode === 2) {
        // BOTTOM_CORNER_FIRST — invert: bottom leads, top lags
        lagRatio = 1.0 - yRatio;
      } else {
        // TOP_CORNER_FIRST — top leads, bottom lags
        lagRatio = yRatio;
      }

      const rowFactor = lerp(1.0, 1.0 - curlLag, lagRatio);
      const timeOffset = (1.0 - rowFactor) * dur * 0.1;

      const tLift = clamp(dur * peakLift + timeOffset, 0, tMid - 0.05);
      const tLand = clamp(dur * peakLand - timeOffset, tMid + 0.05, dur);

      const rootAngleDeg = computeRootAngle(t, tLift, tMid, tLand, dur, rowFactor);
      const baseY = row * sy;

      let chainX = 0;
      let chainY = baseY;
      let chainAngle = rootAngleDeg;

      for (let col = 0; col <= SUBDIV_X; col++) {
        if (col === 0) {
          verts.push({ x: 0, y: baseY });
        } else {
          const xRatio = col / SUBDIV_X;
          const influence = Math.pow(xRatio, stiffness);
          const surfaceBend = computeSurfaceBend(
            t, tLift, tLand, dur, liftBend, landBend, rowFactor, influence,
          );

          const totalAngle = chainAngle + surfaceBend;
          const rad = totalAngle * DEG2RAD;
          chainX = chainX + Math.cos(rad) * sx;
          chainY = chainY + Math.sin(rad) * sx;
          chainAngle = totalAngle;

          verts.push({ x: chainX * squash, y: chainY });
        }
      }
    }

    return verts;
  });

  const frontOpacity = useDerivedValue(() => {
    const pg = progress.value;
    if (pg < 0.38) return 1.0;
    if (pg < 0.52) return lerp(1.0, 0.0, (pg - 0.38) / 0.14);
    return 0.0;
  });

  const backOpacity = useDerivedValue(() => {
    const pg = progress.value;
    if (pg < 0.38) return 0.0;
    if (pg < 0.52) return lerp(0.0, 1.0, (pg - 0.38) / 0.14);
    return 1.0;
  });

  const shadowOpacity = useDerivedValue(() => {
    const pg = progress.value;
    if (pg <= 0.5) {
      const f = pg / 0.5;
      return 0.65 * (1 - Math.pow(1 - f, 3));
    } else {
      const f = Math.min((pg - 0.5) / 0.4, 1.0);
      return 0.65 * (1 - Math.pow(f, 3));
    }
  });

  // Fade the entire overlay to transparent as the page reaches its landing position.
  // This prevents the snap between "nearly-flat Skia mesh" and "static page" that occurs
  // when runOnJS fires a frame or two after progress reaches its target value. By the time
  // onComplete fires, the canvas is already invisible, so removing it causes no flash.
  // For forward: landing = progress → 1. For reverse: landing = progress → 0.
  const landingFadeOpacity = useDerivedValue(() => {
    const pg = progress.value;
    const fadeWindow = 0.02; // last 2% of progress — nearly-flat, imperceptible curl
    const distFromLanding = sDirection.value === 1 ? pg : 1 - pg;
    if (distFromLanding < fadeWindow) {
      return distFromLanding / fadeWindow;
    }
    return 1.0;
  });

  if (!animating || !departingImage) return null;

  return (
    <View style={[styles.container, { width, height }]} pointerEvents="none">
      <Canvas style={{ width, height }}>
        <Group opacity={landingFadeOpacity}>
          <Group opacity={backOpacity}>
            <Vertices
              vertices={animatedVertices}
              indices={TRIANGLE_INDICES}
              colors={parchmentColors}
            />
          </Group>

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

          <Group opacity={shadowOpacity}>
            <Rect x={0} y={0} width={35} height={height}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(35, 0)}
                colors={['rgba(18, 14, 8, 0.6)', 'rgba(18, 14, 8, 0)']}
              />
            </Rect>
          </Group>
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
