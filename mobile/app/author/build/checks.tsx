// The Checks sheet (docs/system/book-ui.md#author-mode): the last compile's checks, then the files
// still holding `~` placeholders (GET /todo, the panel's Still to write).
import { Pressable, Text } from 'react-native';
import { size, space, type } from '../../book/tokens.ts';
import type { Message } from '../live.ts';
import { checks, ink } from './build.ts';
import { go, type Hooks } from './field.tsx';
import type { Said } from './tools.tsx';

const WORDS = {
  nothing: 'Nothing to check.',
  // placeholder: the owner writes these words
  todo: (file: string, n: number) => `${file} · ${n} words still to write`,
};
type Api = Hooks['api'];
const LINK = {
  minHeight: size.touch,
  justifyContent: 'center',
  paddingHorizontal: space.md,
} as const;

/** `close` shuts the sheet after a check's link went somewhere; `redraw` redraws the strip. */
export function checked(heard: Message & Said, api: Api, close: () => void, redraw: () => void) {
  const rows = checks(heard);
  const said = !rows.length ? (
    <Text key="nothing" style={{ ...type.small, color: ink('fg'), padding: space.md }}>
      {WORDS.nothing}
    </Text>
  ) : (
    rows.map((c, i) =>
      c.key || c.file ? (
        <Pressable
          key={i}
          accessibilityRole="link"
          onPress={() => {
            if (c.key ? go(c.key) : void api('/open', { file: c.file })) close();
            redraw();
          }}
          style={LINK}
        >
          <Text style={{ ...type.small, color: ink('action') }}>{c.label}</Text>
        </Pressable>
      ) : (
        <Text key={i} style={{ ...type.small, color: ink('fg'), padding: space.md }}>
          {c.label}
        </Text>
      ),
    )
  );
  return [said, ...todo(heard, api, redraw).map((t) => fileRow(t, api))];
}
type Todo = { file: string; words: number; placeholders: string[] };
let todos: { of: unknown; rows: Todo[] } = { of: undefined, rows: [] };
/** GET /todo's files, asked again after each compile; a failed ask lists none. */
function todo(heard: Message, api: Api, redraw: () => void) {
  if (todos.of !== heard) {
    const mine = (todos = { of: heard, rows: [] as Todo[] });
    api('/todo')
      .then(([status, rows]) => status === 200 && ((mine.rows = rows as Todo[]), redraw()))
      .catch(() => {});
  }
  return todos.rows;
}
const fileRow = (t: Todo, api: Api) => (
  <Pressable
    key={`todo ${t.file}`}
    accessibilityRole="link"
    onPress={() => void api('/open', { file: t.file })}
    style={LINK}
  >
    <Text style={{ ...type.small, color: ink('action') }}>{WORDS.todo(t.file, t.words)}</Text>
    {t.placeholders.map((at) => (
      <Text key={at} style={{ ...type.small, color: ink('dim') }}>
        {at}
      </Text>
    ))}
  </Pressable>
);
