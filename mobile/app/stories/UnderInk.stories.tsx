// The held layers on their own, on the paper they sit on. CanvasKit loads first (App.web.tsx),
// served locally; without it UnderInk draws nothing. Gradient stays lazy here too: Skia reads
// CanvasKit once, at import.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { expect, waitFor } from 'storybook/test';
import wasm from 'canvaskit-wasm/bin/full/canvaskit.wasm?url';
import type { GameView } from '../../packages/game-view/session.ts';
import { UnderInk } from '../book/UnderInk.tsx';
import { PaletteContext, usePalette } from '../book/palette.ts';
import { color, size } from '../book/tokens.ts';
import RoomFirstView from './views/room-first.json';

const loadSkia = async () => {
  const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web/LoadSkiaWeb');
  await LoadSkiaWeb({ locateFile: () => wasm });
};

const lit = {
  ...RoomFirstView.view,
  inventory: [{ id: 'lantern', fuel: { lit: true } }],
} as unknown as GameView;
const low = {
  ...RoomFirstView.view,
  resources: [{ resource: { key: 'hp' }, tone: 'danger' }],
} as unknown as GameView;

function OnPaper({ view }: { view: GameView }) {
  const c = usePalette();
  return (
    <View style={{ height: size.column, backgroundColor: c.bg }}>
      <UnderInk view={view} />
    </View>
  );
}

// Breaks: a held layer that never draws (the guard or the lazy Gradient) leaves no canvas.
const draws = async ({ canvasElement }: { canvasElement: HTMLElement }) =>
  waitFor(() => expect(canvasElement.querySelector('canvas')).not.toBeNull());

const meta: Meta = {
  title: 'Book/UnderInk',
  component: UnderInk,
  tags: ['!autodocs'],
  loaders: [loadSkia],
};
export default meta;

export const LampGlow: StoryObj = {
  render: () => (
    <PaletteContext value={color.dusk}>
      <OnPaper view={lit} />
    </PaletteContext>
  ),
  play: draws,
};
export const LowHealthVignette: StoryObj = { render: () => <OnPaper view={low} />, play: draws };
// Breaks: a lamp on a light paper. The glow is for dusk and dark only.
export const LampByDay: StoryObj = {
  render: () => (
    <PaletteContext value={color.light}>
      <OnPaper view={lit} />
    </PaletteContext>
  ),
  play: async ({ canvasElement }) => expect(canvasElement.querySelector('canvas')).toBeNull(),
};
