// C row Pages, NPC (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, userEvent, within } from 'storybook/test';
import { NpcDetail, NpcPage } from '../book/Npc.tsx';
import { ShelfPage } from '../book/Shelf.tsx';
import { isCard, pageStory } from './screen.tsx';
import NpcChoiceView from './views/npc-choice.json';
import NpcShopView from './views/npc-shop.json';
import NpcServicesView from './views/npc-services.json';
import NpcClosedView from './views/npc-closed.json';
import NpcShelfView from './views/npc-shelf.json';
import NpcSilentView from './views/npc-silent.json';
import { View } from 'react-native';
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
// Breaks: the note is dropped from the NPC page or drawn before the description.
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
const NOTE = 'The Reeve has a sealed letter at her belt.',
  ABOUT = 'The Reeve keeps the village rolls.';
export const Carrying: StoryObj = {
  ...pageStory(carryingView),
  args: {
    words: { [carryingView.view.entities[1]!.description!]: ABOUT, 'npc.reeve.carrying': NOTE },
  },
  name: 'Carrying',
  play: async ({ canvas }) => {
    const note = await canvas.findByText(NOTE);
    await expect(note).toBeVisible();
    // The note follows the description.
    await expect(
      (await canvas.findByText(ABOUT)).compareDocumentPosition(note) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  },
};
// A person's Look page (book-ui.md, NPC page): description, their condition from the hp band, then
// what they wear and what else they carry, each one sentence of inline links. The Reeve is hurt,
// wears a cloak and carries the letter here; Nell has no band and her bread is her shop stock.
// Breaks: the condition, worn or carried sentence lost or out of order, its item not a link, a
// condition drawn without a band, shop stock listed as carried, or a worn item repeated as carried.
const letter = NpcChoiceView.view.entities[3]!;
const nell = NpcChoiceView.view.entities[0]!;
const cloak = {
  id: 'cloak',
  kind: 'item',
  name: 'item.cloak.short',
  words: { article: 'a', bare: 'item.cloak.bare', plural: 'item.cloak.plural' },
  slot: 'body',
  container_id: reeve.id,
  actions: [],
};
const lookView = (id: string, entities: unknown[] = NpcChoiceView.view.entities) => ({
  ...NpcChoiceView,
  view: { ...NpcChoiceView.view, entities },
  stack: [
    { kind: 'thing', id },
    { kind: 'inside', id },
  ],
});
// The Reeve as the view projects them: worn always, contents (worn included) only under theft.
const reeveWith = (dress: object) =>
  NpcChoiceView.view.entities
    .filter((e) => e !== letter)
    .map((e) => (e === reeve ? { ...e, band: 'hurt', worn: [cloak], ...dress } : e));
const after = (a: Element, b: Element) =>
  expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
export const Look: StoryObj = {
  ...pageStory(
    lookView(reeve.id, reeveWith({ contents: [cloak, { ...letter, container_id: reeve.id }] })),
  ),
  name: 'Look',
  play: async ({ canvas }) => {
    const wears = await canvas.findByText(/^The Reeve wears a/);
    const carries = canvas.getByText(/^The Reeve carries a/);
    await after(canvas.getByText('The Reeve looks to be hurt.'), wears);
    await after(wears, carries);
    await expect(carries).not.toHaveTextContent('cloak');
    await expect(canvas.getByRole('button', { name: 'wool cloak, open' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'sealed letter, open' })).toBeVisible();
  },
};
// Breaks: a person who only wears things gains a carries sentence (no theft: no contents).
export const LookWorn: StoryObj = {
  ...pageStory(lookView(reeve.id, reeveWith({}))),
  name: 'Look, wearing only',
  play: async ({ canvas }) => {
    await canvas.findByText(/^The Reeve wears a/);
    await expect(canvas.queryByText(/carries/)).toBeNull();
  },
};
// Nell as the view projects her: worn always, here empty. Breaks: an empty worn draws "Nell wears ."
export const LookNothing: StoryObj = {
  ...pageStory(
    lookView(
      nell.id,
      NpcChoiceView.view.entities.map((e) => (e === nell ? { ...e, worn: [] } : e)),
    ),
  ),
  name: 'Look, carrying nothing',
  play: async ({ canvas }) => {
    await canvas.findByRole('button', { name: LABEL.close });
    await expect(canvas.queryByText(/carries|wears|looks to be/)).toBeNull();
  },
};
// The cloak's page, opened from the worn sentence without theft (book-ui.md, Item details): its
// take is refused not_present. Breaks: a Take or Lift button, a refusal card or "is holding it".
export const WornItem: StoryObj = {
  ...pageStory({
    ...lookView(
      reeve.id,
      reeveWith({
        worn: [
          {
            ...cloak,
            actions: [
              {
                action_key: 'take',
                label: 'action.take',
                target_ids: [cloak.id],
                available: false,
                reason: { code: 'not_present' },
              },
            ],
          },
        ],
      }),
    ),
    stack: [
      { kind: 'thing', id: reeve.id },
      { kind: 'inside', id: reeve.id },
      { kind: 'thing', id: cloak.id },
    ],
  }),
  name: 'Worn item page',
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'A wool cloak' });
    await expect(canvas.queryByRole('button', { name: /take|lift/i })).toBeNull();
    await expect(canvas.queryByText(/holding it|not here/i)).toBeNull();
  },
};
// Breaks: a grayed Attack on an hp-less person, or none on one with hp (loka-3751; book-ui.md).
const refused = { available: false, reason: { code: 'invalid_target', cause: 'cannot_be_hurt' } };
const attack = (offer: object, band?: string) => {
  const actions = [{ action_key: 'attack', label: 'action.attack', ...offer }];
  const view = { ...NpcChoiceView.view, choice: undefined, entities: reeveWith({ band, actions }) };
  return pageStory({ ...NpcChoiceView, view });
};
const panes = [attack(refused), attack({ available: true }, 'ready')];
export const AttackHidden: StoryObj = {
  ...panes[0],
  args: { words: { 'action.attack': 'Attack' } },
  render: (args, ctx) => (
    <>
      {panes.map((s, i) => (
        <View key={i} testID={`pane${i}`}>
          {s.render!(args, ctx)}
        </View>
      ))}
    </>
  ),
  name: 'No Attack on an NPC that cannot be hurt',
  play: async ({ canvas }) => {
    await within(canvas.getByTestId('pane1')).findByRole('button', { name: /^Attack/ });
    await expect(canvas.getAllByRole('button', { name: /^Attack/ })).toHaveLength(1);
  },
};
export const Shop: StoryObj = { ...pageStory(NpcShopView), name: 'Shop' };
type Canvas = Parameters<NonNullable<StoryObj['play']>>[0]['canvas'];
// Breaks: a shop row drawn as a card, or its noun not link-styled (book-ui.md, NPC shop, services).
const shopLine = async (canvas: Canvas, name: string, noun: string) => {
  const line = await canvas.findByRole('button', { name });
  await expect(getComputedStyle(line).borderTopWidth).toBe('0px');
  await expect(getComputedStyle(within(line).getByText(noun)).textDecorationLine).toBe('underline');
  return line;
};
// Breaks: the buy page loses its Sell card while the player holds something the shop buys, or a
// sold-out line's press does not gray it with its sentence.
export const Shelf: StoryObj = {
  ...pageStory(NpcShelfView),
  name: 'Shop, buy page',
  play: async ({ canvas }) => {
    await canvas.findByRole('button', { name: LABEL.sell });
    const cob = 'A cob of bread, 4p. Buy for 4 pennies.';
    await userEvent.click(await shopLine(canvas, cob, 'cob of bread'));
    await canvas.findByText(/It's sold out\./, { selector: '[role=button] *' });
  },
};
// The story's page turns are spies, so the sell page is its own stack.
const keeper = NpcShelfView.stack[0]!.id;
// Breaks: a bought cob not offered back on the sell page with its price.
export const Sale: StoryObj = {
  ...pageStory({ ...NpcShelfView, stack: [...NpcShelfView.stack, { kind: 'sale', id: keeper }] }),
  name: 'Shop, sell page',
  play: async ({ canvas }) => {
    await shopLine(canvas, 'A cob of bread, 1p. Sell for 1 penny.', 'cob of bread');
  },
};
// Breaks: a service drawn as a card, or its name losing the action and price.
export const Services: StoryObj = {
  ...pageStory(NpcServicesView),
  name: 'Services',
  play: async ({ canvas }) => {
    await shopLine(canvas, 'Order a knife, 3p. 3 pennies.', 'Order a knife');
  },
};
// The smith with a knife on order, from Services (the route needs two lumps of ore): knife is at
// the forge, so cancel is offered, claim refused not ready, both under Your order; no commission.
const smith = NpcServicesView.view.entities.find((e) => 'services' in e && e.services)!;
const offered = smith.services!.filter((s) => s.benefit.op !== 'entitlement');
const open = offered.map((s) =>
  s.benefit.op === 'cancel'
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
    await shopLine(canvas, 'Cancel the order, 1p. 1 penny.', 'Cancel the order');
  },
};
export const NothingToSay: StoryObj = { ...pageStory(NpcSilentView), name: 'Nothing to do' };
export const ClosedConversation: StoryObj = {
  ...pageStory(NpcClosedView),
  name: 'Closed conversation',
};
// An NPC's mood is its name and description variants (owner 2026-10-30, W6): the afraid goblin.
// The fence's view without its shop, so no Trade card. Breaks: the page title or description ignores
// the view's variant keys, the title is not capitalised, or Look is a Control, not a card (loka-hvfj).
const moodView = {
  ...NpcSilentView,
  view: {
    ...NpcSilentView.view,
    entities: NpcSilentView.view.entities.map(({ shop: _, ...e }) => ({
      ...e,
      name: 'npc.goblin.short_afraid',
      words: { bare: 'npc.goblin.bare_afraid', article: 'a', plural: 'npc.goblin.plural_afraid' },
      description: 'npc.goblin.description_afraid',
    })),
  },
};
export const Mood: StoryObj = {
  ...pageStory(moodView),
  name: 'Mood (afraid goblin)',
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('A cowering goblin')).toBeVisible();
    await expect(canvas.queryByText(LABEL.trade)).toBeNull();
    await expect(await isCard(canvas, LABEL.lookPerson)).toBe(true);
    await expect(
      await canvas.findByText(
        'The goblin shrinks against the wall, its notched blade low, eyes on the way out.',
      ),
    ).toBeVisible();
  },
};
