// System/Beads (docs page: SystemBeads.mdx).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, userEvent, within } from 'storybook/test';
import { PaletteContext } from '../book/palette.ts';
import { color } from '../book/tokens.ts';
import { Beads } from './system/Beads.tsx';
import { issues } from './system/issues.ts';

const meta = { title: 'System/Beads', component: Beads } satisfies Meta<typeof Beads>;
export default meta;
type Story = StoryObj<typeof meta>;

// Breaks: the status filter ignored, or a blocking dependency not shown. The issue is picked from
// the loaded export: the first closed one that has a blocker.
export const Page: Story = {
  play: async ({ canvas }) => {
    const closed = issues.find(
      (i) => i.status === 'closed' && i.dependencies?.some((d) => d.type === 'blocks'),
    )!;
    const blockers = closed
      .dependencies!.filter((d) => d.type === 'blocks')
      .map((d) => d.depends_on_id);
    const table = within(canvas.getByRole('table', { name: 'Beads issues' }));
    const row = table.getByRole('rowheader', { name: closed.id }).parentElement!;
    await expect(row.lastElementChild).toHaveTextContent(blockers.join(', '));
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Status' }), 'open');
    await expect(table.queryByRole('rowheader', { name: closed.id })).toBeNull();
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Status' }), 'closed');
    await expect(table.getByRole('rowheader', { name: closed.id })).toBeVisible();
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
