// The notebook's Numbers reader (slice 6.2b, the panel's numbers.tsx): the watcher's balancing reports
// over GET /__author/numbers, asked on Run. Read-only; anything unknown says so.
import { Text, View } from 'react-native';
import {
  fightTable,
  FIGHT_LIMITS,
  hours,
  verdict,
  type LevelRows,
  type Numbers as Report,
  type PoolsReport,
} from '../../../../kernel/ts/play/numbers.ts';
import { shortName } from '../shown.ts';
import { ink } from './build.ts';
import { cols, danger, dim, draw, head } from './reading.tsx';
import { known } from './room.tsx';
import { inRow, row } from './roomedit.tsx';
import { act } from './sheet.tsx';

// Placeholders: the owner writes the words.
export const WORDS = {
  tab: 'Numbers',
  pools: 'Pools',
  run: 'Run',
  running: 'Running, up to 90 s', // the wording of live.ts SECONDS
  failed: (why: string) => `Numbers failed: ${why}`,
  stale: 'Older than the cartridge in the Book: run again.',
  levels: 'Levels',
  fights: 'Fights',
  noPools: 'No pools in the view.',
  measured: (r: PoolsReport) =>
    `The measured-flows worker (${r.seeds} seeds, ${r.days} game days; median ${hours(r.hours_played)} played). It does not eat or rest on purpose. Hours are medians of the seeds counted.`,
  pool: (p: PoolsReport['pools'][number], r: PoolsReport) =>
    `${p.start} to ${p.end}, lowest ${p.lowest}, max ${p.maximum}. ${
      p.empty
        ? `Empty at hour ${p.empty.hour} (${p.empty.seeds} of ${r.seeds} seeds).`
        : `Never empty in the ${hours(r.hours_played)} played.`
    }`,
  bands: (p: PoolsReport['pools'][number], seeds: number) =>
    p.bands.map((b) => `${b.band} hour ${b.hour} (${b.seeds}/${seeds})`).join(', '),
  levelHead: ['level', 'XP', 'step', 'points', 'kills for the step'],
  noXp: 'no XP',
  noKill: 'no kill pays XP',
  noLevels: 'No levelling in this cartridge.',
  fought: (seeds: number, rounds: number) =>
    `${seeds} seeds, level by level, with no attribute points spent. Up to ${rounds} rounds. ${FIGHT_LIMITS} Rates count only fights that happened.`,
  noFoes: 'No armed foes in this cartridge.',
};

let numbers: { running?: boolean; report?: Report; note?: string } = {};
const runNumbers = () => {
  numbers = { running: true };
  known.redraw();
  void fetch('/__author/numbers')
    .then(async (r) => {
      if (!r.ok) throw new Error(await r.text());
      return (await r.json()) as Report;
    })
    .then(
      (got) => ({ report: got }),
      (err: Error) => ({ note: WORDS.failed(err.message) }),
    )
    .then((n) => ((numbers = n), known.redraw()));
};
const poolRows = (r: PoolsReport) =>
  r.pools.length
    ? [
        dim(WORDS.measured(r)),
        ...r.pools.flatMap((p) => [
          { text: shortName(p.pool) },
          { text: WORDS.pool(p, r) },
          dim(WORDS.bands(p, r.seeds)),
        ]),
      ]
    : [dim(WORDS.noPools)];
const levelRows = (rows: LevelRows) =>
  rows
    ? cols([
        WORDS.levelHead,
        ...rows.map((r) => [
          String(r.level),
          String(r.experience),
          String(r.step),
          String(r.points),
          r.kills.map((k) => `${shortName(k.npc)}: ${k.needed ?? WORDS.noXp}`).join(', ') ||
            WORDS.noKill,
        ]),
      ])
    : [dim(WORDS.noLevels)];
const fightRows = (fights: Report['fights']) =>
  'why' in fights
    ? [danger(fights.why)]
    : fights.report.targets.length
      ? [
          dim(WORDS.fought(fights.report.seeds, fights.report.rounds)),
          ...fights.report.targets.flatMap((t) => [
            { text: shortName(t.target) },
            dim(verdict(t)),
            ...cols(fightTable(t)),
          ]),
        ]
      : [dim(WORDS.noFoes)];
/** The watcher's balancing reports (kernel/ts/play/numbers.ts), asked on Run; read-only. */
export function numberRows(hash: string | undefined) {
  const { running, report: got, note } = numbers;
  const { pacing, fights } = got ?? {};
  return draw([
    <View key="run" style={row}>
      {running ? (
        <Text style={{ ...inRow, color: ink('dim') }}>{WORDS.running}</Text>
      ) : (
        act(WORDS.run, runNumbers)
      )}
    </View>,
    ...(note ? [danger(note)] : []),
    ...(got && hash && got.hash !== hash ? [danger(WORDS.stale)] : []),
    ...(pacing
      ? [
          head(WORDS.pools),
          ...('why' in pacing ? [danger(pacing.why)] : poolRows(pacing.report.pools)),
          head(WORDS.levels),
          ...('why' in pacing ? [danger(pacing.why)] : levelRows(pacing.report.levels)),
        ]
      : []),
    ...(fights ? [head(WORDS.fights), ...fightRows(fights)] : []),
  ]);
}
