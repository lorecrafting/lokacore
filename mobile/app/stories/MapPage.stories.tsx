// C row Pages, Map (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { DiscoveredMap } from '../book/DiscoveredMap.tsx';
import { MapPage } from '../book/sections.tsx';
import { pageStory } from './screen.tsx';
import MapTwoLevelsView from './views/map-two-levels.json';

const meta: Meta = { title: 'Pages/Map', component: MapPage, subcomponents: { DiscoveredMap } };
export default meta;

export const DiscoveredTwoLevels: StoryObj = {
  ...pageStory(MapTwoLevelsView),
  name: 'Discovered 2 levels',
};
