// A word chip: one word of the World page's Word block as a pill.
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Text.tsx';
import { LABEL } from './labels.ts';
import { Note } from './lines.tsx';
import { usePalette, useType } from './palette.ts';
import { steps, type Reading } from './reading.ts';
import { opacity, radius, size, space } from './tokens.ts';

/**
 * One word of the World page's Word block as a pill (book-ui.md, Word bar).
 * - Use: Word block words; a radio row setting (Reading size).
 * - Rules: a row wraps, never truncates. Name: the word, then how it is spoken (`ward, say`,
 *   `ward, whisper to the elder`). Unavailable: not pressable, its reason a `word, cast: reason`
 *   Note under the row (the Action card's form); chosen: role radio, checked.
 * - States: available; unavailable; pending; chosen.
 * - Story: Chip.stories.tsx
 */
export function Chip(p: {
  word: string;
  label: string;
  onPress?: () => void;
  pending?: boolean;
  chosen?: boolean;
}) {
  const c = usePalette();
  const t = useType();
  const off = !p.onPress || !!p.pending;
  return (
    <Pressable
      accessibilityRole={p.chosen === undefined ? 'button' : 'radio'}
      aria-checked={p.chosen} // a radio's state; axe rejects aria-selected on a radio
      accessibilityLabel={p.label}
      aria-busy={!!p.pending} // RN web maps aria-busy, not accessibilityState.busy
      disabled={off}
      onPress={p.onPress}
      style={{
        minHeight: size.touch,
        minWidth: size.touch,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: space.lg,
        backgroundColor: p.chosen ? c.fg : c.card,
        borderColor: c.line,
        borderWidth: size.rule,
        borderRadius: radius.chip,
        opacity: p.onPress ? 1 : opacity.disabled,
      }}
    >
      <Text style={{ ...t.control, color: p.chosen ? c.bg : p.onPress ? c.fg : c.dim }}>
        {p.word}
      </Text>
    </Pressable>
  );
}

/**
 * A titled row of chips, centred and wrapping, its reasons as Notes under it.
 * - Use: each Word block row (Say, Whisper to <name>, Shout, Cast).
 * - Story: WordBar.stories.tsx
 */
export function Row(p: { title: string; children: ReactNode[]; reasons?: string[] }) {
  if (!p.children.length) return null;
  return (
    <View style={{ gap: space.sm }}>
      <Note>{p.title}</Note>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm }}
      >
        {p.children}
      </View>
      {(p.reasons ?? []).map((r) => (
        <Note key={r}>{r}</Note>
      ))}
    </View>
  );
}

// The Reading size setting (Settings, first): one radio chip per step.
const stepWord = {
  standard: LABEL.readingStandard,
  large: LABEL.readingLarge,
  larger: LABEL.readingLarger,
};
/**
 * The Reading size setting: one radio Chip per step.
 * - Use: Settings, first.
 * - Story: Chip.stories.tsx
 */
export const ReadingSize = (p: Reading) => (
  <View accessibilityRole="radiogroup" accessibilityLabel={LABEL.readingSize}>
    <Row title={LABEL.readingSize}>
      {steps.map((s) => (
        <Chip
          key={s}
          word={stepWord[s]}
          label={stepWord[s]}
          chosen={p.step === s}
          onPress={() => p.choose(s)}
        />
      ))}
    </Row>
  </View>
);
