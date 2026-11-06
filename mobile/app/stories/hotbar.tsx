// The hotbar story (InkButtons.stories.tsx `Hotbar`): the Inked strip under a mock Combat page's last
// lines (book-ui.md, Combat hotbar: four slots at space.xl, the opener last), then one strip per state
// the style guide names. Captions are keys, for review only; the real strip has none. Imports Skia
// through inkButtons.tsx, so the story loads it lazily after CanvasKit.
import { Canvas } from '@shopify/react-native-skia';
import { View } from 'react-native';
import { usePalette, useType } from '../book/palette.ts';
import { Text } from '../book/Text.tsx';
import { size, space } from '../book/tokens.ts';
import { inked, LEFT, lines, OPENER, SIDE, sheet, skills, type State } from './inkButtons.tsx';

type Slot = { key: string; d: string; state: State; share?: number };
const SHARES = [0.1, 0.5, 0.9]; // three cooling frames: just begun, half, nearly back
const opener: Slot = { key: '~', d: OPENER, state: 'ready' };
const strip = (state: State): Slot[] => [
  ...skills.map((s, i) => ({ ...s, state, share: SHARES[i] })),
  opener,
];
const page: Slot[] = [
  { ...skills[0]!, state: 'ready' },
  { ...skills[1]!, state: 'cooling', share: LEFT },
  { ...skills[2]!, state: 'barred' },
  opener,
];
const states: [string, Slot[]][] = [
  ['state.ready', strip('ready')],
  ['state.pressed', strip('pressed')],
  ['state.cooling', strip('cooling')],
  ['state.barred', strip('barred')],
  ['state.focused', strip('focused')],
  ['state.empty', [page[0]!, ...strip('empty').slice(1, 3), opener]],
];

function Strip({ slots, caption }: { slots: Slot[]; caption?: string }) {
  const c = usePalette();
  const t = useType();
  return (
    <View style={{ paddingVertical: space.lg }}>
      {caption && (
        <Text style={{ ...t.label, color: c.dim, marginBottom: space.md }}>{caption}</Text>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.xl }}>
        {slots.map((s, i) => (
          <Canvas
            key={i}
            aria-hidden
            __destroyWebGLContextAfterRender
            style={{ width: SIDE, height: SIDE }}
          >
            {inked(c, s.d, s.state, s.share)}
          </Canvas>
        ))}
      </View>
    </View>
  );
}

export default function Hotbar() {
  const c = usePalette();
  const t = useType();
  return (
    <View style={sheet}>
      <View
        style={{
          paddingVertical: space.lg,
          borderBottomWidth: size.rule,
          borderBottomColor: c.line,
        }}
      >
        {lines.map((l) => (
          <Text key={l} style={{ ...t.log, color: c.fg }}>
            {l}
          </Text>
        ))}
        <Strip slots={page} />
      </View>
      {states.map(([caption, slots]) => (
        <Strip key={caption} caption={caption} slots={slots} />
      ))}
    </View>
  );
}
