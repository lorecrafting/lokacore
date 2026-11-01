// What the turning page holds: the paper, then Combat, or the sky and the Body.
import type { ComponentProps } from 'react';
import { Body } from './Body.tsx';
import { View } from 'react-native';
import { Combat } from './Combat.tsx';
import type { Page } from './model.ts';
import { usePalette } from './palette.ts';
import { Storm } from './Storm.tsx';

type Props = Omit<ComponentProps<typeof Body>, 'talkOn' | 'chapterDone'> & {
  flip: { turn: number };
  talkOn?: ComponentProps<typeof Body>['talkOn'];
  go: (pages: Page[], dir: 1 | -1) => void;
};

/**
 * The inside of the page turn.
 * - Use: BookView, as PageTurn's child.
 * - Rules: an ended fight stays on Combat. Anything but a bare World page draws no sky. The paper
 *   is here, under the sky; the World page draws none of its own.
 * - States: Combat; World.
 * - Story: CombatPage.stories.tsx
 */
export function Leaf(p: Props) {
  const v = p.screen.view;
  const fight = v.combat || p.screen.ended;
  const c = usePalette();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Storm
        weather={v.calendar_status?.weather}
        exposed={!!v.place?.exposed}
        room={v.place?.id}
        turn={p.flip.turn}
        world={!fight && !p.page && !v.scene && !v.ancestry_choices}
      />
      {fight ? (
        <Combat screen={p.screen} g={p.g} press={p.press} world={p.world} />
      ) : (
        <Body
          {...p}
          talkOn={p.talkOn ?? (() => {})}
          chapterDone={() => p.go(p.stack.slice(0, -1), 1)}
        />
      )}
    </View>
  );
}
