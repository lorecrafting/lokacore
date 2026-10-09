// ActionCard: a detail page's offered action or dialogue choice (BOOK-UI-COMPONENTS.md, Action card).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Text, View } from 'react-native';
import { expect, fn } from 'storybook/test';
import { ActionCard, Cards } from '../book/actions.tsx';
import { note, usePalette } from '../book/palette.ts';
import { button } from './fixtures.ts';

const meta = {
  title: 'Book/ActionCard',
  component: ActionCard,
  args: { b: button('Ask about the ferry'), press: fn() },
} satisfies Meta<typeof ActionCard>;
export default meta;
type Story = StoryObj<typeof meta>;

// Breaks: the card is not a button, or a press loses its Button (the offer's token and input).
export const Short: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Ask about the ferry' }));
    await expect(args.press).toHaveBeenCalledWith(args.b);
  },
};

export const TwoLineLabel: Story = {
  args: {
    b: button('Ask Bram the ferryman whether the causeway will be passable before nightfall'),
  },
};

const six = ['Take', 'Drop', 'Light', 'Extinguish', 'Fill', 'Pour out'];
export const ListOfSix: Story = {
  render: (args) => (
    <Cards>
      {six.map((label) => (
        <ActionCard key={label} b={button(label)} press={args.press} />
      ))}
    </Cards>
  ),
};

export const WithUnavailableNote: Story = {
  render: function Render(args) {
    return (
      <View>
        <ActionCard {...args} />
        <Text style={note(usePalette())}>Buy a lantern: sold out</Text>
      </View>
    );
  },
};
