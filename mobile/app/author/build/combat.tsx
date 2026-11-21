// The generic sheet's Combat block (design §6.4, slice 2.4; the panel's blocks/Combat.tsx): hp,
// attack and weapon drawn as the form draws them, then for an NPC's attack or an item's weapon the
// fight rows of GET /fights, measured on asking (seconds, loka-wfrgk.79). The logic is
// kernel/ts/play/blocks.ts. Labels are placeholders.
import { Text, View } from 'react-native';
import { fightsShown } from '../../../../kernel/ts/play/blocks.ts';
import { fightTable, verdict, type Fights } from '../../../../kernel/ts/play/numbers.ts';
import { shortName } from '../shown.ts';
import { block } from './form.tsx';
import type { Block } from './formwrite.ts';
import { known } from './room.tsx';
import { inRow, row } from './roomedit.tsx';
import { act } from './sheet.tsx';

export const WORDS = { run: 'Run fights', running: 'running the fights…' };
type Shown = ReturnType<typeof fightsShown>;
/** Each file's last answer, under the /story it was asked in: a write's new /story clears it. */
const ran = new Map<string, { of: unknown; shown?: Shown }>();

function ask(file: string, key: string, wield: boolean) {
  const of = known.files;
  ran.set(file, { of }); // running: the last answer goes while the next runs
  known.redraw();
  void known.api!(wield ? `/fights?wield=${encodeURIComponent(key)}` : '/fights')
    .then(([status, r]) =>
      status === 200 ? fightsShown((r as Fights).fights, key, wield) : String(r),
    )
    .catch((e: Error) => e.message)
    .then((shown) => {
      if (ran.get(file)?.of !== of) return; // a later run's, or a later /story's
      ran.set(file, { of, shown });
      known.redraw();
    });
}

const fight = (t: Exclude<Shown, string | unknown[]>) => (
  <View key={t.target}>
    <Text style={inRow}>{shortName(t.target)}</Text>
    <Text style={inRow}>{verdict(t)}</Text>
    {fightTable(t).map((cells, i) => (
      <Text key={i} style={inRow}>
        {cells.join(' · ')}
      </Text>
    ))}
  </View>
);

/** Run fights and the rows it answered: why not, the NPC's own rows, or a weapon's every target. */
function rows(file: string, key: string, wield: boolean) {
  const r = ran.get(file);
  const now = r?.of === known.files ? r : undefined;
  const s = now?.shown;
  return (
    <View
      key={`fights ${file}`}
      style={{ ...row, flexDirection: 'column', alignItems: 'flex-start' }}
    >
      {now && !s ? (
        <Text style={inRow}>{WORDS.running}</Text>
      ) : (
        act(WORDS.run, () => ask(file, key, wield), undefined, `fights ${file}`)
      )}
      {s === undefined ? null : typeof s === 'string' ? (
        <Text style={inRow}>{s}</Text>
      ) : Array.isArray(s) ? (
        s.map(fight)
      ) : (
        fight(s)
      )}
    </View>
  );
}

/** The block for field `path[0]`: an NPC's attack answers for itself; a weapon (`wield`) for every
 * target, since it is the player's hand in each fight; hp has no rows of its own. A file's key is
 * its name (source.ex placed/1). */
export const combat: Block = (at, path, node, value, removable) => {
  const key = at.file.replace(/^.*\//, '').replace(/\.json$/, '');
  const runs = path[0] !== 'hp' && value !== undefined;
  return [
    block(at, path, node, value, removable),
    runs ? rows(at.file, key, path[0] === 'weapon') : null,
  ];
};
