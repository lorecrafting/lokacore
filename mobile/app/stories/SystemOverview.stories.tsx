// System/Overview (docs page: SystemOverview.mdx).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Overview } from './system/Overview.tsx';

const meta = { title: 'System/Overview', component: Overview } satisfies Meta<typeof Overview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Page: Story = {};
