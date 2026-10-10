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

// Breaks: the grouped lines show before the tap, or the heading does not open them.
export const Collapsed: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.queryByText(/poison burns/)).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: `${LABEL.awayRecap}, show` }));
    await expect(canvas.getByText('The poison burns in your veins. (11 times)')).toBeVisible();
    await expect(canvas.getByText('The poison fades from your blood.')).toBeVisible();
  },
};

export const Empty: Story = { args: { lines: [] } };
