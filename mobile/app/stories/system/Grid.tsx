// The Data model's chips: one column per layer, a row per owner (else file), and SVG lines from
// the selected chip to its 1-hop neighbours (decorative: the panel lists the same references).
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { usePalette } from '../../book/palette.ts';
import { space } from '../../book/tokens.ts';
import { capabilities, contracts, graph, type Contract } from './graph.ts';
import { hue } from './palette.ts';
import { heading, small } from './ui.tsx';

export type Filter = { query: string; layer: string; owner: string; kind: string; res: string };
type Line = { x1: number; y1: number; x2: number; y2: number };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Whole-word match on description, field names and enum values; the name also by substring.
function matches(name: string, query: string) {
  if (!query) return true;
  const n = contracts.get(name);
  const word = new RegExp(`\\b${escape(query)}\\b`, 'i');
  if (!n) return name.includes(query.toLowerCase());
  const text = [
    n.description ?? '',
    ...n.fields.map((f) => `${f.name} ${(f.enum ?? []).join(' ')}`),
    ...(n.enum ?? []).map(String),
  ];
  return n.name.toLowerCase().includes(query.toLowerCase()) || text.some((t) => word.test(t));
}

const keep = (f: Filter) => (n: Contract) =>
  (!f.owner || (n.owner ?? 'foundation') === f.owner) &&
  (!f.kind || n.kind === f.kind) &&
  (!f.res || (n.owner ? capabilities.get(n.owner)?.residency : 'none') === f.res) &&
  matches(n.name, f.query);

// Lines between chip centres, measured after layout.
function useEdges(
  grid: RefObject<HTMLDivElement | null>,
  selected: string,
  neighbours: Set<string>,
  filter: Filter,
) {
  const [lines, setLines] = useState<Line[]>([]);
  useLayoutEffect(() => {
    const box = grid.current;
    if (!box) return;
    const measure = () => {
      const from = box.querySelector(`[data-chip="${selected}"]`);
      if (!from) return setLines([]);
      const o = box.getBoundingClientRect();
      const mid = (el: Element) => {
        const r = el.getBoundingClientRect();
        return [r.left + r.width / 2 - o.left, r.top + r.height / 2 - o.top];
      };
      const [x1, y1] = mid(from);
      const tos = [...neighbours].map((n) => box.querySelector(`[data-chip="${n}"]`));
      setLines(tos.flatMap((to) => (to ? [{ x1, y1, x2: mid(to)[0], y2: mid(to)[1] }] : [])));
    };
    measure();
    const reflow = new ResizeObserver(measure); // a resize or late font moves the chips
    reflow.observe(box);
    return () => reflow.disconnect();
  }, [selected, filter]);
  return lines;
}

// Arrow keys move between chips in reading order.
function arrows(e: KeyboardEvent, grid: HTMLElement | null) {
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
  const chips = [...(grid?.querySelectorAll<HTMLElement>('[data-chip]') ?? [])];
  const at = chips.indexOf(e.target as HTMLElement);
  if (!step || at < 0) return;
  e.preventDefault();
  chips[Math.min(chips.length - 1, Math.max(0, at + step))].focus();
}

type ChipProps = {
  name: string;
  layer: string;
  selected: string;
  near: boolean;
  select: (n: string) => void;
};

function Chip({ name, layer, selected, near, select }: ChipProps) {
  const c = usePalette();
  const on = name === selected;
  return (
    <li style={{ display: 'inline-block', margin: space.hair }}>
      <button
        type="button"
        data-chip={name}
        aria-pressed={on}
        onClick={() => select(name)}
        style={{
          font: 'inherit',
          color: !selected || on || near ? c.fg : c.dim,
          background: on ? c.card : 'transparent',
          border: `1px solid ${on ? c.action : c.line}`,
          borderLeft: `4px solid ${hue(layer, c)}`,
          paddingBlock: space.hair,
          paddingInline: space.sm,
        }}
      >
        {name}
      </button>
    </li>
  );
}

type GridProps = { filter: Filter; selected: string; select: (n: string) => void };
type Chips = { layer: string; selected: string; near: Set<string>; select: (n: string) => void };

const Chips = ({ names, style, ...p }: Chips & { names: string[]; style: CSSProperties }) => (
  <ul style={style}>
    {names.map((n) => (
      <Chip
        key={n}
        name={n}
        layer={p.layer}
        selected={p.selected}
        near={p.near.has(n)}
        select={p.select}
      />
    ))}
  </ul>
);

// Contracts of one layer by owner, else by file.
function rows(shown: Contract[], layer: string) {
  const by = new Map<string, string[]>();
  for (const n of shown.filter((x) => x.layer === layer)) {
    const g = n.owner ?? n.file.replace('protocol/', '');
    by.set(g, [...(by.get(g) ?? []), n.name]);
  }
  return by;
}

function Column({
  tables,
  groups,
  ...p
}: Chips & { tables: string[]; groups: Map<string, string[]> }) {
  const c = usePalette();
  return (
    <section
      aria-label={p.layer}
      style={{ flex: '1 1 200px', borderTop: `4px solid ${hue(p.layer, c)}` }}
    >
      <h2 style={heading}>{p.layer}</h2>
      {tables.length > 0 && <Chips names={tables} style={{ padding: 0 }} {...p} />}
      {[...groups].map(([g, ns]) => (
        <div key={g}>
          <h3 style={{ ...small, fontWeight: 'bold', marginBottom: 0, marginTop: space.md }}>
            {g}
          </h3>
          <Chips names={ns} style={{ padding: 0, margin: 0 }} {...p} />
        </div>
      ))}
    </section>
  );
}

function Lines({ lines }: { lines: Line[] }) {
  const c = usePalette();
  const style: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  };
  return (
    <svg aria-hidden="true" style={style}>
      {lines.map((l, i) => (
        <line key={i} {...l} stroke={c.action} strokeWidth={1} />
      ))}
    </svg>
  );
}

const box: CSSProperties = {
  position: 'relative',
  flex: '3 1 480px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space.lg,
};

export function Grid({ filter, selected, select }: GridProps) {
  const grid = useRef<HTMLDivElement>(null);
  const near = new Set(
    graph.edges.flatMap((e) => (e.from === selected ? [e.to] : e.to === selected ? [e.from] : [])),
  );
  const lines = useEdges(grid, selected, near, filter);
  const shown = graph.nodes.filter(keep(filter));
  const unfiltered = !filter.owner && !filter.kind && !filter.res;
  const tables = unfiltered
    ? graph.saveTables.map((t) => t.table).filter((t) => matches(t, filter.query))
    : [];
  return (
    <div
      ref={grid}
      onKeyDown={(e) => (e.key === 'Escape' ? select('') : arrows(e, grid.current))}
      style={box}
    >
      <Lines lines={lines} />
      {graph.layers
        .filter((l) => !filter.layer || l === filter.layer)
        .map((l) => (
          <Column
            key={l}
            layer={l}
            tables={l === 'Save' ? tables : []}
            groups={rows(shown, l)}
            {...{ selected, near, select }}
          />
        ))}
    </div>
  );
}
