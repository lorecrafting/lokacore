// System/Checks (docs page: SystemChecks.mdx).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect } from 'storybook/test';
import { PaletteContext } from '../book/palette.ts';
import { color } from '../book/tokens.ts';
import { Checks } from './system/Checks.tsx';

const meta = { title: 'System/Checks', component: Checks } satisfies Meta<typeof Checks>;
export default meta;
type Story = StoryObj<typeof meta>;

// Breaks: a check's name and text swapped or split at the wrong colon (docs/CHECKS.md: credo's
// limits follow its command).
export const Page: Story = {
  play: async ({ canvas }) => {
    const credo = canvas.getByRole('rowheader', { name: 'mix credo --strict' });
    await expect(credo.nextElementSibling).toHaveTextContent(/^cyclomatic complexity 9, nesting 2/);
  },
};

// Axe on the night palette.
export const Dark: Story = {
  render: () => (
    <PaletteContext value={color.dark}>
      <Checks />
    </PaletteContext>
  ),
};
