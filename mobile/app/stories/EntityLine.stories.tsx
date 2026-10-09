// EntityLine: a row that opens a detail (BOOK-UI-COMPONENTS.md, Entity line).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { expect, fn } from 'storybook/test';
import { EntityLine } from '../book/lines.tsx';
import { size, space, type } from '../book/tokens.ts';

const meta = {
  title: 'Book/EntityLine',
  component: EntityLine,
  args: {
    name: 'Bram the ferryman',
    rest: ' is here.',
    note: 'He carries a long pole.',
    onPress: fn(),
  },
} satisfies Meta<typeof EntityLine>;
export default meta;
type Story = StoryObj<typeof meta>;

// Breaks: the whole line is not one button whose name leads with its shown text (name, rest, note)
// then ", open", or a press is dropped.
export const NpcWithCarriedNote: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const name = 'Bram the ferryman is here. He carries a long pole., open';
    await userEvent.click(canvas.getByRole('button', { name }));
    await expect(args.onPress).toHaveBeenCalledTimes(1);
  },
};

export const Item: Story = {
  args: { name: 'A brass lantern', note: undefined },
};

export const Held: Story = {
  args: {
    name: 'a brass lantern',
    rest: undefined,
    note: undefined,
  },
};

export const Worn: Story = {
  args: { name: 'a wool cloak', rest: undefined, note: undefined },
};

export const Inside: Story = {
  args: {
    name: 'A tallow candle',
    rest: undefined,
    note: undefined,
  },
};

export const NoticeWithRemainingCount: Story = {
  args: { name: 'Ferry passage', rest: ' (3)', note: undefined },
};

export const ContentsRow: Story = {
  args: { name: 'Character', rest: undefined, note: undefined },
};

// A run of touching lines, as in Here. Breaks: the bleed shows as space (pitch over the body
// line) or the note line's bleed is lost. Also pins line 2's 44 box and its overlap tap.
export const Run: Story = {
  render: (args) => (
    <View>
      <EntityLine name="Bram the ferryman" rest=" is here." onPress={fn()} />
      <EntityLine name="Elspeth" rest=" is here." onPress={args.onPress} />
      <EntityLine name="A brass lantern" rest=" lies here." note="It is unlit." onPress={fn()} />
    </View>
  ),
  play: async ({ canvas, args, userEvent }) => {
    const [first, second, third] = canvas.getAllByRole('button');
    const box = (e: Element) => e.getBoundingClientRect();
    await expect(box(second).height).toBe(size.touch);
    const textTop = (e: Element) => box(e.firstElementChild!).top;
    await expect(textTop(second) - textTop(first)).toBe(type.body.lineHeight);
    await expect(box(third).height).toBe(2 * type.body.lineHeight + 2 * space.md);
    const edge = document.elementFromPoint(box(second).left + 4, box(second).top + 4);
    await expect(edge?.closest('[role=button]')).toBe(second);
    await userEvent.click(edge!);
    await expect(args.onPress).toHaveBeenCalledTimes(1);
  },
};
