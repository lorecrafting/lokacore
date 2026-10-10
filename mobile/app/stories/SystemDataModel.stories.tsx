// System/Data model (docs page: SystemDataModel.mdx). The `node` and `layer` globals carry the
// selection and the layer filter in the URL (preview.tsx globalTypes).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useGlobals } from 'storybook/preview-api';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { PaletteContext } from '../book/palette.ts';
import { color } from '../book/tokens.ts';
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
    await expect(panel.getByRole('link', { name: '04 §5.1' })).toHaveAttribute(
      'href',
      expect.stringMatching(
        /\/04-command-event-effect-protocol\.md#51-proposal-state-semantics-and-statedelta-composition$/,
      ),
    );
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

// n-hop focus: BleedRow is two edges from StatusRow (through DeltaOp), so it is dimmed at one hop
// and lit at two, and the lines reach past the first ring.
export const TwoHops: Story = {
  globals: { node: 'StatusRow' },
  play: async ({ canvas, canvasElement }) => {
    const bleed = canvas.getByRole('button', { name: 'BleedRow' });
    await expect(bleed).toHaveStyle({ color: color.light.dim });
    const one = canvasElement.querySelectorAll('svg line').length;
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Hops' }), '2');
    await expect(bleed).toHaveStyle({ color: color.light.fg });
    const lines = [...canvasElement.querySelectorAll('svg line')];
    await expect(lines.length).toBeGreaterThan(one);
    // Real edges only: no line joins the selection to a chip two hops out (not an edge).
    const origin = canvasElement.querySelector('svg')!.getBoundingClientRect();
    const mid = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2 - origin.left, r.top + r.height / 2 - origin.top];
    };
    const [s, b] = [mid(canvas.getByRole('button', { name: 'StatusRow' })), mid(bleed)];
    const joins = lines.filter((l) => {
      const p = ['x1', 'y1', 'x2', 'y2'].map((k) => Number(l.getAttribute(k)));
      const near = (x: number, y: number, c: number[]) => Math.hypot(x - c[0], y - c[1]) < 2;
      return near(p[0], p[1], s) && near(p[2], p[3], b);
    });
    await expect(joins).toHaveLength(0);
  },
};

// The impact view: FactType's reverse closure (read off the schemas by hand) by layer, and the
// README fixtures of the files involved (cartridge.schema.json's; fact.schema.json lists none).
export const Impact: Story = {
  globals: { node: 'FactType' },
  play: async ({ canvas }) => {
    const panel = within(canvas.getByRole('complementary', { name: 'Detail' }));
    await userEvent.click(panel.getByText('Impact (3)'));
    const group = (layer: string) =>
      within(panel.getByText(`${layer}:`).closest('p')!)
        .getAllByRole('button')
        .map((b) => b.textContent);
    await expect(group('Content')).toEqual(['CartridgeArtifact', 'CompiledCartridge']);
    await expect(group('State')).toEqual(['FactSpec']);
    const fixtures = panel.getByText('Fixtures:').closest('p')!;
    await expect(
      within(fixtures)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual([
      'cartridge_hash.json',
      'cartridge_rooms_hash.json',
      'cartridge_ferry_hash.json',
      'cartridge_lantern_hash.json',
      'cartridge_loader.json',
    ]);
  },
};

// Path finding (hand-read: StateDelta.ops is DeltaOp, status.transition's value is StatusRow; nothing
// StateDelta reaches references Command). Breaks: an edge walked backwards, the chain reversed or
// cut short, or a missing path shown as a chain.
export const PathTo: Story = {
  globals: { node: 'StateDelta' },
  play: async ({ canvas }) => {
    const panel = within(canvas.getByRole('complementary', { name: 'Detail' }));
    const to = panel.getByRole('combobox', { name: 'Path to' });
    await userEvent.type(to, 'StatusRow');
    const chain = within(panel.getByLabelText('Path')).getAllByRole('button');
    await expect(chain.map((b) => b.textContent)).toEqual(['StateDelta', 'DeltaOp', 'StatusRow']);
    await userEvent.clear(to);
    await userEvent.type(to, 'Command');
    await expect(panel.getByText('No reference path from StateDelta to Command.')).toBeVisible();
  },
};

// Saved in (status.transition writes StatusRow into the statuses section) and the authored files of
// the cartridge map holding RoomDefinition. Breaks: the line or the list dropped from the panel.
export const Homes: Story = {
  globals: { node: 'StatusRow' },
  play: async ({ canvas }) => {
    const panel = () => within(canvas.getByRole('complementary', { name: 'Detail' }));
    await expect(panel().getByText(/^Saved in:/)).toHaveTextContent(
      'Saved in: state_row › statuses',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'RoomDefinition' }));
    await userEvent.click(panel().getByText(/^Authored in cartridges \(\d+\)$/));
    await expect(
      panel().getByRole('link', { name: 'cartridges/ashmere_rooms/rooms/boathouse.json' }),
    ).toBeVisible();
  },
};

// Browser history: Back after a pick reselects the contract before it. Breaks: a pick that adds no
// history entry, or a popstate that leaves the selection where it was.
export const History: Story = {
  globals: { node: 'StateDelta' },
  play: async ({ canvas }) => {
    const panel = within(canvas.getByRole('complementary', { name: 'Detail' }));
    await userEvent.click(panel.getAllByRole('button', { name: 'DeltaOp' })[0]);
    const pressed = (name: string) =>
      expect(canvas.getByRole('button', { name, pressed: true })).toBeVisible();
    await waitFor(() => pressed('DeltaOp'));
    history.back();
    await waitFor(() => pressed('StateDelta'));
  },
};

// Axe on the night palette with a selection (dimmed chips, lines, the panel).
export const Dark: Story = {
  render: () => (
    <PaletteContext value={color.dark}>
      <DataModel node="StatusRow" />
    </PaletteContext>
  ),
};
