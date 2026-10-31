// Author preview only (`?dev=1` on the web dev cartridge; never the pinned save): the dev clock
// control, keep my place, checkpoints and the author column (docs/system/cartridge.md#author-preview).
// All drive the kernel's own paths: the clock skews the host clocks, the place replays saved inputs
// through `invoke`, the column reads the view and the trace.
import { useEffect, useState, type ReactNode } from 'react';
import {
  Button,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import chapter from '../../../protocol/fixtures/toolbox_showcase_hash.json';
import { Column, seen, type Opened } from './column.tsx';
import { listen, overlay } from './live.ts';
import { asRefs, replay, type Place, type Step } from './place.ts';

export const devClock =
  process.env.EXPO_PUBLIC_LOKA_DEV_CARTRIDGE === '1' &&
  Platform.OS === 'web' &&
  new URLSearchParams(location.search).get('dev') === '1';
const g = globalThis as { loka_dev_skew?: number }; // ms the dev clock has moved both host clocks
export const skew = () => g.loka_dev_skew ?? 0;

// The inputs the session saved, under the artifact hash, in localStorage; replayed once per page
// load after a reload into a different artifact.
const PLACE = 'loka-place';
const place: Place = (devClock && JSON.parse(localStorage.getItem(PLACE) ?? 'null')) || {
  hash: chapter.sha256,
  steps: [],
};
let placeNote = '';
const savePlace = () => localStorage.setItem(PLACE, JSON.stringify(place));
const keep = (step: Step) => {
  if (place.hash !== chapter.sha256) return; // a broken path waits for the edit that mends it
  place.steps.push(step);
  savePlace();
};
export const resetPlace = () => {
  place.hash = chapter.sha256;
  place.steps = [];
  savePlace();
};
export function restorePlace(game: Opened | undefined) {
  if (!game || place.hash === chapter.sha256) return;
  let outcome: ReturnType<typeof replay>;
  try {
    outcome = replay(place.steps, game, (ms) => {
      g.loka_dev_skew = skew() + ms;
      let rounds = 0;
      while (rounds++ < 1000 && game.pulse('drain').kind === 'catching_up');
    });
  } catch (e) {
    // a hand-edited checkpoint or stale place with a malformed step must not stop the boot
    outcome = { done: 0, failed: `malformed step (${(e as Error).message})` };
  }
  const { done, failed } = outcome;
  if (failed) {
    placeNote = `Place: ${failed}; stopped after ${done} of ${place.steps.length} steps. Mend the edit, or Start over to record afresh.`;
    console.warn(placeNote);
    return;
  }
  placeNote = `Place: replayed ${done} steps`;
  place.hash = chapter.sha256;
  savePlace();
}
const recorded = new WeakMap<Opened, Opened>(); // one wrapper per game, so the Book sees one identity
/** In the author preview, the game with every accepted input recorded; elsewhere the game itself. */
export function played(game: Opened | undefined) {
  if (!devClock || !game) return game;
  if (!recorded.has(game))
    recorded.set(game, {
      ...game,
      text: (key) => {
        const words = overlay[key] ?? game.text(key);
        seen.set(words, key);
        return words;
      },
      invoke: (intent) => {
        const reply = game.invoke(intent);
        if (reply.kind === 'saved' && reply.decision.kind === 'accepted')
          keep({ intent: asRefs(intent, game.entityIds()) });
        return reply;
      },
    });
  return recorded.get(game)!;
}

// Moves both host clocks forward by game minutes at the cartridge's rate, so the kernel's own
// elapsed path delivers the time (none before D11 selection).
type Manifest = { manifest: { time_policy?: { rate: number } } };
function DevClock() {
  const [minutes, setMinutes] = useState('60');
  const advance = () => {
    const rate = (JSON.parse(chapter.canonical) as Manifest).manifest.time_policy?.rate;
    const m = Number(minutes);
    if (rate && Number.isSafeInteger(m) && m > 0) {
      const ms = Math.ceil((m * 60_000) / rate);
      g.loka_dev_skew = skew() + ms;
      keep({ advance: ms });
    }
  };
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      <TextInput
        aria-label="Game minutes"
        inputMode="numeric"
        value={minutes}
        onChangeText={setMinutes}
        style={{ width: 56, borderWidth: 1, backgroundColor: 'white' }}
      />
      <Button title="Advance game minutes" onPress={advance} />
    </View>
  );
}

// Named checkpoints: the recorded path saved as `checkpoints/<name>.json` in the source tree
// (bin/loka dev --watch writes it); jumping starts the game over and replays the file's steps.
type Tools = {
  redraw: (next: object) => void;
  session: { game: () => Opened | undefined };
  startOver: () => unknown;
};
const CHECKPOINTS = '/__author/checkpoints';
async function jumpTo(name: string, { session, startOver }: Tools) {
  const { steps } = (await (await fetch(`${CHECKPOINTS}/${name}`)).json()) as Place;
  const before = session.game();
  startOver();
  const game = session.game();
  if (!game || game === before) return; // a refused start over keeps this game and its place
  place.hash = ''; // not this artifact's path yet: restorePlace replays it
  place.steps = steps;
  restorePlace(game);
}
function Checkpoints(tools: Tools) {
  const [names, setNames] = useState<string[]>([]);
  const [name, setName] = useState('');
  const list = () =>
    fetch(CHECKPOINTS)
      .then((r) => r.json())
      .then(setNames, () => setNames([]));
  useEffect(() => void list(), []);
  const save = () =>
    fetch(`${CHECKPOINTS}/${name}`, {
      method: 'PUT',
      body: JSON.stringify({ steps: place.steps }),
    }).then((r) => (r.ok ? list() : alert(`Not saved: ${r.status}`)));
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <TextInput
          aria-label="Checkpoint name"
          placeholder="name"
          value={name}
          onChangeText={setName}
          style={{ width: 96, borderWidth: 1 }}
        />
        <Button
          title="Save checkpoint"
          onPress={save}
          disabled={!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(name)} // live.ts NAME
        />
      </View>
      {names.map((n) => (
        <Button key={n} title={`Jump to ${n}`} onPress={() => jumpTo(n, tools)} />
      ))}
    </View>
  );
}

/** The Book with the author column beside it (wide) or under it (narrow); App mounts it only in
 * the author preview. `redraw` is App's state setter, stable, so the stream opens once per page. */
export function DevPanel({ children, ...tools }: Tools & { children: ReactNode }) {
  const { redraw } = tools;
  const [said, setSaid] = useState<string[]>([]); // the last compile's diagnostics
  useEffect(() => listen((lines) => (setSaid(lines), redraw({}))), [redraw]);
  const wide = useWindowDimensions().width >= 900;
  const game = tools.session.game();
  const note = [placeNote, ...said].filter(Boolean).join('\n');
  return (
    <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
      <View style={{ flex: 1 }}>{children}</View>
      <ScrollView
        aria-label="Author column"
        style={wide ? { width: 320, flexGrow: 0 } : { maxHeight: 200 }} // a ScrollView grows by default
        contentContainerStyle={{ gap: 8, padding: 4, backgroundColor: 'white' }}
      >
        {note ? <Text selectable>{note}</Text> : null}
        <DevClock />
        <Checkpoints {...tools} />
        {game ? <Column game={game} /> : null}
      </ScrollView>
    </View>
  );
}
