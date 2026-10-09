// Page: one shell for every page (BOOK-UI-COMPONENTS.md, Page); RunningHead above it, as Body.tsx
// draws it. Journal texts are Chapter 1's own (protocol/fixtures/missing_child_v042_hash.json).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';
import { expect, fn, waitFor } from 'storybook/test';
import type { GameView } from '../../packages/game-view/session.ts';
import { ContinueButton } from '../book/actions.tsx';
import { EntityLine, LogLines } from '../book/lines.tsx';
import { Control, Page, RunningHead, SectionTitle } from '../book/pages.tsx';
import { prose, usePalette } from '../book/palette.ts';

type Quest = Pick<GameView['journal'][number], 'state' | 'journal'>;
const say = (k: string) => k;

// A phone-high frame, so the page scrolls inside itself as on a device.
function Framed(p: ComponentProps<typeof Page> & { journal?: Quest[] }) {
  return (
    <View style={{ height: '100vh' as never }}>
      {p.journal && <RunningHead view={{ journal: p.journal } as unknown as GameView} text={say} />}
      <Page {...p} />
    </View>
  );
}

function Prose({ lines }: { lines: number }) {
  const c = usePalette();
  return Array.from({ length: lines }, (_, i) => (
    <Text key={i} style={prose(c)}>
      {`Line ${i + 1} of the long description.`}
    </Text>
  ));
}

// In the page's own viewport (toBeVisible ignores scrolling).
const inView = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= window.innerHeight;
};

const back = <Control label="Back to World" onPress={() => {}} />;
const meta = {
  title: 'Book/Page',
  component: Framed,
  args: {
    title: 'Settings',
    foot: back,
    children: <Control label="Start over" onPress={() => {}} />,
  },
} satisfies Meta<typeof Framed>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithRunningHead: Story = {
  args: {
    journal: [
      { state: 'resolved', journal: 'quest.bell.prior' },
      {
        state: 'active',
        journal: 'Climb from Chapel Nave through Bell Tower to the Belfry and ring the bell.',
      },
    ] as Quest[],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/^Climb from Chapel Nave/)).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Settings' })).toBeVisible();
  },
};

export const LongRunningHead: Story = {
  args: {
    journal: [
      {
        state: 'objectives_complete',
        journal:
          'Carry Peg’s ledger directly to Aldric at the Chapel Nave before the third day at six. Payment is due only by the second day at six.',
      },
    ] as Quest[],
  },
};

export const NoRunningHead: Story = {
  args: { journal: [{ state: 'resolved', journal: 'quest.bell.prior' }] as Quest[] },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText('quest.bell.prior')).toBeNull();
  },
};

// Breaks: a section heading is not a header (SectionTitle loses its role).
export const WithSectionHeadings: Story = {
  args: {
    title: 'Equipment & Inventory',
    children: (
      <>
        <SectionTitle>Held</SectionTitle>
        <View>
          <EntityLine name="a torch" onPress={() => {}} />
          <EntityLine name="a wool cloak" onPress={() => {}} />
        </View>
        <SectionTitle>Worn</SectionTitle>
        <EntityLine name="a leather cap" onPress={() => {}} />
      </>
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Held' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Worn' })).toBeVisible();
  },
};

// Breaks: a long authored title loses its header role.
export const LongTitle: Story = {
  args: { title: 'The Ferryman’s Notice of Passage across the Flooded Causeway at Low Water' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: /^The Ferryman’s Notice/ })).toBeVisible();
  },
};

// Breaks: the room title scrolls away with the content, or loses its Look tap.
export const FixedTitle: Story = {
  args: {
    title: 'Chapel Nave',
    fixedTitle: true,
    onTitlePress: fn(),
    foot: undefined,
    // An openable line: a scroll with nothing focusable fails axe (scrollable-region-focusable).
    children: (
      <>
        <Prose lines={40} />
        <EntityLine name="Old Bram" rest=" is here." onPress={() => {}} />
      </>
    ),
  },
  play: async ({ canvas, args, userEvent }) => {
    const look = canvas.getByRole('button', { name: 'Chapel Nave, look' });
    const last = canvas.getByText('Line 40 of the long description.');
    last.scrollIntoView();
    await waitFor(() => expect(inView(last)).toBe(true));
    await expect(inView(look)).toBe(true);
    await userEvent.click(look);
    await expect(args.onTitlePress).toHaveBeenCalledTimes(1);
  },
};

// Breaks: an untitled page (a scene) draws an empty header.
export const NoTitle: Story = {
  args: {
    title: undefined,
    foot: undefined,
    children: (
      <>
        <Text>The bell rings once, and the nave falls silent.</Text>
        <ContinueButton label="Continue" onPress={() => {}} />
      </>
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('heading')).toBeNull();
  },
};

// Breaks: a growing dialogue page stays at its top, hiding the latest line.
export const ScrollToEnd: Story = {
  args: {
    title: 'Old Bram',
    scrollToEnd: true,
    foot: <Control label="Leave" onPress={() => {}} />,
    children: <LogLines lines={Array.from({ length: 30 }, (_, i) => `Bram says line ${i + 1}.`)} />,
  },
  play: async ({ canvas }) => {
    const last = canvas.getByText('Bram says line 30.');
    await waitFor(() => expect(inView(last)).toBe(true));
  },
};

// Breaks: Page drops its foot, so the page loses its return.
const leave = fn();
export const WithFoot: Story = {
  args: { title: 'Old Bram', foot: <Control label="Leave" onPress={leave} /> },
  play: async ({ canvas, userEvent }) => {
    leave.mockClear(); // a module spy: Storybook resets only top-level arg spies
    await userEvent.click(canvas.getByRole('button', { name: 'Leave' }));
    await expect(leave).toHaveBeenCalledTimes(1);
  },
};
