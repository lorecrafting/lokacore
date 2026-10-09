// C row Pages, Chapter title, Scene, Dream (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { DreamPage } from '../book/DreamPage.tsx';
import { ChapterPage, ScenePage } from '../book/sections.tsx';
import { pageStory } from './screen.tsx';
import ChapterTitleView from './views/chapter-title.json';
import DreamView from './views/dream.json';
import SceneView from './views/scene.json';

const meta: Meta = {
  title: 'Pages/Chapter and scene',
  component: ChapterPage,
  subcomponents: { ScenePage, DreamPage },
};
export default meta;

export const ChapterTitle: StoryObj = { ...pageStory(ChapterTitleView), name: 'Chapter title' };
export const Scene: StoryObj = { ...pageStory(SceneView), name: 'Scene' };
export const Dream: StoryObj = { ...pageStory(DreamView), name: 'Dream' };
