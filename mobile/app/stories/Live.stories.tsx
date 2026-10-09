// Live stories (spike, Beads loka-bhb batch 4): the real Book over the real local authority, its
// save restored from a checkpoint stories/live/checkpoints.ts wrote, so a click runs real rules.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { openDatabaseAsync } from 'expo-sqlite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import wasm from 'canvaskit-wasm/bin/full/canvaskit.wasm?url';
import firstRoom from './live/first-room.sql?raw';
import chapter from '../../../protocol/fixtures/missing_child_v042_hash.json';
import { openGame } from '../../authority/local-story/session.ts';
import { webDb } from '../sqlite-web.ts';
import type BookType from '../book/Book.tsx';

type Loaded = { Book: typeof BookType; game: ReturnType<typeof openGame> };

const live = (checkpoint: string) => async (): Promise<Loaded> => {
  const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web/LoadSkiaWeb');
  await LoadSkiaWeb({ locateFile: () => wasm });
  const { default: Book } = await import('../book/Book.tsx'); // PageTurn needs CanvasKit first
  const db = await openDatabaseAsync(':memory:'); // a fresh save per mount
  await db.execAsync(checkpoint);
  // the checkpoint's own clock (the Node harness's), so opening does not catch up real time
  const game = openGame(webDb(db), chapter, {
    newId: () => crypto.randomUUID(),
    kernel_version: `loka-kernel@${'0'.repeat(40)}-dirty`,
    time: { wall: () => 10000, monotonic: () => 0 },
  });
  return { Book, game };
};

const meta = {
  title: 'Live',
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

export const FirstRoom: StoryObj = {
  loaders: [live(firstRoom)],
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    await userEvent.click(await page.findByLabelText('Continue')); // a fresh Book opens on its chapter page
    await userEvent.click(await page.findByLabelText('Elspeth, open'));
    const npc = canvasElement.textContent;
    await userEvent.click(await page.findByLabelText('Talk to Elspeth'));
    // the real kernel answers the talk: the NPC page changes (dialogue nodes, quest triggers)
    await waitFor(() => expect(canvasElement.textContent).not.toBe(npc));
  },
};
