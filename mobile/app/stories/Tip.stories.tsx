// Tip: the footer's first-run tip (BOOK-UI-COMPONENTS.md, Footer).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn } from 'storybook/test';
import { Tip } from '../book/Footer.tsx';

const meta = { title: 'Book/Tip', component: Tip, args: { dismiss: fn() } } satisfies Meta<
  typeof Tip
>;
export default meta;

export const Shown: StoryObj<typeof meta> = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Got it' }));
    await expect(args.dismiss).toHaveBeenCalledTimes(1);
  },
};
