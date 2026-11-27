// size: allow 330, the strip draws the notebook column beside the sheet stack (Wide layout)
// Build mode's chrome (docs/system/book-ui.md#author-mode; slice 1.2): the Build toggle and strip,
// the sheet host, auto-hold. Only the author preview requires it (author/seam.test.ts: `BUILD`).
import { cloneElement, useState, type ReactNode } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { size, space, type } from '../../book/tokens.ts';
import type { Message } from '../live.ts';
import type { Step } from '../place.ts';
import { install as seam } from './seam.ts';
import { changed, heard as told, shut, type Hooks, type Wrote } from './field.tsx';
import {
  autoHold,
  badge,
  closed,
  ink,
  keep,
  opened,
  refusal,
  restored,
  swapped,
  toggled,
  type Builder,
} from './build.ts';
import { ghostSheet, pencil, story } from './room.tsx';
import { chip, ghostLines, seeWith, unsee, type Game } from './seeas.tsx';
import { icons, sceneLine, titled } from './talk.tsx';
import { CONTENTS } from './contents.tsx';
import { startPinned, timing, toolsWith, type Hooks as Tools, type Said } from './tools.tsx';
import './generic.tsx'; // registers the def:<file> sheet
import { MAP, mapSheet, measured, unborn } from './map.tsx';
import { storySheet } from './story.tsx';
import './flow.tsx'; // registers the flow:<ref> sheet
import { WORDS as RECENT } from './recent.tsx';
import { undo as putBackIds } from '../../../../kernel/ts/play/mapedit.ts';
import { io, onSaved, refused, run, running } from './roomedit.tsx';
import { checked, unrefuse } from './checks.tsx';
import { act, Column, CONTROL, DOCK, Frame, parts, sheets, stack, stepBack } from './sheet.tsx';
import { strip } from './source.ts';
export { Sheet, sheets } from './sheet.tsx';
export { drawn, unsee } from './seeas.tsx';
export { updated } from './tools.tsx';
export { altClick } from './source.ts';
export { api, recount, start } from './page.ts';
export { tagged } from '../prose_rules.ts';
const WORDS = {
  build: 'Build',
  on: '✎ Build',
  held: (n: number) => `Held · ${n} waiting`,
  undo: 'Undo',
  source: 'Open source',
  drop: 'Drop it and go on',
  back: 'Back to checkpoint',
  room: 'Start in this room',
  checks: 'Checks',
};
const UNDO_MS = 5000; // the chip's life after a write (docs/rnd/in-game-builder-mode-2026-11-19.md)
const KEPT = 'loka-build-undo'; // the chip and its end: a map gesture's compile reloads the Book
type Gesture = { ids: number[] }; // a sheet's gesture: its journal ids, oldest first
let builder: Builder = { on: false };
let heard: Message & Said = { text: {}, said: [] };
let api: Hooks['api'] | undefined;
let undo: Wrote | Gesture | undefined; // the last write (a field's, or a sheet's gesture), while its chip shows
let undoTimer: ReturnType<typeof setTimeout> | undefined;
let notBack: Wrote | undefined; // a refused put-back
let stopped = ''; // a gesture's put-back refused
let redrawStrip = () => {};
let mapped = () => {}; // the map has come: the strip and the Book's pencil draw again
let notebookChip: { focus?: () => void } | null = null; // Close hands the focus back here
let opener: { focus?: () => void } | null | undefined; // what had focus before the first sheet opened
/** What the keep-my-place notice reads and does; panel.tsx hands it in per game. */
export type Place = Game & {
  place: () => { steps: Step[]; refused?: number; checkpoint?: Step[] };
  drop: () => void;
  back: () => void;
  startIn: (room: string) => void;
} & NonNullable<ReturnType<Tools['game']>>; // the Tools tab's paths
let placed: Place | undefined;
export const place = (p: Place) => void ((placed = p), seeWith(p, () => mapped()), startPinned(p));
mapSheet({ go: (room) => placed?.startIn(room), here: () => placed?.here() });
storySheet((room) => placed?.startIn(room));
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
toolsWith({ game: () => placed, hold, heard: () => heard });
/** Opens a sheet on the stack (or brings it to the top); the first remembers the focus to return. */
export function open(id: string) {
  if (!builder.sheets) opener = globalThis.document?.activeElement as typeof opener;
  if (id === 'checks') unrefuse();
  set(opened(builder, id));
  redrawStrip();
  shut();
}
stack.swap = (id) => (set(swapped(builder, id)), redrawStrip(), shut());
/** Back: closes the top sheet (or `id`), or shows its kind's step back; the last returns the focus. */
function back(id?: string) {
  const prev = !id && stepBack(builder.sheets?.at(-1) ?? '');
  if (prev) return stack.swap(prev);
  set(closed(builder, id));
  redrawStrip();
  if (!builder.sheets) opener?.focus?.();
}
/** `book`: the Book's word bindings, redraw and page.ts's api (panel.tsx), for the field. */
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
        titled(placed, open, key)
      );
    },
    icons: (key, words) => icons(placed, open, key, words),
    scene: sceneLine,
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
export function hear(message: Message & Said) {
  heard = message;
  unrefuse();
  unsee(); // any live message ends it (fail safe)
  hold.heard(message.held);
  told(message.unconfirmed?.map((u) => u.key));
  changed(message.changed);
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
/** Checks: each row goes to its line; one on this page closes the sheets to show its field (from the
 * notebook column the stack stays: nothing covers the Book there). */
const shown = () => builder.notebook === undefined && set({ ...builder, sheets: undefined });
sheets.checks = {
  title: () => WORDS.checks,
  body: () => checked(heard, api!, shown, redrawStrip),
};
const STRIP = {
  minHeight: size.touch,
  flexDirection: 'row',
  alignItems: 'center',
  gap: space.md,
  flexWrap: 'wrap',
  // public/index.html's viewport-fit=cover draws under the notch; RN-web passes env() through
  paddingLeft: `max(${space.md}px, env(safe-area-inset-left))` as never,
  paddingRight: `max(${space.md}px, env(safe-area-inset-right))` as never,
  borderBottomWidth: size.rule,
} as const;
const TOP = { paddingTop: 'env(safe-area-inset-top)' as never }; // the top strip only, not the Notice under it
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
/** The strip's `Notebook` from DOCK.at: opens or closes the column (a notebook sheet gives way to it);
 * closing returns the focus to it, after a reload too. */
function column() {
  const open = builder.notebook === undefined;
  const rest = open && builder.sheets?.includes('contents') ? closed(builder, 'contents') : builder;
  set({ ...rest, notebook: open ? 0 : undefined });
  redrawStrip();
  if (!open) notebookChip?.focus?.();
}
const CHIP = { ref: (el: typeof notebookChip) => void (notebookChip = el) } as object;
/** A strip chip that opens sheet `id`, or closes it when it is the top sheet. */
const pad = (label: string, id: string, top?: string) =>
  act(label, () => (top === id ? back(id) : open(id)), top === id);
/** Notebook (a column chip when wide, else a sheet chip), Map and Checks. */
const sheetChips = (wide: boolean, top?: string) => (
  <>
    {wide
      ? cloneElement(
          act(CONTENTS.contents, column, undefined, undefined, builder.notebook !== undefined),
          CHIP,
        )
      : pad(CONTENTS.contents, 'contents', top)}
    {pad(MAP.map, 'map', top)}
    {pad(badge(heard), 'checks', top)}
  </>
);
const scrolled = (n: Builder) => set({ ...builder, scroll: n.scroll }); // the stack's, not the column's
const notebook = () =>
  builder.notebook === undefined ? null : (
    <Column
      open={{ on: true, sheets: ['contents'], scroll: builder.notebook }}
      saved={(n) => set({ ...builder, notebook: n.scroll })}
      close={column}
    />
  );
/** The strip at `size.touch`: Build, Hold, the last edit's timing, Undo, Checks, a refused replay. */
export function Strip({ children }: { children: ReactNode }) {
  const [, redraw] = useState({});
  redrawStrip = strip.redraw = () => redraw({});
  const wide = useWindowDimensions().width >= DOCK.at;
  if (!wide && builder.notebook !== undefined) set({ ...builder, notebook: undefined }); // narrowed
  const change = (next: Builder) => (set(next), unsee(), redraw({}), shut());
  const top = builder.sheets?.at(-1);
  return (
    <View style={{ flex: 1 }} /* mutate-skip: layout */>
      <View style={{ ...STRIP, ...TOP, backgroundColor: ink('bg'), borderColor: ink('line') }}>
        {buildSwitch(() => change(toggled(builder)))}
        {warn(heard.held ? WORDS.held(heard.pending ?? 0) : '')}
        {chip()}
        {undo ? act(WORDS.undo, () => void putBack(undo!)) : null}
        {notBack ? warn(RECENT.notUndone(notBack.file)) : null}
        {stopped ? warn(stopped) : null}
        {notBack ? act(WORDS.source, openBack) : null}
        {strip.note ? warn(strip.note) : null}
        {builder.on ? sheetChips(wide, top) : null}
        {timing(heard.timings, placed?.loaded)}
      </View>
      <Notice />
      <View
        style={{ flex: 1, flexDirection: 'row' }} /* mutate-skip: layout */
        onLayout={measured('book')} // the phone sheet is half this row
      >
        {notebook()}
        <View
          style={{ flex: 1 }} /* mutate-skip: layout; the Book keeps its place as sheets open */
          testID="loka-book" /* page.ts reads the page's palette under it */
        >
          {children}
        </View>
        {top && parts(top)[0] ? (
          <Frame open={builder} saved={scrolled} back={() => back()} />
        ) : null}
      </View>
    </View>
  );
}
