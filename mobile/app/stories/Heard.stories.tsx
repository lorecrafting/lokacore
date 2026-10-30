// Heard: the Book's live region (Heard's doc comment). Not seen, so the play reads the DOM.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect } from 'storybook/test';
import { Heard } from '../book/lines.tsx';

const meta = {
  title: 'Book/Heard',
  component: Heard,
  args: { said: { key: 1, text: 'You say, "Ware."' } },
} satisfies Meta<typeof Heard>;
export default meta;
type Story = StoryObj<typeof meta>;

// Breaks: react-native-web stops mapping aria-live, or the region turns assertive or loses its text.
export const Batch: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[aria-live="polite"]')?.textContent).toBe(
      'You say, "Ware."',
    );
  },
};
