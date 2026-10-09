// Live stories (spike, Beads loka-bhb batch 4): the real Book over the real local authority, its
// save restored from a checkpoint stories/scenarios.ts wrote from stories/routes.ts, so a click
// runs real rules.
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
  // the checkpoint's own wall clock (the Node harness's), so opening does not catch up real time
  const { wall_ms } = (await db.getFirstAsync<{ wall_ms: number }>('SELECT wall_ms FROM elapsed'))!;
  const game = openGame(webDb(db), chapter, {
    newId: () => crypto.randomUUID(),
    kernel_version: `loka-kernel@${'0'.repeat(40)}-dirty`,
    time: { wall: () => wall_ms, monotonic: () => 0 },
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

// A click-through's page; a restored Book opens on its chapter page first.
const opened = async (canvas: HTMLElement) => {
  const page = within(canvas);
  const tap = async (label: string | RegExp) => userEvent.click(await page.findByLabelText(label));
  await tap('Continue');
  return { page, tap };
};

export const FirstRoom: StoryObj = {
  name: 'First room',
  loaders: at('first-room'),
  play: async ({ canvasElement }) => {
    const { page, tap } = await opened(canvasElement);
    await tap(/^Elspeth is here\./);
    await tap('Talk to Elspeth');
    await tap('Will you look around the Green for a sign of Wren?');
    await page.findByText('Journal updated'); // the real kernel answered: the quest began
    await tap('Leave');
    await page.findByText('Look for a sign of Wren on Village Green.'); // the running head
  },
};
export const ElspethAsked: StoryObj = { name: 'Elspeth asked', loaders: at('elspeth-asked') };
export const VesperRiddle: StoryObj = {
  name: 'Vesper riddle',
  loaders: at('vesper-riddle'),
  play: async ({ canvasElement }) => {
    const { page, tap } = await opened(canvasElement);
    // the riddle's tiles, one per letter, then Submit (walkthrough/chapter1.walk.ts spellOn)
    const spell = async (word: string) => {
      const tiles = (await page.findAllByLabelText(/^., tile \d+$/)).map((t) => t.ariaLabel ?? '');
      for (const letter of word) {
        const i = tiles.findIndex((t) => t[0] === letter);
        if (i < 0) throw new Error(`no ${letter} tile left for ${word}`);
        await tap(tiles.splice(i, 1)[0]!);
      }
      await tap('Submit');
    };
    await tap(/^Vesper is here\./);
    await spell('RAN');
    await page.findByText(/Try the letters again/); // a wrong word is the riddle's own answer
    await tap(/^L, tile/);
    await tap('Clear');
    await spell('LANTERN');
    await waitFor(() => expect(page.queryByLabelText('Submit')).toBeNull());
  },
};
export const PegShop: StoryObj = {
  name: 'Peg shop',
  loaders: at('peg-shop'),
  play: async ({ canvasElement }) => {
    const { page, tap } = await opened(canvasElement);
    await tap(/^Peg Harrow is here\./);
    await tap('Buy a torch — 2p');
    await page.findByLabelText(/pennies 4\//); // the status line paid
    await page.findByText(/^an iron sword: Buy 7p \(/); // 7p over 4p: a note, not a Buy
    await tap('Leave');
    await tap(/; opens Contents$/);
    await tap('Equipment & Inventory, open');
    await page.findByLabelText('a torch, open');
  },
};
export const MaudPaidBed: StoryObj = { name: 'Maud paid bed', loaders: at('maud-paid-bed') };
export const CorpseContents: StoryObj = {
  name: 'Corpse contents',
  loaders: at('corpse-contents'),
  play: async ({ canvasElement }) => {
    const { page, tap } = await opened(canvasElement);
    await tap(/^A deer corpse is here\./);
    // the page a turn brings takes focus at its title (pages.tsx titleFocus), for screen readers
    await waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('heading'));
    await tap('A deer hide, open'); // its Inside row
    await tap('Take a deer hide');
    // book-ui.md (Take from a corpse): back on the corpse, its pickup line, Leave still offered
    await page.findByText('You pick up a deer hide.');
    await page.findByLabelText('Put a deer hide in a deer corpse');
    // the held hide's own page offers Drop; the corpse's does not
    await waitFor(() => expect(page.queryByLabelText('Drop a deer hide')).toBeNull());
    await page.findByLabelText('Leave');
  },
};
export const HoundCombat: StoryObj = { name: 'Hound combat', loaders: at('hound-combat') };
export const ChapelMap: StoryObj = { name: 'Chapel map', loaders: at('chapel-map') };
export const NightGreen: StoryObj = { name: 'Night green', loaders: at('night-green') };
