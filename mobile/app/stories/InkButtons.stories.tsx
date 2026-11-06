// Design exploration, loka-x6t.131: round ink action buttons for a combat hotbar, day and night.
// Not a Book component. The owner picked Inked (2026-11-05): docs/design/icon-style-guide.md; the
// Combat page stories show the Book's Hotbar in every state (book-ui.md, Combat hotbar).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import wasm from 'canvaskit-wasm/bin/full/canvaskit.wasm?url';
import { lazy, Suspense } from 'react';

const loadSkia = async () => {
  const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web/LoadSkiaWeb');
  await LoadSkiaWeb({ locateFile: () => wasm });
};
// Skia binds CanvasKit as its module loads, so the drawings are imported only after the loader.
const Buttons = lazy(() => import('./inkButtons.tsx'));
const InkButtons = () => (
  <Suspense fallback={null}>
    <Buttons />
  </Suspense>
);

const meta = {
  title: 'Docs/Ink buttons',
  component: InkButtons,
  loaders: [loadSkia],
  tags: ['!autodocs'],
} satisfies Meta<typeof InkButtons>;
export default meta;

// Day and night by the palette toolbar (stories.test.ts: no story locks it).
export const Sheet: StoryObj<typeof meta> = {};
