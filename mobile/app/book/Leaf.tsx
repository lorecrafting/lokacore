// What the turning page holds: Combat, or the sky and the Body.
import type { ComponentProps } from 'react';
import { Body } from './Body.tsx';
import { Combat } from './Combat.tsx';
import type { Page } from './model.ts';
import { Storm } from './Storm.tsx';

type Props = Omit<ComponentProps<typeof Body>, 'talkOn' | 'chapterDone'> & {
  flip: { turn: number };
  talkOn?: ComponentProps<typeof Body>['talkOn'];
  go: (pages: Page[], dir: 1 | -1) => void;
};

/**
 * The inside of the page turn.
 * - Use: BookView, as PageTurn's child.
 * - Rules: an ended fight stays on Combat. Anything but a bare World page draws no sky.
 * - States: Combat; World.
 * - Story: CombatPage.stories.tsx
 */
export function Leaf(p: Props) {
  const v = p.screen.view;
  if (v.combat || p.screen.ended)
    return <Combat screen={p.screen} g={p.g} press={p.press} world={p.world} />;
  return (
    <>
      {/* lamp flicker (PR B glow) switches on with place.exposed: on merge, read it there */}
      <Storm
        weather={v.calendar_status?.weather}
        exposed={!!v.place?.exposed}
        room={v.place?.id}
        turn={p.flip.turn}
        world={!p.page && !v.scene && !v.ancestry_choices}
      />
      <Body
        {...p}
        talkOn={p.talkOn ?? (() => {})}
        chapterDone={() => p.go(p.stack.slice(0, -1), 1)}
      />
    </>
  );
}
