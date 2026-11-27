// The Room sheet's two typed rows (split from roomedit.tsx, size): Move to area and Join, an exit
// each free way to a typed room. Their gestures are mapedit.ts `move` and `link`.
import { TextInput, View } from 'react-native';
import type { MapRoom } from '../../../../kernel/ts/play/map.ts';
import { BACK } from '../../../../kernel/ts/play/mapedit.ts';
import { size } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { ed, inRow, row, run } from './roomedit.tsx';
import { act } from './sheet.tsx';

// placeholders: the owner writes these words
const WORDS = {
  area: 'Area',
  move: 'Move to area',
  to: 'Exit to',
  join: (dir: string) => `Join ${dir}`,
  noRoom: (key: string) => `No room ${key}`,
};
const drafts = new Map<string, string>(); // each room's Move field (and `join:` Join field), as typed
// read at render: roomedit.tsx's imports reach this file, so inRow is not set yet at load
const field = () => ({
  ...inRow,
  flex: 1, // mutate-skip: layout; the field fills the row's free width, ruled as Build's tap field
  minWidth: 0, // mutate-skip: layout; it may shrink
  borderBottomWidth: size.rule,
  borderColor: ink('action'),
});
/** Move to area: the field's area, or the root when it is empty. */
export const moveTo = (r: MapRoom) => (
  <View key={`move:${r.key}`} style={row}>
    <TextInput
      defaultValue={drafts.get(r.key) ?? r.area ?? ''} // drawn again, it shows what Move sends
      placeholder={WORDS.area}
      accessibilityLabel={WORDS.area}
      onChangeText={(d) => void drafts.set(r.key, d)}
      style={field()}
    />
    {act(
      WORDS.move,
      () => void run(() => ed.move(r, (drafts.get(r.key) ?? r.area ?? '').trim() || null)),
    )}
  </View>
);

/** Join: an exit each free way to the typed room and back, any level, no layout (panel linkTo). */
export const joinTo = (r: MapRoom, rooms: MapRoom[]) => (
  <View key={`join:${r.key}`} style={row}>
    <TextInput
      defaultValue={drafts.get(`join:${r.key}`)}
      placeholder={WORDS.to}
      accessibilityLabel={WORDS.to}
      onChangeText={(d) => void drafts.set(`join:${r.key}`, d)}
      style={field()}
    />
    {Object.keys(BACK)
      .filter((dir) => !r.exits.some((e) => e.dir === dir))
      .map((dir) =>
        act(WORDS.join(dir), () => {
          const to = drafts.get(`join:${r.key}`)?.trim();
          const b = rooms.find((o) => o.key === to);
          void run(async () => to && (b ? ed.link(r, dir, b) : WORDS.noRoom(to)));
        }),
      )}
  </View>
);
