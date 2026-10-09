// VerbLine: a room's offered place action (BOOK-UI-COMPONENTS.md, Verb line).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { expect, fn } from 'storybook/test';
import { VerbLine } from '../book/actions.tsx';
import { button } from './fixtures.ts';

const meta = {
  title: 'Book/VerbLine',
  component: VerbLine,
  args: { b: button('Rest by the fire'), press: fn() },
} satisfies Meta<typeof VerbLine>;
export default meta;
type Story = StoryObj<typeof meta>;

export const One: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Rest by the fire' }));
    await expect(args.press).toHaveBeenCalledWith(args.b);
  },
};

export const ThreeInARoom: Story = {
  render: (args) => (
    <View>
      {['Rest by the fire', 'Search the hearth', 'Listen at the door'].map((label) => (
        <VerbLine key={label} b={button(label)} press={args.press} />
      ))}
    </View>
  ),
};
