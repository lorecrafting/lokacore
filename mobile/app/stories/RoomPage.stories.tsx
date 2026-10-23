// C row Pages, Room (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect } from 'storybook/test';
import { Body } from '../book/Body.tsx';
import { Asides as AsideLines } from '../book/lines.tsx';
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
  subcomponents: { Body, NoticeEntries, Asides: AsideLines },
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
// Breaks: the description's linked signpost stays plain words or keeps a second World line (loka-x6t.105).
export const LinkedSignpost: StoryObj = {
  ...pageStory(RoomFirstView),
  name: 'Linked signpost',
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'signpost, open' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'The inn signpost, open' })).toBeNull();
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

// The voices sampler's hall aside (toolbox row FD2, book-ui.md Aside details) on a generated room.
// Breaks: the aside is dropped or drawn before the room's prose.
export const Asides: StoryObj = {
  ...pageStory({
    ...RoomFirstView,
    view: {
      ...RoomFirstView.view,
      place: { ...RoomFirstView.view.place, asides: [{ key: 'aside.hall.lore' }] },
    },
  }),
  args: { words: { 'aside.hall.lore': voices['aside.hall.lore'] } },
  name: 'Asides',
  play: async ({ canvas }) => {
    const aside = await canvas.findByText(voices['aside.hall.lore']);
    await expect(aside).toBeVisible();
    const prose = canvas.getByText(/A low inn/);
    await expect(
      prose.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  },
};

// A companion remark (toolbox row FD10): a present NPC's aside, worded by the remarks sampler.
// Breaks: the remark is dropped or drawn after the loose items instead of after the people.
export const CompanionRemark: StoryObj = {
  ...pageStory({
    ...RoomNpcsItemsView,
    view: {
      ...RoomNpcsItemsView.view,
      entities: RoomNpcsItemsView.view.entities
        .map((e, i) => (i === 0 ? { ...e, asides: [{ key: 'remark.hal.first' }] } : e))
        .slice(0, 3),
    },
  }),
  args: { words: { 'remark.hal.first': remarks['remark.hal.first'] } },
  name: 'Companion remark',
  play: async ({ canvas }) => {
    const remark = await canvas.findByText(remarks['remark.hal.first']);
    await expect(remark).toBeVisible();
    const item = canvas.getByText(/apple/);
    await expect(
      remark.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  },
};

// Breaks (owner pick mvl9864n2qi8): a crowded room lists one name per line, joins with "and",
// capitalises every name, or merges a group's names into one link.
const [npc, , thing] = RoomNpcsItemsView.view.entities;
const crowd = (e: typeof npc, kind: string, names: string[]) =>
  names.map((n, i) => ({ ...e, id: `${e.id}-${i}`, name: `${kind}.${n}.short`, contents: [] }));
export const Crowded: StoryObj = {
  ...pageStory({
    ...RoomNpcsItemsView,
    view: {
      ...RoomNpcsItemsView.view,
      entities: [
        ...crowd(npc, 'npc', ['aldous', 'bess', 'carpenter', 'chandler', 'cook']),
        ...crowd(thing, 'item', ['apple', 'axe', 'bench', 'bread', 'anvil']),
      ],
    },
  }),
  name: 'Five people, five items',
  play: async ({ canvas }) => {
    const people = ['Aldous', 'Bess, the alewife', 'the carpenter', 'the chandler', 'the cook'];
    const things = ['An apple', 'an axe', 'a wooden bench', 'a cob of bread', 'an iron anvil'];
    for (const group of [people, things]) {
      const links = group.map((n) => canvas.getByRole('button', { name: `${n}, open` }));
      await expect(links[0]!.parentElement!.textContent).toBe(
        `${group.slice(0, -1).join(', ')}, and ${group.at(-1)} are here.`,
      );
    }
  },
};
