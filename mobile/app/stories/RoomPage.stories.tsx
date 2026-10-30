// C row Pages, Room (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, waitFor } from 'storybook/test';
import { Body, RoomPage } from '../book/Body.tsx';
import { LABEL } from '../book/labels.ts';
import { cueLine } from '../book/model.ts';
import { pageStory } from './screen.tsx';
import RoomFirstView from './views/room-first.json';
import RoomNpcsItemsView from './views/room-npcs-items.json';
import RoomLongLogView from './views/room-long-log.json';
import RoomAtNightView from './views/room-at-night.json';
import RoomRefusalView from './views/room-refusal.json';
import senses from '../../../cartridges/senses_sampler/text.json';

const meta: Meta = {
  tags: ['!autodocs'],
  title: 'Pages/Room',
  component: RoomPage,
  subcomponents: { Body },
};
export default meta;

export const FirstRoom: StoryObj = {
  ...pageStory(RoomFirstView, undefined, [
    'room.crossroads_inn.title',
    'room.crossroads_inn.description',
  ]),
  name: 'First room',
  // At launch no title takes focus, so no ring before keyboard use (BOOK-UI-COMPONENTS.md Focus).
  play: async ({ canvasElement }) =>
    expect(canvasElement.contains(document.activeElement)).toBe(false),
};
// Breaks: the page's words come from the text table alone, so the Controls panel rewords nothing.
export const Reworded: StoryObj = {
  ...pageStory(RoomFirstView),
  name: 'Reworded',
  args: { words: { 'room.crossroads_inn.description': 'A reworded inn, set in the panel.' } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('A reworded inn, set in the panel.')).toBeVisible();
    await expect(canvas.queryByText(/A low inn/)).toBeNull();
    // The reworded description drops the signpost link; World draws no line for it instead.
    await expect(canvas.queryByRole('button', { name: /signpost, open$/ })).toBeNull();
  },
};
export const NpcsAndItems: StoryObj = { ...pageStory(RoomNpcsItemsView), name: 'NPCs and items' };
// In the page's own viewport (toBeVisible ignores scrolling).
const inView = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= window.innerHeight;
};
// Breaks: World opens at the top of a log that overflows, so the newest line is off screen (owner
// ruling, loka-x6t.127: World always scrolls to its end).
const longLog = [
  ...Array.from({ length: 30 }, (_, i) => `You pace the floor (${i + 1}).`),
  ...RoomLongLogView.log,
  'You set the loaf down at last.',
];
export const LongLog: StoryObj = {
  ...pageStory({ ...RoomLongLogView, log: longLog }),
  name: 'Long log',
  play: async ({ canvas }) => {
    const last = await canvas.findByText('You set the loaf down at last.');
    await waitFor(() => expect(inView(last)).toBe(true));
  },
};
// The away recap as the presenter logs it: the log's last entry, collapsed (book-ui.md, Away
// recap). Breaks: the recap draws above the log or open, or its heading does not open its lines.
export const AwayRecap: StoryObj = {
  ...pageStory({
    ...RoomLongLogView,
    log: [
      ...RoomLongLogView.log,
      { recap: ['Maud leaves.', 'Maud arrives.', 'Maud leaves.'], text: LABEL.awayRecap },
    ],
  }),
  name: 'Away recap',
  play: async ({ canvas, userEvent }) => {
    const heading = await canvas.findByRole('button', { name: `${LABEL.awayRecap}, show` });
    const taken = canvas.getAllByText('You take a loaf.').at(-1)!;
    await expect(heading.getBoundingClientRect().top).toBeGreaterThan(
      taken.getBoundingClientRect().top,
    );
    await expect(canvas.queryByText(/Maud leaves/)).toBeNull();
    await userEvent.click(heading);
    await expect(canvas.getByText('Maud leaves. (2 times)')).toBeVisible();
    await expect(canvas.getByText('Maud arrives.')).toBeVisible();
  },
};
export const RefusalLine: StoryObj = { ...pageStory(RoomRefusalView), name: 'Refusal line' };
export const AtNight: StoryObj = {
  ...pageStory(RoomAtNightView),
  name: 'At night',
};

