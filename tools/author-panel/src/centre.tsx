// The shell's centre: the `sunken` well with its toolbar (phone or tablet, the reload badge, Hold,
// the last edit's timings against budget) over the Book strip at 0.75 (editor-chrome-rulings.md §5).
import type { RefObject } from 'react';
import { BOOK } from './book.ts';
import type { SetLayout } from './columns.tsx';
import { Hold } from './prose.tsx';
import { BUDGET, loadOf, total, within, type Layout, type Loaded, type Timings } from './shell.ts';

/** The last edit: compile + publish (+ the Book's load), `ok` within its budget, `warning` over. */
export function Timing({ t, loaded }: { t?: Timings; loaded?: Loaded }) {
  if (!t) return null;
  const load = loadOf(t, loaded);
  const parts = [t.compile, t.publish, ...(load ? [load] : [])].join(' + ');
  return (
    <span
      className={`font-mono text-xs ${within(t, load) ? 'text-ok' : 'text-warning'}`}
      title={`${t.kind}: within ${BUDGET[t.kind]} ms`}
      aria-label="Last edit timing"
    >
      {t.kind} {parts} = {total(t, load)} ms
    </span>
  );
}

type Bar = { layout: Layout; set: SetLayout; held?: boolean; pending?: number; last?: Timings; loaded?: Loaded };

function Toolbar({ layout, set, held, pending, last, loaded }: Bar) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-3 px-2">
      <div role="radiogroup" aria-label="Book size" className="inline-flex rounded-md border">
        {(['phone', 'tablet'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={layout.tablet === (v === 'tablet')}
            className={`px-2 text-xs ${layout.tablet === (v === 'tablet') ? 'bg-accent' : ''}`}
            onClick={() => set((l) => ({ ...l, tablet: v === 'tablet' }))}
          >
            {v}
          </button>
        ))}
      </div>
      {loaded ? (
        <span className="text-xs text-primary" title="The Book last loaded">
          reloaded {new Date(loaded.at).toLocaleTimeString()}
        </span>
      ) : null}
      <Timing t={last} loaded={loaded} />
      <Hold held={held} pending={pending} />
    </div>
  );
}

/** The Book itself, 390 (or 820) px wide drawn at 0.75 from the top centre. */
export function BookStrip(
  props: Parameters<typeof Toolbar>[0] & { frame: RefObject<HTMLIFrameElement | null> },
) {
  const width = props.layout.tablet ? 820 : 390; // mutate-skip: the phone and tablet widths the Book is laid out for
  return (
    <main className="flex min-w-0 flex-1 flex-col bg-sunken max-[900px]:h-1/2">
      <Toolbar {...props} />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* allow: a cross-origin frame is only crossOriginIsolated (SharedArrayBuffer for the SQLite worker) when the parent delegates it */}
        <iframe
          ref={props.frame}
          title="Book preview"
          src={`${BOOK}/?dev=1`}
          allow="cross-origin-isolated"
          style={{ width, height: '133.34%', transform: 'translateX(-50%) scale(0.75)' }}
          className="absolute top-0 left-1/2 origin-top border-0 bg-background"
        />
      </div>
    </main>
  );
}
