// The Dialogue sheet's choices block (slice 5.1a, the panel's Choices and Links cards): one folded
// block per choice; Add choice a typed key's least choice; each choice's own fields, an Add… of those
// the compiler takes (choice.ts `choiceMenu`), its links and a linked nested set read-only. Every
// write passes the sheet's gate (generic.tsx); a refused key, link or remove sends nothing.
// Labels are placeholders.
import { Text, TextInput, View } from 'react-native';
import { added, minimal } from '../../../../kernel/ts/play/card.ts';
import { choiceMenu, nested, refuseRemove, RENAME } from '../../../../kernel/ts/play/choice.ts';
import type { Defs } from '../../../../kernel/ts/play/generic.ts';
import { refuseLink } from '../../../../kernel/ts/play/link.ts';
import { choices as named, refuseKey } from '../../../../kernel/ts/play/world_card.ts';
import { space, type } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { block, INPUT } from './form.tsx';
import {
  drafts,
  drop,
  id,
  opened,
  set,
  toggle,
  type At,
  type Block,
  type Obj,
} from './formwrite.ts';
import { reveals } from './reveal.ts';
import { known } from './room.tsx';
import { row, run } from './roomedit.tsx';
import { act } from './sheet.tsx';

export const WORDS = {
  add: 'Add choice',
  key: 'Choice key',
  field: 'Add…',
  rename: 'Rename',
  remove: 'Remove choice',
  clear: 'Clear',
  none: 'none',
  open: (k: string) => `Open ${k}`,
};
const CHOICE = 'DialogueChoice';
const LINKS = ['then', 'then_failed'];
const ASKED = ['sitting', 'exchange']; // the compiler asks these at play: revealed, never written
const LINE = { ...type.label, color: ink('dim') };
const say = (why: string) => void run(async () => why); // a refusal shown, nothing sent

/** The `choices` block of dialogue `doc`: `caps` the cartridge's capabilities (unread: no Add…),
 * `read` a linked file's document as last read. */
export const choices =
  (doc: Obj, caps: object | undefined, read: (file: string) => unknown): Block =>
  (at, path, node, value) =>
    block(at, path, node, value, false, () => {
      const all = (value ?? {}) as Record<string, Obj>;
      const typed = id(at, [...path, '+']);
      const add = () => {
        const k = drafts.get(typed) ?? '';
        const why = k && refuseKey(k, all);
        if (why) return say(why);
        if (k) set(at, [...path, k], minimal(at.defs[CHOICE]!, at.defs));
      };
      return [
        ...Object.entries(all).map(([k, c]) =>
          block(at, [...path, k], { $ref: `#/$defs/${CHOICE}` }, c, false, () =>
            choice(at, [...path, k], doc, k, c, caps, read),
          ),
        ),
        <View key={typed} style={row}>
          <TextInput
            accessibilityLabel={WORDS.key}
            placeholder={WORDS.key}
            style={INPUT}
            defaultValue={drafts.get(typed)}
            onChangeText={(t) => drafts.set(typed, t)}
            onSubmitEditing={add}
          />
          {act(WORDS.add, add, undefined, `add choice ${typed}`)}
        </View>,
      ];
    });

/** Choice `k`'s Rename and Remove, its fields, Add… of the absent ones, its links and nested sets. */
function choice(
  at: At,
  path: (string | number)[],
  doc: Obj,
  k: string,
  c: Obj,
  caps: object | undefined,
  read: (file: string) => unknown,
) {
  const def = at.defs[CHOICE] as { properties: Obj; required: string[] };
  const shown = (f: string) => Object.hasOwn(c, f) || reveals().includes(id(at, [...path, f]));
  const fields = Object.keys(def.properties).filter((f) => !LINKS.includes(f));
  const absent = fields.filter((f) => !shown(f));
  const menu = id(at, [...path, '+']);
  const pick = (f: string) =>
    set(
      at,
      [...path, f],
      ASKED.includes(f) ? undefined : added(c, f, at.defs as Defs, CHOICE)?.[f],
    );
  const offered = caps ? choiceMenu(doc, k, absent, caps, known.hidden) : [];
  const links = LINKS.filter((f) => f === 'then' || c.check !== undefined || c[f] !== undefined);
  return [
    edits(at, path, doc, k, c),
    ...fields
      .filter(shown)
      .map((f) =>
        block(at, [...path, f], def.properties[f] as Obj, c[f], !def.required.includes(f)),
      ),
    offered.length ? act(WORDS.field, () => toggle(menu), opened.has(menu), `add ${menu}`) : null,
    ...(opened.has(menu)
      ? offered.map((f) => act(f, () => pick(f), undefined, `add ${f} ${menu}`))
      : []),
    ...links.map((f) => link(at, [...path, f], doc, c, f as 'then' | 'then_failed', read)),
  ];
}

/** Rename (a choice's key is its id: refused) and Remove (choice.ts `refuseRemove` checks it). */
function edits(at: At, path: (string | number)[], doc: Obj, k: string, c: Obj) {
  const key = id(at, path);
  const remove = () => {
    const why = refuseRemove(doc, k);
    return why ? say(why) : drop(at, path, c);
  };
  return (
    <View key={`edit ${key}`} style={row}>
      {act(WORDS.rename, () => say(RENAME), undefined, `rename ${key}`)}
      {act(WORDS.remove, remove, undefined, `remove choice ${key}`)}
    </View>
  );
}

/** A link's value folded; open, each dialogue it may name and `end` (link.ts `refuseLink` checks the
 * pick) and Clear; a nested set it names is drawn read-only below. */
function link(
  at: At,
  path: (string | number)[],
  doc: Obj,
  c: Obj,
  f: 'then' | 'then_failed',
  read: (file: string) => unknown,
) {
  const key = id(at, path);
  const to = c[f] as string | undefined;
  const keys = named('dialogue', known.nodes);
  const pick = (t: string) => {
    const why = refuseLink(f, t, c, doc, keys, known.unlinkable);
    return why ? say(why) : set(at, path, t);
  };
  return (
    <View key={key} style={{ paddingLeft: space.md }}>
      {act(`${f}: ${to ?? WORDS.none}`, () => toggle(key), opened.has(key), `fold ${key}`)}
      {opened.has(key)
        ? [
            ...[...keys.filter((t) => !Object.hasOwn(known.unlinkable, t)), 'end'].map((t) =>
              act(t, () => pick(t), undefined, `link ${t} ${key}`, to === t),
            ),
            to === undefined
              ? null
              : act(WORDS.clear, () => drop(at, path, to), undefined, `clear ${key}`),
          ]
        : null}
      {to ? linked(to, read) : null}
    </View>
  );
}

/** Dialogue `to` when a nested set (choice.ts `nested`): Open, its prompt and choice labels read-only. */
function linked(to: string, read: (file: string) => unknown) {
  const ref = known.nodes.find((n) => n.ref.endsWith(`:dialogue/${to}`))?.ref;
  const file = ref && known.files[ref];
  const set = file ? nested(read(file) as Obj | undefined, to) : undefined;
  return set ? (
    <View style={{ paddingLeft: space.md }}>
      {act(WORDS.open(to), () => known.open(`def:${file}`), undefined, `open ${to}`)}
      <Text style={LINE}>{set.prompt}</Text>
      {set.choices.map((x, i) => (
        <Text key={i} style={LINE}>
          {x.label}
        </Text>
      ))}
    </View>
  ) : null;
}
