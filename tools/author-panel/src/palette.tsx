// The Cmd-K palette (editor-chrome-rulings.md §5): one input over the commands, the definitions'
// keys, the text keys' words and the `~` still to write; shell.ts ranks them.
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { rank, type Item } from './shell.ts';

/** Esc closes it and gives focus back; Up, Down and Enter pick a row. */
export function Palette({ all, run, close }: { all: Item[]; run: (i: Item) => void; close: () => void }) {
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null; // not autoFocus: StrictMode's remount gives focus back
    input.current?.focus();
    return () => back?.focus();
  }, []);
  const rows = rank(q, all);
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setAt((n) => Math.max(0, Math.min(rows.length - 1, n + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if (e.key === 'Enter' && rows[at]) (close(), run(rows[at]));
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/20 dark:bg-black/50" onClick={close}>
      <div role="dialog" aria-label="Command palette" className="mx-auto mt-[15vh] w-[560px] max-w-[90vw] overflow-hidden rounded-lg border bg-card shadow-[0_8px_24px_rgb(0_0_0/0.12)] dark:shadow-[0_8px_24px_rgb(0_0_0/0.5)]" onClick={(e) => e.stopPropagation()}>
        <label className="flex h-10 items-center gap-2 border-b px-3">
          <Search aria-hidden />
          <input ref={input} aria-label="Find a key, a ~ or a command" className="flex-1 bg-transparent outline-none" value={q} onChange={(e) => (setQ(e.target.value), setAt(0))} onKeyDown={key} />
        </label>
        <ul role="listbox" className="max-h-[50vh] overflow-auto py-1">
          {rows.length ? (
            rows.map((i, n) => (
              <li key={`${i.kind}${i.id}`} role="option" aria-selected={n === at} className={`flex h-7 cursor-pointer items-center gap-2 px-3 ${n === at ? 'bg-accent' : ''}`} onMouseEnter={() => setAt(n)} onClick={() => (close(), run(i))}>
                <span className="truncate">{i.label}</span>
                <span className="ml-auto truncate font-mono text-xs text-muted-foreground">{i.detail}</span>
              </li>
            ))
          ) : (
            <li className="px-3 text-muted-foreground">No match.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
