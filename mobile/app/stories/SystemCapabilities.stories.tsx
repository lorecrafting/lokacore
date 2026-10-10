// System/Capabilities (docs page: SystemCapabilities.mdx).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Capabilities } from './system/Capabilities.tsx';

const meta = { title: 'System/Capabilities', component: Capabilities } satisfies Meta<
  typeof Capabilities
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Page: Story = {};
