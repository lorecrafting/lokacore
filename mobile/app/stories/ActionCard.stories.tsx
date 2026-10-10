// ActionCard: a detail page's offered action or dialogue choice (BOOK-UI-COMPONENTS.md, Action card).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { ComponentProps, ReactElement } from 'react';
import { expect, fn } from 'storybook/test';
import { ActionCard, Cards } from '../book/actions.tsx';
import { button } from './fixtures.ts';

// The args are the offered form's; the unavailable form (label, reason) is drawn by its own story.
type Offered = Extract<ComponentProps<typeof ActionCard>, { b: unknown }>;

const meta = {
  title: 'Book/ActionCard',
  component: ActionCard as (p: Offered) => ReactElement,
  args: { b: button('Ask about the ferry'), press: fn() },
} satisfies Meta<Offered>;
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

// Breaks: the unavailable form is pressable, or loses its label or reason.
export const WithUnavailableNote: Story = {
  render: (args) => (
    <Cards>
      <ActionCard {...args} />
      <ActionCard label="Buy a lantern" reason="sold out" />
    </Cards>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Buy a lantern: sold out')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /Buy a lantern/ })).toBeNull();
  },
};
