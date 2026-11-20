// Build mode's chrome (docs/system/book-ui.md#author-mode; slice 1.2): the Build toggle and its strip
// above the Book, the sheet host, and auto-hold. panel.tsx requires this only in the author preview,
// so a release never holds it (author/seam.test.ts looks for `BUILD`).
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { chrome, size, space } from '../../book/tokens.ts';
import type { Message } from '../live.ts';
import { install as seam } from './seam.ts';
import { autoHold, keep, restored, toggled, type Builder } from './build.ts';

const WORDS = { build: 'Build', held: (n: number) => `Held · ${n} waiting` };
let builder: Builder = { on: false };
let heard: Pick<Message, 'held' | 'pending'> = {};
const ask = (on: boolean) =>
  void fetch('/__author/hold', { method: 'POST', body: JSON.stringify({ on }) });
/** A builder field calls `focus` and `commit` (Enter, blur, a picker closing); 1.3 brings fields. */
export const hold = autoHold(ask, () =>
  navigator.sendBeacon('/__author/hold', JSON.stringify({ on: false })),
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
  return (
    <ScrollView
      ref={scroller}
      style={StyleSheet.absoluteFill}
      onContentSizeChange={() => scroller.current?.scrollTo({ y: open.scroll, animated: false })}
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
/** The strip at `size.touch` above the Book: the Build switch and the Hold status. */
export function Strip({ children }: { children: ReactNode }) {
  const [, redraw] = useState({});
  const c = chrome[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const change = (next: Builder) => (set(next), redraw({}));
  return (
    <View style={{ flex: 1 }}>
      <View style={{ ...STRIP, backgroundColor: c.bg, borderColor: c.line }}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: builder.on }}
          accessibilityLabel={WORDS.build}
          onPress={() => change(toggled(builder))}
          style={{ minWidth: size.touch, minHeight: size.touch, justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: chrome.sans, color: builder.on ? c.accent : c.fg }}>
            {WORDS.build}
          </Text>
        </Pressable>
        <Text
          accessibilityLiveRegion="polite"
          style={{ fontFamily: chrome.sans, color: c.warning }}
        >
          {heard.held ? WORDS.held(heard.pending ?? 0) : ''}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        {children}
        {builder.sheet ? <Sheet open={builder} saved={set} /> : null}
      </View>
    </View>
  );
}
