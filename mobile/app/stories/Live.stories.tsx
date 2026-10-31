// Live stories (spike, Beads loka-bhb batch 4): the real Book over the real local authority, its
// save restored from a checkpoint stories/scenarios.ts wrote from stories/routes.ts, so a click
// runs real rules.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import wasm from 'canvaskit-wasm/bin/full/canvaskit.wasm?url';
import chapter from '../../../protocol/fixtures/toolbox_showcase_hash.json';
import { openGame } from '../../authority/local-story/session.ts';
import { webDb } from '../sqlite-web.ts';
import { LABEL } from '../book/labels.ts';
import type Book from '../book/Book.tsx';

type Loaded = { Book: typeof Book; game: ReturnType<typeof openGame>; db: SQLiteDatabase };

const live = (checkpoint: string) => async (): Promise<Loaded> => {
  const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web/LoadSkiaWeb');
  await LoadSkiaWeb({ locateFile: () => wasm });
  const { default: BookC } = await import('../book/Book.tsx'); // PageTurn needs CanvasKit first
  // a fresh save per mount: the worker otherwise hands back the last story's open ':memory:' (loka-0qz)
  const db = await openDatabaseAsync(':memory:', { useNewConnection: true });
  await db.execAsync(checkpoint);
  // the checkpoint's own wall clock (the Node harness's), so opening does not catch up real time
  const { wall_ms } = (await db.getFirstAsync<{ wall_ms: number }>('SELECT wall_ms FROM elapsed'))!;
  const game = openGame(webDb(db), chapter, {
    newId: () => crypto.randomUUID(),
    kernel_version: `loka-kernel@${'0'.repeat(40)}-dirty`,
    time: { wall: () => wall_ms, monotonic: () => 0 },
  });
  return { Book: BookC, game, db };
};

const meta = {
  title: 'Live',
  // checkpoints: stories/routes.ts, written by npm run stories:views
  // isolation headers (SharedArrayBuffer for the sqlite worker) are not served by a static build
  tags: ['!test', '!autodocs'], // a Docs page would mount every live game at once
  // runs after the loaders; its cleanup when the story is left or remounted closes this story's database
  beforeEach:
    ({ loaded }) =>
    () =>
      (loaded as Loaded).db.closeAsync(),
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

// A click-through's helpers.
const opened = (canvas: HTMLElement) => {
  const page = within(canvas);
  const tap = async (label: string | RegExp) => userEvent.click(await page.findByLabelText(label));
  return { page, tap };
};

export const ReeveErrand: StoryObj = {
  name: 'Reeve errand',
  loaders: at('green'),
  play: async ({ canvasElement }) => {
    const { page, tap } = opened(canvasElement);
    await tap('Reeve, open');
    await tap('Talk to the Reeve');
    await tap('Take the letter to Wat');
    await page.findByText('Journal updated'); // the real kernel answered: the quest began
    await tap('Leave the conversation');
    await tap('Leave');
    await page.findByText("Take the Reeve's letter to Wat on the fell."); // the running head
  },
};
export const ReeveAsked: StoryObj = { name: 'Reeve asked', loaders: at('reeve-asked') };
export const NellShop: StoryObj = {
  name: 'Nell shop',
  loaders: at('nell-shop'),
  play: async ({ canvasElement }) => {
    const { page, tap } = opened(canvasElement);
    await tap('Nell, open'); // a checkpoint restores the save, not the open page
    await tap(LABEL.trade);
    await tap('A cob of bread, 4p. Buy for 4 pennies.');
    // the buy page stays open, the row sold out and the purse redrawn; the own buy line is quiet here
    await waitFor(() =>
      expect(page.getByLabelText('A cob of bread, 4p. Buy for 4 pennies.')).toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
    await page.findByText('You have 6p.');
    await tap(LABEL.leave);
    await tap(LABEL.leave);
    await tap(/; opens Contents$/);
    await tap('Character, open');
    await page.findByText(/^pennies\s+6$/); // paid; pennies stay off the status line
    await tap(LABEL.backToContents);
    await tap(`${LABEL.inventory}, open`);
    await page.findByLabelText('a cob of bread, open');
  },
};
export const SackContents: StoryObj = {
  name: 'Sack contents',
  loaders: at('sack-contents'),
  play: async ({ canvasElement }) => {
    const { page, tap } = opened(canvasElement);
    await tap('seed sack, open');
    // the page a turn brings takes focus at its title (pages.tsx titleFocus), for screen readers
    await waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('heading'));
    await tap(LABEL.lookInside);
    await tap('A turnip seed, open'); // its Inside row
    await tap('Take a turnip seed');
    // book-ui.md (Take from a container): the pickup line shows, then the sack reopens with Put and Leave
    await page.findByText('You take a turnip seed.');
    await tap('seed sack, open');
    await page.findByLabelText('Put a turnip seed in a seed sack');
    await page.findByLabelText('Leave');
  },
};
export const GoblinCombat: StoryObj = { name: 'Goblin combat', loaders: at('goblin-combat') };
export const LoftMap: StoryObj = { name: 'Loft map', loaders: at('loft-map') };
export const NightInn: StoryObj = { name: 'Night inn', loaders: at('night-inn') };
