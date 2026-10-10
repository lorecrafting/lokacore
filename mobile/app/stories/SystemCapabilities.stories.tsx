// System/Capabilities (docs page: SystemCapabilities.mdx), in the light and dark palettes for the a11y checks.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Capabilities } from './system/Capabilities.tsx';

const meta = { title: 'System/Capabilities', component: Capabilities } satisfies Meta<
  typeof Capabilities
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { palette: 'dark' } };
