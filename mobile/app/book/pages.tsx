// The book's page shell and its shared controls (the room page: Body.tsx; the Contents sections:
// sections.tsx; the thing page: Menu.tsx; the title's arriving focus: title.ts).
// Each is only drawing; what a tap does is passed in by Book.tsx.
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from './Text.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { plain, type Pool } from './model.ts';
import { tapBleed } from './reading.ts';
import { usePalette, useType, type Palette } from './palette.ts';
import { opacity, size, space } from './tokens.ts';
import { useTitleFocus } from './title.ts';
import { LABEL } from './labels.ts';
export { useTitleFocus };

type Say = (key: string) => string;
export type { Thing } from './model.ts';

// Tones are projected by the kernel from the cartridge's band table.
export const band = (c: Palette, tone: Pool['tone']): string =>
  ({ normal: c.fg, warning: c.warning, danger: c.danger })[tone];

/**
 * A text pressable whose hit area bleeds onto the paper around it; the only component that bleeds
 * (BOOK-UI-COMPONENTS.md, Where each fact lives).
 * - Use: entity lines, verb lines, the room title, the status position.
 * - Story: VerbLine.stories.tsx
 */
export function Tap(p: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  shrink?: boolean; // may give up width in a row (the status position truncates)
}) {
  const b = tapBleed(useType().body.lineHeight);
  const bleed = { paddingVertical: b, marginVertical: -b }; // hit area, no shown space
  const shrink = p.shrink ? { flexShrink: 1, minWidth: 0 } : {};
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={p.label}
      onPress={() => p.onPress()} // no press event: the handler takes none
      style={{ minHeight: size.touch, justifyContent: 'center', ...bleed, ...shrink }}
    >
      {p.children}
    </Pressable>
  );
}

// ponytail: the first unfinished quest in journal order; several at once await a GameView answer.
/**
 * The current quest's projected journal text, above every page but Journal.
 * - Use: Body only.
 * - Rules: the first quest in journal order that is active or objectives_complete and has journal
 *   text; none when no quest qualifies. Not pressable; wraps, never cuts authored words.
 * - States: one line; long; none.
 * - Story: Page.stories.tsx
 */
export function RunningHead({ view, text }: { view: GameView; text: Say }) {
  const c = usePalette();
  const t = useType();
  const quest = view.journal.find(
    (q) => (q.state === 'active' || q.state === 'objectives_complete') && q.journal,
  );
  if (!quest) return null;
  return (
    <Text
      style={{
        ...t.runningHead,
        color: c.dim,
        paddingHorizontal: space.page,
        paddingTop: space.page,
      }}
    >
      {plain(text(quest.journal!))}
    </Text>
  );
}

/**
 * Local navigation that is not an offered action (Leave, Back to ..., Close, Got it, Start over).
 * - Use: PageFoot returns and local buttons.
 * - Rules: Start over is a Control wherever it appears: its confirmation carries the weight, never
 *   `action` or `danger`. `onInk` sets the label in `bg` on an ink fill.
 * - States: enabled; disabled.
 * - Story: Control.stories.tsx
 */
export function Control(p: {
  label: Extract<(typeof LABEL)[keyof typeof LABEL], string>;
  onPress: () => void;
  disabled?: boolean;
  onInk?: true;
}) {
  const { label, onPress, disabled, onInk } = p;
  const c = usePalette();
  const t = useType();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled} // also sets accessibilityState.disabled (aria-disabled on web)
      onPress={() => onPress()} // no press event: the handler takes none
      style={{
        minHeight: size.touch,
        minWidth: size.touch,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: space.md,
        opacity: disabled ? opacity.disabled : 1,
      }}
    >
      <Text style={{ ...t.control, color: disabled ? c.dim : onInk ? c.bg : c.fg }}>{label}</Text>
    </Pressable>
  );
}

/**
 * One shell for every page: the title, the blocks, and the PageFoot.
 * - Use: every page.
 * - Rules: a run of rows of one kind is one block; a heading is its own block. The title is the
 *   page header with the arriving focus; without one, the first block takes it. The room's fixed
 *   title is the only pressable title. The title is `pageTitle`, scaled with the Reading size: centred
 *   when fixed (the room), left-aligned on every other page. A page that grows at the end scrolls to its end.
 * - States: scrolling title; fixed title; no title; centred (no game behind it).
 * - Story: Page.stories.tsx
 */
export function Page(p: {
  title?: string;
  fixedTitle?: boolean;
  onTitlePress?: () => void;
  scrollToEnd?: boolean;
  centred?: boolean; // centres the blocks vertically: the save error, the chapter card
  foot?: ReactNode;
  children: ReactNode;
}) {
  const c = usePalette();
  let scroll: ScrollView | null = null; // this render's view: a ref callback, so no hook
  const title = p.title !== undefined && (
    <Title title={p.title} fixed={p.fixedTitle} onPress={p.onTitlePress} />
  );
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {p.fixedTitle && (
        <View style={{ paddingHorizontal: space.page, paddingTop: space.xl }}>{title}</View>
      )}
      <ScrollView
        ref={(view) => {
          scroll = view;
        }}
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: space.page,
          ...(p.fixedTitle && { paddingTop: space.xs }), // the title's own space.md below it, then this: 12 to the description
          gap: space.xl,
          ...(p.centred && { flexGrow: 1, justifyContent: 'center' }),
        }}
        onContentSizeChange={() => p.scrollToEnd && scroll?.scrollToEnd({ animated: false })}
      >
        {!p.fixedTitle && title}
        {p.children}
      </ScrollView>
      {p.foot && <PageFoot>{p.foot}</PageFoot>}
    </View>
  );
}

// A header that takes the arriving focus; the room's is fixed, and a tap on it looks.
function Title(p: { title: string; fixed?: boolean; onPress?: () => void }) {
  const heading = (
    <Text
      {...useTitleFocus()}
      accessibilityRole="header"
      style={{
        color: usePalette().fg,
        ...useType().pageTitle,
        // a scrolling title is a block: the page's gap alone is its space below
        ...(p.fixed && { paddingBottom: space.md, textAlign: 'center' }),
      }}
    >
      {p.title}
    </Text>
  );
  return p.onPress ? (
    <Tap label={`${p.title}, look`} onPress={p.onPress}>
      {heading}
    </Tap>
  ) : (
    heading
  );
}

/**
 * The page's local returns, nearest first: Controls centred under a hairline.
 * - Use: every page with a return; outside the scroll, above any status line.
 * - Rules: wraps onto a second row when the Reading size needs it.
 * - States: one return; two (nested item).
 * - Story: PageFoot.stories.tsx
 */
export function PageFoot({ children }: { children: ReactNode }) {
  const c = usePalette();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap', // a large Reading size takes a second row, never truncates
        justifyContent: 'center',
        columnGap: space.lg,
        rowGap: space.sm,
        paddingTop: space.md,
        paddingHorizontal: space.xl,
        paddingBottom: space.xl,
        borderTopWidth: size.rule,
        borderTopColor: c.line,
      }}
    >
      {children}
    </View>
  );
}

/**
 * A heading inside a page (Inside, Held, Worn, Where, profession titles).
 * - Use: any section heading; never a styled Text.
 * - Story: Page.stories.tsx
 */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={{ color: usePalette().fg, ...useType().sectionTitle }}>
      {children}
    </Text>
  );
}
