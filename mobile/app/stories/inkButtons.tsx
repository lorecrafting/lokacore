// The ink buttons exploration sheet (InkButtons.stories.tsx): three skills by nine styles at hotbar
// size on a mock Combat page bottom, each style with one still cooldown or disabled frame (the fourth
// button, captioned ~). Imports Skia, so the story loads it lazily after CanvasKit (as StatusIcon
// does its glyph). Every colour and size is a token.
import {
  BlurMask,
  Canvas,
  Circle,
  DashPathEffect,
  DiscretePathEffect,
  Group,
  Path,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { usePalette, useType, type Palette } from '../book/palette.ts';
import { glyphs } from '../book/statusGlyphs.ts';
import { Text } from '../book/Text.tsx';
import { opacity, size, space } from '../book/tokens.ts';
import CombatOneFoeView from './views/combat-one-foe.json';

// The showcase's three common skills, drawn in the status glyphs' frame (statusGlyphs.ts: a 24 box,
// stroke 2.5, round caps). Flamma and ward share their condition's motif; the blade is new.
const skills = [
  { key: 'skill.blade', d: 'M10 15.5V7.5L12 4.5 14 7.5V15.5zM7.5 15.5h9M12 15.5v4' },
  { key: 'spell.flamma', d: glyphs['condition.burning']! },
  { key: 'spell.ward', d: glyphs['condition.warded']! },
];

const DISC = size.touch; // the button: one touch target
const SIDE = DISC + space.md; // the canvas, room for a bleed
const MID = SIDE / 2;
const R = DISC / 2;
const INK = DISC - 2 * space.md; // the glyph's box, scaled from statusGlyphs' 24
const BOX = 24;
const W = 2.5; // the status glyphs' stroke
const BOLD = 3.5;
const LEFT = 0.6; // the share of a cooldown still to run in the still frame

const glyph = (d: string, ink: string, w = W, effect?: ReactNode) => (
  <Group
    transform={[{ translateX: MID - INK / 2 }, { translateY: MID - INK / 2 }, { scale: INK / BOX }]}
  >
    <Path path={d} style="stroke" strokeWidth={w} strokeCap="round" strokeJoin="round" color={ink}>
      {effect}
    </Path>
  </Group>
);
const disc = (r: number, color: string, effect?: ReactNode) => (
  <Circle cx={MID} cy={MID} r={r} color={color}>
    {effect}
  </Circle>
);
const ring = (r: number, w: number, color: string, effect?: ReactNode) => (
  <Circle cx={MID} cy={MID} r={r} style="stroke" strokeWidth={w} strokeCap="round" color={color}>
    {effect}
  </Circle>
);
// A clockwise arc from 12 o'clock over `f` of the turn (the Ring's countdown direction, StatusIcon);
// `wedge` closes it through the centre.
const arc = (r: number, f: number, wedge = false) => {
  const a = 2 * Math.PI * f;
  const sweep = `A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${MID + r * Math.sin(a)} ${MID - r * Math.cos(a)}`;
  return wedge ? `M${MID} ${MID}L${MID} ${MID - r}${sweep}Z` : `M${MID} ${MID - r}${sweep}`;
};
const left = (r: number, w: number, color: string, effect?: ReactNode) => (
  <Path path={arc(r, LEFT)} style="stroke" strokeWidth={w} color={color}>
    {effect}
  </Path>
);

type Draw = (c: Palette, d: string, off: boolean) => ReactNode;
const dots = <DashPathEffect intervals={[0.1, W * 1.6]} />;
const shake = (seed: number) => <DiscretePathEffect length={3} deviation={0.6} seed={seed} />;
const variants: { name: string; draw: Draw }[] = [
  {
    // The status icon's kin: card disc, hairline ring, fg glyph; cooldown as the Ring's arc.
    name: 'Ring',
    draw: (c, d, off) => (
      <>
        {disc(R, c.card)}
        {ring(R - size.rule / 2, size.rule, c.line)}
        {off && left(R - size.focus / 2, size.focus, c.fg)}
        {glyph(d, off ? c.dim : c.fg)}
      </>
    ),
  },
  {
    // Solid ink, paper glyph; the cooldown is the ink coming back as a wedge.
    name: 'Inked',
    draw: (c, d, off) => (
      <>
        {disc(R, off ? c.dim : c.fg)}
        {off && <Path path={arc(R, LEFT, true)} color={c.fg} />}
        {glyph(d, c.bg)}
      </>
    ),
  },
  {
    // The action role as a seal: outline and glyph in action, paper inside; barred goes line and dim.
    name: 'Seal',
    draw: (c, d, off) => (
      <>
        {ring(R - size.focus / 2, size.focus, off ? c.line : c.action)}
        {glyph(d, off ? c.dim : c.action)}
      </>
    ),
  },
  {
    // A filled action disc, paper glyph.
    name: 'Blot',
    draw: (c, d, off) => (
      <>
        {disc(R, off ? c.dim : c.action)}
        {glyph(d, c.bg)}
      </>
    ),
  },
  {
    // Ink bled into the paper under a crisp disc.
    name: 'Bleed',
    draw: (c, d, off) => (
      <Group opacity={off ? opacity.disabled : 1}>
        {disc(R, c.fg, <BlurMask blur={space.xs} style="normal" />)}
        {disc(R - space.hair, c.fg)}
        {glyph(d, c.bg)}
      </Group>
    ),
  },
  {
    // Dither: a stippled ring; the cooldown re-inks the dots clockwise.
    name: 'Stipple',
    draw: (c, d, off) => (
      <>
        {ring(R - W / 2, W, off ? c.line : c.fg, dots)}
        {off && left(R - W / 2, W, c.fg, dots)}
        {glyph(d, off ? c.dim : c.fg)}
      </>
    ),
  },
  {
    // Fade: the disc dissolves into the paper at its edge.
    name: 'Fade',
    draw: (c, d, off) => {
      const ink = off ? c.dim : c.fg;
      const edge = [ink, ink, `${ink}00`];
      return (
        <>
          {disc(
            R,
            ink,
            <RadialGradient c={vec(MID, MID)} r={R} colors={edge} positions={[0, 0.55, 1]} />,
          )}
          {glyph(d, c.bg)}
        </>
      );
    },
  },
  {
    // Woodcut: a shaken outline and glyph.
    name: 'Rough',
    draw: (c, d, off) => (
      <>
        {disc(R - W / 2, c.card)}
        {ring(R - W / 2, W, off ? c.line : c.fg, shake(1))}
        {glyph(d, off ? c.dim : c.fg, W, shake(2))}
      </>
    ),
  },
  {
    // No disc: a heavy glyph on the paper inside a hairline; the cooldown runs on the hairline.
    name: 'Heavy',
    draw: (c, d, off) => (
      <>
        {ring(R - size.rule / 2, size.rule, c.line)}
        {off && left(R - size.rule / 2, size.focus, c.fg)}
        {glyph(d, off ? c.dim : c.fg, BOLD)}
      </>
    ),
  },
];

function Slot({ label, d, draw, off }: { label: string; d: string; draw: Draw; off?: boolean }) {
  const c = usePalette();
  const t = useType();
  return (
    <View style={{ alignItems: 'center', gap: space.xs }}>
      <Canvas aria-hidden __destroyWebGLContextAfterRender style={{ width: SIDE, height: SIDE }}>
        {draw(c, d, !!off)}
      </Canvas>
      <Text style={{ ...t.label, color: c.dim }}>{label}</Text>
    </View>
  );
}

const lines = CombatOneFoeView.combatLog.slice(-3);
function Row({ name, draw }: { name: string; draw: Draw }) {
  const c = usePalette();
  const t = useType();
  return (
    <View
      style={{ paddingVertical: space.lg, borderBottomWidth: size.rule, borderBottomColor: c.line }}
    >
      <Text style={{ ...t.label, color: c.dim, marginBottom: space.md }}>{name}</Text>
      {lines.map((l) => (
        <Text key={l} style={{ ...t.log, color: c.fg }}>
          {l}
        </Text>
      ))}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: space.xl,
          marginTop: space.lg,
        }}
      >
        {skills.map((s) => (
          <Slot key={s.key} label={s.key} d={s.d} draw={draw} />
        ))}
        <Slot label="~" d={skills[1]!.d} draw={draw} off />
      </View>
    </View>
  );
}

export default function Sheet() {
  return (
    <View style={{ paddingHorizontal: space.page, maxWidth: size.column, alignSelf: 'center' }}>
      {variants.map((v) => (
        <Row key={v.name} {...v} />
      ))}
    </View>
  );
}
