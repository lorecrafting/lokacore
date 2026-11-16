// The framed Book preview, over postMessage (mobile/app/author/panel.tsx is the other end): the
// Book says `ready` when its bridge mounts, the panel says hello, the Book posts `state` on every
// session update, answers `trace`, posts `line` for an Alt-clicked Book line, `select` for a
// clicked one and `shortcut` for an editor key pressed in the Book (all postMessage, not protocol).
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Step as PlaceStep } from '../../../mobile/app/author/place.ts';
import { relays } from '../../../mobile/app/author/prose_rules.ts';
import { askTrace } from './ask_trace.ts';
import type { factRows, shown } from '../../../mobile/app/author/shown.ts';

export const BOOK = `http://localhost:${import.meta.env.VITE_LOKA_PREVIEW_PORT ?? 19006}`;
export type Step = PlaceStep;
// The real shapes, so a field the page renders wrongly fails tsc here (a hand copy once called a Ref a string).
export type State = {
  hash: string;
  title: string;
  placeNote: string;
  refused?: number;
  steps: Step[];
  facts: ReturnType<typeof factRows>;
  shown: ReturnType<typeof shown>;
};
export type Line = { key?: string; words: string };
/** What the Book's editor tells (mobile/app/author/inbook.ts): its `~` counts and its last note. */
export type Prose = {
  todoHere?: { here: number; at: number };
  note?: string;
  open?: { key: string; words: string };
};
type Told = {
  loka: 'author';
  ready?: true;
  sha256?: string;
  select?: string;
  shortcut?: string;
  state?: State;
  trace?: string[];
  id?: number;
  line?: Line;
  add?: AddHere;
} & Prose;
type Asked =
  | { op: 'hello' }
  | { op: 'advance'; minutes: number }
  | { op: 'jump'; steps: Step[] }
  | { op: 'drop' }
  | { op: 'go_to_room'; room: string }
  | { op: 'set_fact'; fact: string; value: boolean | number | string }
  | { op: 'set_level'; level: number; points: Record<string, number> }
  | { op: 'trace'; id: number }
  | { op: 'select'; kind: string; key: string; add?: string[] }
  | { op: 'edit'; key: string }
  | { op: 'key'; key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean };

/** What the shell does with a Book click (its text key) and a relayed editor key. */
export type Heard = { select: (textKey: string) => void; shortcut: (key: string) => void };
/** A Book add-here pick (`select` with `add` offers the menu): the mounted room card writes it. */
export type AddHere = { kind: string; room: string };
export const addHere = { run: (_: AddHere) => {} };

export function useBook(frame: RefObject<HTMLIFrameElement | null>, heard: RefObject<Heard>) {
  const [state, setState] = useState<State>();
  const [loaded, setLoaded] = useState<{ sha256?: string; at: number }>();
  const [line, setLine] = useState<Line>();
  const [prose, setProse] = useState<Prose>({});
  const waiting = useRef(new Map<number, (rows: string[]) => void>());
  const asked = useRef(0);
  const send = useCallback(
    (asked: Asked) => frame.current?.contentWindow?.postMessage(asked, BOOK),
    [frame],
  );
  useEffect(() => {
    const onMessage = (e: MessageEvent<Told>) => {
      if (e.origin !== BOOK || e.data?.loka !== 'author') return;
      if (e.data.ready)
        (send({ op: 'hello' }), setLoaded({ sha256: e.data.sha256, at: Date.now() }));
      if (e.data.select) heard.current.select(e.data.select);
      if (e.data.shortcut) heard.current.shortcut(e.data.shortcut);
      if (e.data.add) addHere.run(e.data.add);
      if (e.data.state) setState(e.data.state);
      if (e.data.trace && e.data.id !== undefined) waiting.current.get(e.data.id)?.(e.data.trace);
      if (e.data.line) setLine(e.data.line);
      if (e.data.todoHere) setProse((p) => ({ ...p, todoHere: e.data.todoHere }));
      if (e.data.note) setProse((p) => ({ ...p, note: e.data.note, open: e.data.open }));
    };
    const onKey = (e: KeyboardEvent) => {
      const { key, metaKey, ctrlKey, altKey } = e;
      if (e.target instanceof HTMLElement && relays(e, e.target))
        send({ op: 'key', key, metaKey, ctrlKey, altKey });
    };
    window.addEventListener('message', onMessage);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('keydown', onKey);
    };
  }, [send, heard]);
  const trace = () => askTrace(waiting.current, (id) => send({ op: 'trace', id }), ++asked.current);
  return { state, line, prose, loaded, send, trace };
}
