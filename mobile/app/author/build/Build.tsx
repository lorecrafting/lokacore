// Build mode's chrome (docs/system/book-ui.md#author-mode; slice 1.2): the Build toggle and its strip
// above the Book, the sheet host, and auto-hold. panel.tsx requires this only in the author preview,
// so a release never holds it (author/seam.test.ts looks for `BUILD`).
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { size, space, type } from '../../book/tokens.ts';
import type { Message } from '../live.ts';
import type { Step } from '../place.ts';
import { install as seam } from './seam.ts';
import { go, heard as told, shut, type Hooks, type Wrote } from './field.tsx';
import {
  autoHold,
  badge,
  checks,
  closed,
  ink,
  keep,
  opened,
  refusal,
  restored,
  toggled,
  type Builder,
} from './build.ts';
import { ghostSheet, pencil, story } from './room.tsx';
import { chip, ghostLines, seeWith, unsee, type Game } from './seeas.tsx';
import { thingPen } from './thing.tsx';
import { CONTENTS } from './contents.tsx';
import './generic.tsx'; // registers the def:<file> sheet
import { MAP, mapSheet, unborn } from './map.tsx';
import { undo as putBackIds } from '../../../../kernel/ts/play/mapedit.ts';
import { io, onSaved, refused, run, running } from './roomedit.tsx';
import { act, CONTROL, Frame, parts, sheets } from './sheet.tsx';

export { Sheet, sheets } from './sheet.tsx';
export { drawn, unsee, updated } from './seeas.tsx';

const WORDS = {
  build: 'Build',
  on: '✎ Build',
  held: (n: number) => `Held · ${n} waiting`,
  undo: 'Undo',
  notUndone: (file: string) => `${file} changed since; not put back.`,
  source: 'Open source',
  nothing: 'Nothing to check.',
  drop: 'Drop it and go on',
  back: 'Back to checkpoint',
  room: 'Start in this room',
  checks: 'Checks',
};
const UNDO_MS = 5000; // the chip's life after a write (docs/rnd/in-game-builder-mode-2026-11-19.md)
const KEPT = 'loka-build-undo'; // the chip and its end: a map gesture's compile reloads the Book
type Gesture = { ids: number[] }; // a sheet's gesture: its journal ids, oldest first
let builder: Builder = { on: false };
let heard: Message = { text: {}, said: [] };
let api: Hooks['api'] | undefined;
let undo: Wrote | Gesture | undefined; // the last write (a field's, or a sheet's gesture), while its chip shows
let undoTimer: ReturnType<typeof setTimeout> | undefined;
let notBack: Wrote | undefined; // a refused put-back
let stopped = ''; // a gesture's put-back refused
let redrawStrip = () => {};
let mapped = () => {}; // the map has come: the strip and the Book's pencil draw again
let opener: { focus?: () => void } | null | undefined; // what had focus before the first sheet opened
/** What the keep-my-place notice reads and does; panel.tsx hands it in per game. */
export type Place = Game & {
  place: () => { steps: Step[]; refused?: number; checkpoint?: Step[] };
  drop: () => void;
  back: () => void;
  startIn: (room: string) => void;
};
let placed: Place | undefined;
export const place = (given: Place) => void ((placed = given), seeWith(given, () => mapped()));
mapSheet({ go: (room) => placed?.startIn(room), here: () => placed?.here() });
onSaved((ids) => wrote({ ids }));
let asked = Promise.resolve();
/** One at a time: the server keeps the last flag it got, so an on overtaking its off would stick.
 * A refused or failed request shows as no Held in the strip. */
