// The Tools tab's Worlds (slice 6.3b, the panel's world.tsx picker): GET /world's list, a press
// switches to that world, or a new one, blank or a copy of a listed one (POST /world, worlds.ts).
// The watcher restarts on it, so the Book waits for /world to name it, then reloads holding nothing
// of the world left: no place, pinned start, open sheet or Undo chip (journal ids restart).
import { TextInput, View } from 'react-native';
import { size } from '../../book/tokens.ts';
import { ink, keep } from './build.ts';
import { known } from './room.tsx';
import { inRow, refusal, row, run } from './roomedit.tsx';
import { act } from './sheet.tsx';

// placeholder: the owner writes these words
export const WORDS = {
  tab: 'Worlds',
  name: 'new_world',
  blank: 'New blank world',
  copy: (title: string) => `New copy of ${title}`,
  stuck: (name: string) => `${name} did not open: see the watcher's terminal`,
};
type Worlds = { current: string; worlds: { name: string; title: string }[] };
// the world left's keys (panel.tsx PLACE, tools.tsx START, Build.tsx KEPT, map.tsx PICKED, scene.tsx ROW)
const LEFT = [
  'loka-place',
  'loka.editor.start',
  'loka-build-undo',
  'loka-build-map',
  'loka-build-row',
];
let all: Worlds | undefined;
let asked = false;
let name = '';

/** Switches to `sent.name` (made first when `new`); true once /world names it, false after a minute. */
async function go(sent: { name: string; new?: true; from?: string }) {
  const [status, told] = await known.api!('/world', sent);
  if (status !== 200) return String(told ?? status);
  for (let i = 0; i < 200; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const [, now] = await known.api!('/world').catch(() => []);
    if (now?.current !== sent.name) continue;
    // cleared last: a step or a draw while the watcher restarts writes them again
    LEFT.forEach((k) => localStorage.removeItem(k));
    keep(localStorage, { on: true });
    return void location.reload();
  }
  return WORDS.stuck(sent.name);
}

/** GET /world, once; the server down or refusing, asked again on the next draw. */
function ask() {
  asked = true;
  void known.api?.('/world').then(
    ([status, w]) => (status === 200 ? ((all = w), known.redraw()) : (asked = false)),
    () => (asked = false),
  );
}

export function worldRows() {
  if (!asked) ask();
  // the sent body read at the press: the name field does not redraw as it is typed
  const pick = (sent: () => Parameters<typeof go>[0]) => () => void run(() => go(sent()));
  return [
    refusal(),
    <View key="worlds" style={row}>
      {all?.worlds.map((w) =>
        act(
          w.title,
          w.name === all!.current ? () => {} : pick(() => ({ name: w.name })),
          undefined,
          `world ${w.name}`,
          w.name === all!.current,
        ),
      )}
    </View>,
    <View key="new world" style={row}>
      <TextInput
        accessibilityLabel={WORDS.name}
        placeholder={WORDS.name}
        defaultValue={name}
        onChangeText={(v) => void (name = v)}
        style={{ ...inRow, flex: 1, borderBottomWidth: size.rule, borderColor: ink('action') }} // mutate-skip: layout; ruled as the Room sheet's Move field
      />
      {act(
        WORDS.blank,
        pick(() => ({ name, new: true })),
      )}
      {all?.worlds.map((w) =>
        act(
          WORDS.copy(w.title),
          pick(() => ({ name, new: true, from: w.name })),
          undefined,
          `copy ${w.name}`,
        ),
      )}
    </View>,
  ];
}
