// The Combat hotbar: four Inked slots fixed under the Combat page's scroll (book-ui.md, Combat hotbar).
import { lazy, Suspense, useState, type RefObject } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { rows, useFocus, type Shown } from './actions.tsx';
import { commandOf } from './buttons.ts';
import { actionGlyph, OPENER } from './actionGlyphs.ts';
import { canDraw } from './canDraw.ts';
import { LiftPressable } from './fade.ts';
import { haptic } from './haptic';
import type { State } from './HotbarGlyph.tsx';
import { LABEL } from './labels.ts';
import { unseen } from './lines.tsx';
import { refusedProps } from './pages.tsx';
import type { Pick } from './pick.ts';
import { usePress, useThin } from './press.ts';
import type { Button } from './presenter.ts';
import { reasonSentence } from './reasons.ts';
import { Text } from './Text.tsx';
import { space } from './tokens.ts';
import { why } from './words.ts';

const HotbarGlyph = lazy(() => import('./HotbarGlyph.tsx'));

// The Combat page's own verbs, by command: their cards stay in the scroll, never a slot.
const VERBS = ['stand', 'flee', 'bandage', 'cast', 'look', 'scan', 'move'];
const PAGE = 'hotbar'; // the opener's list in Combat's one-open-list state

type Cooldown = { ends_at?: number; duration?: number };
// `reason` is the refusal's word ('' when offered); `b` what a ready press sends.
export type Slot = { key: string; label: string; reason: string; b?: Button } & Cooldown;

// The fillers in GameView order: untargeted scripted actions not the page's own, then the untargeted
// spell words (the kernel lists no aimed word) while Cast is available, each sending Cast with its word as
// the Skills page's cards do, with no pick mark, so the page keeps the strip. A fight is wordless
// (buttons.ts), so no Cast twin is projected: the press is built here, under the view's token.
export const slotsOf = (view: GameView, buttons: Button[], text: (key: string) => string) => {
  const cast = view.actions.some((a) => a.action_key === 'cast' && a.available);
  const token = buttons[0]?.token;
  const cooldown = (e: { available: boolean } & Cooldown) =>
    e.ends_at === undefined ? {} : { ends_at: e.ends_at, duration: e.duration };
  const slots: Slot[] = [
    ...view.actions
      .filter((a) => a.target.kind === 'none' && !VERBS.includes(commandOf(a)))
      .map((a) => ({
        key: a.action_key,
        label: text(a.label),
        reason: why(a, text),
        b: buttons.find((b) => b.action_key === a.action_key),
        ...cooldown(a),
      })),
    ...(cast ? (view.spell_words ?? []) : []).map((s) => {
      const label = LABEL.wordCast(s.word);
      return {
        key: s.word,
        label,
        reason: why(s, text),
        b: { label, action_key: 'cast', target_ids: [], input: { word: s.word }, token },
        ...cooldown(s),
      };
    }),
  ];
  return slots.filter((s) => s.reason || s.b);
};

// The share of a cooldown already elapsed, 0 to 1, from the confirmed view's time (as ringFraction).
export const share = (s: Cooldown, time: number) =>
  s.ends_at === undefined || !s.duration
    ? undefined
    : Math.min(1, Math.max(0, (time - (s.ends_at - s.duration)) / s.duration));

const drawing = (d: string, state: State, at?: number) =>
  canDraw() && (
    <Suspense fallback={null}>
      <HotbarGlyph d={d} state={state} share={at} />
    </Suspense>
  );

type Props = {
  view: GameView;
  buttons: Button[];
  text: (key: string) => string;
  press: (b: Button) => void;
  shown: Shown;
  opener: RefObject<View | null>;
};

