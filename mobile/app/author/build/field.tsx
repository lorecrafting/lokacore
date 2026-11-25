// Build's in-place field (docs/system/book-ui.md#author-mode; slice 1.3 of
// docs/rnd/in-game-builder-mode-2026-11-19.md §7): in Build a tap on a description's plain words
// opens a field on that line, through the Book seam. A link inside keeps its own press. The server
// calls and the edit rules are E5's (inbook.ts, prose_rules.ts). A release never holds this module
// (author/seam.test.ts looks for its `Unwritten: ` hint).
import type { ComponentProps, ReactNode } from 'react';
import { Text, TextInput } from 'react-native';
import { plain } from '../../book/model.ts';
import { size, space, type } from '../../book/tokens.ts';
import type { api } from '../inbook.ts';
import { drawnWords, noFieldNote, oneLine, saving, unwritten } from '../prose_rules.ts';
import { ink } from './build.ts';

type Props = ComponentProps<typeof Text>;
type At = { file: string; line: number; was: string; words: string; scene?: true }; // scene: a `.scene` choice line
type Field = {
  key: string;
  at?: At;
  draft: string;
  note?: string;
  choices?: [string, () => void][];
};
export type Hooks = {
  on: () => boolean;
  seen: Map<string, string>; // words -> key, as panel.tsx binds them
  said: Map<string, string>; // key -> its source words
  redraw: () => void; // the Book's
  focus: () => void; // auto-hold (Build.tsx `hold`)
  commit: () => void;
  api: typeof api; // E5's, handed in by panel.tsx behind its require gate
  wrote: (w: Wrote) => void; // a saved write, for the strip's Undo chip
  unsee?: () => boolean; // ends See as (seeas.tsx); true when it was on
  pencil?: (shown: string, key?: string) => ReactNode; // the title pencil: a room page's own title, a person's or item's name
  icons?: (key: string, words: () => void) => ReactNode; // a choice label's icon row (talk.tsx)
  scene?: (key: string) => Promise<At | undefined>; // a `.scene` choice label's line, else none
};
/** A saved write as /undo puts it back: its journal id, and the key and old words the Book shows at once. */
export type Wrote = { id: number; key: string; words: string; file: string };
let hooks: Hooks | undefined;
let field: Field | undefined;
let busy = false; // a /line or /edit in flight
let unconfirmed = new Set<string>();
const enc = encodeURIComponent;

export const attach = (given: Hooks) => void (hooks = given);
/** A pushed message: the keys whose written words the last compile refused. */
export const heard = (keys: string[] = []) => void (unconfirmed = new Set(keys));

const flat = (c: ReactNode): string =>
  Array.isArray(c)
    ? c.map(flat).join('')
    : typeof c === 'string'
      ? c
      : c && typeof c === 'object' && 'props' in c
        ? flat((c.props as { children?: ReactNode }).children)
        : '';
const LABEL = /^dialogue\.\w+\.choices\.\w+\.label$/; // drawn inside its card, which plays
const EDITS = /\.description$|^dialogue\.\w+\.(prompt|choices\.\w+\.label)$/;
/** The key a line draws whole (a description, a dialogue's prompt or a choice's label): its bound
 * words, else its source with links as words.
 * ponytail: one paragraph of a many-paragraph description matches no key, so it does not edit. */
function keyOf(h: Hooks, shown: string) {
  const w = drawnWords(h.seen, shown);
  const keys = w
    ? [h.seen.get(w)!]
    : [...h.said].filter(([, s]) => s && plain(s).trim() === shown.trim()).map(([k]) => k); // a key with no words is undefined
  return keys.length === 1 && EDITS.test(keys[0]) ? keys[0] : undefined;
}

/** The one person's or item's name in these words: two in the same words (or two new `~`) get none. */
function nameKey(h: Hooks, shown: string) {
  const keys = [...h.said].filter(
    ([k, s]) => /^(npc|item)\.\w+\.name$/.test(k) && s && plain(s).trim() === shown.trim(),
  );
  return keys.length === 1 ? keys[0][0] : undefined;
}

