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
export const Contents: StoryObj = { ...pageStory(ContentsView), name: 'Contents' };
export const Settings: StoryObj = { ...pageStory(SettingsView), name: 'Settings' };
export const Ancestry: StoryObj = { ...pageStory(AncestryView), name: 'Ancestry' };
