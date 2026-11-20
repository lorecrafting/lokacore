// Build mode's chrome (docs/system/book-ui.md#author-mode; slice 1.2): the Build toggle and its strip
// above the Book, the sheet host, and auto-hold. panel.tsx requires this only in the author preview,
// so a release never holds it (author/seam.test.ts looks for `BUILD`).
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { size, space, type } from '../../book/tokens.ts';
import type { Message } from '../live.ts';
import type { Step } from '../place.ts';
import { install as seam } from './seam.ts';
import { go, heard as told, shut, type Hooks, type Wrote } from './field.tsx';
import {
  autoHold,
  badge,
  checks,
  ink,
  keep,
  refusal,
  restored,
  toggled,
  type Builder,
} from './build.ts';

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
};
const UNDO_MS = 5000; // the chip's life after a write (docs/rnd/in-game-builder-mode-2026-11-19.md)
let builder: Builder = { on: false };
let heard: Message = { text: {}, said: [] };
let api: Hooks['api'] | undefined;
let undo: Wrote | undefined; // the last write, while its chip shows
let undoTimer: ReturnType<typeof setTimeout> | undefined;
let notBack: Wrote | undefined; // a refused put-back
let redrawStrip = () => {};
/** What the keep-my-place notice reads and does; panel.tsx hands it in per game. */
export type Place = {
  place: () => { steps: Step[]; refused?: number; checkpoint?: Step[] };
  here: () => string | undefined; // the Book's room key
  drop: () => void;
  back: () => void;
  startIn: (room: string) => void;
};
let placed: Place | undefined;
export const place = (given: Place) => void (placed = given);
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
/** Sheet bodies by id; later slices register theirs. */
export const sheets: Record<string, () => ReactNode> = {};

/** `book`: the Book's word bindings, redraw and E5's api (panel.tsx), for the field. */
export function install(book: Pick<Hooks, 'seen' | 'said' | 'redraw' | 'api'>) {
  api = book.api;
  seam({ ...book, on: () => builder.on, focus: hold.focus, commit: hold.commit, wrote });
  builder = restored(localStorage);
  addEventListener('pagehide', hold.leave);
}
export function hear(message: Message) {
  heard = message;
  hold.heard(message.held);
  told(message.unconfirmed?.map((u) => u.key));
}
const set = (next: Builder) => {
  builder = next;
  keep(localStorage, next);
};
/** A field saved: its Undo chip for UNDO_MS, and the room Start in this room goes back to. */
function wrote(w: Wrote) {
  const room = placed?.here();
  set({ ...builder, ...(room && { room }) });
  undo = w;
  notBack = undefined;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => ((undo = undefined), redrawStrip()), UNDO_MS);
  redrawStrip();
}
async function putBack(w: Wrote) {
  undo = undefined;
  clearTimeout(undoTimer);
  redrawStrip();
  const undone = api!('/undo', { id: w.id, key: w.key, words: w.words });
  const [status] = await undone.catch(() => []); // the server down: not put back, said so
  notBack = status === 200 ? undefined : w;
  redrawStrip();
}
const openBack = () => void api!('/open', { key: notBack!.key, words: notBack!.words });
/** Checks: each row goes to its line; one on this page closes the sheet to show its field. */
sheets.checks = () => {
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
            set({ ...builder, sheet: undefined });
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
};

/** The open sheet, scrolled back to where it was when it is drawn again after a reload. */
export function Sheet({ open, saved }: { open: Builder; saved: (next: Builder) => void }) {
  const scroller: { current: ScrollView | null } = { current: null };
  let restoring = true; // once per drawing: later size changes keep the author's place
  return (
    <ScrollView
      ref={scroller}
      style={[StyleSheet.absoluteFill, { backgroundColor: ink('card') }]} // a sheet is card paper (§5)
      onContentSizeChange={() => {
        if (restoring) scroller.current?.scrollTo({ y: open.scroll, animated: false });
        restoring = false;
      }}
      onScroll={(e) => saved({ ...open, scroll: e.nativeEvent.contentOffset.y })}
    >
      {sheets[open.sheet!]?.()}
    </ScrollView>
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
const CONTROL = { minWidth: size.touch, minHeight: size.touch, justifyContent: 'center' } as const;
const act = (label: string, run: () => void, expanded?: boolean) => (
  <Pressable
    key={label}
    accessibilityRole="button"
    accessibilityState={expanded === undefined ? undefined : { expanded }}
    onPress={run}
    style={CONTROL}
  >
    <Text style={{ ...type.control, color: ink('action') }}>{label}</Text>
  </Pressable>
);
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
/** The strip at `size.touch` above the Book: the Build switch, the Hold status, the Undo chip, the
 * Checks badge, and the keep-my-place notice when a replay was refused. */
export function Strip({ children }: { children: ReactNode }) {
  const [, redraw] = useState({});
  redrawStrip = () => redraw({});
  const change = (next: Builder) => (set(next), redraw({}), shut());
  return (
    <View style={{ flex: 1 }} /* mutate-skip: layout */>
      <View style={{ ...STRIP, backgroundColor: ink('bg'), borderColor: ink('line') }}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: builder.on }}
          accessibilityLabel={WORDS.build}
          onPress={() => change(toggled(builder))}
          style={CONTROL}
        >
          <Text style={{ ...type.control, color: ink(builder.on ? 'action' : 'fg') }}>
            {builder.on ? WORDS.on : WORDS.build}
          </Text>
        </Pressable>
        {warn(heard.held ? WORDS.held(heard.pending ?? 0) : '')}
        {undo ? act(WORDS.undo, () => void putBack(undo!)) : null}
        {notBack ? warn(WORDS.notUndone(notBack.file)) : null}
        {notBack ? act(WORDS.source, openBack) : null}
        {builder.on
          ? act(
              badge(heard),
              () =>
                change({ ...builder, sheet: builder.sheet === 'checks' ? undefined : 'checks' }),
              builder.sheet === 'checks',
            )
          : null}
      </View>
      <Notice />
      <View style={{ flex: 1 }} /* mutate-skip: layout */>
        {children}
        {builder.sheet && sheets[builder.sheet] ? <Sheet open={builder} saved={set} /> : null}
      </View>
    </View>
  );
}
