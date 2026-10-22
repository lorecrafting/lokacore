// Note: a dim body line that is not pressable (Note's doc comment).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Note } from '../book/lines.tsx';

const meta = {
  title: 'Book/Note',
  component: Note,
  args: { children: 'Nothing to do here.' },
} satisfies Meta<typeof Note>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyState: Story = {};

export const SaveNotConfirmed: Story = { args: { children: 'save not confirmed' } };
