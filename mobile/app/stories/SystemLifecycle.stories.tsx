// System/Command lifecycle (docs page: SystemLifecycle.mdx).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, userEvent, within } from 'storybook/test';
import { PaletteContext } from '../book/palette.ts';
import { color } from '../book/tokens.ts';
import { Lifecycle } from './system/Lifecycle.tsx';

const meta = { title: 'System/Command lifecycle', component: Lifecycle } satisfies Meta<
  typeof Lifecycle
>;
export default meta;
type Story = StoryObj<typeof meta>;

// Breaks: a stage that opens the wrong node, a GameError branch on a stage that cannot fail (only
// DecisionResult references GameError), or the command picker showing another capability.
export const Page: Story = {
  play: async ({ canvas }) => {
    const stages = within(canvas.getByRole('list', { name: 'Command lifecycle' }));
    const decision = stages.getByRole('link', { name: 'DecisionResult' });
    await expect(decision.getAttribute('href')).toMatch(
      /\?path=\/docs\/system-data-model--docs&globals=node:DecisionResult$/,
    );
    const failing = stages.getAllByRole('link', { name: 'GameError' });
    await expect(failing.map((a) => a.closest('li')!.firstElementChild!.textContent)).toEqual([
      'DecisionResult',
    ]);
    await userEvent.selectOptions(
      canvas.getByRole('combobox', { name: 'Trace a command' }),
      'scan',
    );
    await expect(
      canvas.getByText('owner movement@1 · events entity_entered_room · definitions room'),
    ).toBeVisible();
  },
};

// Axe on the night palette (the lane rules, the error branch).
export const Dark: Story = {
  render: () => (
    <PaletteContext value={color.dark}>
      <Lifecycle />
    </PaletteContext>
  ),
};
