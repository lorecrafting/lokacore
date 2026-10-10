// System/Toolbox (docs page: SystemToolbox.mdx).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, userEvent, within } from 'storybook/test';
import { PaletteContext } from '../book/palette.ts';
import { color } from '../book/tokens.ts';
import { Toolbox } from './system/Toolbox.tsx';

const meta = { title: 'System/Toolbox', component: Toolbox } satisfies Meta<typeof Toolbox>;
export default meta;
type Story = StoryObj<typeof meta>;

// Breaks: a filter ignored, or both filters not applied together; an installed row with no link
// to its mechanics.md rules. docs/MECHANICS-TOOLBOX.md: batch M2 is rows 3 and 4, both done.
export const Page: Story = {
  play: async ({ canvas }) => {
    const table = within(canvas.getByRole('table', { name: 'Toolbox rows' }));
    const ids = () => table.queryAllByRole('rowheader').map((h) => h.textContent);
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Batch' }), 'M2');
    await expect(ids()).toEqual(['3', '4']);
    await expect(
      within(table.getByRole('rowheader', { name: '3' }).parentElement!).getByRole('link', {
        name: 'rules',
      }),
    ).toHaveAttribute(
      'href',
      expect.stringMatching(/mechanics\.md#item-slots-and-affects-toolbox-row-3$/),
    );
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Status' }), 'todo');
    await expect(ids()).toEqual([]);
  },
};

// Axe on the night palette.
export const Dark: Story = {
  render: () => (
    <PaletteContext value={color.dark}>
      <Toolbox />
    </PaletteContext>
  ),
};
