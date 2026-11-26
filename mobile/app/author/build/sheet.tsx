// The sheet stack's host (docs/system/book-ui.md#author-mode; design §5): the registry of sheet
// kinds, the frame with its breadcrumb and Back, and the scrolled body. Build.tsx owns the stack.
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { focusTitle } from '../../book/title.ts';
import { motion, size, space, type } from '../../book/tokens.ts';
import { ink, type Builder } from './build.ts';

const WORDS = { close: 'Back', grow: 'Full height' };
/** Where the sheet docks beside the Book instead of rising over it, and its docked width.
 * ponytail: a placeholder; the designer names the breakpoint (ruling 7 gives none). */
export const DOCK = { at: size.column + size.column / 2, width: size.column / 2 }; // mutate-skip: placeholder

/** Sheet kinds by the id's head (`room:cellar` is `room` with `cellar`); `back`, the id Back shows
 * in this sheet's place instead of closing it (the Flow walk's trail); `file`, the source file its
 * foot names (the panel's source footer). */
export const sheets: Record<
  string,
  {
    title: (arg: string) => string;
    body: (arg: string) => ReactNode;
    back?: (arg: string) => string | undefined;
    file?: (arg: string) => string | undefined;
  }
> = {};
export const parts = (id: string) => {
  const [kind, arg = ''] = id.split(/:(.*)/);
  return [sheets[kind], arg] as const;
};
/** The id Back shows in place of the top sheet `id`, when its kind steps back. */
export const stepBack = (id: string) => {
  const [s, arg] = parts(id);
  return s?.back?.(arg);
};
/** Build.tsx hands in `swap`: the top sheet becomes `id`, the stack does not grow (Flow re-centring). */
export const stack = { swap: (_id: string) => {} };
const titled = (id: string) => {
  const [s, arg] = parts(id);
  return s?.title(arg) ?? id;
};

export const CONTROL = {
  minWidth: size.touch,
  minHeight: size.touch,
  justifyContent: 'center',
} as const;
// the current pick: Map's selected box, the action fill with its words in the background colour
const INSET = space.sm; // mutate-skip: layout only (the fill's inset)
const PICKED = { ...CONTROL, backgroundColor: ink('action'), paddingHorizontal: INSET };
export const act = (
  label: string,
  run: () => void,
  expanded?: boolean,
  key = label,
  selected?: boolean,
) => (
  <Pressable
    key={key}
    accessibilityRole="button"
    accessibilityState={
      expanded === undefined && selected === undefined
        ? undefined
        : {
            ...(expanded !== undefined && { expanded }),
            ...(selected !== undefined && { selected }),
          }
    }
    onPress={run}
    style={selected ? PICKED : CONTROL}
  >
    <Text style={{ ...type.control, color: ink(selected ? 'bg' : 'action') }}>{label}</Text>
  </Pressable>
);

/** A control that cannot act yet, dim with why; pressable only given `run` (Add mechanic… turns one on). */
export const greyed = (label: string, why: string, key: string, run?: () => void) => (
  <Pressable
    key={key}
    accessibilityRole="button"
    accessibilityState={{ disabled: !run }}
    disabled={!run}
    onPress={run}
    style={CONTROL}
  >
    <Text style={{ ...type.control, color: ink('dim') }}>{label}</Text>
    <Text style={{ ...type.label, color: ink(run ? 'action' : 'dim') }}>{why}</Text>
  </Pressable>
);

type Stack = { open: Builder; saved: (next: Builder) => void };
const foot = (file: string | undefined) =>
  file ? (
    <Text key="source" style={{ ...type.small, color: ink('dim'), padding: space.md }}>
      {file}
    </Text>
  ) : null;
/** The open sheet, scrolled back to where it was when it is drawn again after a reload. */
export function Sheet({ open, saved }: Stack) {
  const scroller: { current: ScrollView | null } = { current: null };
  let restoring = true; // once per drawing: later size changes keep the author's place
  return (
    <ScrollView
      ref={scroller}
      // A sheet is card paper (§5).
      style={[StyleSheet.absoluteFill, { backgroundColor: ink('card') }]}
      onContentSizeChange={() => {
        if (restoring) scroller.current?.scrollTo({ y: open.scroll, animated: false });
        restoring = false;
      }}
      onScroll={(e) => saved({ ...open, scroll: e.nativeEvent.contentOffset.y })}
    >
      {(([s, arg]) => [s?.body(arg), foot(s?.file?.(arg))])(parts(open.sheets!.at(-1)!))}
    </ScrollView>
  );
}

