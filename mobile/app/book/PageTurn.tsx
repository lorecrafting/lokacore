// The Book's page turn (docs/BOOK-UI-COMPONENTS.md#page-turn). The arriving page is live from the
// first frame. The leaving page stays mounted over it, hidden from touch, keyboard and screen
// reader, until its picture is taken (at most motion.quick, else the page just changes); then
// page-curl.sksl curls that picture away over the live page. Reduced motion cross-fades the leaving
// page instead. On web, import this after CanvasKit loads.
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  Canvas,
  Fill,
  ImageShader,
  Shader,
  Skia,
  type SkImage,
  type SkRuntimeEffect,
} from '@shopify/react-native-skia';
import curl from './page-curl.sksl';
import { easing } from './easing.ts';
import { motion } from './tokens.ts';
import { snapshot, warm } from './snapshot';

// Made at the first curl: without CanvasKit on web no picture is taken, so no curl is drawn.
let effect: SkRuntimeEffect | undefined;
// Over the arriving page, taking no touch, keyboard or screen-reader focus: `inert` is
// react-native-web's (aria-hidden alone leaves its buttons tabbable); the others are the device's.
const over = {
  style: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none' },
  'aria-hidden': true,
  importantForAccessibility: 'no-hide-descendants',
  accessibilityElementsHidden: true,
  ...({ inert: true } as object),
} as const;

type Leaving = { turn: number; dir: 1 | -1; page: ReactNode; image?: SkImage };

// `paper`: the shown palette's bg, the leaf's back.
type Props = { turn: number; dir: 1 | -1; paper: string; children: ReactNode };
type Size = { width: number; height: number };
type SetLeaving = Dispatch<SetStateAction<Leaving | undefined>>;

export function PageTurn(p: Props) {
  const reduced = useReducedMotion();
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [leaving, setLeaving] = useLeaving(p);
  const { progress, page } = useMotion(p.turn, leaving, setLeaving, reduced);
  const fade = useAnimatedStyle(() => ({ opacity: reduced ? 1 - progress.value : 1 }));
  // Both pages are the same keyed element type, so the leaving page keeps its mounted instance.
  return (
    <View
      style={{ flex: 1 }}
      onLayout={({ nativeEvent: { layout: l } }) => setSize({ width: l.width, height: l.height })}
    >
      {[
        <Animated.View key={p.turn} ref={page(p.turn)} collapsable={false} style={{ flex: 1 }}>
          {p.children}
        </Animated.View>,
        leaving && !leaving.image && (
          <Animated.View key={leaving.turn} {...over} style={[over.style, fade]}>
            {leaving.page}
          </Animated.View>
        ),
      ]}
      {leaving?.image && (
        <Curl
          image={leaving.image}
          dir={leaving.dir}
          paper={p.paper}
          size={size}
          progress={progress}
        />
      )}
    </View>
  );
}

// Takes the leaving page's picture, then curls it (or, under reduced motion, fades the page itself).
function useMotion(
  turn: number,
  leaving: Leaving | undefined,
  setLeaving: SetLeaving,
  reduced: boolean,
) {
  const progress = useSharedValue(0);
  // Each page's view by turn, from its mount: Reanimated reads a ref prop only when it mounts.
  const pages = useRef(new Map<number, View>()).current;
  const page = (turn: number) => (view: View | null) => {
    if (view) pages.set(turn, view);
    else pages.delete(turn);
  };
  // Curl pictures waiting to be freed; unmounting frees them at once.
  const frees = useRef(new Set<() => void>()).current;
  useEffect(() => () => frees.forEach((free) => free()), []);
  // The first page, once mounted, warms the picture-taking so the first turn's picture is quick.
  useEffect(() => void (reduced || warm(pages.get(turn)!)), []);
  // Before paint, so a new curl or fade never shows the last turn's finished progress for a frame.
  useLayoutEffect(() => {
    // A curl or fade first draws with the progress it mounts on (a stale 1 flashed the arriving page).
    if (!leaving) return void (progress.value = 0);
    const timing = leaving.image ? motion.turn : reduced ? motion.fade : undefined;
    if (timing) return animate(progress, timing, leaving, setLeaving, frees);
    let live = true;
    // No picture in time, or none at all: the page has simply changed.
    const late = setTimeout(() => ((live = false), setLeaving(undefined)), motion.quick.duration);
    // A curl first draws with the progress it mounts on: 0 here too, for a turn that cut one short.
    snapshot(pages.get(leaving.turn)!).then(
      (image) =>
        live
          ? ((progress.value = 0), setLeaving(image ? { ...leaving, image } : undefined))
          : image?.dispose(),
      () => live && setLeaving(undefined),
    );
    return () => {
      live = false;
      clearTimeout(late);
    };
  }, [leaving, reduced]);
  return { progress, page };
}

// The page that is leaving, from the render where `turn` changes; a new turn replaces a running one.
function useLeaving(p: Props) {
  const [turn, setTurn] = useState(p.turn);
  const state = useState<Leaving>();
  const lastPage = useRef(p.children);
  useLayoutEffect(() => {
    lastPage.current = p.children;
  });
  if (p.turn !== turn) {
    // Sound: the polish phase plays sound.pageTurn here (curl and cross-fade alike) unless Sound is
    // off; there is no audio library yet.
    setTurn(p.turn);
    state[1]({ turn, dir: p.dir, page: lastPage.current });
  }
  return state;
}

function animate(
  progress: SharedValue<number>,
  timing: { duration: number; easing: string },
  leaving: Leaving,
  setLeaving: SetLeaving,
  frees: Set<() => void>,
) {
  const clear = () => setLeaving((l) => (l === leaving ? undefined : l));
  progress.value = 0;
  progress.value = withTiming(
    1,
    // Never: Reanimated would otherwise skip the reduced-motion cross-fade outright.
    { duration: timing.duration, easing: easing(timing.easing), reduceMotion: ReduceMotion.Never },
    (done) => done && scheduleOnRN(clear),
  );
  return () => {
    const image = leaving.image;
    if (!image) return;
    // Skia's canvas can draw the unmounted curl once more: free its picture two frames later.
    const free = () => (frees.delete(free), cancelAnimationFrame(frame), image.dispose());
    let frame = requestAnimationFrame(() => (frame = requestAnimationFrame(free)));
    frees.add(free);
  };
}

function Curl(p: {
  image: SkImage;
  dir: 1 | -1;
  paper: string;
  size: Size;
  progress: SharedValue<number>;
}) {
  const paper = useMemo(() => Array.from(Skia.Color(p.paper)).slice(0, 3), [p.paper]);
  effect ??= Skia.RuntimeEffect.Make(curl)!;
  const uniforms = useDerivedValue(() => ({
    size: [p.size.width, p.size.height],
    progress: p.progress.value,
    direction: p.dir,
    paper,
  }));
  return (
    <View {...over}>
      <Canvas style={{ flex: 1 }}>
        <Fill>
          <Shader source={effect} uniforms={uniforms}>
            <ImageShader image={p.image} fit="fill" rect={{ x: 0, y: 0, ...p.size }} />
          </Shader>
        </Fill>
      </Canvas>
    </View>
  );
}
