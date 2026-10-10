// System/Overview (docs page: SystemOverview.mdx), in the light and dark palettes for the a11y checks.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Overview } from './system/Overview.tsx';

const meta = { title: 'System/Overview', component: Overview } satisfies Meta<typeof Overview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { palette: 'dark' } };
