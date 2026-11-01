// The framed Book preview, over postMessage (mobile/app/author/panel.tsx is the other end): the
// Book says `ready` when its bridge mounts, the panel says hello, the Book posts `state` on every
// session update, answers `trace`, and posts `line` for an Alt-clicked Book line.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Step as PlaceStep } from '../../../mobile/app/author/place.ts';
import type { shown } from '../../../mobile/app/author/shown.ts';

export const BOOK = `http://localhost:${import.meta.env.VITE_LOKA_PREVIEW_PORT ?? 19006}`;
export type Step = PlaceStep;
// The real shapes, so a field the page renders wrongly fails tsc here (a hand copy once called a Ref a string).
export type State = {
  hash: string;
  placeNote: string;
  refused?: number;
  steps: Step[];
  facts: Record<string, unknown>;
  shown: ReturnType<typeof shown>;
};
export type Line = { key?: string; words: string };
type Told = { loka: 'author'; ready?: true; state?: State; trace?: string[]; line?: Line };
type Asked =
  | { op: 'hello' }
  | { op: 'advance'; minutes: number }
  | { op: 'jump'; steps: Step[] }
  | { op: 'drop' }
  | { op: 'go_to_room'; room: string }
  | { op: 'set_fact'; fact: string; value: boolean | number | string }
  | { op: 'trace' };

export function useBook(frame: RefObject<HTMLIFrameElement | null>) {
  const [state, setState] = useState<State>();
  const [line, setLine] = useState<Line>();
  const waiting = useRef<((rows: string[]) => void)[]>([]);
  const send = useCallback(
    (asked: Asked) => frame.current?.contentWindow?.postMessage(asked, BOOK),
    [frame],
  );
  useEffect(() => {
    const onMessage = (e: MessageEvent<Told>) => {
      if (e.origin !== BOOK || e.data?.loka !== 'author') return;
      if (e.data.ready) send({ op: 'hello' });
      if (e.data.state) setState(e.data.state);
      if (e.data.trace) waiting.current.shift()?.(e.data.trace);
      if (e.data.line) setLine(e.data.line);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [send]);
  const trace = () =>
    new Promise<string[]>((resolve) => {
      waiting.current.push(resolve);
      send({ op: 'trace' });
    });
  return { state, line, send, trace };
}
