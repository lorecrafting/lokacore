// C row Pages, Item (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { InsidePage, Item, ThingPage } from '../book/Menu.tsx';
import { ItemDetails } from '../book/skills.tsx';
import { expect } from 'storybook/test';
import { LABEL } from '../book/labels.ts';
import { isCard, pageStory } from './screen.tsx';
import ItemPlainView from './views/item-plain.json';
import ItemTooHeavyView from './views/item-too-heavy.json';
import ItemContainerView from './views/item-container.json';
import ItemInsideView from './views/item-inside.json';
import ItemInsideEmptyView from './views/item-inside-empty.json';
import ItemFuelView from './views/item-fuel.json';

const meta: Meta = {
  tags: ['!autodocs'],
  title: 'Pages/Item',
  component: Item,
  subcomponents: { ThingPage, InsidePage, ItemDetails },
};
export default meta;

export const Plain: StoryObj = {
  ...pageStory(ItemPlainView, undefined, ['item.waterskin.short', 'item.waterskin.description']),
  name: 'Plain',
};
export const OpenContainer: StoryObj = {
  ...pageStory(ItemContainerView),
  name: 'Open container',
  // Breaks: Look inside drawn as a centered Control, not a card after the options (loka-hvfj).
  play: async ({ canvas }) => {
    await expect(await isCard(canvas, LABEL.lookInside)).toBe(true);
  },
};
export const Inside: StoryObj = { ...pageStory(ItemInsideView), name: 'Inside' };
export const InsideEmpty: StoryObj = { ...pageStory(ItemInsideEmptyView), name: 'Inside, empty' };
export const Fuel: StoryObj = { ...pageStory(ItemFuelView), name: 'Fuel' };
export const TooHeavy: StoryObj = { ...pageStory(ItemTooHeavyView), name: 'Too heavy' };
