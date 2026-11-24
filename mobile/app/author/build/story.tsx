// The notebook's Story tab (design §4.8, slice 5.4b): the panel's Story list (kernel/ts/play/storylist.ts `rows`)
// as rows. A node row has Go there, Sheet, Trace and Consequences; a part adds a beat; a beat binds, retitles,
// is removed and shows Knowledge. Trace, Consequences, Knowledge, Facts and Pacing are sheets.
import { Text, TextInput, View } from 'react-native';
import * as L from '../../../../kernel/ts/play/storylist.ts';
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
  trace: 'Trace',
  consequences: 'Consequences',
  knowledge: 'Knowledge',
  facts: 'Facts',
  pacing: 'Pacing',
  add: 'Add beat',
  number: 'number',
  title: 'title',
  retitle: 'Retitle',
  remove: 'Remove',
  bind: (short: string) => `Bind ${short}`,
  beat: (n: number) => `Beat ${n}`,
  knows: 'Knows',
  may: 'May know',
  not: 'Not yet',
  words: (n: number) => `${n} words`,
  thin: 'thin',
  nothing: 'Nothing here.',
};

let st: L.ListState = L.LIST; // the parts and beats opened or shut
let picked: string | undefined; // the row whose actions show under it
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
const sheetOf = (ref?: string) => (ref && known.files[ref] ? `def:${known.files[ref]}` : undefined);
// ponytail: the first room a story edge joins `ref` to (an NPC's start, a scene's room); none, no Go there
const roomOf = (ref: string) => {
  const rooms = new Map(known.rooms.map((r) => [r.ref, r.key]));
  const e = known.story?.graph.edges.find(
    (e) => (e.from === ref && rooms.has(e.to)) || (e.to === ref && rooms.has(e.from)),
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
const field = (label: string, drafts: Map<string, string>, id: string, shown?: string) => (
  <TextInput
    key={`${label}:${id}`}
    accessibilityLabel={label}
    placeholder={label}
    defaultValue={drafts.get(id) ?? shown}
    onChangeText={(v) => void drafts.set(id, v)}
    style={{ ...inRow, flex: 1, borderBottomWidth: size.rule, borderColor: ink('action') }} // mutate-skip: layout; ruled as the Room sheet's Move field
  />
);

/** A node row's actions: each one a sheet or the room it plays in. */
function nodeActs(r: L.Row) {
  const room = roomOf(r.ref!);
  const sheet = sheetOf(r.ref);
  return [
    <View key="acts" style={row}>
      {room ? act(WORDS.go, () => go(room)) : null}
      {sheet ? act(WORDS.sheet, () => known.open(sheet)) : null}
      {L.TRACED.has(r.node!) ? act(WORDS.trace, () => known.open(`trace:${r.ref}`)) : null}
      {L.CONSEQUENCES.has(r.node!)
        ? act(WORDS.consequences, () => known.open(`consequences:${r.ref}`))
        : null}
    </View>,
  ];
}

/** A beat's edits, each one gesture (one Undo): Retitle ('' removes the title), Remove, Bind a short ref. */
function beatActs(r: L.Row, s: L.Story) {
  const part = partNo(r.parent!);
  return [
    <View key="edit" style={row}>
      {field(WORDS.title, titles, r.id, r.label)}
      {act(
        WORDS.retitle,
        () => void run(() => ed.titleBeat(part, r.n!, titles.get(r.id) ?? r.label)),
      )}
      {act(WORDS.remove, () => void run(() => ed.dropBeat(part, r.n!)))}
      {act(WORDS.knowledge, () => known.open(`knowledge:${r.n}`))}
    </View>,
    <View key="bind" style={row}>
      {/* ponytail: every short ref; one already bound is refused (outlineedit), as /story gives refs, not shorts */}
      {s.shorts.map((short) =>
        act(WORDS.bind(short), () => void run(() => ed.bind(part, r.n!, short, s.shorts))),
      )}
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
  const press = () => {
    if (r.open !== undefined) st = L.toggle(st, r.id);
    picked = picked === r.id ? undefined : r.id;
    known.redraw();
  };
  const head =
    r.kind === 'seed' ? line(label, 'head') : act(label, press, r.open, 'head', picked === r.id);
  const adds = r.id.startsWith('part:') && [
    field(WORDS.number, numbers, r.id),
    act(WORDS.add, () => void run(() => ed.addBeat(partNo(r.id), Number(numbers.get(r.id))))),
  ];
  const acts =
    picked !== r.id
      ? []
      : r.kind === 'node'
        ? nodeActs(r)
        : r.kind === 'beat'
          ? beatActs(r, s)
          : [];
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

/** The Story tab's body: the refusal, Facts and Pacing, why there are no beats, then the rows. */
export function storyRows() {
  const s = known.story;
  if (!s) return [];
  const why = L.note(s);
  return [
    refusal(),
    <View key="sheets" style={row}>
      {act(WORDS.facts, () => known.open('facts:'))}
      {act(WORDS.pacing, () => known.open('pacing:'))}
    </View>,
    why ? (
      <View key="why" style={column}>
        {line(why, 'why')}
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
export { WORDS as STORY };
