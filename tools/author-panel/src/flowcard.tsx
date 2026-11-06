// The Flow graph's drawn pieces (rulings S3): chips, `+N` and count stubs, the edge layer and the
// hover card. Colours only from chrome classes; drawing numbers only from flow.ts `F` and map.ts `M`.
import { CircleAlert } from 'lucide-react';
import { Button } from './components/ui/button.tsx';
import { PopoverContent } from './components/ui/popover.tsx';
import { F, key, type Chip, type Flow, type Line, type Stub } from './flow.ts';
import { card } from './flowread.ts';
import { M } from './map.ts';
import { ICON } from './storylist.tsx';
import { ICONED } from './storylower.tsx';
import type { Story } from './storylist.ts';

const DASH = '[stroke-dasharray:4_3]';
const dim = (on: boolean) => ({ opacity: on ? 1 : F.dim });

/** One line per drawn pair: solid `strong` or dashed `dim`; following, a fact's lines in accent. */
export function Lines({ f, on, accent }: { f: Flow; on: (l: Line) => boolean; accent: (l: Line) => boolean }) {
  return (
    <svg aria-hidden className="pointer-events-none absolute top-0 left-0 overflow-visible" width={f.w} height={f.h}>
      <defs>
        <marker id="flow-head" viewBox="0 0 5 5" refX="5" refY="2.5" markerWidth="5" markerHeight="5" markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0,0 L5,2.5 L0,5 z" className="[fill:context-stroke]" />
        </marker>
      </defs>
      {f.lines.map((l) => (
        <path
          key={l.id}
          d={l.d}
          markerEnd="url(#flow-head)"
          style={dim(on(l))}
          className={`fill-none ${accent(l) ? 'stroke-primary' : l.solid ? 'stroke-foreground' : 'stroke-muted-foreground'} ${l.solid ? '' : DASH}`}
        />
      ))}
    </svg>
  );
}

export type ChipAct = {
  tab: string | undefined;
  zoom: number;
  on: (id: string) => boolean;
  selected?: string;
  dot: (ref: string) => 'editor' | 'outside' | undefined;
  unreached: Set<string>;
  click: (id: string, e: React.MouseEvent) => void;
  dbl: (ref: string) => void;
  hover: (id?: string) => void;
  focus: (id: string) => void;
};

const place = (c: { x: number; y: number }, zoom: number) =>
  zoom < F.overview
    ? { left: c.x + F.w / 2 - M.disc / 2 / zoom, top: c.y + F.h / 2 - M.disc / 2 / zoom, width: M.disc / zoom, height: M.disc / zoom }
    : { left: c.x, top: c.y, width: F.w, height: F.h };

const common = (a: ChipAct, id: string) => ({
  'data-id': id,
  tabIndex: a.tab === id ? 0 : -1,
  onClick: (e: React.MouseEvent) => a.click(id, e),
  onFocus: () => a.focus(id),
  onMouseEnter: () => a.hover(id),
  onMouseLeave: () => a.hover(),
});

/** A story node as a `<button>`: its lane's corners, its kind's icon, refusal and `~` badges, the dot. */
export function ChipButton({ c, s, a }: { c: Chip; s: Story; a: ChipAct }) {
  const I = ICON[c.kind];
  const off = a.unreached.has(c.id);
  const refusals = s.diagnostics[c.id]?.length ?? 0;
  const todo = (s.todo[c.id] ?? []).reduce((n, t) => n + t.placeholders.length, 0);
  const look = `${a.selected === c.id ? 'bg-accent border-ring' : off ? 'border-dashed bg-transparent' : 'bg-card'} ${c.shape}`;
  const dot = a.dot(c.id);
  const disc = a.zoom < F.overview;
  return (
    <button
      type="button"
      data-ref={c.id}
      aria-label={c.name}
      onDoubleClick={() => a.dbl(c.id)}
      {...common(a, c.id)}
      style={{ ...place(c, a.zoom), ...dim(a.on(c.id)) }}
      className={`absolute flex items-center gap-1 border border-input px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring ${disc ? (off ? 'rounded-full border-dashed border-foreground' : 'rounded-full bg-foreground') : look}`}
    >
      {disc ? null : (
        <>
          {I ? <I {...ICONED} /> : null}
          <span className="min-w-0 flex-1 truncate text-left font-mono">{c.key.slice(0, F.chars)}</span>
          {refusals ? (
            <span className="flex items-center text-destructive">
              <CircleAlert {...ICONED} />
              {refusals}
            </span>
          ) : null}
          {todo ? <span className="text-warning">~{todo}</span> : null}
          {dot ? <span className={`absolute -top-0.5 -right-0.5 size-1.5 rounded-full motion-safe:transition-opacity ${dot === 'outside' ? 'bg-outside' : 'bg-primary'}`} /> : null}
        </>
      )}
    </button>
  );
}