// A sense cue as the presenter logs it (book-ui.md, Sense cues details), worded by the senses
// sampler's text: one log line after the room's lines. Breaks: World draws the cue as its own
// block again (two lines). Logging once per visit: book/room_anatomy.test.ts.
// text and direction are branded keys (TextKey, Key) in the view.
const hammering = {
  sense: 'sound',
  text: 'cue.hammering' as never,
  direction: 'east' as never,
} as const;
export const SenseCueLogged: StoryObj = {
  ...pageStory({
    ...RoomFirstView,
    view: { ...RoomFirstView.view, cues: [hammering] },
    log: [cueLine(hammering, (k) => (senses as Record<string, string>)[k] ?? k)],
  }),
  name: 'Sense cue logged',
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Hammering from the east')).toBeVisible();
    await expect(canvas.getAllByText('Hammering from the east')).toHaveLength(1);
  },
};

// Breaks (owner pick mvl9864n2qi8; loka-6qi): a crowded room lists one name per line, joins with
// "and", capitalises every name, merges a group's names into one link, or repeats a shared article.
const [npc, , thing] = RoomNpcsItemsView.view.entities;
type Word = [string, ('a' | 'an' | 'the')?, true?];
const crowd = (e: typeof npc, kind: string, names: Word[]) =>
  names.map(([n, article, many], i) => ({
    ...e,
    id: `${e.id}-${i}`,
    name: `${kind}.${n}.short`,
    contents: [],
    words: { bare: `${kind}.${n}.bare`, article, plural: many && `${kind}.${n}.plural` },
  }));
const room = (entities: Partial<ReturnType<typeof crowd>[number]>[]) =>
  pageStory({ ...RoomNpcsItemsView, view: { ...RoomNpcsItemsView.view, entities } });
const sentence = async (
  canvas: Parameters<NonNullable<StoryObj['play']>>[0]['canvas'],
  names: string[],
  text: string,
) => {
  const links = names.map((n) => canvas.getByRole('button', { name: `${n}, open` }));
  await expect(links[0]!.parentElement!.textContent).toBe(text);
};
export const Crowded: StoryObj = {
  ...room([
    ...crowd(npc, 'npc', [
      ['aldous'],
      ['bess'],
      ['carpenter', 'the'],
      ['chandler', 'the'],
      ['cook', 'the'],
    ]),
    ...crowd(thing, 'item', [
      ['apple', 'an'],
      ['axe', 'an'],
      ['bench', 'a'],
      ['anvil', 'an'],
    ]),
  ]),
  name: 'Five people, four items',
  play: async ({ canvas }) => {
    const people = ['Aldous', 'Bess', 'carpenter', 'chandler', 'cook'];
    await sentence(canvas, people, 'Aldous, Bess, the carpenter, chandler, and cook are here.');
    const things = ['apple', 'axe', 'wooden bench', 'iron anvil'];
    await sentence(canvas, things, 'An apple, axe, a wooden bench, and an iron anvil are here.');
  },
};

// Breaks (loka-6qi): same-kind entities with a plural show one link per member, or the count as a digit.
export const Plural: StoryObj = {
  ...room(
    crowd(npc, 'npc', [
      ['goblin', 'a', true],
      ['goblin', 'a', true],
      ['goblin', 'a', true],
      ['hen', 'a'],
    ]),
  ),
  name: 'Three goblins and a hen',
  play: async ({ canvas }) => {
    await sentence(canvas, ['Three goblins', 'hen'], 'Three goblins and a hen are here.');
  },
};

// Breaks (owner 2026-10-30, W6 moods; PR #507): an NPC's mood name loses its own words (so two
// afraid goblins split into two links) or merges with the calm goblin of its kind. The calm goblin
// shares the run's article (Crowded's rule), so it reads "and goblin" (PM question on PR #507).
const afraid = (i: number) => ({
  ...npc,
  id: `goblin-afraid-${i}`,
  name: 'npc.goblin.short_afraid',
  contents: [],
  words: {
    bare: 'npc.goblin.bare_afraid',
    article: 'a' as const,
    plural: 'npc.goblin.plural_afraid',
  },
});
export const Mood: StoryObj = {
  ...room([afraid(0), ...crowd(npc, 'npc', [['goblin', 'a', true]])]),
  name: 'An afraid goblin and a calm one',
  play: async ({ canvas }) => {
    await sentence(canvas, ['cowering goblin', 'goblin'], 'A cowering goblin and goblin are here.');
  },
};
export const MoodPair: StoryObj = {
  ...room([afraid(0), afraid(1)]),
  name: 'Two afraid goblins',
  play: async ({ canvas }) => {
    await sentence(canvas, ['Two cowering goblins'], 'Two cowering goblins are here.');
  },
};