let grabbed = NaN; // where a drag on the grip began
let dragged = false;
/** The phone sheet's grip: a drag up fills it, down halves it or from half closes it (as Back,
 * §5); a tap or key toggles the height. */
export function Grip({
  full,
  grow,
  back,
}: {
  full: boolean;
  grow: (full: boolean) => void;
  back: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={WORDS.grow}
      accessibilityState={{ expanded: full }}
      onPressIn={(e) => ((grabbed = e.nativeEvent.pageY), (dragged = false))}
      onPressOut={(e) => {
        const dy = e.nativeEvent.pageY - grabbed; // NaN from a key: not a drag
        if (Math.abs(dy) >= size.touch / 4)
          (dy < 0 || full ? grow(dy < 0) : back(), (dragged = true));
      }}
      onPress={() => dragged || grow(!full)}
      // RN-web's touchAction (untyped in RN): the browser must not take the drag as a scroll.
      style={{ ...CONTROL, alignSelf: 'center', ...({ touchAction: 'none' } as object) }}
    >
      <View
        style={{ width: size.touch, height: size.rule * 4, backgroundColor: ink('line') }} // mutate-skip: drawing
      />
    </Pressable>
  );
}

/** The sheet stack's frame: the breadcrumb, Back and the top sheet's title over its body. On a
 * phone it rises over the Book to half height, full on a drag up, modal; from DOCK.at it docks
 * beside the Book, which stays playable. It slides in, and cuts in under reduced motion (§5). */
export function Frame({ open, saved, back }: Stack & { back: () => void }) {
  const docked = useWindowDimensions().width >= DOCK.at;
  const [full, grow] = useState(false);
  const ids = open.sheets!;
  const titles = ids.map(titled);
  return (
    <View
      role="dialog"
      aria-modal={!docked}
      aria-label={titles.at(-1)}
      style={[
        { backgroundColor: ink('card'), borderColor: ink('line') },
        docked
          ? { width: DOCK.width, borderLeftWidth: size.rule }
          : { ...FLOAT, height: full ? '100%' : '50%', borderTopWidth: size.rule },
        slide(docked),
      ]}
    >
      {docked ? null : <Grip full={full} grow={grow} back={back} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md }}>
        {act(WORDS.close, back)}
        <Text style={{ ...type.small, color: ink('dim'), flexShrink: 1 }} /* mutate-skip: layout */>
          {titles.slice(0, -1).join(' › ')}
        </Text>
      </View>
      <Text
        key={ids.at(-1)} // a new top sheet mounts a new title, which takes the focus
        ref={focusTitle}
        {...({ tabIndex: -1 } as object)} // mutate-skip: any negative tabIndex is the same
        accessibilityRole="header"
        style={{ ...type.control, color: ink('fg'), paddingHorizontal: space.md }}
      >
        {titles.at(-1)}
      </Text>
      <View style={{ flex: 1 }} /* mutate-skip: layout */>
        <Sheet key={ids.at(-1)} open={open} saved={saved} /* a new top sheet starts at its top */ />
      </View>
    </View>
  );
}
/** The slide in from the docked side; a cut under reduced motion. RN-web compiles keyframes only
 * in StyleSheet.create, not inline. */
const from = (transform: string) =>
  ({
    animationKeyframes: [{ from: { transform } }],
    animationDuration: `${motion.quick.duration}ms`,
  }) as object;
const SLIDE = StyleSheet.create({ side: from('translateX(100%)'), up: from('translateY(100%)') });
const slide = (docked: boolean) =>
  !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches &&
  SLIDE[docked ? 'side' : 'up'];
const FLOAT = { position: 'absolute', left: 0, right: 0, bottom: 0 } as const; // mutate-skip: layout
