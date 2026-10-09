// Live stories (spike, Beads loka-bhb batch 4): the real Book over the real local authority, its
// save restored from a checkpoint stories/live/checkpoints.ts wrote, so a click runs real rules.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { openDatabaseAsync } from 'expo-sqlite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import wasm from 'canvaskit-wasm/bin/full/canvaskit.wasm?url';
import chapter from '../../../protocol/fixtures/missing_child_v042_hash.json';
import { openGame } from '../../authority/local-story/session.ts';
import { webDb } from '../sqlite-web.ts';
import type Book from '../book/Book.tsx';

type Loaded = { Book: typeof Book; game: ReturnType<typeof openGame> };

const live = (checkpoint: string) => async (): Promise<Loaded> => {
  const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web/LoadSkiaWeb');
  await LoadSkiaWeb({ locateFile: () => wasm });
  const { default: BookC } = await import('../book/Book.tsx'); // PageTurn needs CanvasKit first
  const db = await openDatabaseAsync(':memory:'); // a fresh save per mount
  await db.execAsync(checkpoint);
  // the checkpoint's own clock (the Node harness's), so opening does not catch up real time
  const game = openGame(webDb(db), chapter, {
    newId: () => crypto.randomUUID(),
    kernel_version: `loka-kernel@${'0'.repeat(40)}-dirty`,
    time: { wall: () => 10000, monotonic: () => 0 },
  });
  return { Book: BookC, game };
};

const meta = {
  title: 'Live',
  // checkpoints: stories/routes.ts, written by npm run stories:views
  // isolation headers (SharedArrayBuffer for the sqlite worker) are not served by a static build
  tags: ['!test'],
  render: (_, { loaded }) => {
    const { Book, game } = loaded as Loaded;
    return (
      <Book
        game={game}
        startOver={() => undefined}
        shell={{ confirm: (go) => go(), learned: { seen: () => true, see: () => {} } }}
      />
    );
  },
} satisfies Meta;
export default meta;

const sql = import.meta.glob<string>('./live/*.sql', { query: '?raw', import: 'default' });
const at = (name: string) => [async () => live(await sql[`./live/${name}.sql`]!())()];

export const FirstRoom: StoryObj = {
  name: 'First room',
  loaders: at('first-room'),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    await userEvent.click(await page.findByLabelText('Continue')); // a fresh Book opens on its chapter page
    await userEvent.click(await page.findByLabelText('Elspeth, open'));
    await userEvent.click(await page.findByLabelText('Talk to Elspeth'));
    await userEvent.click(
      await page.findByLabelText('Will you look around the Green for a sign of Wren?'),
    );
    await page.findByText('Journal updated'); // the real kernel answered: the quest began
  },
};
export const ElspethAsked: StoryObj = { name: 'Elspeth asked', loaders: at('elspeth-asked') };
export const VesperRiddle: StoryObj = { name: 'Vesper riddle', loaders: at('vesper-riddle') };
export const PegShop: StoryObj = { name: 'Peg shop', loaders: at('peg-shop') };
export const MaudPaidBed: StoryObj = { name: 'Maud paid bed', loaders: at('maud-paid-bed') };
export const HoundCombat: StoryObj = { name: 'Hound combat', loaders: at('hound-combat') };
export const ChapelMap: StoryObj = { name: 'Chapel map', loaders: at('chapel-map') };