/** The seam's line: Build off or no key leaves it as drawn; a link keeps its own press, an unwritten
 * one drawn blank with its caption (ruling 9). */
export function line(p: Props): Props {
  const h = hooks;
  if (!h?.on()) return p;
  const shown = flat(p.children);
  const blank = unwritten(shown);
  if (p.onPress)
    return blank
      ? {
          ...p,
          accessibilityLabel: 'Unwritten name, open',
          style: [p.style, BLANK],
          children: hint('name'),
        }
      : p;
  if (p.accessibilityRole === 'header') {
    const [thing, pen] = [nameKey(h, shown), h.pencil?.(shown, nameKey(h, shown))];
    const caption = pen && !thing ? 'title' : 'name'; // a pencil with no thing's key is the room's title
    if (pen || blank) return { ...p, children: [blank ? hint(caption) : p.children, pen] };
  }
  const key = keyOf(h, shown);
  return key ? editable(h, p, key, shown, blank) : p;
}
/** Line `p` that draws key `key` whole: its field when open, else a press that opens it. A choice's
 * label is inside its card, which plays: the label takes no press, its words icon opens the field. */
function editable(h: Hooks, p: Props, key: string, shown: string, blank: boolean): Props {
  const name = key.slice(key.lastIndexOf('.') + 1);
  const label = LABEL.test(key);
  if (field?.key === key && field.at)
    return {
      ...p,
      children: open(h, field, field.at, name, p),
      // inside a card: a tap or key in the field is not the card's
      ...(label && ({ onPress: stop, onKeyDown: stop } as object)),
    };
  const marked = unconfirmed.has(key);
  const press = () => void edit(h, key);
  const own = {
    style: [p.style, blank && BLANK, marked && MARKED],
    children: [
      blank ? hint(name) : p.children,
      field?.key === key && field.note && (
        <Text key="note" style={CAPTION}>{`\n${field.note}`}</Text>
      ),
      label && h.icons?.(key, press),
    ],
  };
  if (label) return { ...p, ...own };
  return {
    ...p,
    accessibilityRole: 'button',
    accessibilityLabel: `${blank ? `Unwritten ${name}` : shown}${marked ? ', unconfirmed' : ''}, edit`,
    onPress: press,
    ...({ onKeyDown: keyed(press) } as object), // web Text has no key press
    ...own,
  };
}
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
/** An unwritten line's name in place of its `~` (ruling 9). */
const hint = (name: string) => (
  <Text key="blank" style={{ ...type.small, color: ink('dim') }}>
    {name}
  </Text>
);
/** Enter or Space on the line itself: a link's own key bubbles up from inside and is not ours. */
const keyed = (press: () => void) => (e: KeyboardEvent) =>
  e.target === e.currentTarget &&
  (e.key === 'Enter' || e.key === ' ') &&
  (e.preventDefault(), press());
const BLANK = { borderBottomWidth: size.rule, borderColor: ink('line') };
const MARKED = {
  textDecorationLine: 'underline',
  textDecorationStyle: 'wavy' as 'dashed', // web draws wavy; RN's types stop at dashed
  textDecorationColor: ink('warning'),
} as const;
const NOTE = { ...type.label, color: ink('warning') };
const CAPTION = { ...type.label, color: ink('dim') };
const CHOICE = {
  ...type.control,
  color: ink('action'),
  lineHeight: size.touch,
  paddingHorizontal: space.md,
};

async function edit(h: Hooks, key: string) {
  if (h.unsee?.()) return; // the words See as shows are not the key's: a tap first shows them again
  if (busy) return; // a tap elsewhere replaces a field left open (a notice, another page)
  busy = true;
  const [status, at] = await Promise.resolve(h.scene?.(key))
    .then((s): [number, any] | Promise<[number, any]> =>
      s ? [200, s] : h.api(`/line?key=${enc(key)}&words=${enc(h.said.get(key) ?? '')}`),
    )
    .finally(() => (busy = false));
  field =
    status === 200
      ? { key, at, draft: unwritten(at.words) ? '' : at.words }
      : { key, draft: '', note: noFieldNote(key, typeof at === 'string' ? at : undefined) };
  h.redraw();
}
/** A Checks row's line: its field when this page draws the key, else the source in the owner's
 * editor, as E5 does (inbook.ts `edit`). False: not on this page. */
