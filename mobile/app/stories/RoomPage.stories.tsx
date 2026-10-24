// C row Pages, Room (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect } from 'storybook/test';
import { Body } from '../book/Body.tsx';
import { NoticeEntries } from '../book/notices.tsx';
import { RoomPage } from '../book/pages.tsx';
import { pageStory } from './screen.tsx';
import RoomFirstView from './views/room-first.json';
import RoomNpcsItemsView from './views/room-npcs-items.json';
import RoomLongLogView from './views/room-long-log.json';
import RoomAtNightView from './views/room-at-night.json';
import RoomRefusalView from './views/room-refusal.json';
import senses from '../../../cartridges/senses_sampler/text.json';
import voices from '../../../cartridges/voices_sampler/text.json';
import remarks from '../../../cartridges/remarks_sampler/text.json';

const meta: Meta = {
  tags: ['!autodocs'],
  title: 'Pages/Room',
  component: RoomPage,
  subcomponents: { Body, NoticeEntries },
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
    // The reworded description drops the signpost link, so its World line returns (loka-x6t.105).
    await expect(canvas.getByRole('button', { name: 'The inn signpost, open' })).toBeVisible();
  },
};
export const NpcsAndItems: StoryObj = { ...pageStory(RoomNpcsItemsView), name: 'NPCs and items' };
export const LongLog: StoryObj = { ...pageStory(RoomLongLogView), name: 'Long log' };
export const RefusalLine: StoryObj = { ...pageStory(RoomRefusalView), name: 'Refusal line' };
export const AtNight: StoryObj = {
  ...pageStory(RoomAtNightView),
  name: 'At night',
};

// The senses sampler's GameView cues (kernel/ts/test/senses.test.ts) on a generated room, worded by
// the sampler's own text: the hall hears the forge one room east and smells the tower's stew.
const cued = (cues: object[]): StoryObj => ({
  ...pageStory({ ...RoomFirstView, view: { ...RoomFirstView.view, cues } }),
  args: { words: Object.fromEntries(Object.entries(senses).filter(([k]) => k.startsWith('cue.'))) },
});
// Breaks: the direction phrase is dropped, so a cue next door reads as if it were here; or the
// cues are reordered, so a farther cue reads before a nearer one.
export const SenseCues: StoryObj = {
  ...cued([
    { sense: 'sound', text: 'cue.hammering', direction: 'east' },
    { sense: 'smell', text: 'cue.stew', direction: 'north' },
  ]),
  name: 'Sense cues',
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Hammering from the east')).toBeVisible();
    const stew = canvas.getByText('The smell of stew from the north');
    await expect(stew).toBeVisible();
    const hammering = canvas.getByText('Hammering from the east');
    await expect(
      hammering.compareDocumentPosition(stew) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  },
};
// Breaks: a cue from the player's own room gets a direction phrase it has none of.
export const SenseCuesHere: StoryObj = {
  ...cued([
    { sense: 'heat', text: 'cue.forge_heat' },
    { sense: 'sound', text: 'cue.hammering' },
  ]),
  name: 'Sense cues here',
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Heat beats out from the forge.')).toBeVisible();
    await expect(canvas.getByText('Hammering')).toBeVisible();
  },
};

// A skill voice (toolbox row FD2) and a companion remark (FD10) as the presenter logs them: plain
// World lines after the room's lines, no block of their own (book-ui.md Aside details; owner pick
// mvlrbpi8u4ai). Breaks: the log drops an aside or reorders it; the logging is in polish_style.test.ts.
export const Asides: StoryObj = {
  ...pageStory({
    ...RoomFirstView,
    log: [voices['aside.hall.lore'], remarks['remark.hal.first']],
  }),
  name: 'Asides',
  play: async ({ canvas }) => {
    const aside = await canvas.findByText(voices['aside.hall.lore']);
    await expect(aside).toBeVisible();
    const prose = canvas.getByText(/A low inn/);
    const remark = canvas.getByText(remarks['remark.hal.first']);
    await expect(
      prose.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await expect(
      aside.compareDocumentPosition(remark) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
