// The Tools tab's Worlds (slice 6.3b, the panel's world.tsx picker): GET /world's list, a press
// switches to that world, or a new one, blank or a copy of a listed one (POST /world, worlds.ts).
// The watcher restarts on it, so the Book waits for /world to name it, then reloads holding nothing
// of the world left: no place, pinned start, open sheet or Undo chip (journal ids restart).
import { Text, TextInput, View } from 'react-native';
import { size, space } from '../../book/tokens.ts';
import { ink, keep } from './build.ts';
import { known } from './room.tsx';
import { inRow, refusal, row, run, tell } from './roomedit.tsx';
import { opened as open, toggle } from './formwrite.ts';
import { act } from './sheet.tsx';

// placeholder: the owner writes these words
export const WORDS = {
  tab: 'Worlds',
  name: 'new_world',
  blank: 'New blank world',
  copy: (title: string) => `New copy of ${title}`,
  stuck: (name: string) => `${name} did not open: see the watcher's terminal`,
  updating: (name: string) => `Opening ${name}…`,
  wait: 'One world at a time: wait for this one to open',
  samples: 'Samples',
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
let opening = ''; // the world a switch waits on
const SAMPLES = 'worlds samples'; // the fold's key in the sheet's open set
// a sampler is a mechanic's demonstration, not a world to author (lantern_proof: worlds.ts FROZEN)
const sample = (name: string) => name.endsWith('_sampler');

/** Switches to `sent.name` (made first when `new`); true once /world names it, false after a minute. */
async function go(sent: { name: string; new?: true; from?: string }) {
  const [status, told] = await known.api!('/world', sent);
  if (status !== 200) return String(told ?? status);
  opening = sent.name;
  known.redraw();
  for (let i = 0; i < 200; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const [, now] = await known.api!('/world').catch(() => []);
    if (now?.current !== sent.name) continue;
    // cleared last: a step or a draw while the watcher restarts writes them again
    LEFT.forEach((k) => localStorage.removeItem(k));
    keep(localStorage, { on: true });
    opening = '';
    return void location.reload();
  }
  opening = '';
  return WORDS.stuck(sent.name);
}

/** GET /world, once; the server down or refusing, asked again on the next draw. */
function ask() {
  asked = true;
  void known.api?.('/world').then(
    ([status, w]) =>
      status === 200
        ? ((all = w), sample(w.current) && open.add(SAMPLES), known.redraw()) // the current one shown
        : (asked = false),
    () => (asked = false),
  );
}

/** The line a switch shows while it waits on the watcher. */
const opened = () =>
  opening ? (
    <Text key="opening" style={{ ...inRow, paddingHorizontal: space.md }}>
      {WORDS.updating(opening)}
    </Text>
  ) : null;

// the sent body read at the press: the name field does not redraw as it is typed
const pick = (sent: () => Parameters<typeof go>[0]) => () =>
  opening ? tell(WORDS.wait) : void run(() => go(sent()));

/** Each listed world's switch, then its copy row's buttons (the copies follow the same split). */
const picks = (list: Worlds['worlds']) =>
  list.map((w) =>
    act(
      w.title,
      w.name === all!.current ? () => {} : pick(() => ({ name: w.name })),
      undefined,
      `world ${w.name}`,
      w.name === all!.current,
    ),
  );
const copies = (list: Worlds['worlds']) =>
  list.map((w) =>
    act(
      WORDS.copy(w.title),
      pick(() => ({ name, new: true, from: w.name })),
      undefined,
      `copy ${w.name}`,
    ),
  );

/** Real worlds first; the samplers under a Samples fold, closed unless the current world is one. */
export function worldRows() {
  if (!asked) ask();
  const real = all?.worlds.filter((w) => !sample(w.name)) ?? [];
  const samples = all?.worlds.filter((w) => sample(w.name)) ?? [];
  const shown = open.has(SAMPLES);
  return [
    refusal(),
    opened(),
    <View key="worlds" style={row}>
      {picks(real)}
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
      {copies(real)}
    </View>,
    samples.length ? act(WORDS.samples, () => toggle(SAMPLES), shown, `fold ${SAMPLES}`) : null,
    shown ? (
      <View key="samples" style={row}>
        {picks(samples)}
        {copies(samples)}
      </View>
    ) : null,
  ];
}
