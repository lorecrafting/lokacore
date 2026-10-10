// The Data model detail panel: one contract (or save table) with its fields, owner, sources and
// 1-hop references; every named contract is a button that selects it.
import { usePalette } from '../../book/palette.ts';
import { space } from '../../book/tokens.ts';
import { contracts, graph, repo, type Contract } from './graph.ts';
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
      <span key={s}>
        {' · spec '}
        <Link href={repo(s)}>{s.split('/').pop()}</Link>
      </span>
    ))}
  </p>
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
      {n.examples && <Examples examples={n.examples} />}
    </aside>
  );
}