function SlotButton(p: { s: Slot; time: number; press: (b: Button) => void }) {
  const [said, setSaid] = useState<string>();
  const press = usePress(p.s.reason ? undefined : 'selection');
  const thin = useThin(press, false);
  const at = share(p.s, p.time);
  const sentence = reasonSentence(p.s.reason);
  // A refused press sends nothing and reads its sentence once, as an unavailable card does.
  const refuse = () => {
    haptic('warning');
    setSaid(sentence);
    AccessibilityInfo.announceForAccessibility(sentence);
  };
  return (
    <View>
      <LiftPressable
        {...press.handlers}
        {...(p.s.reason ? refusedProps('') : { accessibilityRole: 'button' as const })}
        accessibilityLabel={p.s.reason ? `${p.s.label}, ${p.s.reason}` : p.s.label}
        onPress={p.s.reason ? refuse : press.commit(() => p.s.b && p.press(p.s.b))}
        style={thin}
      >
        {drawing(
          actionGlyph(p.s.key),
          p.s.reason ? (at === undefined ? 'barred' : 'cooling') : 'ready',
          at,
        )}
      </LiftPressable>
      <View aria-live="polite" style={unseen}>
        {said ? <Text>{said}</Text> : null}
      </View>
    </View>
  );
}

/**
 * The Combat hotbar: three slots and the opener, fixed under the Combat page's scroll.
 * - Use: Combat's Page `strip`, while a fight is on.
 * - Rules: the slots fill in GameView order from the untargeted scripted actions that are not the
 *   page's own verbs, then the untargeted spell words (`slotsOf`); a barred one keeps its place. An
 *   empty slot is the hairline ring, unfocusable and nameless; no filler, no strip. One group named
 *   `LABEL.hotbar`, slots `space.xl` apart. A ready press sends as its card would; a barred or cooling
 *   one is exposed disabled, named with its reason word, and reads its reason sentence once. The
 *   opener (never barred) opens `HotbarList` in Combat's one-open-list state; a second press closes it.
 * - States: ready; cooling (the wedge); barred; empty slots; opener open; no strip.
 * - Story: CombatPage.stories.tsx
 */
export function Hotbar(p: Props) {
  const slots = slotsOf(p.view, p.buttons, p.text);
  const [shown, setShown] = p.shown;
  const open = shown?.page === PAGE;
  const press = usePress('selection');
  const thin = useThin(press, false);
  if (!slots.length) return null;
  return (
    <View
      role="group"
      aria-label={LABEL.hotbar}
      style={{ flexDirection: 'row', justifyContent: 'center', gap: space.xl, padding: space.lg }}
    >
      {[0, 1, 2].map((i) =>
        slots[i] ? (
          <SlotButton key={slots[i].key} s={slots[i]} time={p.view.time} press={p.press} />
        ) : (
          <View key={i} aria-hidden>
            {drawing(OPENER, 'empty')}
          </View>
        ),
      )}
      <LiftPressable
        ref={p.opener}
        {...press.handlers}
        accessibilityRole="button"
        accessibilityLabel={LABEL.hotbarOpener}
        aria-expanded={open}
        onPress={press.commit(() =>
          setShown(open ? undefined : { page: PAGE, label: LABEL.hotbar }),
        )}
        style={thin}
      >
        {drawing(OPENER, 'ready')}
      </LiftPressable>
    </View>
  );
}

/**
 * The opener's list: every slot filler, the three slots included, as Action cards in their order.
 * - Use: the end of Combat's response cards, while the opener is open.
 * - Rules: as a Pick list's rows: opening focuses the first available row; a row press sends and
 *   closes, unless an action is pending; Escape closes; closing puts focus back on the opener.
 * - Story: CombatPage.stories.tsx
 */
export function HotbarList(p: Props & { pending?: boolean }) {
  const [shown, setShown] = p.shown;
  const open = shown?.page === PAGE ? shown.label : undefined;
  const list: Pick = {
    label: LABEL.hotbar,
    rows: slotsOf(p.view, p.buttons, p.text).map((s) =>
      s.reason || !s.b
        ? { label: s.label, reason: s.reason }
        : { b: s.b, label: s.label, name: s.label },
    ),
  };
  const { first, sent } = useFocus(open, p.view, [list]);
  if (!open) return null;
  const close = () => {
    setShown(undefined);
    p.opener.current?.focus();
  };
  const press = (b: Button) => {
    p.press(b);
    if (p.pending) return;
    sent.current = open;
    close();
  };
  return rows(list, first, press, close);
}
