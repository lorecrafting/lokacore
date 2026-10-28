// C row Pages, NPC (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect } from 'storybook/test';
import { NpcDetail, NpcPage } from '../book/Npc.tsx';
import { ShelfPage } from '../book/Shelf.tsx';
import { pageStory } from './screen.tsx';
import NpcChoiceView from './views/npc-choice.json';
import NpcShopView from './views/npc-shop.json';
import NpcServicesView from './views/npc-services.json';
import NpcClosedView from './views/npc-closed.json';
import NpcShelfView from './views/npc-shelf.json';
import NpcSilentView from './views/npc-silent.json';
import { LABEL } from '../book/labels.ts';

const meta: Meta = {
  title: 'Pages/NPC',
  component: NpcPage,
  subcomponents: { NpcDetail, ShelfPage },
  tags: ['!autodocs'],
};
export default meta;

export const Choice: StoryObj = {
  ...pageStory(NpcChoiceView, undefined, [
    'dialogue.reeve_talk.prompt',
    'dialogue.reeve_talk.accept',
    'dialogue.reeve_talk.help',
    'dialogue.reeve_talk.wrong',
  ]),
  name: 'Choice',
  // Breaks: the Map's "Ask where the Reeve is" (known_npcs) leaks onto her own page.
  play: async ({ canvas }) => {
    await canvas.findByText(/Take the letter to Wat/);
    await expect(canvas.queryByText(/^Ask where/)).toBeNull();
  },
};
// A person's carried item is a note on their page, not on World (book-ui.md, NPC page).
// Breaks: the note is dropped from the NPC page.
const reeve = NpcChoiceView.view.entities[1]!;
const carryingView = {
  ...NpcChoiceView,
  view: {
    ...NpcChoiceView.view,
    entities: NpcChoiceView.view.entities.map((e) =>
      e === reeve ? { ...e, carrying: 'npc.reeve.carrying' } : e,
    ),
  },
};
export const Carrying: StoryObj = {
  ...pageStory(carryingView),
  args: { words: { 'npc.reeve.carrying': 'The Reeve has a sealed letter at her belt.' } },
  name: 'Carrying',
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText('The Reeve has a sealed letter at her belt.'),
    ).toBeVisible();
  },
};
export const Shop: StoryObj = { ...pageStory(NpcShopView), name: 'Shop' };
// Breaks: the buy page loses its Sell card while the player holds something the shop buys.
export const Shelf: StoryObj = {
  ...pageStory(NpcShelfView),
  name: 'Shop, buy page',
  play: async ({ canvas }) => {
    await canvas.findByRole('button', { name: LABEL.sell });
  },
};
// The story's page turns are spies, so the sell page is its own stack.
const keeper = NpcShelfView.stack[0]!.id;
// Breaks: a bought cob not offered back on the sell page with its price.
export const Sale: StoryObj = {
  ...pageStory({ ...NpcShelfView, stack: [...NpcShelfView.stack, { kind: 'sale', id: keeper }] }),
  name: 'Shop, sell page',
  play: async ({ canvas }) => {
    await canvas.findByRole('button', { name: 'Cob of bread — 1p' });
  },
};
export const Services: StoryObj = { ...pageStory(NpcServicesView), name: 'Services' };
// The smith with a knife on order, shaped from the Services view (the route needs two lumps of ore):
// the knife still at the forge, so cancel is offered and claim refused not ready; the commission
// hides and they sit under Your order.
const smith = NpcServicesView.view.entities.find((e) => 'services' in e && e.services)!;
const offered = smith.services!.filter((s) => s.benefit.kind !== 'entitlement');
const open = offered.map((s) =>
  s.benefit.kind === 'cancel'
    ? { ...s.action, available: true, reason: undefined }
    : { ...s.action, reason: { code: 'invalid_state', message: { key: 'service.not_ready' } } },
);
const ordered = {
  ...NpcServicesView,
  view: {
    ...NpcServicesView.view,
    actions: [...NpcServicesView.view.actions, ...open.filter((a) => a.available)],
    entities: NpcServicesView.view.entities.map((e) =>
      e === smith ? { ...e, services: offered.map((s, i) => ({ ...s, action: open[i] })) } : e,
    ),
  },
};
// Breaks: the commission beside an open order, or claim and cancel outside Your order.
export const OpenOrder: StoryObj = {
  ...pageStory(ordered),
  name: 'Services, open order',
  play: async ({ canvas }) => {
    await canvas.findByText(LABEL.yourOrder);
    await expect(canvas.queryByText(/^Order a knife/)).toBeNull();
  },
};
export const NothingToSay: StoryObj = { ...pageStory(NpcSilentView), name: 'Nothing to do' };
export const ClosedConversation: StoryObj = {
  ...pageStory(NpcClosedView),
  name: 'Closed conversation',
};