const ask = (on: boolean) => {
  const send = () => fetch('/__author/hold', { method: 'POST', body: JSON.stringify({ on }) });
  asked = asked.then(send).then(
    () => {},
    () => {},
  );
};
/** A builder field calls `focus` and `commit` (Enter, blur, a picker closing). */
export const hold = autoHold(
  ask,
  () => navigator.sendBeacon('/__author/hold', JSON.stringify({ on: false })),
  (release) => setTimeout(release),
);
/** Opens a sheet on the stack (or brings it to the top); the first remembers the focus to return. */
export function open(id: string) {
  if (!builder.sheets) opener = globalThis.document?.activeElement as typeof opener;
  set(opened(builder, id));
  redrawStrip();
  shut();
}
/** Back: closes the top sheet (or sheet `id`); the last one returns the focus to what opened it. */
function back(id?: string) {
  set(closed(builder, id));
  redrawStrip();
  if (!builder.sheets) opener?.focus?.();
}
/** `book`: the Book's word bindings, redraw and E5's api (panel.tsx), for the field. */
export function install(book: Pick<Hooks, 'seen' | 'said' | 'redraw' | 'api'>) {
  api = book.api;
  seam({
    ...book,
    on: () => builder.on,
    focus: hold.focus,
    commit: hold.commit,
    wrote,
    unsee,
    pencil: (shown, key) => {
      const room = pencil(shown, placed?.here(), open); // the page's own title: its ghosts follow
      return room ? (
        <>
          {room}
          {ghostLines(open, ghostSheet)}
        </>
      ) : (
        thingPen(key, open)
      );
    },
  });
  builder = restored(localStorage);
  let kept: { w: Wrote | Gesture; end: number } | null = null;
  try {
    kept = JSON.parse(localStorage.getItem(KEPT) ?? 'null');
  } catch {} // a damaged entry: no chip
  if (kept && kept.end > Date.now()) showUndo(kept.w, kept.end);
  mapped = () => (redrawStrip(), book.redraw());
  story(api, mapped, back, open);
  addEventListener('pagehide', hold.leave);
}
export function hear(message: Message) {
  heard = message;
  unsee(); // any live message ends it (fail safe)
  hold.heard(message.held);
  told(message.unconfirmed?.map((u) => u.key));
  story(api, mapped, back, open); // a compile may have added, moved or renamed rooms
}
const set = (next: Builder) => {
  builder = next;
  keep(localStorage, next);
};
/** A field saved: its Undo chip for UNDO_MS, and the room Start in this room goes back to. */
function wrote(w: Wrote | Gesture) {
  unsee();
  const room = placed?.here();
  set({ ...builder, ...(room && { room }) });
  notBack = undefined;
  stopped = '';
  showUndo(w, Date.now() + UNDO_MS);
}
/** The Undo chip for `w` until `end`, kept so the reload a structural compile brings shows it on. */
function showUndo(w: Wrote | Gesture, end: number) {
  undo = w;
  localStorage.setItem(KEPT, JSON.stringify({ w, end }));
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => ((undo = undefined), redrawStrip()), end - Date.now());
  redrawStrip();
}
async function putBack(w: Wrote | Gesture) {
  if ('ids' in w && running()) return; // a gesture still writing: the chip stays for a later press
  undo = undefined;
  localStorage.setItem(KEPT, 'null');
  clearTimeout(undoTimer);
  redrawStrip();
  // the chip's own ids, not the editor's newest: after a reload the editor's journal is gone
  if ('ids' in w) {
    unborn();
    await run(() => putBackIds(io, [...w.ids]));
    stopped = refused(); // shown on the strip, as no sheet may be open
    return redrawStrip();
  }
  const undone = api!('/undo', { id: w.id, key: w.key, words: w.words });
  const [status] = await undone.catch(() => []); // the server down: not put back, said so
  notBack = status === 200 ? undefined : w;
  redrawStrip();
}
const openBack = () => void api!('/open', { key: notBack!.key, words: notBack!.words });
/** Checks: each row goes to its line; one on this page closes the sheet to show its field. */
sheets.checks = { title: () => WORDS.checks, body: checked };
function checked() {
  const rows = checks(heard);
  if (!rows.length)
    return (
      <Text style={{ ...type.small, color: ink('fg'), padding: space.md }}>{WORDS.nothing}</Text>
    );
  return rows.map((c, i) =>
    c.key || c.file ? (
      <Pressable
        key={i}
        accessibilityRole="link"
        onPress={() => {
          if (c.key ? go(c.key) : void api!('/open', { file: c.file }))
            set({ ...builder, sheets: undefined });
          redrawStrip();
        }}
        style={{ minHeight: size.touch, justifyContent: 'center', paddingHorizontal: space.md }}
      >
        <Text style={{ ...type.small, color: ink('action') }}>{c.label}</Text>
      </Pressable>
    ) : (
      <Text key={i} style={{ ...type.small, color: ink('fg'), padding: space.md }}>
        {c.label}
      </Text>
    ),
  );
}
const STRIP = {
  minHeight: size.touch,
  flexDirection: 'row',
  alignItems: 'center',
  gap: space.md,
  flexWrap: 'wrap',
  paddingHorizontal: space.md,
  borderBottomWidth: size.rule,
} as const;
const warn = (text: ReactNode) => (
  <Text aria-live="polite" style={{ ...type.small, color: ink('warning') }}>
    {text}
  </Text>
);
/** The keep-my-place notice, while the recorded path's replay stands refused. */
function Notice() {
  const at = placed?.place();
  const room = builder.room;
  if (at?.refused === undefined) return null;
  return (
    <View style={{ ...STRIP, backgroundColor: ink('bg'), borderColor: ink('line') }}>
      {warn(refusal(at.steps, at.refused))}
      {act(WORDS.drop, placed!.drop)}
      {at.checkpoint ? act(WORDS.back, placed!.back) : null}
      {room ? act(WORDS.room, () => placed!.startIn(room)) : null}
    </View>
  );
}
/** The Build switch: on, it reads as on, in action ink. */
const buildSwitch = (flip: () => void) => (
  <Pressable
    accessibilityRole="switch"
    accessibilityState={{ checked: builder.on }}
    accessibilityLabel={WORDS.build}
    onPress={flip}
    style={CONTROL}
  >
    <Text style={{ ...type.control, color: ink(builder.on ? 'action' : 'fg') }}>
      {builder.on ? WORDS.on : WORDS.build}
    </Text>
  </Pressable>
);
/** A strip chip that opens sheet `id`, or goes back when it is the top sheet. */
const pad = (label: string, id: string, top?: string) =>
  act(label, () => (top === id ? back() : open(id)), top === id);