export function go(key: string) {
  const h = hooks!; // install attaches it before Build can open the Checks sheet
  const here = EDITS.test(key) && [...h.seen.values()].includes(key); // as keyOf draws
  void (here ? edit(h, key) : h.api('/open', { key, words: h.said.get(key) ?? '' }));
  return here;
}
/** Build turned on or off: no field stays open, and the Book redraws its lines. */
export const shut = () => hooks && close(hooks);
function close(h: Hooks) {
  field = undefined;
  h.commit();
  h.redraw();
}
function say(h: Hooks, f: Field, note: string, choices?: Field['choices']) {
  Object.assign(f, { note, choices });
  h.redraw();
}
async function save(h: Hooks, f: Field) {
  if (busy || field !== f || f.choices) return; // a blur from pressing Keep mine saves nothing
  const at = f.at!;
  const draft = oneLine(f.draft);
  // ruling 9: an unwritten line left empty stays `~`
  const choice = unwritten(at.words) && !draft.trim() ? 'unchanged' : saving(draft, at.words);
  if (choice === 'unchanged') return close(h);
  if (choice === 'empty') return say(h, f, 'Empty. Esc keeps the words.');
  busy = true;
  const { file, line, was } = at;
  const [status, answer] = await h
    .api(
      ...((at.scene // a `.scene` choice's words: its reword (decision 11; /set takes no label)
        ? ['/restructure', { file, was, op: { reword: { line, words: draft } }, carry: [] }]
        : ['/edit', { file, line, was, words: draft, key: f.key }]) as [string, object]),
    )
    .finally(() => (busy = false));
  if (status === 200) h.wrote({ id: answer.id, key: f.key, words: at.words, file });
  if (field !== f) return; // closed (Esc) while it saved
  if (status === 200) return close(h); // the server sends the new words at once (kernel/ts/play/told.ts)
  if (status !== 409)
    return say(h, f, typeof answer === 'string' ? answer : `Not saved (${status}).`);
  const [got, theirs] = at.scene
    ? [200, await h.scene!(f.key)]
    : await h.api(`/line?key=${enc(f.key)}&words=${enc(at.words)}`);
  if (got !== 200 || !theirs)
    return say(h, f, 'Changed on disk since you opened it.', [
      ['Open source', () => (void h.api('/open', { key: f.key, words: at.words }), close(h))],
    ]);
  say(h, f, `Changed on disk since you opened it. ${theirs.words}`, [
    ['Keep mine', () => ((f.at = theirs), (f.choices = undefined), void save(h, f))],
    ['Take theirs', () => close(h)],
  ]);
}

/** The open field in the line's own Text: the source words, then its caption or notice. */
function open(h: Hooks, f: Field, at: At, name: string, p: Props) {
  return [
    <TextInput
      key="field"
      autoFocus
      multiline // the line wraps as the Book drew it; Enter still saves (blurOnSubmit)
      blurOnSubmit
      defaultValue={f.draft}
      placeholder={`Unwritten: ${name}`}
      accessibilityLabel={name}
      onFocus={h.focus}
      onChangeText={(d) => void (f.draft = d)}
      onSubmitEditing={() => void save(h, f)}
      onBlur={() => (h.commit(), void save(h, f))} // the Hold lasts while it has focus
      onKeyPress={(e) => {
        const k = e.nativeEvent as { key: string; shiftKey?: boolean };
        if (k.key === 'Escape') close(h);
        if (k.key === 'Enter' && k.shiftKey) e.preventDefault(); // one line
      }}
      style={[p.style, { width: '100%', borderBottomWidth: size.rule, borderColor: ink('action') }]}
    />,
    <Text key="note" style={f.choices ? NOTE : CAPTION}>
      {`${f.note ?? `${at.file}:${at.line}  Enter saves · Esc cancels`}`}
    </Text>,
    ...(f.choices ?? []).map(([label, run]) => (
      <Text key={label} accessibilityRole="button" onPress={run} style={CHOICE}>
        {label}
      </Text>
    )),
  ];
}
