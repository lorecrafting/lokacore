// The notebook's Tools tab (slice 6.2a, the panel's Play column): the Hold, named checkpoints with
// their replayed verdicts, Advance time and the cheats, all through panel.tsx's own paths (placeHooks):
// a cheat is a recorded step, a replay starts the game over. The strip's last-edit timing is here too.
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  BUDGET,
  loadOf,
  total,
  within,
  type Loaded,
  type Timings,
} from '../../../../kernel/ts/play/timings.ts';
import { verdicts, type Checked } from '../../../../kernel/ts/play/verdicts.ts';
import { type } from '../../book/tokens.ts';
import type { Cheat, Step } from '../place.ts';
import { ink } from './build.ts';
import { known } from './room.tsx';
import { inRow, refusal, row, run, tell } from './roomedit.tsx';
import { numberRows, WORDS as NUMBERS } from './numbers.tsx';
import { readRows, stepped, WORDS as READING, type Reader } from './reading.tsx';
import { updated as seeUpdated } from './seeas.tsx';
import { worldRows, WORDS as WORLDS } from './worlds.tsx';
import { act, CONTROL } from './sheet.tsx';

// Placeholders: the owner writes the words.
export const WORDS = {
  tab: 'Tools',
  play: 'Play', // the 6.2a rows' own tab, beside the readers'
  hold: 'Hold',
  name: 'checkpoint name',
  save: 'Save checkpoint',
  notSaved: (status: number) => `Not saved: ${status}`,
  notReplayed: (status: number) => `Not replayed: ${status}`,
  badName:
    'A name is up to 64 lower-case letters, digits, - and _, starting with a letter or digit.',
  noSteps: 'That checkpoint has no steps list; nothing changed.',
  replay: (name: string) => `Replay ${name}`,
  pin: 'Pin',
  empty: 'Play to a beat, name it, Save; later, pick it to replay there.',
  failed: (n: number) => `${n} checkpoint ${n === 1 ? 'fails' : 'fail'}`,
  minutes: 'minutes',
  advance: 'Advance',
  room: 'room key',
  go: 'Go to room',
  fact: 'fact key',
  value: 'value',
  setFact: 'Set fact',
  level: 'level',
  attribute: 'attribute key',
  points: 'points',
  setLevel: 'Set level',
};
const NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/; // kernel/ts/play/live.ts NAME
const START = 'loka.editor.start'; // the panel's pinned start (tools/author-panel/src/shell.ts START)

/** panel.tsx's paths for this game (placeHooks), the Hold and the stream's last message (Build.tsx). */
export type Hooks = {
  game: () =>
    | ({
        place: () => { steps: Step[] };
        loaded: Loaded; // this Book's artifact and load time, for a structural edit's timing
        jump: (steps: Step[]) => void;
        advance: (minutes: number) => string;
        cheat: (cheat: Cheat) => string;
      } & Reader)
    | undefined;
  hold: { toggle: () => void; pinned: () => boolean };
  heard: () => Said;
};
/** The stream's fields this tab reads (kernel/ts/play/live.ts), beside live.ts's Message. */
export type Said = { checkpoints?: Checked[]; timings?: Timings };
let hooks: Hooks | undefined;
export const toolsWith = (given: Hooks) => void (hooks = given);
/** Build's game update: the Step reader folds this state into its before and after, so a step taken
 * with the notebook shut still pairs with the one before it; then See as may end (seeas.tsx). */
export const updated: typeof seeUpdated = (u) => (stepped(hooks?.game()), seeUpdated(u));

const typed: Record<string, string> = { minutes: '60' };
let names: string[] | undefined; // GET /__author/checkpoints, asked when the tab first draws
const field = (label: string, key: string, numeric = false) => (
  <TextInput
    key={key}
    accessibilityLabel={label}
    placeholder={label}
    placeholderTextColor={ink('dim')}
    defaultValue={typed[key]}
    inputMode={numeric ? 'numeric' : undefined}
    onChangeText={(v) => void ((typed[key] = v), known.redraw())}
    style={{ ...inRow, minWidth: 80, borderBottomWidth: 1, borderColor: ink('action') }} // mutate-skip: layout; ruled as Contents' name field
  />
);
const said = (text: string) => <Text style={{ ...inRow, color: ink('dim') }}>{text}</Text>;
/** A tool's act, or the same control disabled in dim ink while what it needs is missing. */
const maybe = (label: string, go: (() => void) | false) =>
  go ? (
    act(label, go)
  ) : (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      disabled
      style={CONTROL}
    >
      <Text style={{ ...type.control, color: ink('dim') }}>{label}</Text>
    </Pressable>
  );

// not through run: save awaits it inside its own run, which a nested run would skip as busy
const list = async () => {
  const r = await fetch('/__author/checkpoints');
  names = r.ok ? ((await r.json()) as string[]) : [];
  known.redraw();
};
const save = (steps: Step[]) =>
  run(async () => {
    const r = await fetch(`/__author/checkpoints/${typed.name}`, {
      method: 'PUT',
      body: JSON.stringify({ steps }),
    });
    if (!r.ok) return WORDS.notSaved(r.status);
    await list();
  });
const replay = (name: string) =>
  run(async () => {
    const r = await fetch(`/__author/checkpoints/${name}`);
    if (!r.ok) return WORDS.notReplayed(r.status);
    const { steps } = (await r.json()) as { steps?: Step[] };
    if (!Array.isArray(steps)) return WORDS.noSteps;
    hooks?.game()?.jump(steps);
  });
