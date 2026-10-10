// The Data model detail panel: one contract (or save table) with its fields, owner, sources and
// 1-hop references; every named contract is a button that selects it.
import { usePalette } from '../../book/palette.ts';
import { space } from '../../book/tokens.ts';
import { contracts, graph, repo } from './graph.ts';
import { cell, Link, Prose } from './ui.tsx';

const values = (v: unknown[] | null | undefined) => (v ? v.map(String).join(', ') : '');

export function Panel({ name, onSelect }: { name: string; onSelect: (name: string) => void }) {
  const c = usePalette();
  const n = contracts.get(name);
  const table = graph.saveTables.find((t) => t.table === name);
  const go = (to: string) => (
    <button
      key={to}
      type="button"
      onClick={() => onSelect(to)}
      style={{
        color: c.fg,
        background: c.card,
        border: `1px solid ${c.line}`,
        margin: space.hair,
        font: 'inherit',
      }}
    >
      {to}
    </button>
  );
  if (table)
    return (
      <aside aria-label="Detail" style={{ flex: '1 1 320px' }}>
        <h2>{table.table}</h2>
        <p>
          Save table (docs/system/save.md, loka-save-v1): <Prose text={table.rows} />
        </p>
      </aside>
    );
  if (!n) return null;
  const refs = [...new Set(graph.edges.filter((e) => e.from === name).map((e) => e.to))];
  const usedBy = [...new Set(graph.edges.filter((e) => e.to === name).map((e) => e.from))];
  return (
    <aside aria-label="Detail" style={{ flex: '1 1 320px', minWidth: 0 }}>
      <h2>{n.name}</h2>
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
      {n.description && (
        <p>
          <Prose text={n.description} />
        </p>
      )}
      {n.enum && <p>Values: {values(n.enum)}</p>}
      {n.fields.length > 0 && (
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
              return (
                <tr key={f.name}>
                  <td style={cell}>{f.name}</td>
                  <td style={cell}>
                    {contracts.has(target) ? go(target) : f.type}
                    {f.type.endsWith('[]') && contracts.has(target) ? '[]' : ''}
                  </td>
                  <td style={cell}>{f.required ? 'required' : ''}</td>
                  <td style={cell}>{values(f.enum ?? contracts.get(target)?.enum)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p>References: {refs.length ? refs.map(go) : 'none'}</p>
      <p>Used by: {usedBy.length ? usedBy.map(go) : 'none'}</p>
      {n.examples && (
        <details>
          <summary>Examples ({n.examples.length})</summary>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {JSON.stringify(n.examples, null, 2)}
          </pre>
        </details>
      )}
    </aside>
  );
}
