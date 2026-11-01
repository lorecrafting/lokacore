// ExperienceRule: the thin rule of progress under the status row (ExperienceRule's doc comment).
// Reduced motion is the device's setting, which a story cannot force: experience_rule.test.ts holds it.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { expect, waitFor, within } from 'storybook/test';
import { ExperienceRule, type RuleDrawn } from '../book/ExperienceRule.tsx';
import { StatusLine } from '../book/Status.tsx';

type Levelling = {
  level: number;
  experience: number;
  from: number;
  next?: number;
  unspent: number;
};
const at = (experience: number, level = 1, from = 0, next = 100): Levelling => ({
  level,
  experience,
  from,
  next,
  unspent: 0,
});

// Draws `before`, then `after`; `away` leaves the rule unmounted between them, as a detail page does.
function Moving(p: { before: Levelling; after?: Levelling; away?: boolean }) {
  const drawn = useRef<RuleDrawn['current']>(undefined);
  const [shown, setShown] = useState({ levelling: p.before, on: true });
  useEffect(() => {
    if (!p.after) return;
    const after = p.after;
    if (p.away) setShown({ levelling: p.before, on: false });
    const next = setTimeout(() => setShown({ levelling: after, on: true }));
    return () => clearTimeout(next);
  }, []);
  return (
    <View testID="rule">
      {shown.on && <ExperienceRule levelling={shown.levelling} drawn={drawn} />}
    </View>
  );
}

const meta = {
  title: 'Book/ExperienceRule',
  component: Moving,
  args: { before: at(40) },
} satisfies Meta<typeof Moving>;
export default meta;
type Story = StoryObj<typeof meta>;

const ink = (canvasElement: HTMLElement) =>
  getComputedStyle(within(canvasElement).getByTestId('rule').firstElementChild!.firstElementChild!);
const filled = (canvasElement: HTMLElement) => new DOMMatrix(ink(canvasElement).transform).a;
const near = (canvasElement: HTMLElement, to: number) =>
  waitFor(() => expect(filled(canvasElement)).toBeCloseTo(to, 2), { timeout: 4000 });

export const AtRest: Story = {
  play: async ({ canvasElement }) => {
    await near(canvasElement, 0.4);
    // No reader's stop and no touch target.
    expect(within(canvasElement).getByTestId('rule').firstElementChild).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(canvasElement.querySelector('[role="button"], button')).toBeNull();
  },
};

export const Top: Story = {
  args: { before: { ...at(900, 9, 800), next: undefined } },
  play: ({ canvasElement }) => near(canvasElement, 1),
};

export const Gain: Story = {
  args: { after: at(80) },
  play: ({ canvasElement }) => near(canvasElement, 0.8),
};

export const Loss: Story = {
  args: { before: at(80), after: at(20) },
  play: async ({ canvasElement }) => {
    const rest = ink(canvasElement).backgroundColor;
    await near(canvasElement, 0.2);
    expect(ink(canvasElement).backgroundColor).toBe(rest);
  },
};

const levelRun = async (canvasElement: HTMLElement) => {
  const rest = ink(canvasElement).backgroundColor;
  await near(canvasElement, 1);
  await waitFor(() => expect(ink(canvasElement).backgroundColor).not.toBe(rest), { timeout: 4000 });
  await near(canvasElement, 0.3);
  await waitFor(() => expect(ink(canvasElement).backgroundColor).toBe(rest), { timeout: 4000 });
};

export const LevelRun: Story = {
  args: { before: at(90), after: at(130, 2, 100, 200) },
  play: ({ canvasElement }) => levelRun(canvasElement),
};

export const ReturnWithGain: Story = {
  args: { before: at(20), after: at(60), away: true },
  play: ({ canvasElement }) => near(canvasElement, 0.6),
};

export const ReturnWithLevel: Story = {
  args: { before: at(90), after: at(130, 3, 100, 200), away: true },
  // The status line was gone, so the run is seen from full; the last value was still drawn first.
  play: async ({ canvasElement }) => {
    await near(canvasElement, 1);
    await near(canvasElement, 0.3);
  },
};

// Placement: directly under the row, the row's height untouched.
export const UnderStatusRow: Story = {
  render: () => {
    const drawn = useRef<RuleDrawn['current']>(undefined);
    return (
      <StatusLine
        time={3}
        text={(key: string) => key}
        locked={false}
        pending={false}
        open={() => {}}
        openCharacter={() => {}}
        rule={{ levelling: at(40), drawn }}
      />
    );
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('[aria-hidden="true"]')).not.toBeNull());
  },
};
