// The riddle answer: a bank of letter tiles over one local buffer (BOOK-UI-COMPONENTS.md, Letter tile).
import { useState } from 'react';
import { Text, View } from 'react-native';
import type { Button } from './presenter.ts';
import { Act, Tap } from './pages.tsx';
import { note, prose, usePalette } from './palette.ts';
import { space } from './tokens.ts';

// Tile indices preserve multiplicity; only the bounded submitted word crosses the session boundary.
// size: allow 45, bounded tile editing and submission share one local buffer
export function Riddle(p: { bank: readonly string[]; button: Button; press: (b: Button) => void }) {
  const c = usePalette();
  const [selected, setSelected] = useState<number[]>([]);
  const answer = selected.map((i) => p.bank[i]).join('');
  return (
    <View>
      <Text style={prose(c)}>{answer || 'Choose letters to answer.'}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
        {p.bank.map((letter, i) => (
          <View key={i}>
            {selected.includes(i) ? (
              <Text style={note(c)}>{letter}</Text>
            ) : (
              <Tap
                label={`Letter ${letter}, tile ${i + 1}`}
                onPress={() => setSelected((s) => (s.includes(i) ? s : [...s, i]))}
              >
                <Text style={{ ...prose(c), color: c.action }}>{letter}</Text>
              </Tap>
            )}
          </View>
        ))}
      </View>
      {selected.length > 0 && (
        <View>
          <Tap label="Backspace" onPress={() => setSelected((s) => s.slice(0, -1))}>
            <Text style={prose(c)}>Backspace</Text>
          </Tap>
          <Tap label="Clear" onPress={() => setSelected([])}>
            <Text style={prose(c)}>Clear</Text>
          </Tap>
          <Act
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
