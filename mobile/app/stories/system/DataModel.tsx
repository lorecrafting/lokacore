// System/Data model: every contract as a chip, columns by layer, rows by owning capability (else
// file); search, filters, a detail panel and the selection's 1-hop edges (spec §2).
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { usePalette } from '../../book/palette.ts';
import { space, type } from '../../book/tokens.ts';
import { capabilities, contracts, graph, page } from './graph.ts';
import { hue } from './palette.ts';
import { Panel } from './Panel.tsx';
import { Link, Sheet } from './ui.tsx';

const any = '';
const residency = (owner: string | null) => (owner ? capabilities.get(owner)?.residency : 'none');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Whole-word match on name, description, field names and enum values; name also by substring.
function matches(name: string, query: string) {
  if (!query) return true;
  const n = contracts.get(name);
  const word = new RegExp(`\\b${escape(query)}\\b`, 'i');
  if (!n) return word.test(name);
  const text = [
    n.description ?? '',
    ...n.fields.map((f) => `${f.name} ${(f.enum ?? []).join(' ')}`),
    ...(n.enum ?? []).map(String),
  ];
  return n.name.toLowerCase().includes(query.toLowerCase()) || text.some((t) => word.test(t));
}

type Props = {
  node?: string;
  layer?: string;
  onSelect?: (globals: Record<string, string>) => void;
};

