// C row Pages, Room (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect } from 'storybook/test';
import { Body } from '../book/Body.tsx';
import { NoticeEntries } from '../book/notices.tsx';
import { RoomPage } from '../book/pages.tsx';
import { pageStory } from './screen.tsx';
import RoomFirstView from './views/room-first.json';
import RoomNpcsItemsView from './views/room-npcs-items.json';
import RoomNoticesView from './views/room-notices.json';
import RoomLongLogView from './views/room-long-log.json';
import RoomAtNightView from './views/room-at-night.json';
import RoomRefusalView from './views/room-refusal.json';
import senses from '../../../cartridges/senses_sampler/text.json';

const meta: Meta = {
  title: 'Pages/Room',
  component: RoomPage,
  subcomponents: { Body, NoticeEntries },
};
export default meta;

export const FirstRoom: StoryObj = {
  ...pageStory(RoomFirstView, undefined, [
    'room.ferry_landing.title',
    'room.ferry_landing.description',
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
  args: { words: { 'room.ferry_landing.description': 'A reworded landing, set in the panel.' } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('A reworded landing, set in the panel.')).toBeVisible();
    await expect(canvas.queryByText(/Reeds crowd/)).toBeNull();
  },
};
export const NpcsAndItems: StoryObj = { ...pageStory(RoomNpcsItemsView), name: 'NPCs and items' };
export const WithNotices: StoryObj = { ...pageStory(RoomNoticesView), name: 'With notices' };
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
// Breaks: the direction phrase is dropped, so a cue next door reads as if it were here.
export const SenseCues: StoryObj = {
  ...cued([
    { sense: 'sound', text: 'cue.hammering', direction: 'east' },
    { sense: 'smell', text: 'cue.stew', direction: 'north' },
  ]),
  name: 'Sense cues',
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Hammering from the east')).toBeVisible();
    await expect(canvas.getByText('The smell of stew from the north')).toBeVisible();
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
