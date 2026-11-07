// `bin/loka dev --watch`'s API (kernel/ts/play/live.ts), proxied at /__author by vite.config.ts.
import { useEffect, useState } from 'react';
import type { Story, Todo } from './storylist.ts';
export type { Edge, Beat, Outline, Story, Todo } from './storylist.ts';
import type { Timings } from './shell.ts';
import type { useBook } from './book.ts';
import type { Fights, Numbers } from '../../../kernel/ts/play/numbers.ts';

export const ask = (path: string, sent: object) =>
  fetch(`/__author/${path}`, { method: 'POST', body: JSON.stringify(sent) }).then(async (r) => ({
    ok: r.ok,
    told: (await r.json()) as unknown,
  }));
/** A refusal (what still names it, or changed since) shows as an alert. */
const refused = ({ ok, told }: { ok: boolean; told: unknown }) =>
  ok || alert(typeof told === 'string' ? told : 'Changed outside: try again');

/** The palette's Delete (POST /delete): the definition's file, or its row of a root file; a refusal
 * (what still names it) shows as an alert, as the palette's New does. */
export async function drop(key: string, file?: string) {
  if (!file) return alert(`${key}: no source file`);
  const { sha256 } = await fetch(`/__author/source?file=${encodeURIComponent(file)}`).then((r) =>
    r.ok ? r.json() : { sha256: undefined },
  );
  if (!sha256) return alert(`${file}: not found`);
  const sent = { file, was: sha256, ...(!file.includes('/') && { key }) };
  let { ok, told } = await ask('delete', sent);
  // a delete that takes other files (a return leg, a template) names them with their shas once
  const set = (told as { set?: { file: string; sha256: string }[] })?.set;
  if (set && confirm(`Also deletes ${set.map((m) => m.file).join(', ')}`))
    ({ ok, told } = await ask('delete', {
      ...sent,
      also: Object.fromEntries(set.map((m) => [m.file, m.sha256])),
    }));
  else if (set) return;
  refused({ ok, told });
}
/** The palette's Undo: the newest journal entry if it is a Delete, which leaves no card to undo it
 * from (loka-wfrgk.92); else the Book's Cmd-Z, which puts back its own words. */
export async function undoDelete(book: Pick<ReturnType<typeof useBook>, 'send'>) {
  const r = await fetch('/__author/journal');
  const told: unknown = await r.json().catch(() => r.statusText);
  if (!r.ok) return refused({ ok: false, told });
  const [last] = told as { id: number; what: string }[];
  if (!last?.what.startsWith('delete '))
    return book.send({ op: 'key', key: 'z', metaKey: true, ctrlKey: false, altKey: false });
  refused(await ask('undo', { id: last.id }));
}

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

const report = <T>(route: string) =>
  fetch(`/__author/${route}`).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return (await r.json()) as T;
  });
/** The balancing reports, each bounded by the watcher (kernel/ts/play/live.ts). */
export const numbers = () => report<Numbers>('numbers');
/** The fight rows alone, without the pacing sim's minutes (loka-wfrgk.79). */
export const fights = () => report<Fights>('fights');

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