export function DataModel({ node = '', layer: initialLayer = '', onSelect }: Props) {
  const c = usePalette();
  const [selected, setSelected] = useState(node);
  const [query, setQuery] = useState('');
  const [layer, setLayer] = useState(initialLayer);
  const [owner, setOwner] = useState(any);
  const [kind, setKind] = useState(any);
  const [res, setRes] = useState(any);
  const [copied, setCopied] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);

  const select = (name: string) => {
    setSelected(name);
    setCopied(false);
    onSelect?.({ node: name });
  };
  const neighbours = new Set(
    graph.edges.flatMap((e) => (e.from === selected ? [e.to] : e.to === selected ? [e.from] : [])),
  );

  // `/` focuses search anywhere on the page, as on GitHub.
  useEffect(() => {
    const slash = (e: globalThis.KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    document.addEventListener('keydown', slash);
    return () => document.removeEventListener('keydown', slash);
  }, []);

  // The selection's edges: lines between chip centres, measured after layout.
  useLayoutEffect(() => {
    const box = grid.current;
    const from = box?.querySelector<HTMLElement>(`[data-chip="${selected}"]`);
    if (!box || !from) return setLines([]);
    const o = box.getBoundingClientRect();
    const mid = (el: Element) => {
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2 - o.left, r.top + r.height / 2 - o.top];
    };
    const [x1, y1] = mid(from);
    setLines(
      [...neighbours].flatMap((n) => {
        const to = box.querySelector(`[data-chip="${n}"]`);
        if (!to) return [];
        const [x2, y2] = mid(to);
        return [{ x1, y1, x2, y2 }];
      }),
    );
  }, [selected, query, layer, owner, kind, res]);

  // Arrow keys move between chips in reading order; Escape clears the selection.
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Escape') return select('');
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    const chips = [...(grid.current?.querySelectorAll<HTMLElement>('[data-chip]') ?? [])];
    const at = chips.indexOf(e.target as HTMLElement);
    if (!step || at < 0) return;
    e.preventDefault();
    chips[Math.min(chips.length - 1, Math.max(0, at + step))].focus();
  };

  const shown = graph.nodes.filter(
    (n) =>
      (!owner || (n.owner ?? 'foundation') === owner) &&
      (!kind || n.kind === kind) &&
      (!res || residency(n.owner) === res) &&
      matches(n.name, query),
  );
  const tables =
    owner || kind || res ? [] : graph.saveTables.filter((t) => matches(t.table, query));
  const current = contracts.get(selected);
  const choose = (label: string, value: string, set: (v: string) => void, options: string[]) => (
    <label style={{ marginRight: space.lg }}>
      {label}{' '}
      <select
        value={value}
        onChange={(e) => {
          set(e.target.value);
          if (set === setLayer) onSelect?.({ layer: e.target.value });
        }}
        style={{ font: 'inherit', color: c.fg, background: c.card }}
      >
        <option value={any}>all</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
  const chip = (name: string, layerName: string) => (
    <li key={name} style={{ display: 'inline-block', margin: space.hair }}>
      <button
        type="button"
        data-chip={name}
        aria-pressed={name === selected}
        onClick={() => select(name)}
        style={{
          font: 'inherit',
          color: !selected || name === selected || neighbours.has(name) ? c.fg : c.dim,
          background: name === selected ? c.card : 'transparent',
          border: `1px solid ${name === selected ? c.action : c.line}`,
          borderLeft: `4px solid ${hue(layerName, c)}`,
          paddingBlock: space.hair,
          paddingInline: space.sm,
        }}
      >
        {name}
      </button>
    </li>
  );

  return (
    <Sheet>
      <div role="search" style={{ marginBottom: space.md }}>
        <label style={{ marginRight: space.lg }}>
          Search{' '}
          <input
            ref={search}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ font: 'inherit', color: c.fg, background: c.card }}
          />
        </label>
        {choose('Layer', layer, setLayer, graph.layers)}
        {choose('Owner', owner, setOwner, ['foundation', ...capabilities.keys()])}
        {choose('Kind', kind, setKind, [...new Set(graph.nodes.map((n) => n.kind))].sort())}
        {choose('Residency', res, setRes, [
          ...new Set(graph.capabilities.map((x) => x.residency)),
          'none',
        ])}
        <button
          type="button"
          disabled={!selected}
          onClick={() =>
            navigator.clipboard
              .writeText(page('data-model', { node: selected }))
              .then(() => setCopied(true))
          }
          style={{
            font: 'inherit',
            color: c.fg,
            background: c.card,
            border: `1px solid ${c.line}`,
          }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <nav aria-label="Breadcrumb" style={{ marginBottom: space.md }}>
        <Link top href={page('overview')}>
          Overview
        </Link>
        {current && ` › ${current.layer} › ${current.owner ?? current.file} › ${current.name}`}
        {!current && selected && ` › Save › ${selected}`}
      </nav>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.xl, alignItems: 'flex-start' }}>
        <div
          ref={grid}
          onKeyDown={keys}
          style={{
            position: 'relative',
            flex: '3 1 480px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: space.lg,
          }}
        >
          <svg
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            {lines.map((l, i) => (
              <line key={i} {...l} stroke={c.action} strokeWidth={1} />
            ))}
          </svg>
          {graph.layers
            .filter((l) => !layer || l === layer)
            .map((l) => {
              const groups = new Map<string, typeof shown>();
              for (const n of shown.filter((x) => x.layer === l)) {
                const g = n.owner ?? n.file.replace('protocol/', '');
                groups.set(g, [...(groups.get(g) ?? []), n]);
              }
              return (
                <section
                  key={l}
                  aria-label={l}
                  style={{ flex: '1 1 200px', borderTop: `4px solid ${hue(l, c)}` }}
                >
                  <h2 style={type.log}>{l}</h2>
                  {l === 'Save' && tables.length > 0 && (
                    <ul style={{ padding: 0 }}>{tables.map((t) => chip(t.table, l))}</ul>
                  )}
                  {[...groups].map(([g, ns]) => (
                    <div key={g}>
                      <h3
                        style={{
                          ...type.small,
                          fontWeight: 'bold',
                          marginBottom: 0,
                          marginTop: space.md,
                        }}
                      >
                        {g}
                      </h3>
                      <ul style={{ padding: 0, margin: 0 }}>{ns.map((n) => chip(n.name, l))}</ul>
                    </div>
                  ))}
                </section>
              );
            })}
        </div>
        {selected && <Panel name={selected} onSelect={select} />}
      </div>
    </Sheet>
  );
}
