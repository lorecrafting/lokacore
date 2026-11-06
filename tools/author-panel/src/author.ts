// `bin/loka dev --watch`'s API (kernel/ts/play/live.ts), proxied at /__author by vite.config.ts.
import { useEffect, useState } from 'react';
import type { Story, Todo } from './storylist.ts';
export type { Edge, Beat, Outline, Story, Todo } from './storylist.ts';
import type { Timings } from './shell.ts';
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

/** The `~` placeholders still to write, by file (kernel/ts/play/todo.ts). */
export const todo = () => fetch('/__author/todo').then((r) => r.json() as Promise<Todo[]>);

/** The abstract NPCs and items a map drop may extend (kernel/ts/play/write.ts `templates`). */
export type Template = { dir: 'npcs' | 'items'; key: string };
export const templates = () =>
  fetch('/__author/templates').then((r) => r.json() as Promise<Template[]>);

/** The balancing reports, each bounded by the watcher (kernel/ts/play/live.ts). */
export const numbers = () =>
  fetch('/__author/numbers').then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return (await r.json()) as Numbers;
  });

type Message = {
  text: Record<string, string>;
  said: string[];
  compiled: boolean;
  lint?: string[];
  diagnostics?: unknown[];
  held?: boolean;
  pending?: number;
  changed?: { file: string; sha256: string; by: 'editor' | 'outside' }[];
  unconfirmed?: { key: string; at: string }[];
  placeholders?: Record<string, string>;
  timings?: Timings;
};
export type Change = NonNullable<Message['changed']>[number] & { seen: number };
type Kept = Omit<Message, 'changed' | 'timings'>;
const KEEP = 50; // mutate-skip: the console's scrollback, a display bound

/** The last compile's message, the change feed (newest first) and each edit's timings once. */
export function useDiagnostics() {
  const [last, setLast] = useState<Partial<Kept>>({});
  const [changes, setChanges] = useState<Change[]>([]);
  const [timings, setTimings] = useState<Timings[]>([]);
  useEffect(() => {
    let events: EventSource;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const open = () => {
      events = new EventSource('/__author/events');
      events.onmessage = (e) => {
        const { changed, timings: t, ...kept } = JSON.parse(e.data) as Message;
        setLast(kept);
        const seen = Date.now();
        if (changed?.length)
          setChanges((c) => [...changed.map((x) => ({ ...x, seen })), ...c].slice(0, KEEP));
        if (t)
          setTimings((all) => (all.some((x) => x.at === t.at) ? all : [t, ...all].slice(0, KEEP)));
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
  return { ...last, compiled: last.compiled ?? true, changes, timings };
}

/** The Story map's model (kernel/ts/play/story.ts): the definitions, their `~` and diagnostics. */
export const story = () => {
  const start = performance.now();
  return fetch('/__author/story').then(async (r) => {
    if (!r.ok) throw Object.assign(new Error(await r.text()), { status: r.status });
    const s = (await r.json()) as Story;
    performance.measure('flow:fetch', { start }); // Flow's budget reads it (rulings S3 Budgets)
    return s;
  });
};
