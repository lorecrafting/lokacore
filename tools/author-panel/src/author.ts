// `bin/loka dev --watch`'s API (kernel/ts/play/live.ts), proxied at /__author by vite.config.ts.
import { useEffect, useState } from 'react';
import type { Numbers } from '../../../kernel/ts/play/numbers.ts';

export const ask = (path: string, sent: object) =>
  fetch(`/__author/${path}`, { method: 'POST', body: JSON.stringify(sent) }).then(async (r) => ({
    ok: r.ok,
    told: (await r.json()) as unknown,
  }));

export const checkpoints = {
  list: () => fetch('/__author/checkpoints').then((r) => r.json() as Promise<string[]>),
  get: (name: string) =>
    fetch(`/__author/checkpoints/${name}`).then((r) => r.json() as Promise<{ steps: never[] }>),
  put: (name: string, steps: unknown[]) =>
    fetch(`/__author/checkpoints/${name}`, { method: 'PUT', body: JSON.stringify({ steps }) }),
};

export type Found = {
  hits: { at: string; text: string }[];
  total: number;
  refs: { kind: string; by: string; at?: string }[];
};
/** Every source line holding `q` and every definition referring to the key `q` (kernel/ts/play/find.ts). */
export const find = (q: string) =>
  fetch(`/__author/find?q=${encodeURIComponent(q)}`).then((r) => r.json() as Promise<Found>);

export type Todo = { file: string; words: number; placeholders: string[] };
/** The `~` placeholders still to write, by file (kernel/ts/play/todo.ts). */
export const todo = () => fetch('/__author/todo').then((r) => r.json() as Promise<Todo[]>);

/** The balancing reports, each bounded by the watcher (kernel/ts/play/live.ts). */
export const numbers = () =>
  fetch('/__author/numbers').then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return (await r.json()) as Numbers;
  });

/** The last compile's plain-words diagnostics; `undefined` until the watcher answers. */
export function useDiagnostics() {
  const [said, setSaid] = useState<string[]>();
  const [compiled, setCompiled] = useState(true);
  const [lint, setLint] = useState<string[]>();
  useEffect(() => {
    let events: EventSource;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const open = () => {
      events = new EventSource('/__author/events');
      events.onmessage = (e) => {
        const message = JSON.parse(e.data) as { said: string[]; compiled: boolean; lint?: string[] };
        setSaid(message.said);
        setCompiled(message.compiled);
        setLint(message.lint);
      };
      // a 502 while the watcher restarts closes the stream for good; only a network drop retries
      events.onerror = () => {
        if (events.readyState === EventSource.CLOSED) retry = setTimeout(open, 2000);
      };
    };
    open();
    return () => {
      clearTimeout(retry);
      events.close();
    };
  }, []);
  return { said, compiled, lint };
}
