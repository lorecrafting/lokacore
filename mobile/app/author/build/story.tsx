// size: allow 335, the rows, their part and beat edits and the sheets share the tab's drafts and pick
// The notebook's Story tab (design §4.8, slice 5.4b): the panel's Story list (kernel/ts/play/storylist.ts `rows`)
// as rows. A node row has Go there, Sheet, Trace, Consequences and Flow (flow.tsx); Add part starts the outline or adds a
// part; a part adds a beat, is retitled and removed; a beat binds, retitles, is removed and shows Knowledge. Trace, Consequences, Knowledge, Facts and Pacing are sheets.
import { Text, TextInput, View } from 'react-native';
import * as L from '../../../../kernel/ts/play/storylist.ts';
import { laneOf } from '../../../../kernel/ts/play/flow.ts';
import { consequenceRows } from '../../../../kernel/ts/play/storyconseq.ts';
import { factRows } from '../../../../kernel/ts/play/storyfacts.ts';
import { knowledge, pacing } from '../../../../kernel/ts/play/storyknow.ts';
import { size } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { known } from './room.tsx';
import { ed, inRow, refusal, row, run } from './roomedit.tsx';
import { act, sheets } from './sheet.tsx';

const WORDS = {
  unwritten: (n = 0) => (n ? `${n} unwritten` : 'unwritten'), // never `~` (ruling 9)
  refusals: (n: number) => (n === 1 ? '1 refusal' : `${n} refusals`),
  unreached: 'unreached',
  go: 'Go there',
  sheet: 'Sheet',
  source: 'Source',
  trace: 'Trace',
  consequences: 'Consequences',
  flow: 'Flow',
  knowledge: 'Knowledge',
  facts: 'Facts',
  pacing: 'Pacing',
  add: 'Add beat',
  addPart: 'Add part', // placeholder words: the owner writes the line
  number: 'number',
  title: 'title',
  retitle: 'Retitle',
  remove: 'Remove',
  binds: 'Bind…',
  bind: (short: string) => `Bind ${short}`,
  beat: (n: number) => `Beat ${n}`,
  knows: 'Knows',
  may: 'May know',
  not: 'Not yet',
  words: (n: number) => `${n} words`,
  thin: 'thin',
  nothing: 'Nothing here.',
  none: 'No story yet.', // placeholder words: the owner writes the line
};

let st: L.ListState = L.LIST; // the parts and beats opened or shut
let picked: string | undefined; // the row whose actions show under it
let binding: string | undefined; // the beat whose Bind… fold is open
const numbers = new Map<string, string>(); // a part's new beat number, as typed
const titles = new Map<string, string>(); // a beat's new title, as typed
let go = (_room: string) => {};

const column = { ...row, flexDirection: 'column', alignItems: 'flex-start' } as const; // mutate-skip: layout; padded as a row, one line each
const keyOf = (ref: string) => L.fromRef(ref)?.key ?? ref;
const partNo = (id: string) => Number(id.slice('part:'.length)); // the panel's: `part:<i>`, 0-based
const line = (words: string, key: string) => (
  <Text key={key} style={{ ...inRow, color: ink('fg') }}>
    {words}
  </Text>
);
/** A row's node's sheet, if the last /story named its file. */
export const sheetOf = (ref?: string) =>
  ref && known.files[ref] ? `def:${known.files[ref]}` : undefined;
// The room a placement edge joins `ref` to (an NPC's or scene's `.room`, a room's `.items`); none, no Go there.
// ponytail: a dialogue gets no Go there; follow its speaker when an author asks
const PLACED = new Set(['.room', '.items']);
const roomOf = (ref: string) => {
  const rooms = new Map(known.rooms.map((r) => [r.ref, r.key]));
  const e = known.story?.graph.edges.find(
    (e) =>
      PLACED.has(e.path) &&
      ((e.from === ref && rooms.has(e.to)) || (e.to === ref && rooms.has(e.from))),
  );
  return e && rooms.get(e.from === ref ? e.to : e.from);
};
const marks = (r: L.Row) =>
  r.kind === 'beat'
    ? [r.status === '~' ? WORDS.unwritten() : r.status === 'built' ? '' : (r.title ?? r.status!)]
    : [
        r.refusals ? WORDS.refusals(r.refusals) : '',
        r.todo ? WORDS.unwritten(r.todo) : '',
        r.unreached ? WORDS.unreached : '',
      ];
