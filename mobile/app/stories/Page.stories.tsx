// Page with its running head, composed as Body.tsx draws it: RunningHead above the Sheet shell.
// Journal texts are Chapter 1's own (protocol/fixtures/missing_child_v042_hash.json).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { expect } from 'storybook/test';
import type { GameView } from '../../packages/game-view/session.ts';
import { Control, RunningHead, Sheet } from '../book/pages.tsx';

type Quest = Pick<GameView['journal'][number], 'state' | 'journal'>;
const say = (k: string) => k;

function Page({ journal }: { journal: Quest[] }) {
  return (
    <View style={{ flex: 1 }}>
      <RunningHead view={{ journal } as unknown as GameView} text={say} />
      <Sheet title="Settings">
        <Control label="Start over" onPress={() => {}} />
      </Sheet>
    </View>
  );
}

const meta = { title: 'Book/Page', component: Page } satisfies Meta<typeof Page>;
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