/** The strip at `size.touch` above the Book: the Build switch, the Hold status, the Undo chip, the
 * Checks badge, and the keep-my-place notice when a replay was refused. */
export function Strip({ children }: { children: ReactNode }) {
  const [, redraw] = useState({});
  redrawStrip = () => redraw({});
  const change = (next: Builder) => (set(next), unsee(), redraw({}), shut());
  const top = builder.sheets?.at(-1);
  return (
    <View style={{ flex: 1 }} /* mutate-skip: layout */>
      <View style={{ ...STRIP, backgroundColor: ink('bg'), borderColor: ink('line') }}>
        {buildSwitch(() => change(toggled(builder)))}
        {warn(heard.held ? WORDS.held(heard.pending ?? 0) : '')}
        {chip()}
        {undo ? act(WORDS.undo, () => void putBack(undo!)) : null}
        {notBack ? warn(WORDS.notUndone(notBack.file)) : null}
        {warn(stopped)}
        {notBack ? act(WORDS.source, openBack) : null}
        {builder.on ? pad(CONTENTS.contents, 'contents', top) : null}
        {builder.on ? pad(MAP.map, 'map', top) : null}
        {builder.on ? pad(badge(heard), 'checks', top) : null}
      </View>
      <Notice />
      <View style={{ flex: 1, flexDirection: 'row' }} /* mutate-skip: layout */>
        <View
          style={{ flex: 1 }} /* mutate-skip: layout; the Book keeps its place as sheets open */
        >
          {children}
        </View>
        {top && parts(top)[0] ? <Frame open={builder} saved={set} back={() => back()} /> : null}
      </View>
    </View>
  );
}
