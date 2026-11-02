// LevelWash: the paper's wash when a level lands (LevelWash's doc comment); neutral text, the ink above it.
// Flashes off and reduced motion: level_wash.test.ts holds them.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { expect, waitFor } from 'storybook/test';
import type { GameView } from '../../packages/game-view/session.ts';
import { onCue, useCues, type Cue } from '../book/cues.ts';
import { LevelWash } from '../book/LevelWash.tsx';
import { Control, Page } from '../book/pages.tsx';
import { size } from '../book/tokens.ts';

// In a fight, the wolf stands; out of one, it fell.
const at = (level: number, fight?: boolean) =>
  ({
    place: { id: 'p' },
    entities: fight ? [{ id: 'wolf' }] : [],
    ...(fight && { combat: { opponent_id: 'wolf' } }),
    journal: [],
    inventory: [],
    resources: [],
    levelling: { level, experience: 0, from: 0, next: 100, unspent: 0, level_up: 'level_up' },
  }) as unknown as GameView;
function Levels(p: { paperless?: boolean; fight?: boolean }) {
  const [view, setView] = useState(() => at(1, p.fight));
  useCues(view, false, 0);
  return (
    <div style={{ display: 'flex', maxWidth: size.column, height: size.column }}>
      <Page
        paperless={p.paperless}
        title="Title"
        foot={<Control label="Continue" onPress={() => setView(at(view.levelling!.level + 1))} />}
      >
        {null}
      </Page>
    </div>
  );
}

const meta = { title: 'Book/LevelWash', component: LevelWash } satisfies Meta<typeof LevelWash>;
export default meta;
type Story = StoryObj<typeof meta>;

const press: Story['play'] = async ({ canvas, canvasElement, userEvent }) => {
  const paper = canvasElement.querySelector<HTMLElement>('[aria-hidden="true"]')!;
  await expect(Number(getComputedStyle(paper).opacity)).toBe(0);
  await userEvent.click(canvas.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(Number(getComputedStyle(paper).opacity)).toBeGreaterThan(0.1));
  // Breaks: the wash takes touches, or swells the page.
  await expect(getComputedStyle(paper).pointerEvents).toBe('none');
  await waitFor(() => expect(Number(getComputedStyle(paper).opacity)).toBe(0), { timeout: 2000 });
};
export const OnPaper: Story = { render: () => <Levels />, play: press };
export const OverCombat: Story = { render: () => <Levels paperless />, play: press };
// Breaks: the kill's fight-won pulse and fanfare take the level's moment (book-ui.md, Level wash):
// the close must say it levelled, so cueSounds holds the fanfare and leaves the haptic to the level.
export const KillThatLevels: Story = {
  render: () => <Levels paperless fight />,
  play: async (ctx) => {
    const heard: Cue[] = [];
    const off = onCue((cue) => void heard.push(cue));
    try {
      await press(ctx);
    } finally {
      off();
    }
    await expect(heard.map((c) => c.name)).toEqual(['combat_close', 'level']);
    await expect(heard[0]).toMatchObject({ end: 'fell', levelled: true });
    await expect(heard[1]).toMatchObject({ first: true });
  },
};
