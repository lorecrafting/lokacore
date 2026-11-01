// The riddle answer: a bank of letter tiles over one local buffer.
import { useState } from 'react';
import { View } from 'react-native';
import { LiftPressable } from './fade.ts';
import { useLift, usePress } from './press.ts';
import { Text } from './Text.tsx';
import type { Button } from './presenter.ts';
import { ActionCard } from './actions.tsx';
import { Control } from './pages.tsx';
import { prose, usePalette, useType } from './palette.ts';
import { opacity, radius, size, space } from './tokens.ts';
import { LABEL } from './labels.ts';

/**
 * The riddle answer: a bank of Letter tiles over one local buffer, with Backspace, Clear and
 * Submit.
 * - Use: an NPC page offering a riddle.
 * - Rules: the answer line, the bank, its Controls and the Submit card are one block. Tile indices
 *   preserve multiplicity; only the bounded submitted word crosses the session boundary.
 * - Story: Riddle.stories.tsx
 */
export function Riddle(p: { bank: readonly string[]; button: Button; press: (b: Button) => void }) {
  const c = usePalette();
  const t = useType();
  const [selected, setSelected] = useState<number[]>([]);
  const answer = selected.map((i) => p.bank[i]).join('');
  return (
    // the answer, the bank and the controls, as the mock's `.word`, `.bankl` and `.rrow`
    <View style={{ gap: space.xl }}>
      <Text style={prose(c, t)}>{answer || 'Choose letters to answer.'}</Text>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm }}
      >
        {p.bank.map((letter, i) => (
          <LetterTile
            key={i}
            letter={letter}
            used={selected.includes(i)}
            label={`${letter}, tile ${i + 1}`}
            onPress={() => setSelected((s) => (s.includes(i) ? s : [...s, i]))}
          />
        ))}
      </View>
      {selected.length > 0 && (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row' }}>
            <Control label={LABEL.backspace} onPress={() => setSelected((s) => s.slice(0, -1))} />
            <Control label={LABEL.clear} onPress={() => setSelected([])} />
          </View>
          <ActionCard
            b={{ ...p.button, label: LABEL.submit, input: { ...p.button.input, answer } }}
            press={(b) => {
              p.press(b);
              setSelected([]);
            }}
          />
        </View>
      )}
    </View>
  );
}

/**
 * One letter of the riddle bank.
 * - Use: Riddle only.
 * - Rules: a press lifts with a selection haptic; a used tile keeps its place (no reflow). Name: the letter, then its place (`N, tile 2`).
 * - States: free; used (not pressable).
 * - Story: LetterTile.stories.tsx
 */
export function LetterTile(p: {
  letter: string;
  used: boolean;
  label: string;
  onPress: () => void;
}) {
  const c = usePalette();
  const press = usePress('selection');
  const lift = useLift(press, c.card);
  return (
    <LiftPressable
      {...press.handlers}
      accessibilityRole="button"
      accessibilityLabel={p.label}
      disabled={p.used}
      onPress={() => p.onPress()} // no press event: the handler takes none
      style={[
        {
          width: size.touch,
          height: size.touch,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: c.card,
          borderColor: c.line,
          borderWidth: size.rule,
          borderRadius: radius.card,
          opacity: p.used ? opacity.disabled : 1, // mutate-skip: opacity above full clamps to full
        },
        lift,
      ]}
    >
      <Text style={{ ...useType().tile, color: c.fg }}>{p.letter}</Text>
    </LiftPressable>
  );
}
