// AwayRecap: the World page's grouped lines after an absence (BOOK-UI-COMPONENTS.md, Away recap).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect } from 'storybook/test';
import { LABEL } from '../book/labels.ts';
import { AwayRecap } from '../book/lines.tsx';

const meta = {
  title: 'Book/AwayRecap',
  component: AwayRecap,
  args: {
    lines: [
      { line: 'The poison burns in your veins.', count: 11 },
      { line: 'The poison fades from your blood.', count: 1 },
      { line: 'Maud leaves.', count: 6 },
      { line: 'Maud arrives.', count: 6 },
    ],
  },
} satisfies Meta<typeof AwayRecap>;
export default meta;
type Story = StoryObj<typeof meta>;

// Breaks: the grouped lines show before the tap, or the heading's name does not say a tap shows them.
export const Collapsed: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.queryByText(/poison burns/)).toBeNull();
    await expect(canvas.getByRole('button', { name: `${LABEL.awayRecap}, show` })).toBeVisible();
  },
};

// Breaks: the heading does not open the lines, a count is missing or shown for a single line, or
// the open heading's name does not say a tap hides them.
export const Open: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: `${LABEL.awayRecap}, show` }));
    await expect(canvas.getByText('The poison burns in your veins. (11 times)')).toBeVisible();
    await expect(canvas.getByText('The poison fades from your blood.')).toBeVisible();
    await expect(canvas.getByRole('button', { name: `${LABEL.awayRecap}, hide` })).toBeVisible();
  },
};
