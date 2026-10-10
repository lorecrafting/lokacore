// System/Save (docs page: SystemSave.mdx).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, within } from 'storybook/test';
import { PaletteContext } from '../book/palette.ts';
import { color } from '../book/tokens.ts';
import { Save } from './system/Save.tsx';

const meta = { title: 'System/Save', component: Save } satisfies Meta<typeof Save>;
export default meta;
type Story = StoryObj<typeof meta>;

// state_row lists the State sections with the MutationTarget kinds each keeps (a status is saved
// in `statuses`; an entity's creation in `created`).
export const Page: Story = {
  play: async ({ canvas }) => {
    const sections = within(canvas.getByRole('list', { name: 'State sections' }));
    await expect(sections.getByText('statuses').parentElement).toHaveTextContent(
      'statuses ← status',
    );
    await expect(sections.getByText('created').parentElement).toHaveTextContent('created ← entity');
  },
};

// Axe on the night palette (the smoke runs the toolbar's light one; a story-level palette global
// would lock the toolbar, stories.test.ts).
export const Dark: Story = {
  render: () => (
    <PaletteContext value={color.dark}>
      <Save />
    </PaletteContext>
  ),
};
