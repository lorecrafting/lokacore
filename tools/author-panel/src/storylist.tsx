// The map slot's Story segment (docs/design/editor-map-and-story-rulings.md S2): the list as a
// role="tree" and Trace under it. The rules live in storylist.ts; this file maps rows to elements.
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Film,
  Flag,
  Hand,
  MessageCircle,
  Route,
  Scroll,
  Tag,
  TriangleAlert,
  User,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { Story } from './author.ts';
import { Button } from './components/ui/button.tsx';
import type { SetLayout } from './columns.tsx';
import { fromRef, type Layout, type Selection } from './shell.ts';
import * as L from './storylist.ts';

const ICON: Record<string, typeof Flag> = {
  quest: Flag,
  story_point: Scroll,
  dialogue: MessageCircle,
  scene: Film,
  reaction: Zap,
  action: Hand,
  fact: Tag,
  topic: BookOpen,
  npc: User,
};
const ICONED = { className: 'size-3.5 shrink-0', strokeWidth: 1.5, absoluteStrokeWidth: true };
const SCROLL = 'loka.editor.story.scroll';

type Props = {
  story: Story;
  layout: Layout;
  set: SetLayout;
  segment: React.ReactNode;
  pick: (s: Selection) => void;
  open: (key: string) => void;
};

function NodeCells({ row, trace }: { row: L.Row; trace: () => void }) {
  const Icon = ICON[row.node ?? ''];
  return (
    <>
      {Icon ? <Icon {...ICONED} /> : null}
      <code className={`flex-1 truncate ${row.unreached ? 'text-muted-foreground' : ''}`}>{row.label}</code>
      {L.TRACED.has(row.node!) ? (
        <Button
          variant="ghost"
          size="icon-xs"
          tabIndex={-1}
          className="opacity-0 group-hover:opacity-100 group-focus:opacity-100"
          title={`Trace ${row.label}`}
          aria-label={`Trace ${row.label}`}
          onClick={(e) => (e.stopPropagation(), trace())}
        >
          <Route {...ICONED} />
        </Button>
      ) : null}
      {row.refusals ? (
        <span className="flex items-center gap-0.5 text-destructive">
          <CircleAlert {...ICONED} />
          {row.refusals}
        </span>
      ) : null}
      {row.todo ? <span className="text-warning">~{row.todo}</span> : null}
    </>
  );
}

function Cells({ row, trace }: { row: L.Row; trace: () => void }) {
  if (row.kind === 'node') return <NodeCells row={row} trace={trace} />;
  if (row.kind === 'part') return <span className="truncate text-xs font-medium uppercase">{row.label}</span>;
  if (row.kind === 'seed')
    return (
      <span className="flex items-center gap-1 truncate text-warning">
        <TriangleAlert {...ICONED} />
        {row.label}
      </span>
    );
  return (
    <>
      <span className={`size-4 shrink-0 rounded-sm ${L.SWATCH[row.status!] ?? ''}`} />
      <code className="text-muted-foreground">{row.n}</code>
      <span className="flex-1 truncate">{row.label}</span>
      <span className="text-xs text-muted-foreground">{row.status === 'built' ? '' : row.status}</span>
    </>
  );
}

type Act = { st: L.ListState; put: (st: L.ListState) => void; pick: (s: Selection) => void; open: (key: string) => void };

// A row's click: a node selects (Alt opens its source), a part or beat opens or shuts.
const click = (a: Act, row: L.Row, alt: boolean) => {
  const sel = row.ref ? fromRef(row.ref) : undefined;
  if (sel && alt) return a.open(sel.key);
  if (sel) return (a.put({ ...a.st, focus: row.id }), a.pick(sel));
  if (row.open !== undefined) a.put({ ...L.toggle(a.st, row.id), focus: row.id });
};

// The tree's keys (rulings S2 Keyboard): arrows, Enter selects, `f` traces, Esc closes Trace then leaves.
function keyDown(a: Act, list: L.Row[], e: React.KeyboardEvent<HTMLElement>) {
  const row = list.find((r) => r.id === (e.target as HTMLElement).dataset.id);
  if (!row || e.metaKey || e.ctrlKey) return; // leave Cmd-F and the shortcuts to the browser and App
  const m = L.move(list, row.id, e.key);
  const run: Record<string, () => void> = {
    Enter: () => click(a, row, e.altKey),
    f: () => row.ref && L.TRACED.has(row.node!) && a.put({ ...a.st, trace: row.ref }),
    Escape: () =>
      a.st.trace
        ? a.put({ ...a.st, trace: undefined })
        : e.currentTarget
            .closest('section')
            ?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
            ?.focus(),
  };
  const act = m.toggle ? () => a.put(L.toggle(a.st, m.toggle!)) : m.focus ? () => a.put({ ...a.st, focus: m.focus }) : run[e.key];
  if (!act && !e.key.startsWith('Arrow')) return;
  e.preventDefault();
  act?.();
}

