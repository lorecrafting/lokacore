// C row Pages, Room (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect } from 'storybook/test';
import { Body } from '../book/Body.tsx';
import { cueLine } from '../book/model.ts';
import { RoomPage } from '../book/pages.tsx';
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
export const LongLog: StoryObj = { ...pageStory(RoomLongLogView), name: 'Long log' };
export const RefusalLine: StoryObj = { ...pageStory(RoomRefusalView), name: 'Refusal line' };
export const AtNight: StoryObj = {
  ...pageStory(RoomAtNightView),
  name: 'At night',
};

// A sense cue as the presenter logs it (book-ui.md, Sense cues details), worded by the senses
// sampler's text: one log line after the room's lines. Breaks: World draws the cue as its own
// block again (two lines). Logging once per visit: book/room_anatomy.test.ts.
const hammering = { sense: 'sound', text: 'cue.hammering', direction: 'east' } as const;
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
const room = (entities: ReturnType<typeof crowd>) =>
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
