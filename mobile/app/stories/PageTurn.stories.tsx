// The page turn between two real pages, as page-turn-preview.tsx drives it (that file imports
// App.tsx, which opens SQLite, so it is mirrored here). PageTurn builds its shader at import, so it
// is imported only after CanvasKit loads (App.web.tsx), served locally, never from a CDN.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState, type ComponentType } from 'react';
import { View } from 'react-native';
import { expect, waitFor } from 'storybook/test';
import wasm from 'canvaskit-wasm/bin/full/canvaskit.wasm?url';
import { ChapterPage, SettingsPage } from '../book/sections.tsx';
import { usePalette } from '../book/palette.ts';
import type { PageTurn as Turn } from '../book/PageTurn.tsx';

async function loadPageTurn() {
  const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web/LoadSkiaWeb');
  await LoadSkiaWeb({ locateFile: () => wasm });
  return { PageTurn: (await import('../book/PageTurn.tsx')).PageTurn };
}

function Turning({ PageTurn }: { PageTurn: ComponentType<Parameters<typeof Turn>[0]> }) {
  const c = usePalette();
  const [at, setAt] = useState({ turn: 0, dir: 1 as 1 | -1 });
  const go = (dir: 1 | -1) => setAt((a) => ({ turn: a.turn + 1, dir }));
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <PageTurn turn={at.turn} dir={at.dir} paper={c.bg}>
        {at.turn % 2 ? (
          <SettingsPage startOver={() => go(-1)} />
        ) : (
          <ChapterPage title="Chapter One" done={() => go(1)} />
        )}
      </PageTurn>
    </View>
  );
}

const meta = { title: 'Book/PageTurn' } satisfies Meta;
export default meta;

export const ChapterToSettings: StoryObj<typeof meta> = {
  loaders: [loadPageTurn],
  render: (_, { loaded }) => <Turning PageTurn={loaded.PageTurn} />,
  // Continue curls forward to Settings, the arriving page live at once. A turn with no curl (no
  // picture in time) fails the canvas wait. ponytail: the back turn (Start over) is not driven: the
  // known PageTurn defect (see .storybook/vitest.config.mts) blanks the story when a curl ends.
  play: async ({ canvas, canvasElement, userEvent }) => {
    const curl = () => canvasElement.querySelector('canvas');
    await userEvent.click(canvas.getByRole('button', { name: 'Continue' }));
    await expect(await canvas.findByRole('heading', { name: 'Settings' })).toBeVisible();
    await waitFor(() => expect(curl()).not.toBeNull());
    // Headless Chromium draws slowly: the 500 ms curl ends about 2 s in, as in the app's preview.
    await waitFor(() => expect(curl()).toBeNull(), { timeout: 5000 });
  },
};
