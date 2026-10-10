// System/Save (docs page: SystemSave.mdx), in the light and dark palettes for the a11y checks.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Save } from './system/Save.tsx';

const meta = { title: 'System/Save', component: Save } satisfies Meta<typeof Save>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = { globals: { palette: 'dark' } };
