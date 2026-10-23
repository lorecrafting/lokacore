// PageFoot: the page's local returns, nearest first (PageFoot's doc comment).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn } from 'storybook/test';
import { Control, PageFoot } from '../book/pages.tsx';

const meta = {
  title: 'Book/PageFoot',
  args: { back: fn(), leave: fn() },
  render: (args: { back?: () => void; leave: () => void }) => (
    <PageFoot>
      {args.back && <Control label="Back to map" onPress={args.back} />}
      <Control label={args.back ? 'Back to World' : 'Leave'} onPress={args.leave} />
    </PageFoot>
  ),
} satisfies Meta<{ back?: () => void; leave: () => void }>;
export default meta;
type Story = StoryObj<typeof meta>;

// Breaks: the foot draws a return twice or drops its press.
export const OneReturn: Story = {
  args: { back: undefined },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getAllByRole('button')).toHaveLength(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Leave' }));
    await expect(args.leave).toHaveBeenCalledTimes(1);
  },
};

// Breaks: a Map room detail loses one of its two returns.
export const TwoReturns: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getAllByRole('button')).toHaveLength(2);
    await userEvent.click(canvas.getByRole('button', { name: 'Back to map' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Back to World' }));
    await expect(args.back).toHaveBeenCalledTimes(1);
    await expect(args.leave).toHaveBeenCalledTimes(1);
  },
};
