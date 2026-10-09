// The riddle answer: a bank of letter tiles over one local buffer (BOOK-UI-COMPONENTS.md, Letter tile).
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Button } from './presenter.ts';
import { ActionCard } from './actions.tsx';
import { Control } from './pages.tsx';
import { prose, usePalette } from './palette.ts';
import { opacity, radius, size, space, type } from './tokens.ts';

// Tile indices preserve multiplicity; only the bounded submitted word crosses the session boundary.
export function Riddle(p: { bank: readonly string[]; button: Button; press: (b: Button) => void }) {
  const c = usePalette();
  const [selected, setSelected] = useState<number[]>([]);
  const answer = selected.map((i) => p.bank[i]).join('');
  return (
    // the answer, the bank and the controls, as the mock's `.word`, `.bankl` and `.rrow`
    <View style={{ gap: space.block }}>
      <Text style={prose(c)}>{answer || 'Choose letters to answer.'}</Text>
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
            <Control label="Backspace" onPress={() => setSelected((s) => s.slice(0, -1))} />
            <Control label="Clear" onPress={() => setSelected([])} />
          </View>
          <ActionCard
            b={{ ...p.button, label: 'Submit', input: { ...p.button.input, answer } }}
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

// A used tile keeps its place in the bank (no reflow), disabled.
export function LetterTile(p: {
  letter: string;
  used: boolean;
  label: string;
  onPress: () => void;
}) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={p.label}
      disabled={p.used}
      onPress={p.onPress}
      style={{
        width: size.touch,
        height: size.touch,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: c.card,
        borderColor: c.line,
        borderWidth: size.rule,
        borderRadius: radius.card,
        opacity: p.used ? opacity.disabled : 1,
      }}
    >
      <Text style={{ ...type.tile, color: c.fg }}>{p.letter}</Text>
    </Pressable>
  );
}
