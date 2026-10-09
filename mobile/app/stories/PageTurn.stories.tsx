// The page turn between two real pages, as page-turn-preview.tsx drives it (that file imports
// App.tsx, which opens SQLite, so it is mirrored here). PageTurn builds its shader at import, so it
// is imported only after CanvasKit loads (App.web.tsx), served locally, never from a CDN.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState, type ComponentType } from 'react';
import { View } from 'react-native';
import { expect, waitFor } from 'storybook/test';
import wasm from 'canvaskit-wasm/bin/full/canvaskit.wasm?url';
import { ChapterPage, SettingsPage } from '../book/sections.tsx';
import { chapterLabel } from '../book/words.ts';
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
          <SettingsPage startOver={() => go(-1)} world={() => go(-1)} />
        ) : (
          <ChapterPage label={chapterLabel(0)} title="The Missing Child" done={() => go(1)} />
        )}
      </PageTurn>
    </View>
  );
}

const meta = { title: 'Book/PageTurn' } satisfies Meta;
export default meta;

// Every picture decoded while the story is shown; before the first turn, only PageTurn's warm-up.
const decodes: Promise<void>[] = [];

export const ChapterToSettings: StoryObj<typeof meta> = {
  loaders: [loadPageTurn],
  beforeEach: () => {
    decodes.length = 0;
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function (this: HTMLImageElement) {
      return decodes[decodes.push(decode.call(this)) - 1]!;
    };
    return () => void (HTMLImageElement.prototype.decode = decode);
  },
  render: (_, { loaded }) => <Turning PageTurn={loaded.PageTurn} />,
  // Continue curls forward to Settings, the arriving page live at once; Start over curls back. A
  // turn with no curl (no picture in time) fails the canvas wait.
  play: async ({ canvas, canvasElement, userEvent }) => {
    // PageTurn prepares the page's picture before the turn (BOOK-UI-COMPONENTS.md, Input): wait for
    // its own warm-up, as a click during it shares the decoder and misses motion.quick under load.
    await waitFor(() => expect(decodes.length).toBeGreaterThan(0), { timeout: 3000 });
    await Promise.allSettled(decodes);
    const curl = () => canvasElement.querySelector('canvas');
    const turn = async (button: string, arriving: string | RegExp) => {
      await userEvent.click(canvas.getByRole('button', { name: button }));
      await expect(await canvas.findByRole('heading', { name: arriving })).toBeVisible();
      await waitFor(() => expect(curl()).not.toBeNull());
      // Headless Chromium draws slowly: the 500 ms curl ends about 2 s in, as in the app's preview.
      await waitFor(() => expect(curl()).toBeNull(), { timeout: 5000 });
      await expect(canvas.getByRole('heading', { name: arriving })).toBeVisible();
    };
    await turn('Continue', 'Settings');
    await turn('Start over', /The Missing Child/);
  },
};
