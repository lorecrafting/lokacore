// The sheet stack's host (docs/system/book-ui.md#author-mode; design §5): the registry of sheet
// kinds, the frame with its breadcrumb and Back, and the scrolled body. Build.tsx owns the stack.
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { focusTitle } from '../../book/title.ts';
import { motion, size, space, type } from '../../book/tokens.ts';
import { ink, type Builder } from './build.ts';
import { openSource } from './source.ts';

const WORDS = { close: 'Back', grow: 'Full height', shut: 'Close' };
/** From `at` (the page column and half of it again; book-ui.md, Wide layout) a sheet docks beside
 * the Book instead of rising over it, and the notebook column opens; both are `width` wide. */
export const DOCK = { at: size.column + size.column / 2, width: size.column / 2 };

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
/** The phone sheet's raise to full height (Frame sets it; docked, nothing): a long-list field's focus. */
export const raise = { full: () => {} };
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

const foot = (file?: string) => (file ? <Foot key="source" file={file} /> : null);
type Stack = { open: Builder; saved: (next: Builder) => void };
/** The source footer: the path, a button that opens it in the owner's editor; a refusal under it
 * until the next press. */
export function Foot({ file }: { file: string }) {
  const [note, say] = useState('');
  return (
    <View style={{ padding: space.md }} /* mutate-skip: layout */>
      {act(file, () => (say(''), void openSource({ file }).then(say)))}
      <Text aria-live="polite" style={{ ...type.small, color: ink('warning') }}>
        {note}
      </Text>
    </View>
  );
}
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
      {(([s, arg]) => (
        <>
          {s?.body(arg)}
          {foot(s?.file?.(arg))}
        </>
      ))(parts(open.sheets!.at(-1)!))}
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
  raise.full = () => grow(true); // docked, the sheet ignores full
  const [ids, titles] = [open.sheets!, open.sheets!.map(titled)];
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
        slide(docked ? 'side' : 'up'),
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
/** The notebook column (Wide layout): from DOCK.at, at the Book's left edge, not modal, never in the
 * stack; `Close` in Back's place, the header taking the focus as it opens. `open` holds only the
 * notebook, at the column's scroll. */
export function Column({ open, saved, close }: Stack & { close: () => void }) {
  const title = titled(open.sheets![0]);
  return (
    <View
      aria-label={title}
      style={[
        { backgroundColor: ink('card'), borderColor: ink('line') },
        { width: DOCK.width, borderRightWidth: size.rule },
        slide('left'),
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md }}>
        {act(WORDS.shut, close)}
      </View>
      <Text
        ref={focusTitle}
        {...({ tabIndex: -1 } as object)} // mutate-skip: any negative tabIndex is the same
        accessibilityRole="header"
        style={{ ...type.control, color: ink('fg'), paddingHorizontal: space.md }}
      >
        {title}
      </Text>
      <View style={{ flex: 1 }} /* mutate-skip: layout */>
        <Sheet open={open} saved={saved} />
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
const SLIDE = StyleSheet.create({
  side: from('translateX(100%)'),
  up: from('translateY(100%)'),
  left: from('translateX(-100%)'),
});
const slide = (from: keyof typeof SLIDE) =>
  !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches && SLIDE[from];
const FLOAT = {
  position: 'absolute', // mutate-skip: layout
  left: 0, // mutate-skip: layout
  right: 0, // mutate-skip: layout
  bottom: 0, // mutate-skip: layout
  paddingBottom: 'env(safe-area-inset-bottom)' as never, // above the home bar (19.6)
} as const;
