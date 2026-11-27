// Add mechanic… (split from form.tsx, size): a root object's fields its cartridge's capabilities
// gate (allowed.ts), each with its schema description; the refused ones greyed with why.
import type { Blocked } from '../../../../kernel/ts/play/allowed.ts';
import { side, WORDS } from './form.tsx';
import {
  id,
  opened,
  ops,
  own,
  set,
  toggle,
  type At,
  type Mechanics,
  type Write,
} from './formwrite.ts';
import { reveal } from './reveal.ts';
import { ed, run } from './roomedit.tsx';
import { act, greyed } from './sheet.tsx';

const why = (b: Blocked) => (b.caps.length ? WORDS.needs(b.caps) : WORDS.first);
/** Turn a greyed mechanic on: cartridge.json and then the field, one gesture (a refusal undoes both). */
const turn = (at: At, start: (k: string) => unknown, k: string, on: Write) => () => {
  const value = start(k); // none: the field is revealed empty once the capability is on
  const field: Write[] = value === undefined ? [] : [[at.file, at.was, own(at, ops([k], value))]];
  const empty = value === undefined && id(at, [k]); // revealed before the write: web reloads on it
  void run(async () => {
    const why = field.length ? at.gate?.(field[0]![2]) : undefined;
    if (why) return why; // the field's write refused: the capability is not turned on either
    if (empty) reveal(empty, true);
    return ed.change(on, ...field).catch((e) => (empty && reveal(empty, false), Promise.reject(e)));
  });
};

/** Add mechanic…: the fields the cartridge takes, then the refused ones greyed with why (`turn`). */
export function mechanics(
  at: At,
  m: Mechanics,
  hidden: (k: string) => boolean,
  start: (k: string) => unknown,
  said: (k: string) => string | undefined,
) {
  const menu = id(at, ['+mechanic']);
  const yes = m.allowed.filter((k) => !hidden(k));
  const no = m.blocked.filter((b) => !hidden(b.field));
  if (!yes.length && !no.length) return [];
  return [
    side(
      [],
      act(WORDS.mechanic, () => toggle(menu), opened.has(menu), `mechanic ${menu}`),
    ),
    ...(opened.has(menu)
      ? [
          ...yes.map((k) =>
            act(
              k,
              () => set(at, [k], start(k)),
              undefined,
              `mechanic ${k} ${menu}`,
              undefined,
              said(k),
            ),
          ),
          ...no.map((b) =>
            greyed(
              b.field,
              why(b),
              `mechanic ${b.field} ${menu}`,
              b.on && turn(at, start, b.field, b.on),
            ),
          ),
        ]
      : []),
  ];
}
