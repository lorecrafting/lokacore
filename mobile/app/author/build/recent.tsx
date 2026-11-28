// The notebook's Recent tab (slice 6.3b, the panel's change feed and undo): the editor's journal
// (GET /journal, write.ts), newest first, each change yours or from outside, each one put back by
// its own id (POST /undo); a file changed since is refused and named (in-game-builder-mode §5).
import { Text, View } from 'react-native';
import { ink } from './build.ts';
import { known } from './room.tsx';
import { inRow, refusal, row, run } from './roomedit.tsx';
import { act } from './sheet.tsx';

// placeholder: the owner writes these words
export const WORDS = {
  tab: 'Recent',
  you: 'you',
  outside: 'outside',
  back: 'Put back',
  nothing: 'No change yet.',
  // what each change did, by the journal entry's first word (write.ts `what`); an outside one says none
  did: {
    new: 'new',
    delete: 'delete',
    move: 'move',
    rename: 'rename',
    undo: 'put back',
    outside: '',
  } as Record<string, string>,
  edit: 'edit',
  from: 'from', // a row delete (`delete <section> <key>`): its key, from its file
  notUndone: (file: string) => `${file} changed since; not put back.`,
};
type Entry = { id: number; at: number; what: string; by: 'editor' | 'outside'; files: string[] };
let journal: { of: unknown; rows: Entry[] } = { of: undefined, rows: [] };

/** GET /journal, asked again under each new /story (the last rows stay until it answers); a failed ask lists none. */
function entries() {
  if (journal.of !== known.files) {
    const mine = (journal = { of: known.files, rows: journal.rows });
    const answer = (rows: Entry[]) => journal === mine && ((mine.rows = rows), known.redraw());
    void known.api?.('/journal').then(
      ([status, rows]) => answer(status === 200 ? (rows as Entry[]) : []),
      () => answer([]),
    );
  }
  return journal.rows;
}
/** Puts entry `id` back; a refusal names the file changed since (the 409's own), or says the server's why. */
const putBack = (id: number) =>
  run(async () => {
    const [status, body] = await known.api!('/undo', { id });
    journal.of = undefined; // asked again either way
    if (status === 200) return;
    return body?.file ? WORDS.notUndone(body.file) : String(body);
  });

const did = (what: string) => {
  const [verb, , key] = what.split(' ');
  const said = WORDS.did[verb] ?? WORDS.edit;
  return verb === 'delete' && key ? `${said} ${key} ${WORDS.from}` : said;
};
const clock = (at: number) => new Date(at).toTimeString().slice(0, 5); // mutate-skip: a local HH:MM

export function recentRows() {
  const rows = entries();
  return [
    refusal(),
    rows.length ? null : (
      <Text key="nothing" style={{ ...inRow, color: ink('dim') }}>
        {WORDS.nothing}
      </Text>
    ),
    ...rows.map((e) => (
      <View key={e.id} style={row}>
        <Text style={{ ...inRow, color: ink(e.by === 'outside' ? 'warning' : 'dim') }}>
          {`${clock(e.at)} ${e.by === 'outside' ? WORDS.outside : WORDS.you} · ${[did(e.what), e.files.join(', ')].filter(Boolean).join(' ')}`}
        </Text>
        {act(WORDS.back, () => void putBack(e.id), undefined, `back ${e.id}`)}
      </View>
    )),
  ];
}
