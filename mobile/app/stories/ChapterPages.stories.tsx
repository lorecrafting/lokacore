// C row Pages, Chapter title, Scene, Dream (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn } from 'storybook/test';
import { DreamPage } from '../book/DreamPage.tsx';
import { ChapterPage, ScenePage } from '../book/sections.tsx';
import { chapterLabel } from '../book/words.ts';
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

export const ChapterTitle: StoryObj = {
  ...pageStory(ChapterTitleView, undefined, ['chapter.missing_child']),
  name: 'Chapter title',
  // Breaks: the header is the title alone, so the arriving focus never reads the chapter label;
  // or the header (a View) cannot take that focus on web.
  play: async ({ canvas }) => {
    const header = canvas.getByRole('heading', { name: /^Chapter one\W+The Missing Child/ });
    header.focus();
    await expect(document.activeElement).toBe(header);
  },
};
// A title that wraps at SE width; the fixture's one title cannot show it.
export const ChapterTitleLong: StoryObj = {
  name: 'Long title',
  render: () => (
    <ChapterPage
      label={chapterLabel(11)}
      title="The Ferryman’s Daughter and the Bell beneath the Flooded Causeway"
      done={fn()}
    />
  ),
};
export const Scene: StoryObj = { ...pageStory(SceneView), name: 'Scene' };
export const Dream: StoryObj = { ...pageStory(DreamView), name: 'Dream' };
