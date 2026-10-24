// C row Pages, Combat (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect } from 'storybook/test';
import { Combat } from '../book/Combat.tsx';
import { pageStory } from './screen.tsx';
import CombatOneFoeView from './views/combat-one-foe.json';
import CombatPackView from './views/combat-pack.json';
import CombatBleedingView from './views/combat-bleeding.json';

const meta: Meta = { title: 'Pages/Combat', component: Combat, tags: ['!autodocs'] };
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
// A blow a status barred (loka-x6t.30): the Book's default line for the foe and for the player
// (book/words.ts lineWords). No showcase status bars a blow yet, so the lines are set here.
export const SkippedTurn: StoryObj = {
  ...pageStory(CombatOneFoeView, {
    combatLog: ['The boar is too stunned to do anything.', 'You are too stunned to do anything.'],
  }),
  name: 'Skipped turn',
};
// A live foe's line draws its Cast a spell… list (loka-x6t.109.5). Breaks: no list on the foe line.
const boar = CombatOneFoeView.view.entities[0]!;
const flamma = {
  action_key: 'flamma',
  command: 'cast',
  label: 'spell.flamma',
  target: { kind: 'entity', scopes: ['room_occupants'] },
  target_ids: [boar.id],
  available: true,
};
export const FoeCast: StoryObj = {
  ...pageStory({
    ...CombatOneFoeView,
    view: { ...CombatOneFoeView.view, entities: [{ ...boar, actions: [...boar.actions, flamma] }] },
  }),
  name: 'Foe with Cast a spell…',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Cast a spell…' }));
    await expect(canvas.getByRole('button', { name: /^Flamma, cast flamma on/ })).toBeVisible();
  },
};
