// The Flow graph in the left slot (docs/design/editor-map-and-story-rulings.md S3): the map's view
// engine over flow.ts's layout; chips and the hover card are in flowcard.tsx.
import { X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon, useSize, useView } from './areamap.tsx';
import type { Change } from './author.ts';
import { Input } from './components/ui/input.tsx';
import { burst, F, key, layout, stateOf, type Flow } from './flow.ts';
import type { ChipAct } from './flowcard.tsx';
import { Graph, Header } from './flowframe.tsx';
import { entry, focusInk, followed, footer, inked, search } from './flowread.ts';
import { fit, keep, zoomAt } from './map.ts';
import type { SetLayout } from './columns.tsx';
import { BUDGET, fromRef, type Layout, type Selection } from './shell.ts';
import { LIST, toggle, type Story } from './storylist.ts';

export type Props = {
  story: Story;
  layout: Layout;
  set: SetLayout;
  segment: React.ReactNode;
  pick: (s: Selection) => void;
  open: (ref: string) => void;
  changes: Change[];
};
type Mark = { ref: string; hops: number };

const bound = (f: Flow) => ({ x0: 0, y0: 0, x1: f.w, y1: f.h });
const refOf = (s: Story, sel?: Selection) =>
  sel && s.graph.nodes.find((n) => fromRef(n.ref)?.kind === sel.kind && fromRef(n.ref)?.key === sel.key)?.ref;

/** The files changed since the story before this one, with who changed them (the feed's colour). */
function useBurst(story: Story, changes: Change[]) {
  const last = useRef({ story: undefined as Story | undefined, since: undefined as number | undefined, by: new Map<string, Change['by']>() });
  if (last.current.story !== story) {
    const since = last.current.since;
    last.current = { story, since: changes[0]?.seen ?? since ?? 0, by: new Map(burst(changes, since).map((c) => [c.file, c.by])) };
  }
  return last.current.by;
}

/** The layout, measured as `flow:layout` and `flow:commit`; the ms against the open or update budget. */
function useMeasured(story: Story, l: Layout, open: string[], reveal?: string) {
  const st = stateOf(l, { open, reveal });
  const f = useMemo(() => {
    const start = performance.now();
    const f = layout(story, st);
    (performance.clearMeasures('flow:layout'), performance.measure('flow:layout', { start }));
    return f;
  }, [story, JSON.stringify(st)]); // eslint-disable-line react-hooks/exhaustive-deps
  const start = performance.now();
  const first = useRef(true);
  const [ms, setMs] = useState<{ ms: number; budget: number }>();
  useLayoutEffect(() => {
    const done = (performance.clearMeasures('flow:commit'), performance.measure('flow:commit', { start }));
    const fetch = first.current ? (performance.getEntriesByName('flow:fetch').at(-1)?.duration ?? 0) : 0;
    const laid = performance.getEntriesByName('flow:layout').at(-1)?.duration ?? 0;
    setMs({ ms: Math.round(fetch + laid + done.duration), budget: first.current ? BUDGET.flowOpen : BUDGET.flowUpdate });
    first.current = false;
  }, [f]); // eslint-disable-line react-hooks/exhaustive-deps
  return { f, ms };
}

/** The opening view (zoom 1 at the first column, or panned to the selection), and a pan to the
 * selection's chip only when it is outside the viewport. */
