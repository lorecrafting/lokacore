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

// The search box; `/` anywhere on the page focuses it.
function Search({ value, change }: { value: string; change: (query: string) => void }) {
  const c = usePalette();
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const slash = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      search.current?.focus();
    };
    document.addEventListener('keydown', slash);
    return () => document.removeEventListener('keydown', slash);
  }, []);
  return (
    <label style={{ marginRight: space.lg }}>
      Search{' '}
      <input
        ref={search}
        type="search"
        value={value}
        onChange={(e) => change(e.target.value)}
        style={{ font: 'inherit', color: c.fg, background: c.card }}
      />
    </label>
  );
}

function CopyLink({ selected }: { selected: string }) {
  const c = usePalette();
  const [copied, setCopied] = useState('');
  const copy = () =>
    navigator.clipboard
      .writeText(page('data-model', { node: selected }))
      .then(() => setCopied(selected));
  return (
    <button
      type="button"
      disabled={!selected}
      onClick={copy}
      style={{ font: 'inherit', color: c.fg, background: c.card, border: `1px solid ${c.line}` }}
    >
      {copied && copied === selected ? 'Copied' : 'Copy link'}
    </button>
  );
}

const owners = ['foundation', ...capabilities.keys()];
const kinds = [...new Set(graph.nodes.map((n) => n.kind))].sort();
const residencies = [...new Set(graph.capabilities.map((x) => x.residency)), 'none'];

export const Toolbar = ({ filter, change, selected }: Props) => (
  <div role="search" style={{ marginBottom: space.md }}>
    <Search value={filter.query} change={(query) => change({ query })} />
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
      options={owners}
    />
    <Choose label="Kind" value={filter.kind} set={(kind) => change({ kind })} options={kinds} />
    <Choose
      label="Residency"
      value={filter.res}
      set={(res) => change({ res })}
      options={residencies}
    />
    <CopyLink selected={selected} />
  </div>
);
