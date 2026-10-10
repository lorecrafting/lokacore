// System/Save (docs page: SystemSave.mdx).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Save } from './system/Save.tsx';

const meta = { title: 'System/Save', component: Save } satisfies Meta<typeof Save>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Page: Story = {};
