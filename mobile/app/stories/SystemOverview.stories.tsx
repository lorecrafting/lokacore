// System/Overview (docs page: SystemOverview.mdx).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { PaletteContext } from '../book/palette.ts';
import { color } from '../book/tokens.ts';
import { Overview } from './system/Overview.tsx';

const meta = { title: 'System/Overview', component: Overview } satisfies Meta<typeof Overview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Page: Story = {};

// Axe on the night palette (the smoke runs the toolbar's light one; a story-level palette global
// would lock the toolbar, stories.test.ts).
export const Dark: Story = {
  render: () => (
    <PaletteContext value={color.dark}>
      <Overview />
    </PaletteContext>
  ),
};
