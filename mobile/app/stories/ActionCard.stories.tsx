// ActionCard: a detail page's offered action or dialogue choice (ActionCard's doc comment).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { ComponentProps, ReactElement } from 'react';
import { expect, fn, waitFor } from 'storybook/test';
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

// Breaks: an already asked option stops answering the press instead of only dimming, or the name stops saying so.
export const Asked: Story = {
  args: { asked: true },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Ask about the ferry, already chosen' }),
    );
    await expect(args.press).toHaveBeenCalledOnce();
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

// Breaks: the unavailable card reads `label: reason`, is not exposed as disabled, or a press
// does not gray it and show its reason as one sentence (book-ui.md, Unavailable actions).
export const Unavailable: Story = {
  render: (args) => (
    <Cards>
      <ActionCard {...args} />
      <ActionCard label="Buy a lantern" reason="sold out" />
    </Cards>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const card = canvas.getByRole('button', { name: 'Buy a lantern' });
    await expect(card).toHaveAttribute('aria-disabled', 'true');
    await expect(card).toHaveTextContent(/^Buy a lantern$/);
    await userEvent.click(card);
    await waitFor(() => expect(card).toHaveTextContent(/^Buy a lantern\s+It's sold out\.$/));
    await expect(canvasElement.querySelector('[aria-live]')).toHaveTextContent("It's sold out.");
    await expect(card).toHaveAccessibleName(/^Buy a lantern\s+It's sold out\.$/);
  },
};
