// VerbLine: a room's offered place action (VerbLine's doc comment).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { expect, fn } from 'storybook/test';
import { ActionCard, VerbLine } from '../book/actions.tsx';
import { button } from './fixtures.ts';

const meta = {
  title: 'Book/VerbLine',
  component: VerbLine,
  args: { b: button('Rest by the fire'), press: fn() },
} satisfies Meta<typeof VerbLine>;
export default meta;
type Story = StoryObj<typeof meta>;

// Breaks: the verb line is not a button, or a press loses its Button.
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

// Pass-1 R2: a refused place action follows the available verb lines as a `label: reason` note.
// Breaks: a refused line becomes a button (only the available verb presses), or loses its reason.
export const WithRefused: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Rest by the fire',
    ]);
    await expect(canvas.getByText('Chop wood: more than you can carry')).toBeVisible();
  },
  render: (args) => (
    <View>
      <VerbLine b={button('Rest by the fire')} press={args.press} />
      <ActionCard label="Chop wood" reason="more than you can carry" />
      <ActionCard label="Fish in" reason="not yet" />
    </View>
  ),
};
