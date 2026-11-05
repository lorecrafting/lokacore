// `bin/loka dev --watch`'s API (kernel/ts/play/live.ts), proxied at /__author by vite.config.ts.
import { useEffect, useState } from 'react';
import type { MapRoom } from './map.ts';
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

export type Todo = { file: string; words: number; placeholders: string[] };
/** The `~` placeholders still to write, by file (kernel/ts/play/todo.ts). */
export const todo = () => fetch('/__author/todo').then((r) => r.json() as Promise<Todo[]>);

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

/** A content-graph link (kernel/ts/play/reach.ts): `set` when it writes its fact. */
export type Edge = { from: string; to: string; path: string; op?: string; set?: true };
export type Beat = {
  part: number;
  n: number;
  title?: string;
  status: string; // built, ~, missing or unreached
  missing?: string[];
  nodes: string[];
};
export type Outline = {
  parts: (string | null)[];
  beats: Beat[];
  unpaid: { seed: string; n: number }[];
  unseeded: { pays: string; n: number }[];
};
export type Story = {
  hash: string;
  graph: { nodes: { ref: string; kind: string }[]; edges: Edge[] };
  report: {
    unreachable: Record<string, string[]>;
    behind_lock: { rooms: string[] };
    orphan_facts: { unused: string[]; write_only: string[]; read_only: string[] };
  };
  outline: Outline | { refused: string } | null;
  todo: Record<string, Todo[]>;
  diagnostics: Record<string, { code?: string; path?: string }[]>;
  map: MapRoom[];
};
/** The Story map's model (kernel/ts/play/story.ts): the definitions, their `~` and diagnostics. */
export const story = () =>
  fetch('/__author/story').then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return (await r.json()) as Story;
  });
