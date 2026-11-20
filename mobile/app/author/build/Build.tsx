// Build mode's chrome (docs/system/book-ui.md#author-mode; slice 1.2): the Build toggle and its strip
// above the Book, the sheet host, and auto-hold. panel.tsx requires this only in the author preview,
// so a release never holds it (author/seam.test.ts looks for `BUILD`).
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { color, size, space, type } from '../../book/tokens.ts';
import type { Message } from '../live.ts';
import { install as seam } from './seam.ts';
import { autoHold, keep, restored, toggled, type Builder } from './build.ts';

const WORDS = { build: 'Build', on: '✎ Build', held: (n: number) => `Held · ${n} waiting` };
let builder: Builder = { on: false };
let heard: Pick<Message, 'held' | 'pending'> = {};
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
/** A builder field calls `focus` and `commit` (Enter, blur, a picker closing); 1.3 brings fields. */
export const hold = autoHold(
  ask,
  () => navigator.sendBeacon('/__author/hold', JSON.stringify({ on: false })),
  (release) => setTimeout(release),
);
/** Sheet bodies by id; later slices register theirs. */
export const sheets: Record<string, () => ReactNode> = {};

export function install() {
  seam();
  builder = restored(localStorage);
  addEventListener('pagehide', hold.leave);
}
export function hear(message: Message) {
  heard = message;
  hold.heard(message.held);
}
const set = (next: Builder) => {
  builder = next;
  keep(localStorage, next);
};

/** The open sheet, scrolled back to where it was when it is drawn again after a reload. */
export function Sheet({ open, saved }: { open: Builder; saved: (next: Builder) => void }) {
  const scroller: { current: ScrollView | null } = { current: null };
  let restoring = true; // once per drawing: later size changes keep the author's place
  return (
    <ScrollView
      ref={scroller}
      style={StyleSheet.absoluteFill}
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
  paddingHorizontal: space.md,
  borderBottomWidth: size.rule,
} as const;
/** The Book's current palette, night included: inbook.ts sets `--loka-<role>` from
 * `paletteNear(paper(...))` after every Book render; light until it first has. */
const ink = (role: keyof typeof color.light) => `var(--loka-${role}, ${color.light[role]})`;
/** The strip at `size.touch` above the Book: the Build switch and the Hold status. */
export function Strip({ children }: { children: ReactNode }) {
  const [, redraw] = useState({});
  const change = (next: Builder) => (set(next), redraw({}));
  return (
    <View style={{ flex: 1 }} /* mutate-skip: layout */>
      <View style={{ ...STRIP, backgroundColor: ink('bg'), borderColor: ink('line') }}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: builder.on }}
          accessibilityLabel={WORDS.build}
          onPress={() => change(toggled(builder))}
          style={{ minWidth: size.touch, minHeight: size.touch, justifyContent: 'center' }}
        >
          <Text style={{ ...type.control, color: ink(builder.on ? 'action' : 'fg') }}>
            {builder.on ? WORDS.on : WORDS.build}
          </Text>
        </Pressable>
        <Text aria-live="polite" style={{ ...type.small, color: ink('warning') }}>
          {heard.held ? WORDS.held(heard.pending ?? 0) : ''}
        </Text>
      </View>
      <View style={{ flex: 1 }} /* mutate-skip: layout */>
        {children}
        {builder.sheet && sheets[builder.sheet] ? <Sheet open={builder} saved={set} /> : null}
      </View>
    </View>
  );
}
