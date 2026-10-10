// System/Data model (docs page: SystemDataModel.mdx). The `node` and `layer` globals carry the
// selection and the layer filter in the URL (preview.tsx globalTypes).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useGlobals } from 'storybook/preview-api';
import { expect, userEvent, within } from 'storybook/test';
import { DataModel } from './system/DataModel.tsx';

const meta = {
  title: 'System/Data model',
  render: (_, { globals }) => {
    const [, update] = useGlobals();
    return <DataModel node={globals.node} layer={globals.layer} onSelect={update} />;
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Page: Story = {};

// Acceptance 5 and 6: a node global (as a deep link sets it) opens that contract.
export const Selected: Story = {
  globals: { node: 'StateDelta' },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('button', { name: 'StateDelta' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const panel = within(canvas.getByRole('complementary', { name: 'Detail' }));
    await expect(panel.getByRole('heading', { name: 'StateDelta' })).toBeVisible();
    const ops = within(panel.getByRole('row', { name: /^ops/ }));
    await expect(ops.getByText('required')).toBeVisible();
    await expect(ops.getByText(/character\.select, fact\.assign/)).toBeVisible();
    await expect(panel.getByText(/owner foundation/)).toBeVisible();
    const source = panel.getByRole('link', { name: /^protocol\/delta\.schema\.json:\d+$/ });
    await expect(source.getAttribute('href')).toMatch(
      new RegExp(`#L${source.textContent!.split(':')[1]}$`),
    );
    await expect(
      panel.getByRole('link', { name: '04-command-event-effect-protocol.md' }),
    ).toBeVisible();
    // One edge per neighbour: DeltaOp, which it references, and the contracts that use it.
    const neighbours = panel.getAllByRole('button').map((b) => b.textContent);
    await expect(neighbours).toContain('DeltaOp');
    await expect(canvasElement.querySelectorAll('svg line').length).toBe(new Set(neighbours).size);
  },
};

// Acceptance 5: an optional field carries no required mark (UnavailableReason.message).
export const OptionalField: Story = {
  globals: { node: 'UnavailableReason' },
  play: async ({ canvas }) => {
    const panel = within(canvas.getByRole('complementary', { name: 'Detail' }));
    const message = within(panel.getByRole('row', { name: /^message/ }));
    await expect(message.queryByText('required')).toBeNull();
  },
};

// The Owner and Kind filters: unowned contracts count as foundation; a oneOf or anyOf is a union.
export const Filters: Story = {
  play: async ({ canvas }) => {
    const owner = canvas.getByRole('combobox', { name: 'Owner' });
    await userEvent.selectOptions(owner, 'foundation');
    await expect(canvas.getByRole('button', { name: 'StateDelta' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'ResourceSpec' })).toBeNull();
    await userEvent.selectOptions(owner, 'all');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Kind' }), 'union');
    await expect(canvas.getByRole('button', { name: 'TextValue' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'StateDelta' })).toBeNull();
  },
};

// Acceptance 7 and keyboard use: search by a field word, the Save layer's tables, arrows, Escape.
export const SearchAndKeys: Story = {
  play: async ({ canvas }) => {
    await userEvent.keyboard('/');
    const search = canvas.getByRole('searchbox', { name: 'Search' });
    await expect(search).toHaveFocus();
    await userEvent.type(search, 'hp');
    const resource = canvas.getByRole('heading', { name: 'resource@1' }).parentElement!;
    await expect(within(resource).getByRole('button', { name: 'ResourceSpec' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'StateDelta' })).toBeNull();

    await userEvent.clear(search);
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Layer' }), 'Save');
    const save = within(canvas.getByRole('region', { name: 'Save' }));
    await expect(save.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'head',
      'state_row',
      'receipt',
      'save',
      'report',
      'trace',
      'observation',
    ]);
    await expect(canvas.queryByRole('region', { name: 'Content' })).toBeNull();

    save.getByRole('button', { name: 'head' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(save.getByRole('button', { name: 'state_row' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(save.getByRole('button', { name: 'head' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('complementary', { name: 'Detail' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect(canvas.queryByRole('complementary', { name: 'Detail' })).toBeNull();
  },
};