/** A cell's `+N` (hollow, dim) or a collapsed part's count chip (`12` with the lane's first icon). */
export function StubButton({ c, a }: { c: Stub; a: ChipAct }) {
  const I = ICON[c.icon];
  const name = c.kind === 'more' ? `${c.n} more` : `${c.n} ${c.lane}`;
  return (
    <button
      type="button"
      aria-label={name}
      {...common(a, c.id)}
      style={{ ...place(c, a.zoom), ...dim(a.on(c.id)) }}
      className={`absolute flex items-center gap-1 rounded-md border px-1.5 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring ${c.kind === 'more' ? 'border-dashed text-muted-foreground' : 'bg-card'}`}
    >
      {a.zoom < F.overview ? null : c.kind === 'more' ? `+${c.n}` : (
        <>
          {I ? <I {...ICONED} /> : null}
          {c.n}
        </>
      )}
    </button>
  );
}

// focus or a press on another chip moves the card; Radix would close it after the chip opened it
const stay = (e: Event) => (e.target as Element).closest?.('[data-id]') && e.preventDefault();

export type CardAct = {
  open: () => void;
  inbound: () => void;
  outbound: () => void;
  expand: () => void;
  follow?: () => void;
  unfollow?: () => void;
  back: () => void;
};

/** The hover card's body (rulings S3 Hover card); Play to here and Jump here wait for S4. */
export function Card({ s, f, ref: r, a }: { s: Story; f: Flow; ref: string; a: CardAct }) {
  const chip = f.chips.find((c) => c.id === r);
  const I = ICON[chip?.kind ?? ''];
  const { rows, more, depends } = card(s, r);
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') e.preventDefault(), a.back();
    if (e.key === 'Tab' && e.shiftKey && e.target === e.currentTarget.querySelector('button')) e.preventDefault(), a.back();
  };
  const btn = (label: string, run?: () => void) => (
    <Button key={label} variant="outline" size="xs" onClick={run}>
      {label}
    </Button>
  );
  return (
    <PopoverContent data-flow-card align="start" className="w-[280px] p-2 text-xs" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={stay} onKeyDown={keys}>
      <p className="flex items-center gap-1">
        {I ? <I {...ICONED} /> : null}
        <span className="font-mono">{key(r)}</span>
      </p>
      <p className="text-muted-foreground">{chip?.name.split(', ').slice(2, -2).join(', ')}</p>
      <ul className="my-1 font-mono">
        {rows.map((row) => <li key={row}>{row}</li>)}
        {more ? <li className="text-muted-foreground">+{more} more</li> : null}
      </ul>
      {depends.length ? <p className="text-muted-foreground">{depends.join(' · ')}</p> : null}
      <div className="mt-1 flex flex-wrap gap-1">
        {btn('Open', a.open)}
        {btn('← Inbound', a.inbound)}
        {btn('Outbound →', a.outbound)}
        {btn('Expand', a.expand)}
        {a.follow ? btn('Follow', a.follow) : null}
        {a.unfollow ? btn('Unfollow', a.unfollow) : null}
        <Button variant="outline" size="xs" disabled title="S4">Play to here</Button>
        <Button variant="outline" size="xs" disabled title="S4">Jump here</Button>
      </div>
    </PopoverContent>
  );
}
