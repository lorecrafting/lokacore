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
  Lightbulb,
  Link,
  MessageCircle,
  Route,
  Scroll,
  Tag,
  TriangleAlert,
  User,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import type { Story } from './author.ts';
import { Button } from './components/ui/button.tsx';
import type { SetLayout } from './columns.tsx';
import { edit } from './mapwire.ts';
import { fromRef, type Layout, type Selection } from './shell.ts';
import * as L from './storylist.ts';
import { ICONED, LowerPanel, PacingButton, type Act } from './storylower.tsx';

/** Each story kind's icon (the List's rows and Flow's chips): a quest is a scroll, a story point a flag. */
export const ICON: Record<string, typeof Flag> = {
  quest: Scroll,
  story_point: Flag,
  dialogue: MessageCircle,
  scene: Film,
  reaction: Zap,
  action: Hand,
  fact: Tag,
  topic: BookOpen,
  npc: User,
};
const SCROLL = 'loka.editor.story.scroll';
let saving: ReturnType<typeof setTimeout> | undefined;
// the scroll is kept once it rests, not on every scroll event
const save = (el: HTMLElement) => {
  const top = String(el.scrollTop); // read now: a list gone by the timer has lost its scroll
  clearTimeout(saving);
  saving = setTimeout(() => localStorage.setItem(SCROLL, top), 200);
};

type Props = {
  story: Story;
  layout: Layout;
  set: SetLayout;
  segment: React.ReactNode;
  pick: (s: Selection) => void;
  open: (ref: string) => void;
};

function NodeCells({ row, tab, trace }: { row: L.Row; tab: boolean; trace: () => void }) {
  const Icon = ICON[row.node ?? ''];
  return (
    <>
      {Icon ? <Icon {...ICONED} /> : null}
      <code className={`flex-1 truncate ${row.unreached ? 'text-muted-foreground' : ''}`}>{row.label}</code>
      {L.TRACED.has(row.node!) ? <Ghost label={`Trace ${row.label}`} icon={Route} tab={tab} run={trace} /> : null}
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

// A row's hover button, shown on hover and focus as the hierarchy's Play is; Tab reaches the tab row's.
// It gives focus back to its row, so a palette undo after it does not return Enter to it.
function Ghost({ label, icon: Icon, tab, run }: { label: string; icon: typeof Flag; tab: boolean; run: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      tabIndex={tab ? 0 : -1}
      className="opacity-0 group-hover:opacity-100 group-focus:opacity-100 focus-visible:opacity-100"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        e.currentTarget.closest('li')?.focus();
        run();
      }}
    >
      <Icon {...ICONED} />
    </Button>
  );
}

// Bind (design 5c): one more short ref on the beat's `nodes` in outline.json, by /change; map undo puts it back.
// ponytail: a prompt, not the design's Picker (the panel has none until E4b, PR 645); swap in its Picker then
const bind = (row: L.Row) => {
  const short = prompt(`Bind beat ${row.n} to (a short ref, as outline.json writes it)`);
  if (short) edit((e) => e.bind(Number(row.parent!.slice('part:'.length)), row.n!, short));
};

function Cells({ row, a, tab }: { row: L.Row; a: Act; tab: boolean }) {
  const at = { ...a.st, focus: row.id }; // a ghost's run moves the tab row to its row, where it gave focus
  if (row.kind === 'node')
    return <NodeCells row={row} tab={tab} trace={() => a.put({ ...at, lower: { panel: 'trace', at: row.ref! } })} />;
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
      <Ghost label={`Bind beat ${row.n}`} icon={Link} tab={tab} run={() => {
          a.put(at);
          bind(row);
        }}
      />
      <Ghost
        label={`Knowledge at beat ${row.n}`}
        icon={Lightbulb}
        tab={tab}
        run={() => a.put({ ...at, lower: { panel: 'knowledge', n: row.n! } })}
      />
      <span className="text-xs text-muted-foreground">{row.status === 'built' ? '' : row.status}</span>
    </>
  );
}


