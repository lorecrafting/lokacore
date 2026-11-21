// The notebook's Contents, minimal (design §7, slice 2.2): every kind New makes (kernel/ts/play/new.json),
// each with its New; a person or item made opens its sheet. The full notebook is a later slice's.
import { TextInput, View } from 'react-native';
import NEW from '../../../../kernel/ts/play/new.json' with { type: 'json' };
import { create, NAMED, nodeOf } from '../../../../kernel/ts/play/mapedit.ts';
import { size } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { known } from './room.tsx';
import { inRow, io, refusal, row, run } from './roomedit.tsx';
import { act, sheets } from './sheet.tsx';

const WORDS = { contents: 'Notebook', new: (kind: string) => `New ${kind}` };
const names = new Map<string, string>(); // a NAMED kind's key, as typed

/** New `kind`: its starter under a free key (or the typed one); a person or item opens its sheet. */
const made = (kind: string) =>
  run(async () => {
    const [status, all] = (await known.api?.('/templates')) ?? []; // the templates' keys are taken too
    const temps: { dir: string; key: string }[] = status === 200 && Array.isArray(all) ? all : [];
    const held = temps.filter((t) => t.dir === kind).map((t) => t.key);
    const key = await create(io, kind, known.nodes, held, names.get(kind));
    names.delete(kind);
    if (key && (kind === 'npcs' || kind === 'items')) known.open(`${nodeOf(kind)}:${key}`);
  });

sheets.contents = {
  title: () => WORDS.contents,
  body: () => [
    refusal(),
    ...NEW.map((kind) => (
      <View key={kind} style={row}>
        {NAMED.includes(kind) ? (
          <TextInput
            accessibilityLabel={kind}
            placeholder={kind}
            defaultValue={names.get(kind)}
            onChangeText={(v) => void names.set(kind, v)}
            style={{ ...inRow, flex: 1, borderBottomWidth: size.rule, borderColor: ink('action') }} // mutate-skip: layout; ruled as the Room sheet's Move field
          />
        ) : null}
        {act(WORDS.new(kind), () => void made(kind))}
      </View>
    )),
  ],
};
export { WORDS as CONTENTS };
