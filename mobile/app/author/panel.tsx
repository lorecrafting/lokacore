// Author preview only (`?dev=1` on the web dev cartridge; never the pinned save): keep my place and
// the bridge the author panel page (tools/author-panel) drives over postMessage: the dev clock,
// checkpoints, facts, quests, the trace and each Book line's source (docs/system/cartridge.md#author-preview).
// All drive the kernel's own paths: the clock skews the host clocks, the place replays saved inputs
// through `invoke`, the panel reads the view and the trace.
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import type { localSession } from '../../authority/local-story/session';
import chapter from '../../../protocol/fixtures/toolbox_showcase_hash.json';
import { listen, overlay } from './live.ts';
import { advanced, dropStep, recording, replay, type Place, type Step } from './place.ts';
import { shown, type Canon } from './shown.ts';

export { frozenClock } from './place.ts';

export type Opened = NonNullable<ReturnType<ReturnType<typeof localSession>['game']>>;
/** words -> text key, filled as the Book resolves text, so a clicked line names its source. */
const seen = new Map<string, string>();
export const devClock =
  process.env.EXPO_PUBLIC_LOKA_DEV_CARTRIDGE === '1' &&
  Platform.OS === 'web' &&
  new URLSearchParams(location.search).get('dev') === '1';
const g = globalThis as { loka_dev_skew?: number }; // ms the dev clock has moved both host clocks
export const skew = () => g.loka_dev_skew ?? 0;

// The inputs the session saved, under the artifact hash, in localStorage; replayed once per page
// load after a reload into a different artifact.
const PLACE = 'loka-place';
function saved(): Place | undefined {
  try {
    const p = JSON.parse(localStorage.getItem(PLACE) ?? 'null') as Place | null;
    if (p && typeof p.hash === 'string' && Array.isArray(p.steps)) return p;
  } catch {} // a stale or hand-edited value is forgotten, not fatal to the Book
}
const place: Place = (devClock && saved()) || { hash: chapter.sha256, steps: [] };
let placeNote = '';
let refused: number | undefined; // the step a replay was refused at, which the panel can drop
const savePlace = () => localStorage.setItem(PLACE, JSON.stringify(place));
const keep = (step: Step) => {
  if (place.hash !== chapter.sha256) return; // a broken path waits for the edit that mends it
  place.steps.push(step);
  savePlace();
};
export const resetPlace = () => {
  place.hash = chapter.sha256;
  place.steps = [];
  delete place.stopped;
  refused = undefined;
  placeNote = '';
  savePlace();
};
/** At page load: a path due a replay gets a fresh game, as a hash seen before keeps its old save (an edit undone). */
export function bootPlace(session: {
  game(): Opened | undefined;
  startOver(): string | undefined;
}) {
  const due = place.hash !== chapter.sha256 && place.stopped?.hash !== chapter.sha256;
  const why = due && session.game() ? session.startOver() : undefined; // no game: a save that did not open stays as evidence
  if (why) placeNote = `Place: not replayed (${why}); this is the old save.`;
  else restorePlace(session.game());
}
export function restorePlace(game: Opened | undefined) {
  if (!game) return;
  if (place.hash === chapter.sha256) {
    // an edit undone: a stop recorded for that edit no longer describes the path
    delete place.stopped;
    return savePlace();
  }
  if (place.stopped?.hash === chapter.sha256) {
    // this save holds the path up to the stop: replaying would re-send those steps
    ({ at: refused, note: placeNote } = place.stopped);
    return;
  }
  let outcome: ReturnType<typeof replay>;
  try {
    outcome = replay(place.steps, game, (ms) => {
      g.loka_dev_skew = skew() + ms;
    });
  } catch (e) {
    // a hand-edited checkpoint or stale place with a malformed step must not stop the boot
    outcome = { done: 0, failed: `malformed step (${(e as Error).message})` };
  }
  const { done, failed } = outcome;
  if (failed) {
    refused = outcome.refused && done;
    placeNote = `Place: ${failed}; stopped after ${done} of ${place.steps.length} steps. Mend the edit, or Start over to record afresh.`;
    console.warn(placeNote);
    place.stopped = { hash: chapter.sha256, at: refused, note: placeNote };
    savePlace();
    return;
  }
  placeNote = `Place: replayed ${done} steps on load`;
  place.hash = chapter.sha256;
  delete place.stopped;
  savePlace();
}
const recorded = new WeakMap<Opened, Opened>(); // one wrapper per game, so the Book sees one identity
/** In the author preview, the game with every accepted input recorded; elsewhere the game itself. */
export function played(game: Opened | undefined) {
  if (!devClock || !game) return game;
  if (!recorded.has(game))
    recorded.set(game, {
      ...game,
      text: (key) => {
        const words = overlay[key] ?? game.text(key);
        seen.set(words, key);
        return words;
      },
      invoke: recording(game, keep),
    });
  return recorded.get(game)!;
}

