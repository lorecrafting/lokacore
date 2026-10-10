// C row Pages, Sections (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { ContentsPage } from '../book/Menu.tsx';
import { RaiseCards, SkillDetails } from '../book/skills.tsx';
import { AncestryPage, CarryingPage, CharacterPage, SettingsPage } from '../book/sections.tsx';
import { JournalPage } from '../book/journal.tsx';
import { pageStory } from './screen.tsx';
import JournalView from './views/journal.json';
import CarryingEmptyView from './views/carrying-empty.json';
import CarryingHeldView from './views/carrying-held.json';
import CharacterUnknownView from './views/character-unknown.json';
import CharacterFullView from './views/character-full.json';
import ContentsView from './views/contents.json';
import SettingsView from './views/settings.json';
import AncestryView from './views/ancestry.json';

const meta: Meta = {
  title: 'Pages/Sections',
  component: JournalPage,
  subcomponents: {
    CarryingPage,
    CharacterPage,
    SkillDetails,
    RaiseCards,
    ContentsPage,
    SettingsPage,
    AncestryPage,
  },
};
export default meta;

export const Journal: StoryObj = { ...pageStory(JournalView), name: 'Journal' };
export const CarryingEmpty: StoryObj = { ...pageStory(CarryingEmptyView), name: 'Carrying empty' };
export const CarryingHeld: StoryObj = { ...pageStory(CarryingHeldView), name: 'Carrying held' };
export const CharacterUnknown: StoryObj = {
  ...pageStory(CharacterUnknownView),
  name: 'Character unknown',
};
export const CharacterFull: StoryObj = { ...pageStory(CharacterFullView), name: 'Character full' };
// Chapter 1 authors no levelling, so the generated Character view gets the levelling sampler's
// level-2 projection (kernel/ts/test/levelling.test.ts) and its one raise_attribute offer.
const raise = { action_key: 'raise_attribute', label: 'action.raise_attribute', available: true };
export const CharacterPointsToSpend: StoryObj = {
  ...pageStory({
    ...CharacterFullView,
    view: {
      ...CharacterFullView.view,
      levelling: { level: 2, experience: 30, next: 100, unspent: 1 },
      actions: [
        ...CharacterFullView.view.actions,
        { ...raise, target: { kind: 'none' }, input: ['attribute'] },
      ],
    },
  }),
  name: 'Character with points to spend',
};
export const Contents: StoryObj = { ...pageStory(ContentsView), name: 'Contents' };
export const Settings: StoryObj = { ...pageStory(SettingsView), name: 'Settings' };
export const Ancestry: StoryObj = { ...pageStory(AncestryView), name: 'Ancestry' };
// Toolbox row 46: the codex sampler's lore (kernel/ts/test/codex.test.ts) on the Journal page, its
// words given here because Chapter 1 authors no deduction. Away from the study the card is refused.
const lore = {
  topics: [
    { topic: { kind: 'topic', key: 'mill' }, label: 'topic.mill' },
    { topic: { kind: 'topic', key: 'missing_cart' }, label: 'topic.missing_cart' },
  ],
  deductions: [
    {
      action: 'deduce_smugglers',
      label: 'actions.deduce_smugglers',
      from: ['topic.mill', 'topic.missing_cart'],
    },
  ],
};
const loreWords = {
  'topic.mill': 'The mill',
  'topic.missing_cart': 'The missing cart',
  'actions.deduce_smugglers': 'Think it through',
};
const deduce = {
  action_key: 'deduce_smugglers',
  label: 'actions.deduce_smugglers',
  available: true,
  target: { kind: 'none' },
  input: [],
};
const loreStory = (actions: object[], name: string): StoryObj => {
  const story = pageStory({ ...JournalView, view: { ...JournalView.view, ...lore, actions } });
  return { ...story, args: { words: loreWords }, name };
};
export const JournalLore: StoryObj = {
  ...loreStory([...JournalView.view.actions, deduce], 'Journal lore with a deduction here'),
  play: async ({ canvas }) => {
    await canvas.findByText('Lore');
    await canvas.findByText('The mill + The missing cart');
    await canvas.findByRole('button', { name: 'Think it through' });
  },
};
export const JournalLoreAway: StoryObj = {
  ...loreStory(JournalView.view.actions, 'Journal lore, deduction elsewhere'),
  play: async ({ canvas }) => {
    await canvas.findByText('Think it through: Not here');
  },
};
