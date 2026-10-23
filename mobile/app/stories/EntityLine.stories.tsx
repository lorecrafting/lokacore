// EntityLine: a row that opens a detail (EntityLine's doc comment).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { expect, fn } from 'storybook/test';
import { EntityLine } from '../book/lines.tsx';
import { size } from '../book/tokens.ts';

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

// Breaks: a note under a bare name (no `rest`) shows text its name does not read; the axe run (label-content-name-mismatch) fails.
export const ItemWithNote: Story = {
  args: { name: 'A brass lantern', rest: undefined, note: 'It is unlit.' },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('button', { name: 'A brass lantern It is unlit., open' }),
    ).toBeVisible();
  },
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
      <EntityLine name="Nell" rest=" is here." onPress={args.onPress} />
      <EntityLine name="A brass lantern" rest=" lies here." note="It is unlit." onPress={fn()} />
    </View>
  ),
  play: async ({ canvas, args, userEvent, globals }) => {
    // Per Reading size: type.body's line height (28 x 1, 1.15, 1.3, 1.5, rounded) and the note
    // line's box (two lines plus Tap's bleed, which tops one line up to 44).
    const sizes: Record<string, [number, number]> = {
      Standard: [28, 72],
      Large: [32, 76],
      Larger: [36, 80],
      Max: [42, 86],
    };
    const [line, two] = sizes[globals.reading as string]!; // preview's initialGlobals always sets reading
    const [first, second, third] = canvas.getAllByRole('button');
    const box = (e: Element) => e.getBoundingClientRect();
    await expect(box(second).height).toBe(size.touch);
    const textTop = (e: Element) => box(e.firstElementChild!).top;
    await expect(textTop(second) - textTop(first)).toBe(line);
    await expect(box(third).height).toBe(two);
    const edge = document.elementFromPoint(box(second).left + 4, box(second).top + 4);
    await expect(edge?.closest('[role=button]')).toBe(second);
    await userEvent.click(edge!);
    await expect(args.onPress).toHaveBeenCalledTimes(1);
  },
};
