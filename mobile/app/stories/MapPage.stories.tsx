// C row Pages, Map: dots and lines (book-ui.md, Minimap, Map and presentation controls; loka-wz6f);
// routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect } from 'storybook/test';
import { DiscoveredMap } from '../book/DiscoveredMap.tsx';
import { MapPage } from '../book/sections.tsx';
import { pageStory } from './screen.tsx';
import MapStartView from './views/map-start.json';
import MapRoomsView from './views/map-rooms.json';
import MapTwoLevelsView from './views/map-two-levels.json';

const meta: Meta = {
  title: 'Pages/Map',
  component: MapPage,
  subcomponents: { DiscoveredMap },
  tags: ['!autodocs'],
};
export default meta;

// The inn alone, ringed, an open dot on each of its six exits.
export const Start: StoryObj = { ...pageStory(MapStartView), name: 'Start' };
// Four visited rooms joined by lines; the unexplored exits of each end in open dots.
export const SeveralRooms: StoryObj = { ...pageStory(MapRoomsView), name: 'Several rooms' };
export const DiscoveredTwoLevels: StoryObj = {
  ...pageStory(MapTwoLevelsView),
  name: 'Discovered 2 levels',
};
// Breaks: a tapped dot's name is not shown under the map, or an open dot names a room.
export const Selected: StoryObj = {
  ...pageStory(MapRoomsView),
  name: 'Selected caption',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Crossroads Inn' }));
    await expect(canvas.getByText('Crossroads Inn')).toBeVisible();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Unexplored, north of Crossroads Inn' }),
    );
    await expect(canvas.getByText('Unexplored')).toBeVisible();
    await expect(canvas.queryByText('Crossroads Inn')).toBeNull();
  },
};
