// The web Book's page column (book-ui.md, Page column) on a desktop browser.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect } from 'storybook/test';
import { BookView } from '../book/Book.tsx';
import { size } from '../book/tokens.ts';
import { pageStory } from './screen.tsx';
import firstRoom from './views/room-first.json';

const meta: Meta = { title: 'Pages/Web column', component: BookView, tags: ['!autodocs'] };
export default meta;

// Wide web caps the Book at size.column, centred on the paper.
// Breaks: the page stretches across the desktop, or the column sits off centre.
export const Desktop: StoryObj = {
  ...pageStory(firstRoom),
  name: 'Desktop',
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvas }) => {
    const title = await canvas.findByRole('heading', { level: 1 });
    const { left, right } = title.getBoundingClientRect();
    await expect(window.innerWidth).toBeGreaterThan(size.column);
    await expect(right - left).toBeLessThan(size.column);
    await expect(left + right).toBeCloseTo(window.innerWidth, 0);
  },
};