function TracePanel({ story, at, a }: { story: Story; at: string; a: Act }) {
  const key = fromRef(at)?.key ?? at;
  return (
    <section aria-label={`Trace ${key}`} className="max-h-1/2 shrink-0 overflow-auto border-t">
      <header className="flex h-8 items-center justify-between px-2">
        <span>
          Trace <code>{key}</code>
        </span>
        <Button variant="ghost" size="icon-xs" aria-label="Close Trace" onClick={() => a.put({ ...a.st, trace: undefined })}>
          <X {...ICONED} />
        </Button>
      </header>
      <ul>
        {L.trace(story, at).map((r, i) => (
          <li key={i}>
            <button
              type="button"
              disabled={!(r.ref && fromRef(r.ref))}
              className="flex h-7 w-full items-center gap-2 px-4 text-left text-muted-foreground"
              onClick={() => r.ref && a.pick(fromRef(r.ref)!)}
            >
              {r.label}
              {r.key ? <code className={`text-foreground ${r.dashed ? 'underline decoration-dashed' : ''}`}>{r.key}</code> : null}
              {r.beat !== undefined ? <span>· beat {r.beat}</span> : null}
              {r.dashed ? <span className="sr-only">(a clock read)</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Selection from elsewhere reveals its row; a new focus scrolls to it, and takes focus if the tree had it.
function useSync(props: Props, tree: React.RefObject<HTMLUListElement | null>, a: Act, selRef?: string) {
  // restore the saved scroll first, so a revealed row's scroll below wins on mount
  useEffect(() => {
    if (tree.current) tree.current.scrollTop = Number(localStorage.getItem(SCROLL) ?? 0);
  }, [tree]);
  useEffect(() => {
    if (selRef) a.put(L.reveal(props.story, a.st, selRef));
  }, [selRef]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = [...(tree.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])].find(
      (r) => r.dataset.id === a.st.focus,
    );
    el?.scrollIntoView({ block: 'nearest' });
    const here = document.activeElement;
    if (el && (here === document.body || tree.current?.contains(here))) el.focus();
  }, [a.st.focus]); // eslint-disable-line react-hooks/exhaustive-deps
}

function TreeRow({ row, a, chosen, tab }: { row: L.Row; a: Act; chosen: boolean; tab: boolean }) {
  return (
    <li
      data-id={row.id}
      role="treeitem"
      aria-level={row.level}
      aria-expanded={row.open}
      aria-selected={chosen}
      aria-label={row.name}
      title={row.title}
      tabIndex={tab ? 0 : -1}
      className={`group flex cursor-default items-center gap-1.5 pr-2 outline-none focus-visible:ring-1 focus-visible:ring-ring aria-selected:bg-accent ${row.kind === 'part' ? 'h-8' : 'h-7'}`}
      style={{ paddingLeft: 8 + (row.level - 1) * 16 }}
      onClick={(e) => click(a, row, e.altKey)}
    >
      {row.open === undefined ? <span className="size-3.5 shrink-0" /> : row.open ? <ChevronDown {...ICONED} /> : <ChevronRight {...ICONED} />}
      <Cells row={row} trace={() => a.put({ ...a.st, trace: row.ref })} />
    </li>
  );
}

/** The Story segment: the list, its `dim` note and, when tracing, Trace in the lower half. */
export function StoryList(props: Props) {
  const { story, layout, set, segment } = props;
  const st = layout.story ?? L.LIST;
  const a: Act = { st, put: (next) => set((l) => ({ ...l, story: next })), pick: props.pick, open: props.open };
  const tree = useRef<HTMLUListElement>(null);
  const sel = layout.selection;
  const selRef = story.graph.nodes.find((n) => {
    const s = fromRef(n.ref);
    return s?.kind === sel?.kind && s?.key === sel?.key;
  })?.ref;
  useSync(props, tree, a, selRef);
  const list = L.rows(story, st);
  const note = L.note(story);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-8 shrink-0 items-center px-2">{segment}</header>
      {note ? <p className="truncate px-2 text-xs text-muted-foreground">{note}</p> : null}
      <ul
        ref={tree}
        role="tree"
        aria-label="Story"
        className="min-h-0 flex-1 overflow-auto"
        onScroll={(e) => localStorage.setItem(SCROLL, String(e.currentTarget.scrollTop))}
        onKeyDown={(e) => keyDown(a, list, e)}
      >
        {list.map((row) => (
          <TreeRow
            key={row.id}
            row={row}
            a={a}
            chosen={row.ref !== undefined && row.ref === selRef}
            tab={row.id === (list.some((r) => r.id === st.focus) ? st.focus : list[0]?.id)}
          />
        ))}
      </ul>
      {st.trace ? <TracePanel story={story} at={st.trace} a={a} /> : null}
    </div>
  );
}
