// The Step tab's rows: facts changed, quests changed, and the rules that looked (each a node row, so
// selecting one opens its card). Presentational only; the report and the two views come from step.ts.
import type { Heard } from './book.ts';
import { Heading } from './sections.tsx';
import { lookedLine, type Report, type Views } from './step.ts';

const value = (v: unknown) => (v === null || v === undefined ? 'unset' : JSON.stringify(v));

const Row = ({ children, onSelect }: { children: React.ReactNode; onSelect?: (() => void) | undefined }) =>
  onSelect ? (
    <li>
      <button type="button" className="w-full text-left hover:underline" onClick={onSelect}>
        {children}
      </button>
    </li>
  ) : (
    <li>{children}</li>
  );

export const List = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <Heading>{title}</Heading>
    <ul className="space-y-1">{children}</ul>
  </div>
);

export const Facts = ({ facts }: { facts: ReturnType<typeof import('./step.ts').changedFacts> }) => (
  <List title={`Facts changed (${facts.length})`}>
    {facts.map((f) => (
      <Row key={f.key}>
        <span className="font-mono text-xs">{f.key}</span>{' '}
        <span className="text-muted-foreground">
          {value(f.from)} → {value(f.to)}
        </span>
      </Row>
    ))}
    {facts.length ? null : <li className="text-muted-foreground">none</li>}
  </List>
);

export const Quests = ({ quests }: { quests: ReturnType<typeof import('./step.ts').changedQuests> }) => (
  <List title={`Quests changed (${quests.length})`}>
    {quests.map((q) => (
      <Row key={q.quest}>
        <span className="font-mono text-xs">{q.quest}</span>{' '}
        <span className="text-muted-foreground">
          {q.from} → {q.to}
        </span>
      </Row>
    ))}
    {quests.length ? null : <li className="text-muted-foreground">none</li>}
  </List>
);

export const Rules = ({
  report,
  heard,
}: {
  report: Report['reactions'] | undefined;
  heard?: Heard | undefined;
}) => (
  <List title={`Rules that looked (${report?.length ?? 0})`}>
    {(report ?? []).map((x) => {
      const line = lookedLine(x);
      return (
        <Row key={x.rule} onSelect={heard ? () => heard.select(`reaction.${x.rule}`) : undefined}>
          <span className="font-mono text-xs">{x.rule}</span>{' '}
          <span className={line.ok === false ? 'text-destructive' : ''}>{line.text}</span>
        </Row>
      );
    })}
    {report?.length ? null : (
      <li className="text-muted-foreground">{report ? 'none matched' : 'asking…'}</li>
    )}
  </List>
);

export type { Views };
