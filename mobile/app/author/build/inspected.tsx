// A sheet's head (parity inspector-header): its own module, as room.tsx, thing.tsx and generic.tsx
// import it and story.tsx sits in their import cycle. known and inRow are read at render time only.
import { Text, View } from 'react-native';
import { space } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { known } from './room.tsx';
import { inRow } from './roomedit.tsx';

// Placeholders: the owner writes the words. Never `~` (ruling 9).
const WORDS = {
  counts: (todo: number, diagnostics: number) => `${todo} unwritten · ${diagnostics} diagnostics`,
  unreached: 'unreached from the start',
};

/** A sheet's head, as the panel inspector's: the ref its file defines (a World file, the file), how
 * many unwritten and diagnostics the last /story counted there, and unreached from the start. */
export function inspected(
  file?: string,
  ref = file && Object.keys(known.files).find((r) => known.files[r] === file), // a bundle member's: its caller's
) {
  const s = known.story;
  if (!s || !file) return null;
  // unwritten counts placeholders, as the Story rows do (storylist.ts), not the panel's todo entries
  const todo = (ref && s.todo?.[ref]?.reduce((n, t) => n + t.placeholders.length, 0)) || 0;
  const diagnostics = (ref && s.diagnostics?.[ref]?.length) || 0;
  const off =
    !!ref && Object.values(s.report?.unreachable ?? {}).some((refs) => refs.includes(ref));
  const dim = { ...inRow, color: ink('dim') };
  return (
    <View key="inspected" style={{ paddingHorizontal: space.md /* mutate-skip: layout */ }}>
      <Text style={dim}>{ref || file}</Text>
      {ref ? <Text style={dim}>{WORDS.counts(todo, diagnostics)}</Text> : null}
      {off ? <Text style={{ ...inRow, color: ink('danger') }}>{WORDS.unreached}</Text> : null}
    </View>
  );
}
