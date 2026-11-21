// The generic sheet's Schedule block (design §6.4, slice 2.4; the panel's blocks/Schedule.tsx): the
// day's hours down, each hour's number (moved on leaving it), its room or cases as the form draws
// them, and its Remove; then Add hour. The logic is kernel/ts/play/blocks.ts. Labels are placeholders.
import { TextInput, View } from 'react-native';
import { addHour, NO_HOUR, rehour } from '../../../../kernel/ts/play/blocks.ts';
import { plain } from '../../../../kernel/ts/play/card.ts';
import { shapeOf } from '../../../../kernel/ts/play/generic.ts';
import { block, field, INPUT, WORDS as FORM } from './form.tsx';
import {
  drafts,
  drop,
  id,
  ops,
  set,
  type At,
  type Block,
  type Obj,
  type Step,
} from './formwrite.ts';
import { ed, row, run } from './roomedit.tsx';
import { act, greyed } from './sheet.tsx';

export const WORDS = { add: 'Add hour', hour: (h: string) => `hour ${h}` };

/** Hour `h`: its number, written as the schedule moved on leaving the field (a refusal is shown,
 * never written), its value, and its Remove. */
function hour(at: At, path: Step[], sched: Obj, h: string, each: Obj | undefined, perDay?: number) {
  const key = id(at, [...path, h, '#']);
  const move = () => {
    const t = (drafts.get(key) ?? h).trim();
    void run(async () => {
      const moved = rehour(sched, h, t, perDay);
      if (typeof moved === 'string') return moved; // the draft stays, as shown: leaving again refuses again
      if (t !== h) await ed.change([at.file, at.was, ops(path, moved)]);
      drafts.delete(key);
    });
  };
  return (
    <View key={key} style={row}>
      <TextInput
        accessibilityLabel={WORDS.hour(h)}
        defaultValue={h}
        style={{ ...INPUT, flexGrow: 0, width: 48 }}
        onChangeText={(t) => void drafts.set(key, t)}
        onBlur={move}
      />
      {field(at, [...path, h], each, sched[h])}
      {act(FORM.remove, () => drop(at, [...path, h], sched[h]), undefined, `remove ${key}`)}
    </View>
  );
}

/** The Schedule block for an NPC in `room` on a day of `perDay` hours (the cartridge's calendar). */
export const schedule =
  (room: unknown, perDay?: number): Block =>
  (at, path, node, value, removable) => {
    const sched: Obj = plain(value) ? value : {};
    const [s] = shapeOf(node, value, at.defs, at.seen);
    const each = s.as === 'object' ? s.each : undefined;
    const next = addHour(sched, room, perDay);
    const key = id(at, [...path, '+hour']);
    return block(at, path, node, value, removable, () => [
      ...Object.keys(sched).map((h) => hour(at, path, sched, h, each, perDay)),
      next
        ? act(WORDS.add, () => set(at, path, next), undefined, key)
        : greyed(WORDS.add, NO_HOUR, key),
    ]);
  };