function useOpening(f: Flow, sel: string | undefined, v: ReturnType<typeof useView>, size: { w: number; h: number }) {
  const at = sel && [...f.chips, ...f.stubs].find((c) => c.id === f.at.get(sel));
  useEffect(() => {
    if (!size.w) return;
    const now = v.now.current;
    const toward = (zoom: number) => keep({ zoom, x: size.w / 2 - (at ? at.x + F.w / 2 : size.w / 2 - F.gutter) * zoom, y: at ? size.h / 2 - at.y * zoom : 0 }, bound(f), size);
    if (!now) return v.set(toward(1));
    if (!at) return;
    const [x, y] = [now.x + at.x * now.zoom, now.y + at.y * now.zoom];
    if (x < 0 || y < 0 || x + F.w * now.zoom > size.w || y + F.h * now.zoom > size.h) v.ease(toward(now.zoom));
  }, [size.w, size.h, at && at.id]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Wheel zooms with ctrl or meta about the cursor, else pans (the map's idiom). */
function useWheel(el: React.RefObject<HTMLDivElement | null>, g: { v: ReturnType<typeof useView>; f: Flow; size: { w: number; h: number } }) {
  const latest = useRef(g);
  latest.current = g;
  useEffect(() => {
    const div = el.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const { v, f, size } = latest.current;
      const now = v.now.current!;
      const box = div.getBoundingClientRect();
      const moved = e.ctrlKey || e.metaKey ? zoomAt(now, Math.exp(-e.deltaY / 100), { x: e.clientX - box.left, y: e.clientY - box.top }) : { ...now, x: now.x - e.deltaX, y: now.y - e.deltaY };
      v.set(keep(moved, bound(f), size));
    };
    div.addEventListener('wheel', wheel, { passive: false });
    return () => div.removeEventListener('wheel', wheel);
  }, [el]);
}

/** A drag on empty ground pans; a press that does not move clears the ink (the selection stays). */
function pan(e: React.PointerEvent<HTMLDivElement>, v: ReturnType<typeof useView>, f: Flow, size: { w: number; h: number }, clear: () => void) {
  if ((e.target as Element).closest('button') || !v.now.current) return;
  const el = e.currentTarget;
  el.setPointerCapture(e.pointerId);
  const [x0, y0, start] = [e.clientX, e.clientY, v.now.current];
  let moved = false;
  const move = (m: PointerEvent) => {
    moved ||= Math.abs(m.clientX - x0) + Math.abs(m.clientY - y0) > 2;
    v.set(keep({ ...start, x: start.x + m.clientX - x0, y: start.y + m.clientY - y0 }, bound(f), size));
  };
  // lost capture follows pointerup and pointercancel alike
  const up = () => (el.removeEventListener('pointermove', move), el.removeEventListener('lostpointercapture', up), moved || clear());
  el.addEventListener('pointermove', move);
  el.addEventListener('lostpointercapture', up);
}

/** What is inked: search text, else the focus and its hops, else the followed fact. */
function useInk(p: Props, sel: string | undefined) {
  const [mark, setMark] = useState<Mark>();
  const [q, setQ] = useState<string>();
  useEffect(() => setMark(sel ? { ref: sel, hops: 1 } : undefined), [sel]);
  const follow = p.layout.flow?.follow;
  useEffect(() => void (follow && setMark(undefined)), [follow]); // a new follow replaces the focus ink
  const ink = (q && search(p.story, q)) || (mark ? focusInk(p.story, mark.ref, mark.hops) : follow ? followed(p.story, follow) : undefined);
  const setFollow = (fact?: string) => p.set((l) => ({ ...l, flow: { ...l.flow, follow: fact } }));
  return { mark, setMark, q, setQ, ink, follow, setFollow };
}

/** The live region: following, hidden on a filter, beats changed on a compile. */
function useSay(p: Props, f: Flow, dot: (ref: string) => unknown, follow?: string) {
  const [say, setSay] = useState('');
  const hidden = useRef(f.hidden);
  useEffect(() => {
    if (!follow) return;
    const ink = followed(p.story, follow);
    const into = p.story.graph.edges.filter((e) => e.to === follow && ink.has(e.from));
    setSay(`following ${key(follow)}: ${into.filter((e) => e.set).length} setters, ${into.filter((e) => !e.set).length} readers`);
  }, [follow]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (hidden.current !== f.hidden) setSay(`${f.hidden} nodes hidden`);
    hidden.current = f.hidden;
  }, [f.hidden]);
  useEffect(() => {
    const beats = new Set(f.chips.filter((c) => dot(c.id)).map((c) => c.col)).size;
    if (beats) setSay(`${beats} beats changed`);
  }, [p.story]); // eslint-disable-line react-hooks/exhaustive-deps
  return say;
}

/** The hover card: open after F.hoverDelay on a chip; leaving the chip or the card closes it after
 * the same delay unless the focus is on its chip or in it (rulings S3 Hover card). */
function useCard(chip: (id: string) => boolean) {
  const [card, setCard] = useState<string>();
  const timer = useRef(0);
  const kept = (c?: string) => (c && (document.activeElement?.getAttribute('data-id') === c || document.activeElement?.closest('[data-flow-card]')) ? c : undefined);
  const later = (run: () => void) => (clearTimeout(timer.current), (timer.current = window.setTimeout(run, F.hoverDelay)));
  const hover = (id?: string) => (id ? chip(id) && later(() => setCard(id)) : later(() => setCard(kept)));
  return { card, setCard, hover };
}

/** The graph's state and its moves: ink, card, roving tab, view and the actions chips call. */
function useGraph(p: Props, f: Flow, sel: string | undefined, setOpen: (u: (o: string[]) => string[]) => void) {
  const [el, size] = useSize();
  const v = useView();
  const ink = useInk(p, sel);
  const { card, setCard, hover } = useCard((id) => f.chips.some((c) => c.id === id));
  const [tab, setTab] = useState<string>();
  const box = useRef<HTMLInputElement>(null);
  const burst = useBurst(p.story, p.changes);
  const dot = (ref: string) => burst.get(p.story.files[ref] ?? '');
  const say = useSay(p, f, dot, ink.follow);
  useOpening(f, sel, v, size);
  useWheel(el, { v, f, size });
  const chip = (id: string) => f.chips.some((c) => c.id === id);
  const fold = (part: string) => p.set((l) => ({ ...l, story: toggle(l.story ?? LIST, part) }));
  const select = (ref: string) => (p.pick({ file: p.story.files[ref], ...fromRef(ref)! }), ink.setMark({ ref, hops: 1 }));
  const chipEl = (id?: string) => (id ? el.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`) : undefined);
  const focusChip = (id = entry(f, sel)) => chipEl(id)?.focus();
  const enter = (id: string) => {
    if (chip(id)) return select(id);
    if (id.startsWith('more:')) return setOpen((o) => [...o, id.slice(5)]);
    fold(id.slice(6, id.lastIndexOf('|')));
  };
  const zoom = (factor: number) => v.now.current && v.ease(keep(zoomAt(v.now.current, factor, { x: size.w / 2, y: size.h / 2 }), bound(f), size));
  const act: ChipAct = {
    tab: tab && [...f.chips, ...f.stubs].some((c) => c.id === tab) ? tab : entry(f, sel),
    zoom: v.view?.zoom ?? 1,
    on: (id) => inked(f, ink.ink, id),
    selected: sel,
    dot,
    unreached: new Set(Object.values(p.story.report.unreachable).flat()),
    click: (id, e) => (e.altKey && chip(id) ? p.open(id) : enter(id)),
    dbl: (ref) => p.open(ref),
    hover,
    focus: (id) => (setTab(id), chip(id) && setCard(id)),
  };
  const down = (e: React.PointerEvent<HTMLDivElement>) => pan(e, v, f, size, () => (ink.setMark(undefined), setCard(undefined)));
  return { ...ink, el, v, card, setCard, box, say, act, f, fold, chipEl, focusChip, enter, zoom, down, fit: () => v.ease(fit(bound(f), size)) };
}
export type Graph = ReturnType<typeof useGraph>;

export function FlowView(p: Props) {
  const sel = refOf(p.story, p.layout.selection);
  const [open, setOpen] = useState<string[]>([]);
  const { f, ms } = useMeasured(p.story, p.layout, open, sel);
  const g = useGraph(p, f, sel, setOpen);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Header p={p} g={g} />
      {g.q === undefined ? null : (
        <div className="flex h-7 shrink-0 items-center gap-1 px-2">
          <Input ref={g.box} aria-label="~ Search the flow" className="h-6 text-xs" value={g.q} onChange={(e) => g.setQ(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && (e.preventDefault(), g.setQ(undefined), g.focusChip())} />
          <Icon label="~ Close search" icon={X} run={() => g.setQ(undefined)} />
        </div>
      )}
      {f.note ? <p className="truncate px-2 text-xs text-muted-foreground">{f.note}</p> : null}
      <Graph p={p} g={g} />
      <footer className="flex h-5 shrink-0 items-center gap-2 truncate px-2 text-[11px] text-muted-foreground">
        <span className="truncate">{footer(f, p.layout.flow?.follow)}</span>
        {ms ? <span className={`ml-auto font-mono ${ms.ms <= ms.budget ? 'text-ok' : 'text-warning'}`}>{ms.ms} ms</span> : null}
      </footer>
      <p aria-live="polite" className="sr-only">{g.say}</p>
    </div>
  );
}
