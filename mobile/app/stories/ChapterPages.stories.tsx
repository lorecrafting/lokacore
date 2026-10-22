// C row Pages, Chapter title, Scene(design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn } from 'storybook/test';
import { ChapterPage, ScenePage } from '../book/sections.tsx';
import { DreamPage } from '../book/DreamPage.tsx';
import { chapterLabel } from '../book/words.ts';
import { pageStory, pageTags } from './screen.tsx';
import SceneView from './views/scene.json';

const meta: Meta = {
  tags: pageTags,
  title: 'Pages/Chapter and scene',
  component: ChapterPage,
  subcomponents: { ScenePage },
};
export default meta;

// A title that wraps at SE width.
export const ChapterTitleLong: StoryObj = {
  name: 'Long title',
  // Breaks: the header is the title alone, so the arriving focus never reads the chapter label;
  // or the header (a View) cannot take that focus on web.
  play: async ({ canvas }) => {
    const header = canvas.getByRole('heading', { name: /^Chapter twelve\W+The Ferryman/ });
    header.focus();
    await expect(document.activeElement).toBe(header);
  },
  render: () => (
    <ChapterPage
      label={chapterLabel(11)}
      title="The Ferryman’s Daughter and the Bell beneath the Flooded Causeway"
      done={fn()}
    />
  ),
};
export const Scene: StoryObj = { ...pageStory(SceneView), name: 'Scene' };

// The showcase authors no dream, so the page takes a synthetic screen (words are their own keys).
export const Dream: StoryObj = {
  name: 'Dream',
  render: () => (
    <DreamPage
      id="n"
      close={fn()}
      press={fn()}
      screen={
        {
          view: {
            notices: [
              {
                id: 'n',
                dream: {
                  available: true,
                  index: 1,
                  title: 'A dream',
                  description: 'You sleep.',
                  line: 'Rain on slate.',
                },
              },
            ],
          },
          text: (k: string) => k,
          buttons: [],
          detail: () => [],
        } as never
      }
    />
  ),
};
