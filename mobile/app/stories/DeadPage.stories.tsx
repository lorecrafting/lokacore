// The dead page (book-ui.md, Dead page): a death outside a fight, before Let go.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect } from 'storybook/test';
import { Body } from '../book/Body.tsx';
import { DeadPage as Dead } from '../book/DeadPage.tsx';
import { LABEL } from '../book/labels.ts';
import { pageStory } from './screen.tsx';
import RoomNpcsItemsView from './views/room-npcs-items.json';

const meta: Meta = {
  tags: ['!autodocs'],
  title: 'Pages/Dead',
  component: Dead,
  subcomponents: { Body },
};
export default meta;

// Breaks (book-ui.md, Dead page): the recovery room's prose, people or status row drawn under the
// kept title, or any control but Let go.
export const DeadPage: StoryObj = {
  ...pageStory(RoomNpcsItemsView, {
    dead: { title: 'The cellar', log: ['You light the lamp.'] },
    log: ['You bleed.', 'You die.', 'You wake at the shrine.'],
    fell: true,
  }),
  name: 'Dead page',
  play: async ({ canvas }) => {
    const letGo = await canvas.findByRole('button', { name: LABEL.letGo });
    await expect(canvas.getAllByRole('button')).toEqual([letGo]);
    await expect(canvas.getByRole('heading')).toHaveTextContent('The cellar');
    await expect(canvas.getByText('You wake at the shrine.')).toBeVisible();
  },
};