// A row's click: a node selects (Alt opens its source), a part or beat opens or shuts.
const click = (a: Act, row: L.Row, alt: boolean) => {
  const sel = row.ref ? fromRef(row.ref) : undefined;
  if (sel && alt) return a.open(row.ref!);
  if (sel) return (a.put({ ...a.st, focus: row.id }), a.pick(sel));
  if (row.open !== undefined) a.put({ ...L.toggle(a.st, row.id), focus: row.id });
};

// The tree's keys (rulings S2 Keyboard): arrows, Enter selects, `f` traces, Esc closes Trace then leaves.
function keyDown(a: Act, list: L.Row[], e: React.KeyboardEvent<HTMLElement>) {
  const el = e.target as HTMLElement;
  const row = list.find((r) => r.id === el.closest<HTMLElement>('[data-id]')?.dataset.id); // a row or its ghost
  if (!row || e.metaKey || e.ctrlKey) return; // leave Cmd-F and the shortcuts to the browser and App
  if (e.key === 'Enter' && !el.dataset.id) return; // a ghost's Enter is its own click
  const m = L.move(list, row.id, e.key);
  const run: Record<string, () => void> = {
    Enter: () => click(a, row, e.altKey),
    f: () => row.ref && L.TRACED.has(row.node!) && a.put({ ...a.st, lower: { panel: 'trace', at: row.ref } }),
    Escape: () =>
      a.st.lower
        ? a.put({ ...a.st, lower: undefined })
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

// Selection from elsewhere reveals its row (useSync returns its ref); a new focus scrolls to it, and takes focus if the tree had it.
function useSync(props: Props, tree: React.RefObject<HTMLUListElement | null>, a: Act) {
  const sel = props.layout.selection;
  const selRef = props.story.graph.nodes.find((n) => {
    const s = fromRef(n.ref);
    return s?.kind === sel?.kind && s?.key === sel?.key;
  })?.ref;
  // restore the saved scroll first, so a revealed row's scroll below wins on mount
  useEffect(() => {
    if (tree.current) tree.current.scrollTop = Number(localStorage.getItem(SCROLL) ?? 0);
  }, [tree]);
  useEffect(() => {
    if (selRef && !a.st.chosen) a.put(L.reveal(props.story, a.st, selRef));
  }, [selRef]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = [...(tree.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])].find(
      (r) => r.dataset.id === a.st.focus,
    );
    el?.scrollIntoView({ block: 'nearest' });
    const here = document.activeElement;
    if (el && (here === document.body || tree.current?.contains(here))) el.focus();
    if (a.st.chosen) a.put({ ...a.st, chosen: undefined }); // the palette's focus is shown; selections reveal again
  }, [a.st.focus, a.st.chosen]); // eslint-disable-line react-hooks/exhaustive-deps
  return selRef;
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
      <Cells row={row} a={a} tab={tab} />
    </li>
  );
}

/** The Story segment: the list, its `dim` note and, when tracing, Trace in the lower half. */
export function StoryList(props: Props) {
  const { story, layout, set, segment } = props;
  const st = layout.story ?? L.LIST;
  const a: Act = { st, put: (next) => set((l) => ({ ...l, story: next })), pick: props.pick, open: props.open };
  const tree = useRef<HTMLUListElement>(null);
  const selRef = useSync(props, tree, a);
  const list = useMemo(() => L.rows(story, st), [story, st]);
  const note = L.note(story);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-8 shrink-0 items-center gap-1 px-2">
        {segment}
        <PacingButton story={story} a={a} />
      </header>
      {note ? <p className="truncate px-2 text-xs text-muted-foreground">{note}</p> : null}
      <ul
        ref={tree}
        role="tree"
        aria-label="Story"
        className="min-h-0 flex-1 overflow-auto"
        onScroll={(e) => save(e.currentTarget)}
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
      {st.lower ? <LowerPanel story={story} p={st.lower} a={a} /> : null}
    </div>
  );
}
