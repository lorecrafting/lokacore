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

/** The divider on a column's inner edge, or above the map slot (it grows upwards, at most to the
 * column less its 32 px tab strip). */
export function Divider({ side, layout, set }: { side: 'left' | 'right' | 'slot'; layout: Layout; set: SetLayout }) {
  const size = (px: number) => set((l) => ({ ...l, [side]: px }));
  const across = side === 'slot';
  const most = (el: HTMLElement) => (across ? el.parentElement!.clientHeight - 32 : undefined);
  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId); // a release over the Book frame still ends the drag
    const top = most(e.currentTarget);
    const at = (m: { clientX: number; clientY: number }) => (across ? -m.clientY : m.clientX);
    const [from, start] = [at(e), clamp(side, layout[side], top)];
    const move = (m: PointerEvent) =>
      size(clamp(side, start + (at(m) - from) * (side === 'right' ? -1 : 1), top));
    const up = () => (removeEventListener('pointermove', move), removeEventListener('pointerup', up));
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  };
  return (
    <div
      role="separator"
      aria-orientation={across ? 'horizontal' : 'vertical'}
      aria-label={across ? 'Map slot height' : `${side} column width`}
      aria-valuenow={layout[side]}
      tabIndex={0}
      className={
        across
          ? 'relative h-px shrink-0 cursor-row-resize bg-border before:absolute before:inset-x-0 before:-top-1 before:h-2 hover:bg-ring'
          : 'relative w-px shrink-0 cursor-col-resize bg-border before:absolute before:inset-y-0 before:-left-1 before:w-2 hover:bg-ring max-[900px]:hidden'
      }
      onPointerDown={drag}
      onDoubleClick={() => size(reset(side))}
      onKeyDown={(e) => size(nudge(side, layout[side], e.key, e.shiftKey, most(e.currentTarget)))}
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
