// The Data model detail panel: one contract (or save table) with its fields, owner, sources and
// 1-hop references, where it is saved or authored, its impact and a path to another contract; every
// named contract is a button that selects it.
import { usePalette } from '../../book/palette.ts';
import { space } from '../../book/tokens.ts';
import { useId, useState } from 'react';
import { contracts, graph, path, repo, type Contract } from './graph.ts';
import { Sections } from './Save.tsx';
import { cell, Link, Prose } from './ui.tsx';

type Select = (name: string) => void;
const values = (v: unknown[] | null | undefined) => (v ? v.map(String).join(', ') : '');
const aside = { flex: '1 1 320px', minWidth: 0 };

function Go({ to, onSelect }: { to: string; onSelect: Select }) {
  const c = usePalette();
  const style = {
    color: c.fg,
    background: c.card,
    border: `1px solid ${c.line}`,
    margin: space.hair,
    font: 'inherit',
  };
  return (
    <button type="button" onClick={() => onSelect(to)} style={style}>
      {to}
    </button>
  );
}

// Fields: a referenced union's discriminator values stand in for an inline enum (StateDelta.ops).
const Fields = ({ n, onSelect }: { n: Contract; onSelect: Select }) => (
  <table style={{ borderCollapse: 'collapse' }}>
    <thead>
      <tr>
        {['Field', 'Type', 'Required', 'Values'].map((h) => (
          <th key={h} style={cell}>
            {h}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {n.fields.map((f) => {
        const target = f.type.replace(/\[\]$/, '');
        const linked = contracts.has(target);
        return (
          <tr key={f.name}>
            <td style={cell}>{f.name}</td>
            <td style={cell}>
              {linked ? (
                <>
                  <Go to={target} onSelect={onSelect} />
                  {f.type.slice(target.length)}
                </>
              ) : (
                f.type
              )}
            </td>
            <td style={cell}>{f.required ? 'required' : ''}</td>
            <td style={cell}>{values(f.enum ?? contracts.get(target)?.enum)}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

function Related({ label, names, onSelect }: { label: string; names: string[]; onSelect: Select }) {
  const unique = [...new Set(names)];
  return (
    <p>
      {label}:{' '}
      {unique.length ? unique.map((to) => <Go key={to} to={to} onSelect={onSelect} />) : 'none'}
    </p>
  );
}

// Kind, layer, owner, source file:line and the archived spec files the description cites.
const Source = ({ n }: { n: Contract }) => (
  <p>
    {n.kind} · {n.layer} · owner {n.owner ?? 'foundation'} · source{' '}
    <Link href={repo(n.file, n.line)}>{`${n.file}:${n.line}`}</Link>
    {n.spec.map((s) => (
      <span key={s.cite}>
        {' · spec '}
        <Link href={repo(s.path)}>{s.cite}</Link>
      </span>
    ))}
  </p>
);

// What a change to `name` can break: every contract that reaches it through references (the
// reverse closure), by layer, and the protocol/README.md fixtures of their files.
function Impact({ name, onSelect }: { name: string; onSelect: Select }) {
  const reach = new Set([name]);
  for (const at of reach) for (const e of graph.edges) if (e.to === at) reach.add(e.from);
  reach.delete(name);
  const files = new Set([name, ...reach].map((r) => contracts.get(r)!.file));
  const fixtures = [...new Set(graph.files.flatMap((f) => (files.has(f.file) ? f.fixtures : [])))];
  return (
    <details>
      <summary>Impact ({reach.size})</summary>
      {graph.layers.map((l) => {
        const names = [...reach].filter((r) => contracts.get(r)!.layer === l).sort();
        return names.length ? (
          <Related key={l} label={l} names={names} onSelect={onSelect} />
        ) : null;
      })}
      <p>
        Fixtures:{' '}
        {fixtures.length
          ? fixtures.map((f, i) => (
              <span key={f}>
                {i ? ', ' : ''}
                <Link href={repo(`protocol/fixtures/${f}`)}>{f}</Link>
              </span>
            ))
          : 'none'}
      </p>
    </details>
  );
}

// Path finding: the reference chain from the selection to a contract typed or picked here.
function PathTo({ from, onSelect }: { from: string; onSelect: Select }) {
  const [to, setTo] = useState('');
  const list = useId();
  const chain = contracts.has(to) ? path(from, to) : undefined;
  return (
    <div>
      <label>
        Path to <input list={list} value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <datalist id={list}>
        {graph.nodes.map((n) => (
          <option key={n.name} value={n.name} />
        ))}
      </datalist>
      {chain === null && (
        <p>
          No reference path from {from} to {to}.
        </p>
      )}
      {chain && (
        <p aria-label="Path">
          {chain.map((s, i) => (
            <span key={s}>
              {i ? ' → ' : ''}
              <Go to={s} onSelect={onSelect} />
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

// Where the contract lives outside protocol/: its save sections and authored cartridge files.
const Homes = ({ n, onSelect }: { n: Contract; onSelect: Select }) => (
  <>
    {n.saved && (
      <p>
        Saved in: <Go to="state_row" onSelect={onSelect} /> › {n.saved.join(', ')}
      </p>
    )}
    {n.authored && n.authored.length > 0 && (
      <details>
        <summary>Authored in cartridges ({n.authored.length})</summary>
        <ul>
          {n.authored.map((f) => (
            <li key={f}>
              <Link href={repo(f)}>{f}</Link>
            </li>
          ))}
        </ul>
      </details>
    )}
  </>
);

// Where the contract is kept, what a change to it reaches, and a path to another one.
const Reach = ({ n, onSelect }: { n: Contract; onSelect: Select }) => (
  <>
    <Homes n={n} onSelect={onSelect} />
    <Impact name={n.name} onSelect={onSelect} />
    <PathTo from={n.name} onSelect={onSelect} />
  </>
);

const Examples = ({ examples }: { examples: unknown[] }) => (
  <details>
    <summary>Examples ({examples.length})</summary>
    <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      {JSON.stringify(examples, null, 2)}
    </pre>
  </details>
);

export function Panel({ name, onSelect }: { name: string; onSelect: Select }) {
  const n = contracts.get(name);
  const table = graph.saveTables.find((t) => t.table === name);
  if (table)
    return (
      <aside aria-label="Detail" style={aside}>
        <h2>{table.table}</h2>
        <p>
          Save table (docs/system/save.md, loka-save-v1): <Prose text={table.rows} />
        </p>
        {table.sections && <Sections sections={table.sections} />}
      </aside>
    );
  if (!n) return null;
  return (
    <aside aria-label="Detail" style={aside}>
      <h2>{n.name}</h2>
      <Source n={n} />
      {n.description && (
        <p>
          <Prose text={n.description} />
        </p>
      )}
      {n.enum && <p>Values: {values(n.enum)}</p>}
      {n.fields.length > 0 && <Fields n={n} onSelect={onSelect} />}
      <Related
        label="References"
        names={graph.edges.filter((e) => e.from === name).map((e) => e.to)}
        onSelect={onSelect}
      />
      <Related
        label="Used by"
        names={graph.edges.filter((e) => e.to === name).map((e) => e.from)}
        onSelect={onSelect}
      />
      <Reach n={n} onSelect={onSelect} />
      {n.examples && <Examples examples={n.examples} />}
    </aside>
  );
}
