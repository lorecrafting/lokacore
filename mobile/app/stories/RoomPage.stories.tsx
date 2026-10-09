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
