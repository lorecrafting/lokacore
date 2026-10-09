// C row Pages, Other: Dream (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { DreamPage } from '../book/DreamPage.tsx';
import { pageStory } from './screen.tsx';
import DreamView from './views/dream.json';

const meta: Meta = { title: 'Pages/Other', component: DreamPage };
export default meta;

export const Dream: StoryObj = {
  ...pageStory(DreamView),
  name: 'Dream',
  globals: { palette: 'dark' },
};
