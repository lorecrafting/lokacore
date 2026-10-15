// A word chip (BOOK-UI-COMPONENTS.md, Chip): one word of the World page's Word block as a pill.
import { Pressable, Text } from 'react-native';
import { usePalette } from './palette.ts';
import { opacity, radius, size, space, type } from './tokens.ts';

// No onPress is the unavailable form (its reason is a line under the row); pending is pressed.
export function Chip(p: { word: string; label: string; onPress?: () => void; pending?: boolean }) {
  const c = usePalette();
  const off = !p.onPress || !!p.pending;
  return (
    <Pressable
      accessibilityRole="button"
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
        backgroundColor: c.card,
        borderColor: c.line,
        borderWidth: size.rule,
        borderRadius: radius.chip,
        opacity: p.onPress ? 1 : opacity.disabled,
      }}
    >
      <Text style={{ ...type.control, color: p.onPress ? c.fg : c.dim }}>{p.word}</Text>
    </Pressable>
  );
}
