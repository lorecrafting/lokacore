// The Flow graph's frame (rulings S3): header buttons, part and beat headers, lane labels, the
// drawn layer and its keys. State lives in flow.tsx `useGraph`.
import { ChevronDown, ChevronRight, Filter, Maximize, Search, ZoomIn, ZoomOut } from 'lucide-react';
import { Icon } from './areamap.tsx';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './components/ui/popover.tsx';
import { Button } from './components/ui/button.tsx';
import { FILTERS, key } from './flow.ts';
import type { Graph, Props as P } from './flow.tsx';
import { Card, ChipButton, Lines, StubButton, type CardAct } from './flowcard.tsx';
import { step } from './flowread.ts';
import { M } from './map.ts';
import { fromRef } from './shell.ts';
import type { Story } from './storylist.ts';

// Esc clears one thing per press: card, search, focus ink, follow, then back to the segment.
function esc(g: Graph, from: HTMLElement) {
  if (g.card) return g.setCard(undefined);
  if (g.q !== undefined) return g.setQ(undefined);
  if (g.mark) return g.setMark(undefined);
  if (g.follow) return g.setFollow(undefined);
  from.closest('section')?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
}

const ZOOM: Record<string, (g: Graph) => void> = {
  '+': (g) => g.zoom(M.step),
  '=': (g) => g.zoom(M.step),
  '-': (g) => g.zoom(1 / M.step),
  '0': (g) => g.fit(),
};

/** The graph's keys (rulings S3 Keyboard), on the focused chip or stub. */
export function keys(g: Graph, s: Story, e: React.KeyboardEvent<HTMLElement>) {
  const id = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')?.dataset.id;
  const run = (f: () => unknown) => (e.preventDefault(), f());
  if (e.key === 'Escape') return run(() => esc(g, e.currentTarget));
  if (!id) return;
  const card = document.querySelector<HTMLElement>('[data-flow-card] button:not(:disabled)');
  if (e.key === 'Tab' && !e.shiftKey && g.card === id && card) return run(() => card.focus());
  const next = step(s, g.f, id, e.key, e.shiftKey);
  if (next) return run(() => g.focusChip(next));
  if (e.key === 'Enter') return run(() => g.enter(id));
  const at = [...g.f.chips, ...g.f.stubs].find((c) => c.id === id)!;
  const part = g.f.parts.find((p) => p.id === g.f.columns[at.col].part);
  if (part && ((e.key === '[' && part.open) || (e.key === ']' && !part.open))) return run(() => g.fold(part.id));
  if (e.key === 'f' && fromRef(id)?.kind === 'fact') return run(() => g.setFollow(id));
  if (e.key === '/') return run(() => (g.setQ(''), setTimeout(() => g.box.current?.focus())));
  if (ZOOM[e.key]) run(() => ZOOM[e.key](g));
}

