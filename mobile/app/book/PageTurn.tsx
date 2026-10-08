// The Book's page turn (docs/BOOK-UI-COMPONENTS.md#page-turn), Turn.tsx's props; the polish phase
// swaps it in. The arriving page is live from the first frame. The leaving page stays mounted over
// it, taking no touches, until its picture is taken; then page-curl.sksl curls that picture away.
// Reduced motion cross-fades the leaving page instead. On web, import this after CanvasKit loads.
// ponytail: `arriving` is transparent so the live page shows through; the roll's shadow on it is
// lost until the shader draws its shadow without sampling the arriving page.
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
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
  ColorShader,
  Fill,
  ImageShader,
  Shader,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';
import curl from './page-curl.sksl';
import { color, motion } from './tokens.ts';
import { snapshot } from './snapshot';

const effect = Skia.RuntimeEffect.Make(curl)!;
const easings: Record<string, (t: number) => number> = {
  inOutQuad: Easing.inOut(Easing.quad),
  linear: Easing.linear,
};
// ponytail: the light paper only; the polish phase passes the in-game palette's (book-ui.md).
const paper = Array.from(Skia.Color(color.light.bg)).slice(0, 3);
const over = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  pointerEvents: 'none',
} as const;

type Leaving = { turn: number; dir: 1 | -1; page: ReactNode; image?: SkImage };

type Props = { turn: number; dir: 1 | -1; children: ReactNode };
type Size = { width: number; height: number };
type SetLeaving = Dispatch<SetStateAction<Leaving | undefined>>;

export function PageTurn(p: Props) {
  const reduced = useReducedMotion();
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [leaving, setLeaving] = useLeaving(p);
  const { progress, page } = useMotion(leaving, setLeaving, reduced);
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
          <Animated.View key={leaving.turn} style={[over, fade]}>
            {leaving.page}
          </Animated.View>
        ),
      ]}
      {leaving?.image && (
        <Curl image={leaving.image} dir={leaving.dir} size={size} progress={progress} />
      )}
    </View>
  );
}

// Takes the leaving page's picture, then curls it (or, under reduced motion, fades the page itself).
function useMotion(leaving: Leaving | undefined, setLeaving: SetLeaving, reduced: boolean) {
  const progress = useSharedValue(0);
  // Each page's view by turn, from its mount: Reanimated reads a ref prop only when it mounts.
  const pages = useRef(new Map<number, View>()).current;
  const page = (turn: number) => (view: View | null) => {
    if (view) pages.set(turn, view);
    else pages.delete(turn);
  };
  useEffect(() => {
    if (!leaving) return;
    const timing = leaving.image ? motion.turn : reduced ? motion.fade : undefined;
    if (timing) return animate(progress, timing, leaving, setLeaving);
    let live = true;
    snapshot(pages.get(leaving.turn)!).then(
      (image) => live && setLeaving(image ? { ...leaving, image } : undefined),
      () => live && setLeaving(undefined), // no picture: the page has simply changed
    );
    return () => {
      live = false;
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
) {
  const clear = () => setLeaving((l) => (l === leaving ? undefined : l));
  progress.value = 0;
  progress.value = withTiming(
    1,
    // Never: Reanimated would otherwise skip the reduced-motion cross-fade outright.
    { duration: timing.duration, easing: easings[timing.easing], reduceMotion: ReduceMotion.Never },
    (done) => done && scheduleOnRN(clear),
  );
  return () => leaving.image?.dispose();
}

function Curl(p: { image: SkImage; dir: 1 | -1; size: Size; progress: SharedValue<number> }) {
  const uniforms = useDerivedValue(() => ({
    size: [p.size.width, p.size.height],
    progress: p.progress.value,
    direction: p.dir,
    paper,
  }));
  return (
    <View style={over}>
      <Canvas style={{ flex: 1 }}>
        <Fill>
          <Shader source={effect} uniforms={uniforms}>
            <ImageShader image={p.image} fit="fill" rect={{ x: 0, y: 0, ...p.size }} />
            <ColorShader color="transparent" />
          </Shader>
        </Fill>
      </Canvas>
    </View>
  );
}
