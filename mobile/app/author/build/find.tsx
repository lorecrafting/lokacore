// Find (slice 6.3b, the panel's reading.tsx Find): a key or words to every source line (GET /find,
// find.ts `find`) and the definitions referring to that key; a sheet's own referrers (GET /users,
// the delete gate find.ts `users`). Each one opens: a JSON source its sheet, any other file as
// Checks opens one (POST /open).
import { Text, TextInput, View } from 'react-native';
import { size } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { known } from './room.tsx';
import { inRow, row } from './roomedit.tsx';
import { act } from './sheet.tsx';

type Referrer = { kind: string; by: string; at?: string }; // find.ts Referrer (it reads node:fs)

// placeholder: the owner writes these words
const WORDS = {
  key: 'key or words',
  find: 'Find',
  by: (r: Referrer) => `${r.by} (${r.kind})`,
  lines: (shown: number, total: number) =>
    `Lines: ${shown < total ? `first ${shown} of ${total}` : total}`,
  referredBy: 'Referred to by',
  failed: (status: number) => `Find failed: ${status}`,
};
type Found = { hits: { at: string; text: string }[]; total: number; refs: Referrer[] };
let q = '';
let found: Found | string | undefined; // the last answer, or why there is none

/** Opens `at` (`<file>:<line>`): a JSON file's sheet, else the file where Checks opens one, at
 * `key`'s line there (POST /open takes no line). */
export const opens = (at: string, key: string) => {
  const file = at.slice(0, at.lastIndexOf(':'));
  return file.endsWith('.json')
    ? known.open(`def:${file}`)
    : void known.api?.('/open', { file, key }).catch(() => {});
};
/** A referrer: its definition's link when the server placed it, else its name, dim. */
const referrer = (r: Referrer) =>
  r.at ? (
    act(WORDS.by(r), () => opens(r.at!, r.by), undefined, `by ${r.by} ${r.kind}`)
  ) : (
    <Text key={`by ${r.by} ${r.kind}`} style={{ ...inRow, color: ink('dim') }}>
      {WORDS.by(r)}
    </Text>
  );
const dim = (text: string, key: string) => (
  <Text key={key} style={{ ...inRow, color: ink('dim') }}>
    {text}
  </Text>
);

const search = () =>
  known.api?.(`/find?q=${encodeURIComponent(q)}`).then(
    ([status, f]) => (
      (found = status === 200 ? (f as Found) : WORDS.failed(status)),
      known.redraw()
    ),
    (e: Error) => ((found = e.message), known.redraw()),
  );

/** The Contents tab's Find: the field, then the referrers and the lines of the last answer. */
export function findRows() {
  const answer = typeof found === 'object' ? found : undefined;
  return [
    <View key="find" style={row}>
      <TextInput
        accessibilityLabel={WORDS.key}
        placeholder={WORDS.key}
        defaultValue={q}
        onChangeText={(v) => void (q = v)}
        onSubmitEditing={() => void search()}
        style={{ ...inRow, flex: 1, borderBottomWidth: size.rule, borderColor: ink('action') }} // mutate-skip: layout; ruled as the Room sheet's Move field
      />
      {act(WORDS.find, () => void search())}
    </View>,
    typeof found === 'string' ? dim(found, 'find said') : null,
    ...(answer
      ? [
          <View key="refs" style={row}>
            {dim(WORDS.referredBy, 'refs title')}
            {answer.refs.map(referrer)}
          </View>,
          <View key="lines" style={row}>
            {dim(WORDS.lines(answer.hits.length, answer.total), 'lines title')}
          </View>,
          ...answer.hits.map((h) => (
            <View key={`hit ${h.at}`} style={row}>
              {act(h.at, () => opens(h.at, q))}
              {dim(h.text, 'text')}
            </View>
          )),
        ]
      : []),
  ];
}

const lists = new Map<string, Referrer[]>(); // each file's referrers, asked under the latest /story
let listed: unknown; // that /story
/** A sheet's referrers (the definitions its Delete would leave dangling), asked on a press. */
export function referredBy(file: string) {
  if (listed !== known.files) (lists.clear(), (listed = known.files));
  const ask = () =>
    void known.api?.(`/users?file=${encodeURIComponent(file)}`).then(
      ([status, left]) => status === 200 && (lists.set(file, left as Referrer[]), known.redraw()),
      () => {}, // the server down: the press can be tried again
    );
  return lists.get(file)?.map(referrer) ?? [act(WORDS.referredBy, ask, false, 'referred by')];
}