/** The segment, zoom, fit, search and the filter popover (its button carries the active count). */
export function Header({ p, g }: { p: P; g: Graph }) {
  const on = p.layout.flow?.filters ?? [];
  const flip = (f: string) =>
    p.set((l) => {
      const now = l.flow?.filters ?? [];
      return { ...l, flow: { ...l.flow, filters: now.includes(f) ? now.filter((x) => x !== f) : [...now, f] } };
    });
  return (
    <div className="flex h-7 shrink-0 items-center gap-1 px-2">
      {p.segment}
      <span className="ml-auto" />
      <Icon label="Zoom out" icon={ZoomOut} run={() => g.zoom(1 / M.step)} />
      <Icon label="Zoom in" icon={ZoomIn} run={() => g.zoom(M.step)} />
      <Icon label="~ Fit" icon={Maximize} run={g.fit} />
      <Icon label="~ Search" icon={Search} run={() => (g.setQ(''), setTimeout(() => g.box.current?.focus()))} />
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="xs" aria-label={`~ Filters, ${on.length} active`}>
            <Filter />
            {on.length || null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="flex w-48 flex-col gap-0.5 p-1 text-xs">
          {FILTERS.map((f) => (
            <Button key={f} variant="ghost" size="xs" className="justify-start" aria-pressed={on.includes(f)} onClick={() => flip(f)}>
              {on.includes(f) ? '✓ ' : ''}{f}
            </Button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Part buttons and beat titles above the columns, lane names pinned left; both follow the view. */
function Labels({ g }: { g: Graph }) {
  const v = g.v.view!;
  const x = (at: number) => v.x + at * v.zoom;
  return (
    <>
      {g.f.parts.map((part) => (
        <button key={part.id} type="button" tabIndex={-1} aria-expanded={part.open} onClick={() => g.fold(part.id)} style={{ left: Math.max(0, x(part.x)) }} className="absolute top-0 flex h-4 items-center text-[11px] font-medium">
          {part.open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          {part.label}
        </button>
      ))}
      {g.f.columns.filter((c) => c.n !== undefined).map((c) => (
        <span key={c.id} aria-hidden style={{ left: x(c.x) }} className="absolute top-4 truncate text-[11px] text-muted-foreground">
          {c.n} {c.title}
        </span>
      ))}
      {g.f.lanes.map((l) => (
        <span key={l.lane} aria-hidden style={{ top: v.y + l.y * v.zoom }} className="absolute left-1 text-[11px] text-muted-foreground">
          {l.lane}
        </span>
      ))}
    </>
  );
}

// The hover card's buttons; Inbound and Outbound move focus as Backspace and Shift-Enter do.
const cardAct = (p: P, g: Graph, ref: string): CardAct => {
  const go = (k: string, shift = false) => () => g.focusChip(step(p.story, g.f, ref, k, shift));
  const fact = fromRef(ref)?.kind === 'fact';
  return {
    open: () => p.open(key(ref)),
    inbound: go('Backspace'),
    outbound: go('Enter', true),
    expand: () => g.setMark({ ref, hops: (g.mark?.ref === ref ? g.mark.hops : 1) + 1 }),
    follow: fact && g.follow !== ref ? () => g.setFollow(ref) : undefined,
    unfollow: fact && g.follow === ref ? () => g.setFollow(undefined) : undefined,
    back: () => g.focusChip(ref),
  };
};

/** The drawn layer in a `role="group"`: one column group per beat, lines underneath, the card on top. */
export function Graph({ p, g }: { p: P; g: Graph }) {
  const v = g.v.view;
  const lineOn = (id: string) => g.act.on(id);
  const accent = (from: string, to: string) => !!g.follow && !g.q && !g.mark && (from === g.follow || to === g.follow);
  const name = `Flow, ${g.f.parts.length} parts, ${g.f.nodes} nodes`;
  return (
    <div ref={g.el} className="relative min-h-0 flex-1 touch-none overflow-hidden" onPointerDown={g.down} onKeyDown={(e) => keys(g, p.story, e)}>
      {v ? <Labels g={g} /> : null}
      <Popover open={!!g.card} onOpenChange={(o) => o || g.setCard(undefined)}>
        <div role="group" aria-label={name} className="absolute top-0 left-0 origin-top-left" style={v && { transform: `translate(${v.x}px, ${v.y}px) scale(${v.zoom})` }}>
          <Lines f={g.f} on={(l) => lineOn(l.from) && lineOn(l.to)} accent={(l) => accent(l.from, l.to)} />
          {g.f.columns.map((c, col) => (
            <div key={c.id} role="group" aria-label={c.n === undefined ? key(c.id) : `beat ${c.n} ${c.title ?? ''}`.trim()}>
              {g.f.chips.filter((x) => x.col === col).map((x) => <ChipButton key={x.id} c={x} s={p.story} a={g.act} />)}
              {g.f.stubs.filter((x) => x.col === col).map((x) => <StubButton key={x.id} c={x} a={g.act} />)}
            </div>
          ))}
          <PopoverAnchor virtualRef={{ current: { getBoundingClientRect: () => g.chipEl(g.card)?.getBoundingClientRect() ?? new DOMRect() } }} />
        </div>
        {g.card ? <Card s={p.story} f={g.f} ref={g.card} a={cardAct(p, g, g.card)} /> : null}
      </Popover>
    </div>
  );
}