const TWO = { flex: 0, width: size.touch }; // mutate-skip: layout; two digits, as Schedule's hour field
const field = (
  label: string,
  drafts: Map<string, string>,
  id: string,
  shown?: string,
  width: object = { flex: 1 }, // mutate-skip: layout
) => (
  <TextInput
    key={`${label}:${id}`}
    accessibilityLabel={label}
    placeholder={label}
    placeholderTextColor={ink('dim')}
    defaultValue={drafts.get(id) ?? shown}
    onChangeText={(v) => void drafts.set(id, v)}
    style={{ ...inRow, ...width, borderBottomWidth: size.rule, borderColor: ink('action') }} // mutate-skip: layout; ruled as the Room sheet's Move field
  />
);
// ponytail: /story gives a beat's refs, not its shorts; `dir/key` is bound when the beat binds that key
// under a kind `dir` starts with (npcs: npc), a dialogue's choice as its dialogue
const bound = (short: string, refs: string[]) => {
  const [dir, key] = short.split('/');
  return refs.some((ref) => {
    const n = L.fromRef(ref);
    return n?.key === key && dir.startsWith(n.kind.replace(/^scripted_/, ''));
  });
};

const CARDS = new Set(['room', 'npc', 'item']); // the kinds with their own sheet (room.tsx, thing.tsx)
/** A node row's actions: each one a sheet or the room it plays in. Sheet is its card (its own sheet,
 * else its fields), Source its fields beside a card (the panel's click and Alt-click). */
function nodeActs(r: L.Row) {
  const room = roomOf(r.ref!);
  const source = sheetOf(r.ref);
  const card = CARDS.has(r.node!) ? `${r.node}:${keyOf(r.ref!)}` : undefined;
  const sheet = card ?? source;
  return [
    <View key="acts" style={row}>
      {room ? act(WORDS.go, () => go(room)) : null}
      {sheet ? act(WORDS.sheet, () => known.open(sheet)) : null}
      {card && source ? act(WORDS.source, () => known.open(source)) : null}
      {L.TRACED.has(r.node!) ? act(WORDS.trace, () => known.open(`trace:${r.ref}`)) : null}
      {L.CONSEQUENCES.has(r.node!)
        ? act(WORDS.consequences, () => known.open(`consequences:${r.ref}`))
        : null}
      {laneOf(r.ref!) ? act(WORDS.flow, () => known.open(`flow:${r.ref}`)) : null}
    </View>,
  ];
}

/** A beat's edits, each one gesture (one Undo): Retitle ('' removes the title), Remove, and in the
 * Bind… fold, Bind each short ref the beat does not bind yet. */
function beatActs(r: L.Row, s: L.Story) {
  const part = partNo(r.parent!);
  const refs = L.outlineOf(s)?.beats.find((b) => b.n === r.n)?.nodes ?? [];
  const fold = () => {
    binding = binding === r.id ? undefined : r.id;
    known.redraw();
  };
  return [
    <View key="edit" style={row}>
      {field(WORDS.title, titles, r.id, r.label)}
      {act(
        WORDS.retitle,
        () => void run(() => ed.titleBeat(part, r.n!, titles.get(r.id) ?? r.label)),
      )}
      {act(WORDS.remove, () => void run(() => ed.dropBeat(part, r.n!)))}
      {act(WORDS.knowledge, () => known.open(`knowledge:${r.n}`))}
      {act(WORDS.binds, fold, binding === r.id)}
    </View>,
    binding === r.id ? (
      <View key="bind" style={row}>
        {s.shorts
          .filter((short) => !bound(short, refs))
          .map((short) =>
            act(WORDS.bind(short), () => void run(() => ed.bind(part, r.n!, short, s.shorts))),
          )}
      </View>
    ) : null,
  ];
}

/** A part's edits, each one gesture: Retitle ('' removes the title) and Remove, its beats with it. */
function partActs(r: L.Row, s: L.Story) {
  if (!r.id.startsWith('part:')) return []; // Seeds and Unplaced: no outline part to edit
  const part = partNo(r.id);
  const shown = L.outlineOf(s)?.parts[part] ?? undefined;
  const drop = async () => {
    await ed.dropPart(part); // refused: throws, the pick and drafts stay
    picked = undefined;
    // every later part takes the next lower id: drop the part-keyed drafts rather than shift them
    // ponytail: open/shut folds keep their ids (looks only); shift them if authors notice
    [titles, numbers].forEach((m) =>
      [...m.keys()].filter((k) => k.startsWith('part:')).forEach((k) => m.delete(k)),
    );
  };
  return [
    <View key="edit" style={row}>
      {field(WORDS.title, titles, r.id, shown)}
      {act(
        WORDS.retitle,
        () => void run(() => ed.titlePart(part, titles.get(r.id) ?? shown ?? '')),
      )}
      {act(WORDS.remove, () => void run(drop))}
    </View>,
  ];
}

