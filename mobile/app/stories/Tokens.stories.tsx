// Tokens: tokens.ts rendered live (BOOK-UI-COMPONENTS.md, Design tokens). No value is copied here.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Text, View } from 'react-native';
import { contrast, usePalette } from '../book/palette.ts';
import { color, motion, opacity, radius, size, sound, space, type } from '../book/tokens.ts';

const textRoles = ['fg', 'dim', 'action', 'danger', 'warning'] as const;

type Palette = (typeof color)['light'];

// One role's swatch, value and, for a text role, its ratio on bg and card.
function Swatch({ p, role, hex }: { p: Palette; role: string; hex: string }) {
  const small = { ...type.small, color: p.fg };
  const ratios = (textRoles as readonly string[]).includes(role)
    ? [contrast(hex, p.bg), contrast(hex, p.card)]
    : [];
  return (
    <View style={{ gap: space.hair }}>
      <View
        style={{
          height: size.touch,
          backgroundColor: hex,
          borderWidth: size.rule,
          borderColor: p.line,
        }}
      />
      <Text style={small}>{`${role} ${hex}`}</Text>
      {ratios.length > 0 && (
        <Text style={{ ...small, color: ratios.some((r) => r < 4.5) ? p.danger : p.fg }}>
          {`bg ${ratios[0].toFixed(2)} card ${ratios[1].toFixed(2)}`}
        </Text>
      )}
    </View>
  );
}

function Palettes() {
  return (
    <View style={{ flexDirection: 'row' }}>
      {Object.entries(color).map(([name, p]) => (
        <View
          key={name}
          style={{ flex: 1, backgroundColor: p.bg, padding: space.md, gap: space.xs }}
        >
          <Text style={{ ...type.sectionTitle, color: p.fg }}>{name}</Text>
          {Object.entries(p).map(([role, hex]) => (
            <Swatch key={role} p={p} role={role} hex={hex} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Type() {
  const c = usePalette();
  return (
    <View style={{ padding: space.page, gap: space.block }}>
      {Object.entries(type).map(([name, style]) => (
        <View key={name}>
          <Text style={{ ...style, color: c.fg }}>The lantern swings over the gate</Text>
          <Text style={{ ...type.small, color: c.dim }}>
            {`type.${name}: ${style.fontFamily} ${style.fontSize}` +
              ('lineHeight' in style ? `/${style.lineHeight}` : '') +
              ('letterSpacing' in style ? `, spacing ${style.letterSpacing}` : '')}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Measures() {
  const c = usePalette();
  const label = { ...type.small, color: c.fg };
  const rows = (group: string, values: Record<string, number>, shape: (v: number) => object) =>
    Object.entries(values).map(([name, v]) => (
      <View
        key={group + name}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
      >
        <Text style={{ ...label, width: '40%' }}>{`${group}.${name} ${v}`}</Text>
        <View style={{ backgroundColor: c.dim, ...shape(v) }} />
      </View>
    ));
  return (
    <View style={{ padding: space.page, gap: space.sm }}>
      {rows('space', space, (v) => ({ width: v, height: space.md }))}
      {rows('size', size, (v) => ({ width: v, height: space.md }))}
      {rows('radius', radius, (v) => ({ width: size.touch, height: size.touch, borderRadius: v }))}
      {rows('opacity', opacity, (v) => ({ width: size.touch, height: size.touch, opacity: v }))}
    </View>
  );
}

function Motion() {
  const c = usePalette();
  const cell = { ...type.small, color: c.fg, flex: 1 };
  const row = (cells: string[]) => (
    <View key={cells[0]} style={{ flexDirection: 'row', gap: space.md }}>
      {cells.map((t, i) => (
        <Text key={i} style={cell}>
          {t}
        </Text>
      ))}
    </View>
  );
  return (
    <View style={{ padding: space.page, gap: space.sm }}>
      {row(['name', 'duration (ms)', 'easing'])}
      {Object.entries(motion).map(([name, m]) =>
        row([`motion.${name}`, String(m.duration), m.easing]),
      )}
      {Object.entries(sound).map(([name, s]) => row([`sound.${name}`, `volume ${s.volume}`, '']))}
    </View>
  );
}

const meta = { title: 'Docs/Tokens' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const PaletteSwatches: Story = { render: () => <Palettes /> };
export const TypeStyles: Story = { render: () => <Type /> };
export const SpaceSizeRadius: Story = { render: () => <Measures /> };
export const MotionAndSound: Story = { render: () => <Motion /> };
