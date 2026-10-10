// System/Beads (docs page: SystemBeads.mdx).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, userEvent, within } from 'storybook/test';
import { PaletteContext } from '../book/palette.ts';
import { color } from '../book/tokens.ts';
import { Beads } from './system/Beads.tsx';

const meta = { title: 'System/Beads', component: Beads } satisfies Meta<typeof Beads>;
export default meta;
type Story = StoryObj<typeof meta>;

// Breaks: the status filter ignored, or a blocking dependency not shown. In the export loka-4xk
// (closed) depends on loka-hs9.
export const Page: Story = {
  play: async ({ canvas }) => {
    const table = within(canvas.getByRole('table', { name: 'Beads issues' }));
    const rc = table.getByRole('rowheader', { name: 'loka-4xk' }).parentElement!;
    await expect(rc.lastElementChild).toHaveTextContent('loka-hs9');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Status' }), 'open');
    await expect(table.queryByRole('rowheader', { name: 'loka-4xk' })).toBeNull();
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Status' }), 'closed');
    await expect(table.getByRole('rowheader', { name: 'loka-4xk' })).toBeVisible();
  },
};

// Axe on the night palette.
export const Dark: Story = {
  render: () => (
    <PaletteContext value={color.dark}>
      <Beads />
    </PaletteContext>
  ),
};
