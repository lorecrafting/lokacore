// System/Command lifecycle (spec §1): one Command through the lanes Host, Kernel, Save and View.
// Every stage is a contract or a save table and opens it in System/Data model; a failure branch
// (GameError) leaves only a stage whose contract references GameError.
import { useState } from 'react';
import { usePalette } from '../../book/palette.ts';
import { space } from '../../book/tokens.ts';
import { capabilities, contracts, graph, page } from './graph.ts';
import { hue } from './palette.ts';
import { Choose, heading, Link, Sheet } from './ui.tsx';

const lanes = ['Host', 'Kernel', 'Save', 'View'];
// [lane, contract or save table, what happens there], in order (docs/system/architecture.md: the
// host commits the changed rows plus the receipt in one transaction, then replies with the view).
const stages = [
  ['Host', 'Command', 'the input'],
  ['Kernel', 'DecisionResult', 'admission + decide: accepted, rejected or fault'],
  ['Kernel', 'StateDelta', 'the proposal’s changes'],
  ['Kernel', 'DeltaOp', 'one change each'],
  ['Kernel', 'DomainEvent', 'proposed events'],
  ['Save', 'state_row', 'the changed rows'],
  ['Save', 'receipt', 'the receipt, same transaction'],
  ['Save', 'CommittedEvent', 'events after the commit'],
  ['View', 'GameView', 'the reply'],
];
const tables = new Set(graph.saveTables.map((t) => t.table));
const missing = stages.filter(([, name]) => !contracts.has(name) && !tables.has(name));
// A renamed contract or table fails the page (and the smoke), not a dead link.
if (missing.length) throw new Error(`Command lifecycle: no contract or save table ${missing}`);
const fails = (name: string) => graph.edges.some((e) => e.from === name && e.to === 'GameError');

// Every registry command => the capability that owns it.
const commands = new Map(
  graph.capabilities
    .flatMap((c) => c.commands.map((type) => [type, c.id] as const))
    .sort(([a], [b]) => a.localeCompare(b)),
);

function Command() {
  const [type, setType] = useState('');
  const c = capabilities.get(commands.get(type) ?? '');
  return (
    <p>
      <label>
        Trace a command{' '}
        <select onChange={(e) => setType(e.target.value)} defaultValue="">
          <option value="">(any)</option>
          {[...commands.keys()].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      {c && (
        <span>
          {' '}
          owner {c.id} · events {c.events.join(', ') || 'none'} · definitions{' '}
          {c.definitions.map((d) => d.kind).join(', ') || 'none'}
        </span>
      )}
    </p>
  );
}

// One stage in its lane's column, ruled in its layer's hue (a save table's: Save).
function Stage({
  lane,
  name,
  what,
  row,
}: {
  lane: string;
  name: string;
  what: string;
  row: number;
}) {
  const c = usePalette();
  return (
    <li
      style={{
        gridColumn: lanes.indexOf(lane) + 1,
        gridRow: row,
        borderLeft: `4px solid ${hue(contracts.get(name)?.layer ?? 'Save', c)}`,
        paddingInline: space.sm,
      }}
    >
      <Link top href={page('data-model', { node: name })}>
        {name}
      </Link>{' '}
      {what}
      {fails(name) && (
        <span style={{ color: c.danger }}>
          {' '}
          → fails with{' '}
          <Link top href={page('data-model', { node: 'GameError' })}>
            GameError
          </Link>
        </span>
      )}
    </li>
  );
}

export function Lifecycle() {
  const [lane, setLane] = useState('');
  return (
    <Sheet>
      <Command />
      <p>
        <Choose label="Lane" options={lanes} set={setLane} />
      </p>
      <ol
        aria-label="Command lifecycle"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${lanes.length}, minmax(140px, 1fr))`,
          gap: space.sm,
          listStyle: 'none',
          padding: 0,
        }}
      >
        {lanes.map((l, i) => (
          <li key={l} aria-hidden style={{ ...heading, gridColumn: i + 1, gridRow: 1 }}>
            {l}
          </li>
        ))}
        {stages.map(
          ([l, name, what], i) =>
            (!lane || l === lane) && (
              <Stage key={name} lane={l} name={name} what={what} row={i + 2} />
            ),
        )}
      </ol>
    </Sheet>
  );
}