// Moves both host clocks forward by game minutes at the cartridge's rate, so the kernel's own
// elapsed path delivers the time (none before D11 selection).
// Lazy: App.tsx imports this module in a release too, which must not parse the chapter for it.
type Parsed = Canon & { manifest: { time_policy?: { rate: number } } };
let parsed: Parsed | undefined;
const canon = () => (parsed ??= JSON.parse(chapter.canonical) as Parsed);
function advance(minutes: number, game: Opened) {
  const rate = canon().manifest.time_policy?.rate;
  if (!rate)
    placeNote = 'This cartridge has no clock (no time_policy); there is no time to advance.';
  if (!rate || !Number.isSafeInteger(minutes) || minutes <= 0) return;
  const ms = Math.ceil((minutes * 60_000) / rate);
  const stopped = advanced(ms, (by) => (g.loka_dev_skew = skew() + by), game, keep);
  if (stopped) placeNote = stopped;
}

type Tools = {
  redraw: (next: object) => void;
  session: { game: () => Opened | undefined };
  startOver: () => unknown;
};
// Jumping to a checkpoint starts the game over and replays the file's steps (the panel fetched them).
function jumpTo(steps: Step[], { session, startOver }: Tools) {
  const before = session.game();
  startOver();
  const game = session.game();
  if (!game || game === before) return; // a refused start over keeps this game and its place
  place.hash = ''; // not this artifact's path yet: restorePlace replays it
  place.steps = steps;
  restorePlace(game);
}

// The panel protocol: the panel says hello (and after every Book reload, answered by `ready`), the
// Book posts its state on every session update and answers `trace`; a Book line Alt-clicked posts
// `line`. Only a local page may drive it: the panel's page and the Book's are different ports.
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
type Asked =
  | { op: 'hello' }
  | { op: 'advance'; minutes: number }
  | { op: 'jump'; steps: Step[] }
  | { op: 'drop' }
  | { op: 'trace' };
const OPS = new Set(['hello', 'advance', 'jump', 'drop', 'trace']); // any other local window is not the panel
let panel: { to: Window; origin: string } | undefined;
const tell = (sent: object) => panel?.to.postMessage({ loka: 'author', ...sent }, panel.origin);
const stateOf = (game: Opened) => ({
  hash: chapter.sha256,
  placeNote,
  refused,
  steps: place.steps,
  facts: game.facts(),
  shown: shown(game.view().view, played(game)!.text, canon(), game.entityIds(), game.roomIds()),
});
// Alt-click (Option-click) on a Book line: the panel opens its source in the owner's editor.
const onClick = (e: MouseEvent) => {
  if (!e.altKey) return;
  e.preventDefault();
  e.stopPropagation();
  const words = (e.target as HTMLElement).textContent ?? '';
  tell({ line: { key: seen.get(words), words } });
};
/** Serves the author panel page for `game` while mounted; App calls it only in the author preview. */
export function useAuthorPanel(tools: Tools, game: Opened | undefined) {
  const latest = useRef(tools); // App's closures change per render; the bridge lives per game
  latest.current = tools;
  useEffect(() => {
    if (!devClock || !game) return;
    const state = () => tell({ state: stateOf(game) });
    const onMessage = (e: MessageEvent<Asked>) => {
      if (!LOCAL.test(e.origin) || !e.source || !OPS.has(e.data?.op)) return;
      panel = { to: e.source as Window, origin: e.origin }; // a cross-origin window is never `instanceof Window`
      if (e.data.op === 'trace') return void tell({ trace: game.trace() });
      if (e.data.op === 'advance') advance(e.data.minutes, game);
      if (e.data.op === 'jump') {
        if (Array.isArray(e.data.steps)) return jumpTo(e.data.steps, latest.current); // the new game posts its state
        placeNote = 'Place: that checkpoint has no steps list; nothing changed.'; // checked before the start over wipes the save
      }
      if (e.data.op === 'drop' && refused !== undefined)
        return jumpTo(dropStep(place.steps, refused), latest.current);
      state();
    };
    window.addEventListener('message', onMessage);
    document.addEventListener('click', onClick, true);
    const unsubscribe = game.subscribe(state);
    const unlisten = listen(() => latest.current.redraw({})); // a text overlay redraws in place
    if (panel) state();
    else if (window.parent !== window)
      window.parent.postMessage({ loka: 'author', ready: true }, '*');
    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('click', onClick, true);
      unsubscribe();
      unlisten();
    };
  }, [game]);
}
