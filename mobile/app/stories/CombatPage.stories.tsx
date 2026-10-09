// C row Pages, Combat (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Combat } from '../book/Combat.tsx';
import { pageStory } from './screen.tsx';
import CombatOneFoeView from './views/combat-one-foe.json';
import CombatPackView from './views/combat-pack.json';
import CombatBleedingView from './views/combat-bleeding.json';

const meta: Meta = { title: 'Pages/Combat', component: Combat };
export default meta;

export const OneFoe: StoryObj = {
  ...pageStory(CombatOneFoeView),
  name: 'One foe',
};
export const Pack: StoryObj = {
  ...pageStory(CombatPackView),
  name: 'Pack',
};
export const Bleeding: StoryObj = {
  ...pageStory(CombatBleedingView),
  name: 'Bleeding',
};
