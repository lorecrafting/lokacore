// C row Pages, Item (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Item, ThingPage } from '../book/Menu.tsx';
import { ItemDetails } from '../book/skills.tsx';
import { pageStory } from './screen.tsx';
import ItemPlainView from './views/item-plain.json';
import ItemTooHeavyView from './views/item-too-heavy.json';

const meta: Meta = {
  title: 'Pages/Item',
  component: Item,
  subcomponents: { ThingPage, ItemDetails },
};
export default meta;

export const Plain: StoryObj = { ...pageStory(ItemPlainView), name: 'Plain' };
export const TooHeavy: StoryObj = { ...pageStory(ItemTooHeavyView), name: 'Too heavy' };