const pin = (name: string) => {
  if (localStorage.getItem(START) === name) localStorage.removeItem(START);
  else localStorage.setItem(START, name);
  known.redraw();
};
let started = false; // the pinned start is replayed once per load
/** A fresh Book (no steps yet) replays the pinned start checkpoint, as the panel's useStart (App.tsx). */
export function startPinned(game: Game) {
  const name = localStorage.getItem(START);
  if (started || !name || game.place().steps.length) return;
  started = true;
  void fetch(`/__author/checkpoints/${name}`)
    .then((r) => r.json())
    .then(({ steps }: { steps?: Step[] }) => Array.isArray(steps) && game.jump(steps))
    .catch(() => {}); // a missing pin starts as unpinned
}
/** true, false, a number or a "quoted" string as typed; a bare word is an enum's or a string's (cheats.tsx). */
function value(text: string) {
  try {
    const v: unknown = JSON.parse(text);
    return typeof v === 'boolean' || typeof v === 'string' || Number.isFinite(v)
      ? (v as boolean | number | string)
      : text;
  } catch {
    return text;
  }
}

const shelf = [WORDS.play, ...READING.tabs, NUMBERS.tab, WORLDS.tab];
let open = WORDS.play; // the Tools tab's open reader
/** The Tools tab's rows: its own tabs, then the open one's. */
export function toolRows() {
  const game = hooks?.game();
  return [
    <View key="tools" style={row}>
      {shelf.map((t) =>
        act(t, () => ((open = t), known.redraw()), undefined, `tool ${t}`, open === t),
      )}
    </View>,
    ...(open === WORDS.play
      ? playRows()
      : open === NUMBERS.tab
        ? numberRows(game?.state().hash)
        : open === WORLDS.tab
          ? worldRows()
          : readRows(open, game)),
  ];
}

/** The Play rows: the Hold, the checkpoints, then time and the cheats. */
function playRows() {
  if (!names) void ((names = []), list().catch(() => {})); // asked once; unreachable reads as none
  const game = hooks?.game();
  return [
    refusal(),
    <View key="hold" style={row}>
      {act(
        WORDS.hold,
        () => (hooks!.hold.toggle(), known.redraw()),
        undefined,
        'hold',
        hooks?.hold.pinned() ?? false,
      )}
    </View>,
    ...checkpointRows(game?.place().steps ?? []),
    ...(game ? cheatRows(game) : []),
  ];
}

function checkpointRows(steps: Step[]) {
  const checked = hooks?.heard().checkpoints;
  const broke = checked?.filter((c) => !c.ok).length ?? 0;
  return [
    <View key="save" style={row}>
      {field(WORDS.name, 'name')}
      {maybe(
        WORDS.save,
        NAME.test(typed.name ?? '') && steps.length > 0 && (() => void save(steps)),
      )}
      {broke ? <Text style={{ ...inRow, color: ink('danger') }}>{WORDS.failed(broke)}</Text> : null}
    </View>,
    typed.name && !NAME.test(typed.name) ? (
      <View key="bad" style={row}>
        {said(WORDS.badName)}
      </View>
    ) : null,
    ...(names?.length
      ? verdicts(names, checked).map((v) => (
          <View key={`cp ${v.name}`} style={row}>
            {act(WORDS.replay(v.name), () => void replay(v.name))}
            {act(
              WORDS.pin,
              () => pin(v.name),
              undefined,
              `pin ${v.name}`,
              localStorage.getItem(START) === v.name,
            )}
            <Text style={{ ...inRow, color: ink(v.ok ? 'dim' : 'danger') }}>{v.said}</Text>
          </View>
        ))
      : [
          <View key="empty" style={row}>
            {said(WORDS.empty)}
          </View>,
        ]),
  ];
}

type Game = NonNullable<ReturnType<Hooks['game']>>;
const cheatOf = (game: Game) => (c: Cheat) => () => tell(game.cheat(c));
function cheatRows(game: Game) {
  const [minutes, cheat] = [Number(typed.minutes), cheatOf(game)];
  const { room, fact, level, attribute, points } = typed;
  return [
    <View key="advance" style={row}>
      {field(WORDS.minutes, 'minutes', true)}
      {maybe(
        WORDS.advance,
        Number.isSafeInteger(minutes) && minutes > 0 && (() => tell(game.advance(minutes))),
      )}
    </View>,
    <View key="go" style={row}>
      {field(WORDS.room, 'room')}
      {maybe(WORDS.go, !!room && cheat({ op: 'go_to_room', room }))}
    </View>,
    <View key="fact" style={row}>
      {field(WORDS.fact, 'fact')}
      {field(WORDS.value, 'value')}
      {maybe(
        WORDS.setFact,
        !!fact && !!typed.value && cheat({ op: 'set_fact', fact, value: value(typed.value) }),
      )}
    </View>,
    <View key="level" style={row}>
      {field(WORDS.level, 'level', true)}
      {field(WORDS.attribute, 'attribute')}
      {field(WORDS.points, 'points', true)}
      {maybe(
        WORDS.setLevel,
        !!level &&
          (!attribute || !!points) &&
          cheat({
            op: 'set_level',
            level: Number(level),
            points: attribute ? { [attribute]: Number(points) } : {},
          }),
      )}
    </View>,
  ];
}

/** The strip's last edit, as the panel's Timing (centre.tsx): dim ink within its budget (no `ok` token), `warning` over. */
export function timing(t: Timings | undefined, loaded?: Loaded) {
  if (!t) return null;
  const load = loadOf(t, loaded);
  const ok = within(t, load);
  const parts = [t.compile, t.publish, ...(load ? [load] : [])].join(' + ');
  return (
    <Text
      accessibilityLabel={`Last edit timing, ${ok ? 'within' : 'over'} ${BUDGET[t.kind]} ms`}
      style={{ ...type.small, color: ink(ok ? 'dim' : 'warning') }}
    >
      {`${t.kind} ${parts} = ${total(t, load)} ms`}
    </Text>
  );
}