/** One list row: a part or beat opens or shuts and shows its edits, a node shows its actions. */
function storyRow(r: L.Row, s: L.Story) {
  const label = [
    r.kind === 'beat' ? [String(r.n), r.label].filter(Boolean).join('  ') : r.label,
    ...marks(r),
  ]
    .filter(Boolean)
    .join(' · ');
  // open and selected are one state: a shut row opens and is picked, the picked row shuts and is
  // dropped, another open row is only picked; a node is picked or dropped, never opened
  const press = () => {
    const shuts = r.open !== undefined && (!r.open || picked === r.id);
    if (shuts) st = L.toggle(st, r.id);
    picked = picked === r.id ? undefined : r.id;
    known.redraw();
  };
  const head =
    r.kind === 'seed' ? line(label, 'head') : act(label, press, r.open, 'head', picked === r.id);
  const adds = r.id.startsWith('part:') && [
    field(WORDS.number, numbers, r.id, undefined, TWO),
    act(WORDS.add, () => void run(() => ed.addBeat(partNo(r.id), Number(numbers.get(r.id))))),
  ];
  const acts =
    picked !== r.id
      ? []
      : r.kind === 'node'
        ? nodeActs(r)
        : r.kind === 'beat'
          ? beatActs(r, s)
          : partActs(r, s);
  const indent = ((r.level - 1) * size.touch) / 2; // mutate-skip: layout; half a touch target per level
  return (
    <View key={r.id} style={{ paddingLeft: indent }}>
      <View style={row}>
        {head}
        {adds}
      </View>
      {acts /* each its own wrapping row: a row inside a row runs off a phone's width */}
    </View>
  );
}

const addPart = (s: L.Story) =>
  s.outline ? ed.addPart() : ed.call('new', { kind: 'outline', name: 'outline' });

/** The Story tab's body: the refusal, Facts, Pacing and Add part, why there are no beats, then the rows;
 * no story or no parts, the plain line. Add part starts outline.json (/new's outline starter, one part)
 * when there is none, and is not offered over an outline.json the last /story refused. */
export function storyRows() {
  const s = known.story;
  if (!s) return [refusal(), line(WORDS.none, 'none')];
  const why = s.outline && 'refused' in s.outline ? s.outline.refused : undefined;
  const bare = !L.outlineOf(s)?.parts.length;
  return [
    refusal(),
    <View key="sheets" style={row}>
      {act(WORDS.facts, () => known.open('facts:'))}
      {act(WORDS.pacing, () => known.open('pacing:'))}
      {why ? null : act(WORDS.addPart, () => void run(() => addPart(s)))}
    </View>,
    why || bare ? (
      <View key="why" style={column}>
        {why ? line(why, 'why') : null}
        {bare ? line(WORDS.none, 'none') : null}
      </View>
    ) : null,
    ...L.rows(s, st).map((r) => storyRow(r, s)),
  ];
}

/** A sheet's rows: each names a node opens its sheet, the rest are words. */
const listed = (rows: { label: string; ref?: string }[]) => [
  <View key="list" style={column}>
    {rows.length
      ? rows.map((r, i) => {
          const sheet = sheetOf(r.ref);
          return sheet
            ? act(r.label, () => known.open(sheet), undefined, `${i}`)
            : line(r.label, `${i}`);
        })
      : line(WORDS.nothing, 'none')}
  </View>,
];
const withKey = (label: string, ref?: string) => ({
  label: ref ? `${label} ${keyOf(ref)}` : label,
  ref,
});
/** A sheet's body from the last /story; none yet (a restored stack, a refused compile), nothing listed. */
const told =
  (rows: (s: L.Story, arg: string) => { label: string; ref?: string }[]) => (arg: string) =>
    listed(known.story ? rows(known.story, arg) : []);

sheets.trace = {
  title: (ref) => `${WORDS.trace} ${keyOf(ref)}`,
  body: told((s, ref) =>
    L.trace(s, ref).map((r) => {
      const row = withKey(r.label, r.ref);
      return r.beat ? { ...row, label: `${row.label} (${WORDS.beat(r.beat)})` } : row;
    }),
  ),
};
sheets.consequences = {
  title: (ref) => `${WORDS.consequences} ${keyOf(ref)}`,
  body: told((s, ref) =>
    consequenceRows(s, ref).map((r) => ({
      label: [r.label, r.key].filter(Boolean).join(' '),
      ref: r.ref,
    })),
  ),
};
sheets.knowledge = {
  title: (n) => `${WORDS.knowledge} · ${WORDS.beat(Number(n))}`,
  body: told((s, n) => {
    const k = knowledge(s, Number(n));
    return [
      ...k.knows.map((ref) => withKey(WORDS.knows, ref)),
      ...k.may.map((ref) => withKey(WORDS.may, ref)),
      ...k.not.map((ref) => withKey(WORDS.not, ref)),
    ];
  }),
};
sheets.facts = {
  title: () => WORDS.facts,
  body: told((s) => factRows(s).map((f) => ({ label: f.label, ref: f.ref }))),
};
sheets.pacing = {
  title: () => WORDS.pacing,
  body: told((s) =>
    pacing(s).map((p) => ({
      label: [`Part ${p.part + 1}`, p.title, WORDS.words(p.words), p.thin && WORDS.thin]
        .filter(Boolean)
        .join(' · '),
    })),
  ),
};

/** Build.tsx hands in Go there: start in the room. */
export const storySheet = (given: typeof go) => void (go = given);
export const goTo = (room: string) => go(room);
export { WORDS as STORY };
