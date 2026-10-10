// C row Pages, Sections (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { ContentsPage } from '../book/Menu.tsx';
import { SkillDetails } from '../book/skills.tsx';
import {
  AncestryPage,
  CarryingPage,
  CharacterPage,
  JournalPage,
  SettingsPage,
} from '../book/sections.tsx';
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
