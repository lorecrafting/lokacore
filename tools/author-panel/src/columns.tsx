// The shell's columns as layout, not modes (docs/design/editor-chrome-rulings.md): remembered
// widths, a divider that drags, takes arrow keys and resets on a double-click, and a folded side's
// rail. The model is shell.ts.
import { PanelLeftOpen, PanelRightOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './components/ui/button.tsx';
import { clamp, load, nudge, reset, save, type Layout } from './shell.ts';

export type SetLayout = (change: (l: Layout) => Layout) => void;

/** The layout, read once from localStorage and written back on each change. */
export function useLayout(): [Layout, SetLayout] {
  const [layout, setLayout] = useState(() => load(localStorage));
  useEffect(() => save(localStorage, layout), [layout]);
  return [layout, setLayout];
}

/** The divider on a column's inner edge. */
export function Divider({ side, layout, set }: { side: 'left' | 'right'; layout: Layout; set: SetLayout }) {
  const width = (px: number) => set((l) => ({ ...l, [side]: px }));
  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId); // a release over the Book frame still ends the drag
    const [from, start] = [e.clientX, layout[side]];
    const move = (m: PointerEvent) => width(clamp(side, start + (m.clientX - from) * (side === 'left' ? 1 : -1)));
    const up = () => (removeEventListener('pointermove', move), removeEventListener('pointerup', up));
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`${side} column width`}
      aria-valuenow={layout[side]}
      tabIndex={0}
      className="relative w-px shrink-0 cursor-col-resize bg-border before:absolute before:inset-y-0 before:-left-1 before:w-2 hover:bg-ring max-[900px]:hidden"
      onPointerDown={drag}
      onDoubleClick={() => width(reset(side))}
      onKeyDown={(e) => width(nudge(side, layout[side], e.key, e.shiftKey))}
    />
  );
}

/** A folded column's rail: one button that opens it again (Cmd-\ or Cmd-/ does the same). */
export function Rail({ side, set }: { side: 'left' | 'right'; set: SetLayout }) {
  const Icon = side === 'left' ? PanelLeftOpen : PanelRightOpen;
  const key = side === 'left' ? 'leftOpen' : 'rightOpen';
  return (
    <div className="flex w-7 shrink-0 flex-col items-center bg-sunken py-2 max-[900px]:hidden">
      <Button variant="ghost" size="icon-xs" aria-label={`Open the ${side} column`} onClick={() => set((l) => ({ ...l, [key]: true }))}>
        <Icon />
      </Button>
    </div>
  );
}
