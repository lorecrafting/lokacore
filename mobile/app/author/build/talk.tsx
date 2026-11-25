// The conversation in Build (docs/rnd/in-game-builder-mode-2026-11-19.md §4.6, slice 5.1b): an icon
// row under each choice's label, inside its card, and a header line under the person's title. The
// label's own field is field.tsx's; a `.scene` label's line and its writes are found here.
import { Text } from 'react-native';
import { sentences } from '../../../../kernel/ts/play/why_words.ts';
import { choiceLabel, rows } from '../../../../kernel/ts/play/scene_choice.ts';
import type { Game } from './seeas.tsx';
import { id, opened, type At as Form } from './formwrite.ts';
import { known, pen } from './room.tsx';
import { ed, io, run } from './roomedit.tsx';
import { ink } from './build.ts';
import { type } from '../../book/tokens.ts';
import { thingPen } from './thing.tsx';

export const WORDS = {
  words: 'words',
  when: 'when',
  does: 'does',
  goes: 'goes',
  offered: (when: string) => `Offered when: ${when} · repeats `,
  policy: 'when it is offered',
  always: 'always',
  choice: '＋ Add choice',
  line: '＋ Add line',
};
const LABEL = /^dialogue\.(\w+)\.choices\.(\w+)\.label$/;
type Opens = (id: string) => void;

/** Dialogue `d`'s ref (the canon's key), as choices.tsx `linked` finds it, and its source file. */
const refOf = (d: string) => known.nodes.find((n) => n.ref.endsWith(`:dialogue/${d}`))?.ref ?? '';
const fileOf = (d: string) => known.files[refOf(d)] as string | undefined;

/** Opens `file`'s sheet with the folds on `path` open and every other choice folded. */
function sheetAt(file: string, open: Opens, path: string[]) {
  const at = { file } as Form;
  for (const k of [...opened]) if (k.startsWith(`${file}:["choices",`)) opened.delete(k);
  path.forEach((_, i) => opened.add(id(at, path.slice(0, i + 1))));
  open(`def:${file}`);
}

/** The icon row of choice label `key` (words, when, does, goes): lit when the choice has it. A
 * `.scene` choice has words only: the def sheet draws JSON. */
export function icons(g: Game | undefined, open: Opens, key: string, words: () => void) {
  const [, d, c] = LABEL.exec(key) ?? [];
  const file = d && fileOf(d);
  const choice = g?.canon().dialogues?.[refOf(d)]?.choices?.[c] as
    Record<string, unknown> | undefined;
  const has = (f: string) => choice?.[f] !== undefined;
  // the choice's own field when it has one, else its Add… menu
  const at = (f: string) => (has(f) ? ['choices', c, f] : ['choices', c, '+']);
  const goes = has('then_failed') && !has('then') ? 'then_failed' : 'then'; // `then` is always drawn
  const json = file && !file.endsWith('.scene');
  return [
    <Text key="row">{'\n'}</Text>,
    pen(WORDS.words, words, '✎ words', true),
    ...(json
      ? [
          pen(WORDS.when, () => sheetAt(file, open, at('policy')), '  ◇ when', has('policy')),
          pen(WORDS.does, () => sheetAt(file, open, at('steps')), '  ↦ does', has('steps')),
          pen(WORDS.goes, () => sheetAt(file, open, ['choices', c, goes]), '  → goes', has(goes)),
        ]
      : []),
  ];
}

/** A `.scene` choice label's line, for field.tsx's reword (scene_choice.ts `rows`); none for JSON. */
export async function sceneLine(key: string) {
  const [, d, c] = LABEL.exec(key) ?? [];
  const file = d && fileOf(d);
  if (!file?.endsWith('.scene')) return undefined;
  const got = await io.source(file).catch(() => undefined); // gone: no field, else Changed on disk
  if (!got) return undefined;
  const keys = rows(got.bytes.split('\n')).map((r) => r.key);
  const at = keys.indexOf(c);
  // ponytail: a key repeated in nested sets is not told apart (no dialogue nesting here): no field
  if (at < 0 || keys.lastIndexOf(c) !== at) return undefined;
  const words = choiceLabel(got.bytes.split('\n')[at].trim().slice(2));
  return { file, line: at + 1, was: got.sha256, words, scene: true as const };
}

/** The header line under the person's title while their talk waits: when it is offered, then
 * Add choice, and for a `.scene` Add line. */
export function header(g: Game | undefined, open: Opens) {
  const [, d] =
    /^dialogue\.(\w+)\.prompt$/.exec(g?.game?.view().view.choice?.prompt.key ?? '') ?? [];
  const file = d && fileOf(d);
  if (!file) return undefined;
  const policy = g?.canon().dialogues?.[refOf(d)]?.policy;
  const when = policy
    ? sentences({ policy })
        .map((r) => r.text)
        .join('; ')
    : WORDS.always;
  const scene = file.endsWith('.scene');
  return [
    <Text key="header">{'\n'}</Text>,
    <Text key="when" style={{ ...type.small, color: ink('dim') }}>
      {WORDS.offered(when)}
    </Text>,
    pen(WORDS.policy, () => sheetAt(file, open, ['policy']), '⚙→'),
    <Text key="choice">{'\n'}</Text>, // the acts start at the title's left edge
    pen(
      WORDS.choice,
      () => (scene ? addTo(file, 'choice') : sheetAt(file, open, ['choices'])),
      WORDS.choice,
    ),
    ...(scene
      ? [<Text key="line">{'\n'}</Text>, pen(WORDS.line, () => addTo(file, 'words'), WORDS.line)]
      : []),
  ];
}

/** A person's or item's pencil (thing.tsx) and, while their talk waits, the header line under the
 * title: found by the waiting prompt, not the title's words ("The cook" is not the name "cook"). */
export function titled(g: Game | undefined, open: Opens, key?: string) {
  const [pen, talk] = [thingPen(key, open), header(g, open)];
  return pen && talk ? (
    <>
      {pen}
      {talk}
    </>
  ) : (
    pen || talk || undefined
  );
}

/** A new choice after the last top-level choice's block (else the last line), or new words after
 * the last line before the first choice: one /restructure add (scene_card.ts). */
const addTo = (file: string, kind: 'choice' | 'words') =>
  run(async () => {
    const got = await io.source(file);
    const rs = rows(got.bytes.split('\n'));
    const first = rs.findIndex((r) => r.key && r.indent === 0);
    const top = rs.findLastIndex((r) => r.key && r.indent === 0);
    const filled = (to: number) => rs.slice(0, to).findLastIndex((r) => r.text.trim()) + 1;
    const after = kind === 'choice' && top >= 0 ? top + 1 : filled(first < 0 ? rs.length : first);
    // through the editor: one Undo entry, as the JSON sheet's writes (a refusal throws its reason)
    await ed.call('restructure', {
      file,
      was: got.sha256,
      op: { add: { after, kind } },
      carry: [],
    });
  });
