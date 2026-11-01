// The Numbers tab: balancing reports read from the watcher. Read-only; anything unknown says so.
import { useState } from 'react';
import type {
  Cell,
  LevelRows,
  Numbers as Report,
  PoolsReport,
  Target,
} from '../../../kernel/ts/play/numbers.ts';
import { numbers } from './author.ts';
import { Button } from './components/ui/button.tsx';
import { Heading } from './sections.tsx';

const Cols = ({ rows }: { rows: string[][] }) => (
  <table className="w-full text-xs">
    <tbody>
      {rows.map((row, i) => (
        <tr key={i} className={i ? 'border-t' : 'text-muted-foreground'}>
          {row.map((cell, j) => (
            <td key={j} className={`py-1 pr-2 align-top ${j ? 'font-mono' : 'whitespace-nowrap'}`}>
              {cell}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

const fightRow = (c: Cell): string[] =>
  'refused' in c
    ? [`level ${c.level}`, `refused: ${c.refused}`, '', '', '', '', '']
    : [
        `level ${c.level}`,
        `${c.win_pct}%`,
        `${c.death_pct}%`,
        `${c.fled_pct}%`,
        String(c.timeouts),
        c.rounds ? String(c.rounds.median) : 'no win',
        c.hp_left ? String(c.hp_left.median) : 'no win',
      ];

const Fight = ({ target }: { target: Target }) => {
  const at = target.rating.first_win_level;
  return (
    <div>
      <p className="font-mono text-xs break-all">{target.target}</p>
      <p className="text-muted-foreground text-xs">
        {at === null
          ? 'No level wins half with any build.'
          : `Wins half from level ${at} (build ${target.rating.first_win_build}).`}
      </p>
      <Cols
        rows={[
          ['no build', 'win', 'death', 'fled', 'no end (runs)', 'rounds', 'hp left'],
          ...target.cells.filter((c) => c.build === 'none').map(fightRow),
        ]}
      />
    </div>
  );
};

const Pools = ({ report }: { report: PoolsReport }) => {
  const { seeds, days } = report;
  if (!report.pools.length) return <p className="text-muted-foreground">No pools in the view.</p>;
  return (
    <>
      <p className="text-muted-foreground text-xs">
        The measured-flows worker ({seeds} seeds, {days} game days; median {report.hours_played}{' '}
        hours played). It does not eat or rest on purpose. Hours are medians of the seeds counted.
      </p>
      {report.pools.map((p) => (
        <div key={p.pool}>
          <p className="font-mono text-xs break-all">{p.pool}</p>
          <p className="text-xs">
            {p.start} to {p.end}, lowest {p.lowest}, max {p.maximum}.{' '}
            {p.empty
              ? `Empty at hour ${p.empty.hour} (${p.empty.seeds} of ${seeds} seeds).`
              : `Never empty in the ${report.hours_played} hours played.`}
          </p>
          <p className="text-muted-foreground text-xs">
            {p.bands.map((b) => `${b.band} hour ${b.hour} (${b.seeds}/${seeds})`).join(', ')}
          </p>
        </div>
      ))}
    </>
  );
};

const Levels = ({ rows }: { rows: LevelRows }) =>
  rows ? (
    <Cols
      rows={[
        ['level', 'XP', 'step', 'points', 'kills for the step'],
        ...rows.map((r) => [
          String(r.level),
          String(r.experience),
          String(r.step),
          String(r.points),
          r.kills.map((k) => `${k.npc}: ${k.needed ?? 'no XP'}`).join(', ') || 'no kill pays XP',
        ]),
      ]}
    />
  ) : (
    <p className="text-muted-foreground">No levelling in this cartridge.</p>
  );

const Sections = ({ report: { pacing, fights } }: { report: Report }) => (
  <>
    <section className="space-y-2">
      <Heading>Pools</Heading>
      {'why' in pacing ? (
        <p className="text-destructive">{pacing.why}</p>
      ) : (
        <Pools report={pacing.report.pools} />
      )}
      <Heading>Levels</Heading>
      {'why' in pacing ? (
        <p className="text-destructive">{pacing.why}</p>
      ) : (
        <Levels rows={pacing.report.levels} />
      )}
    </section>
    <section className="space-y-2">
      <Heading>Fights</Heading>
      {'why' in fights ? (
        <p className="text-destructive">{fights.why}</p>
      ) : fights.report.targets.length ? (
        <>
          <p className="text-muted-foreground text-xs">
            {fights.report.seeds} seeds, level by level, with no attribute points spent.
          </p>
          {fights.report.targets.map((t) => (
            <Fight key={t.target} target={t} />
          ))}
        </>
      ) : (
        <p className="text-muted-foreground">No armed foes in this cartridge.</p>
      )}
    </section>
  </>
);

export function Numbers({ hash }: { hash?: string }) {
  const [report, setReport] = useState<Report>();
  const [note, setNote] = useState('');
  const [running, setRunning] = useState(false);
  const run = () => {
    setRunning(true);
    setNote('');
    setReport(undefined);
    numbers()
      .then(setReport, (err: Error) => setNote(`Numbers failed: ${err.message}`))
      .finally(() => setRunning(false));
  };
  return (
    <div className="space-y-3 text-sm">
      <Button variant="secondary" disabled={running} onClick={run}>
        {running ? 'Running, up to 30 s' : 'Run'}
      </Button>
      {note ? <p className="text-destructive">{note}</p> : null}
      {report && hash && report.hash !== hash ? (
        <p className="text-destructive">Older than the cartridge in the Book: run again.</p>
      ) : null}
      {report ? <Sections report={report} /> : null}
    </div>
  );
}
