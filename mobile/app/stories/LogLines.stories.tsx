// LogLines: the event log and detail history (BOOK-UI-COMPONENTS.md, Log line).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect } from 'storybook/test';
import { LogLines } from '../book/lines.tsx';

const meta = {
  title: 'Book/LogLines',
  component: LogLines,
  args: { lines: ['You step onto the jetty. The water is black and still.'] },
} satisfies Meta<typeof LogLines>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Narration: Story = {};

export const SystemLine: Story = {
  args: { lines: ['You read the notice.', { text: 'Journal updated.', event: true }] },
};

// Breaks: the reason tag dropped or merged into the sentence.
export const RefusedWithTag: Story = {
  args: { lines: [{ kind: 'refused', reason: 'locked', text: 'The way west is locked.' }] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('locked')).toBeVisible();
    await expect(canvas.getByText(/The way west is locked\./)).toBeVisible();
  },
};

export const ThirtyLines: Story = {
  args: { lines: Array.from({ length: 30 }, (_, i) => `The tide turns (${i + 1}).`) },
};

export const Empty: Story = { args: { lines: [] } };
