// E5's panel pieces (docs/design/prose-in-the-book-rulings.md): the Hold, the Book's `~` counts,
// its unconfirmed words and its notes. The editing itself is the Book's (mobile/app/author/inbook.ts).
import { useEffect, useRef, useState } from 'react';
import { ask, todo } from './author.ts';
import type { Prose } from './book.ts';
import { Button } from './components/ui/button.tsx';

const WARNING = 'text-(--book-warning)';

/** The header's Hold toggle and `Held · N waiting`; leaving the page releases a Hold it set. */
export function Hold({ held, pending }: { held?: boolean; pending?: number }) {
  const mine = useRef(false);
  useEffect(() => {
    if (!held) mine.current = false; // on a change only: a render before `held` arrives keeps it
  }, [held]);
  useEffect(() => {
    const release = () =>
      mine.current && navigator.sendBeacon('/__author/hold', JSON.stringify({ on: false }));
    addEventListener('pagehide', release);
    return () => removeEventListener('pagehide', release);
  }, []);
  const toggle = () => {
    mine.current = !held;
    void ask('hold', { on: !held });
  };
  return (
    <>
      <Button
        className="ml-auto"
        size="sm"
        variant="outline"
        aria-pressed={!!held}
        onClick={toggle}
      >
        Hold
      </Button>
      {held ? <span className={`text-xs ${WARNING}`}>Held · {pending ?? 0} waiting</span> : null}
    </>
  );
}

/** `~ 2 of 5 here · 41 in cartridge`: the Book's count, and todo's over every file. */
export function Counts({ prose, said }: { prose: Prose; said?: string[] }) {
  const [all, setAll] = useState<number>();
  useEffect(() => {
    todo().then(
      (rows) => setAll(rows.reduce((n, row) => n + row.placeholders.length, 0)),
      () => setAll(undefined),
    );
  }, [said]);
  const { here = 0, at = 0 } = prose.todoHere ?? {};
  const where = at ? `${at} of ${here}` : `${here}`;
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      ~ {where} here{all === undefined ? '' : ` · ${all} in cartridge`}
    </p>
  );
}

/** The unconfirmed words (a refused compile) with the refusal, and the Book's last note. */
export function Unconfirmed({
  prose,
  unconfirmed,
  said,
}: {
  prose: Prose;
  unconfirmed?: { at: string }[];
  said?: string[];
}) {
  const open = prose.open;
  return (
    <>
      {unconfirmed?.length ? (
        <details className={`mt-1 text-xs ${WARNING}`}>
          <summary className="cursor-pointer">
            The Book shows unconfirmed words ({unconfirmed.length})
          </summary>
          <ul className="mt-1 font-mono">
            {unconfirmed.map(({ at }) => (
              <li key={at}>{at}</li>
            ))}
          </ul>
          <p className="mt-1">{said?.join(' ')}</p>
        </details>
      ) : null}
      {prose.note ? (
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground" role="status">
          {prose.note}
          {open ? (
            <Button size="sm" variant="link" onClick={() => void ask('open', open)}>
              Open source
            </Button>
          ) : null}
        </p>
      ) : null}
    </>
  );
}
