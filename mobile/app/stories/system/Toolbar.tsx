// The Data model's search, filters and copy-link button. `/` focuses search, as on GitHub.
import { useEffect, useRef, useState } from 'react';
import { usePalette } from '../../book/palette.ts';
import { space } from '../../book/tokens.ts';
import { capabilities, graph, page } from './graph.ts';
import type { Filter } from './Grid.tsx';

type Props = { filter: Filter; change: (f: Partial<Filter>) => void; selected: string };

function Choose({
  label,
  value,
  set,
  options,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  options: string[];
}) {
  const c = usePalette();
  return (
    <label style={{ marginRight: space.lg }}>
      {label}{' '}
      <select
        value={value}
        onChange={(e) => set(e.target.value)}
        style={{ font: 'inherit', color: c.fg, background: c.card }}
      >
        <option value="">all</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

export function Toolbar({ filter, change, selected }: Props) {
  const c = usePalette();
  const search = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState('');
  useEffect(() => {
    const slash = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      search.current?.focus();
    };
    document.addEventListener('keydown', slash);
    return () => document.removeEventListener('keydown', slash);
  }, []);
  const field = { font: 'inherit', color: c.fg, background: c.card };
  const copy = () =>
    navigator.clipboard
      .writeText(page('data-model', { node: selected }))
      .then(() => setCopied(selected));
  return (
    <div role="search" style={{ marginBottom: space.md }}>
      <label style={{ marginRight: space.lg }}>
        Search{' '}
        <input
          ref={search}
          type="search"
          value={filter.query}
          onChange={(e) => change({ query: e.target.value })}
          style={field}
        />
      </label>
      <Choose
        label="Layer"
        value={filter.layer}
        set={(layer) => change({ layer })}
        options={graph.layers}
      />
      <Choose
        label="Owner"
        value={filter.owner}
        set={(owner) => change({ owner })}
        options={['foundation', ...capabilities.keys()]}
      />
      <Choose
        label="Kind"
        value={filter.kind}
        set={(kind) => change({ kind })}
        options={[...new Set(graph.nodes.map((n) => n.kind))].sort()}
      />
      <Choose
        label="Residency"
        value={filter.res}
        set={(res) => change({ res })}
        options={[...new Set(graph.capabilities.map((x) => x.residency)), 'none']}
      />
      <button
        type="button"
        disabled={!selected}
        onClick={copy}
        style={{ ...field, border: `1px solid ${c.line}` }}
      >
        {copied && copied === selected ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );
}
