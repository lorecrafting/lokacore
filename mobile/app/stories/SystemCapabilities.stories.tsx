// System/Capabilities (docs page: SystemCapabilities.mdx).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { PaletteContext } from '../book/palette.ts';
import { color } from '../book/tokens.ts';
import { Capabilities } from './system/Capabilities.tsx';

const meta = { title: 'System/Capabilities', component: Capabilities } satisfies Meta<
  typeof Capabilities
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Page: Story = {};

// Axe on the night palette (the smoke runs the toolbar's light one; a story-level palette global
// would lock the toolbar, stories.test.ts).
export const Dark: Story = {
  render: () => (
    <PaletteContext value={color.dark}>
      <Capabilities />
    </PaletteContext>
  ),
};
