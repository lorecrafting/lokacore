// The Build map's controls (map.tsx): its glyphs, and (slice 6.5b, the panel's mapsvg.tsx `keys`)
// its keys on the ground while it has the focus: an arrow selects the nearest room that way, Enter selects, Shift-Enter goes there,
// PageUp and PageDown step levels, `+` `-` zoom by M.step and `0` fits. map.tsx hands in its acts.
import { Pressable, Text } from 'react-native';
import * as map from '../../../../kernel/ts/play/map.ts';
import { M, type MapRoom } from '../../../../kernel/ts/play/map.ts';
import { type } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { CONTROL } from './sheet.tsx';

/** A control glyph; without `run` it is disabled, in `dim`. */
export const glyph = (g: { glyph: string; name: string; drop?: number }, run?: () => void) => (
  <Pressable
    key={g.name}
    accessibilityRole="button"
    accessibilityLabel={g.name}
    accessibilityState={{ disabled: !run }}
    disabled={!run}
    onPress={run}
    style={CONTROL}
  >
    <Text
      style={{
        ...type.control,
        color: ink(run ? 'action' : 'dim'),
        transform: [{ translateY: g.drop ?? 0 }],
      }}
    >
      {g.glyph}
    </Text>
  </Pressable>
);

export type Acts = {
  pick: (key: string) => void;
  goTo: (key: string) => void;
  step: (by: number) => void;
  zoom: (f: number) => void;
  fit: () => void;
};
type Key = Pick<
  KeyboardEvent,
  'key' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'altKey' | 'preventDefault' | 'stopPropagation'
>;

/** Runs the map act key `e` asks for on level `z` of `rooms`, from the selection (else the
 * current room, else the first): the key goes no further (the Book's walk keys). */
export function mapKey(
  e: Key,
  rooms: MapRoom[],
  z: number,
  selected: string | undefined,
  here: string | undefined,
  a: Acts,
) {
  if (e.metaKey || e.ctrlKey || e.altKey) return; // the browser's zoom chords stay the browser's
  const level = map.onLevel(rooms, z);
  const from = map.entry(level, selected, here);
  const all = map.levels(rooms);
  const i = all.indexOf(z);
  const acts: Record<string, (() => unknown) | undefined> = {
    Enter: () => from && (e.shiftKey ? a.goTo(from.key) : a.pick(from.key)),
    PageUp: () => i < all.length - 1 && a.step(1),
    PageDown: () => i > 0 && a.step(-1),
    '+': () => a.zoom(M.step),
    '=': () => a.zoom(M.step),
    '-': () => a.zoom(1 / M.step),
    '0': a.fit,
  };
  const next = e.key.startsWith('Arrow') && from && map.nearest(level, from, e.key);
  const run = e.key.startsWith('Arrow') ? () => next && a.pick(next.key) : acts[e.key];
  if (!run) return;
  e.preventDefault();
  e.stopPropagation();
  run();
}
