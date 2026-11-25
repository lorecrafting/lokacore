// The Flow focus walk on the phone (design §7 5.5, slice 5.5b): a node centred, what leads to it above,
// what it unlocks below (kernel/ts/play/flowwalk.ts `walk`); a tap re-centres, Back steps back along
// the walk's trail, kept in the sheet id (`flow:<ref> <ref> …`) so the stack does not grow.
import { Text, type TextStyle, useWindowDimensions, View } from 'react-native';
import { FILTERS } from '../../../../kernel/ts/play/flow.ts';
import { walk } from '../../../../kernel/ts/play/flowwalk.ts';
import { fromRef } from '../../../../kernel/ts/play/storylist.ts';
import { size, space, type } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { known } from './room.tsx';
import { inRow, row } from './roomedit.tsx';
import { act, DOCK, sheets, stack } from './sheet.tsx';
import { goTo, sheetOf } from './story.tsx';

const WORDS = {
  flow: 'Flow', // placeholder words: the owner writes the labels
  filters: 'Filters…',
  above: 'Leads here',
  below: 'Unlocks',
  setters: 'Set by',
  readers: 'Read by',
  far: 'Two steps out',
  sheet: 'Sheet',
  go: (room: string) => `Go there: ${room}`,
  nothing: 'Nothing here.',
};
let filters: string[] = []; // the Flow filters on (a lane's nodes hidden; flow.ts `shownOf`)
let folded = true; // the Filters… fold

const keyOf = (ref: string) => fromRef(ref)?.key ?? ref;
const named = (ref: string) => `${fromRef(ref)?.kind} ${keyOf(ref)}`;
const line = (words: string, key: string, color = ink('fg'), look: TextStyle = inRow) => (
  <View key={key} style={row}>
    <Text style={{ ...look, color }}>{words}</Text>
  </View>
);
const heading = { ...type.label, color: ink('dim') }; // a band's heading: the field caption
// mutate-skip: layout; the centre stands between two rules across the sheet
const ruled = {
  borderTopWidth: size.rule,
  borderBottomWidth: size.rule,
  borderColor: ink('line'),
  paddingVertical: space.sm,
  rowGap: space.sm,
} as const;

/** The centre's people, items and rooms (not nodes: walk() leaves them out); a room is Go there. */
function around(ref: string) {
  const rooms = new Map(known.rooms.map((r) => [r.ref, r.key]));
  const things = new Map(known.nodes.map((n) => [n.ref, n.kind]));
  const others = new Set(
    known.story?.graph.edges.flatMap((e) =>
      e.from === ref ? [e.to] : e.to === ref ? [e.from] : [],
    ),
  );
  return [...others].flatMap((o) => {
    const room = rooms.get(o);
    if (room) return [act(WORDS.go(room), () => goTo(room), undefined, `go ${o}`)];
    const kind = things.get(o);
    return kind === 'npc' || kind === 'item'
      ? [act(keyOf(o), () => known.open(`${kind}:${keyOf(o)}`), undefined, `thing ${o}`)]
      : [];
  });
}
/** A drawn node: its name re-centres the walk on it; Sheet opens its file, if /story named one. */
const node = (trail: string[], ref: string) => {
  const sheet = sheetOf(ref);
  return (
    <View key={ref} style={row}>
      {act(
        named(ref),
        () => stack.swap(`flow:${trailTo(trail, ref).join(' ')}`),
        undefined,
        `at ${ref}`,
      )}
      {sheet ? act(WORDS.sheet, () => known.open(sheet), undefined, `sheet ${ref}`) : null}
    </View>
  );
};
/** The trail on to `ref`; back to a ref already on it, cut there (no loop to step back through). */
const trailTo = (trail: string[], ref: string) =>
  trail.includes(ref) ? trail.slice(0, trail.indexOf(ref) + 1) : [...trail, ref];
const band = (title: string, trail: string[], refs: string[], key = title) =>
  refs.length ? [line(title, key, ink('dim'), heading), ...refs.map((r) => node(trail, r))] : [];

const toggle = (f: string) =>
  act(
    f,
    () => (
      (filters = filters.includes(f) ? filters.filter((x) => x !== f) : [...filters, f]),
      known.redraw()
    ),
    undefined,
    `filter ${f}`,
    filters.includes(f),
  );
/** The Filters… fold: shut, each filter on (one press turns it off); open, every filter as a toggle. */
const toggles = () => (
  <View key="filters" style={row}>
    {act(WORDS.filters, () => ((folded = !folded), known.redraw()), !folded, 'filters')}
    {(folded ? filters : FILTERS).map(toggle)}
  </View>
);
/** The centred node: its Sheet, people, items and rooms. */
const centre = (ref: string) => {
  const sheet = sheetOf(ref);
  return (
    <View key="centre" style={ruled}>
      {line(named(ref), 'centre', ink('fg'), type.control)}
      <View style={row}>
        {sheet ? act(WORDS.sheet, () => known.open(sheet), undefined, 'sheet') : null}
        {around(ref)}
      </View>
    </View>
  );
};

function Walk({ arg }: { arg: string }) {
  const wide = useWindowDimensions().width >= DOCK.at;
  const s = known.story;
  const trail = arg.split(' ');
  const ref = trail.at(-1)!;
  if (!s) return line(WORDS.nothing, 'none');
  const w = walk(s, ref, filters);
  const fact = fromRef(ref)?.kind === 'fact';
  const near = new Set([ref, ...w.above, ...w.below]);
  // the second hop by direction, through shown nodes only: what leads to the nodes above, and so on
  const far = (side: 'above' | 'below') =>
    wide
      ? [...new Set(w[side].flatMap((r) => walk(s, r, filters)[side]))].filter((r) => !near.has(r))
      : [];
  return (
    <View style={{ rowGap: size.rule }}>
      {trail.length > 1 ? line(trail.map(keyOf).join(' › '), 'trail', ink('dim')) : null}
      {toggles()}
      {band(WORDS.far, trail, far('above'), 'far above')}
      {band(fact ? WORDS.setters : WORDS.above, trail, w.above)}
      {centre(ref)}
      {band(fact ? WORDS.readers : WORDS.below, trail, w.below)}
      {band(WORDS.far, trail, far('below'), 'far below')}
    </View>
  );
}

sheets.flow = {
  title: (arg) => `${WORDS.flow} ${keyOf(arg.split(' ').at(-1)!)}`,
  body: (arg) => <Walk arg={arg} />,
  back: (arg) => (arg.includes(' ') ? `flow:${arg.slice(0, arg.lastIndexOf(' '))}` : undefined),
};
