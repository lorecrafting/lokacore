// The Person and Item sheets, with placement, and the pencil after a person's or item's name that
// opens them (design §7, slice 2.2). Placement is the panel's (Entity.tsx: card.ts `placement`,
// world_card.ts `choices` and `refusePick`), written by mapedit.ts `put`; no words are written here.
import { Text, TextInput, View } from 'react-native';
import { placement } from '../../../../kernel/ts/play/card.ts';
import { nodeOf } from '../../../../kernel/ts/play/mapedit.ts';
import { choices, refusePick } from '../../../../kernel/ts/play/world_card.ts';
import { size, space, type } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { known, pen } from './room.tsx';
import { ed, inRow, io, refusal, row, run } from './roomedit.tsx';
import { act, sheets } from './sheet.tsx';

const WORDS = {
  edit: (key: string) => `Edit ${key}`,
  holder: { room: 'Room', npc: 'Person', item: 'Item' } as Record<string, string>,
  move: 'Move',
  spawned: (by: string) => `Spawned by ${by}`,
};
type Dir = 'npcs' | 'items';
type Doc = Record<string, unknown>;
const docs = new Map<string, Doc>(); // each source file as last read
const fresh = new Set<string>(); // the files read under the latest /story
let of = known.files; // that /story: a new one reads each file again, showing the old until then
const chosen = new Map<string, string>(); // an item's holder kind picked (by `dir:key`), until it moves
const drafts = new Map<string, string>(); // each holder field, as typed

/** The pencil after a person's or item's name (`npc.<key>.name`), which opens its sheet. */
export function thingPen(key: string | undefined, open: (id: string) => void) {
  const [, kind, k] = /^(npc|item)\.(\w+)\.name$/.exec(key ?? '') ?? [];
  return k ? pen(WORDS.edit(k), () => open(`${kind}:${k}`)) : undefined;
}

/** `file`'s JSON as last read; read again under a new /story, then the Book redraws. */
function doc(file: string) {
  if (of !== known.files) (fresh.clear(), (of = known.files));
  if (!fresh.has(file)) {
    fresh.add(file);
    io.source(file)
      .then((got) => (docs.set(file, JSON.parse(got.bytes)), known.redraw()))
      .catch(() => {}); // gone or half-written since the /story: the next one reads it again
  }
  return docs.get(file);
}

/** A person's or item's sheet: where it starts and, unless a spawn places it, a holder to move it to. */
function body(dir: Dir, key: string) {
  const kind = nodeOf(dir);
  const ref = known.nodes.find((n) => n.kind === kind && n.ref.endsWith(`/${key}`))?.ref;
  const file = known.files[ref ?? ''];
  const d = file && doc(file);
  if (!file || !d) return refusal();
  const text = { ...type.small, color: ink('dim'), paddingHorizontal: space.md };
  if (d.spawn_template !== undefined)
    return [
      refusal(),
      <Text key="spawned" style={text}>
        {WORDS.spawned(String(d.spawn_template))}
      </Text>,
    ];
  const now = placement(d, dir);
  return [
    refusal(),
    <Text
      key="summary"
      style={text}
    >{`${WORDS.holder[now.kind] ?? now.kind} · ${String(now.key ?? '')}`}</Text>,
    now.kind === 'template' ? null : holderForm(dir, key, file, now),
  ];
}

/** An item's holder kinds, then the holder field and Move (the panel's Placement, Entity.tsx). */
function holderForm(dir: Dir, key: string, file: string, now: { kind: string; key?: unknown }) {
  const holder = chosen.get(`${dir}:${key}`) ?? now.kind;
  const id = `${dir}:${key}:${holder}`;
  const move = async () => {
    const v = (drafts.get(id) ?? '').trim();
    if (!v) return undefined;
    return (
      refusePick({ kind: holder, keys: choices(holder, known.nodes) }, v) ??
      ed.put(file, dir, holder, v).then(() => void chosen.delete(`${dir}:${key}`))
    );
  };
  return [
    dir === 'items' ? (
      <View key="kinds" style={row}>
        {['room', 'npc', 'item'].map((k) =>
          act(WORDS.holder[k], () => (chosen.set(`${dir}:${key}`, k), known.redraw())),
        )}
      </View>
    ) : null,
    <View key={`put:${id}`} style={row}>
      <TextInput
        defaultValue={drafts.get(id) ?? (holder === now.kind ? String(now.key ?? '') : '')}
        placeholder={WORDS.holder[holder]}
        accessibilityLabel={WORDS.holder[holder]}
        onChangeText={(v) => void drafts.set(id, v)}
        style={{ ...inRow, flex: 1, borderBottomWidth: size.rule, borderColor: ink('action') }} // mutate-skip: layout; ruled as the Room sheet's Move field
      />
      {act(WORDS.move, () => void run(move))}
    </View>,
  ];
}

sheets.npc = { title: (key) => key, body: (key) => body('npcs', key) };
sheets.item = { title: (key) => key, body: (key) => body('items', key) };
