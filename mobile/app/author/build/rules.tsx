// The Rules block (slice 5.3, the panel's blocks/Rules.tsx): Policy, Steps, Trigger and Check are one
// union picker told apart by their tag (`op`, `event`, `kind`), and every other union in the generic
// form is drawn by it too (form.tsx `field`). It offers only the branches the compiler takes in the
// sheet's kind (rules.ts `offered`), plus the one picked; a switch keeps the tag and the shared
// fields (generic.ts `picked`); a `wait` step draws the divider before the rules that run later.
// Labels are placeholders.
import { Text, View } from 'react-native';
import { branchOf, constraintOnly } from '../../../../kernel/ts/play/card.ts';
import { picked } from '../../../../kernel/ts/play/generic.ts';
import { offered } from '../../../../kernel/ts/play/rules.ts';
import { titles } from '../../../../kernel/ts/play/ui_schema.ts';
import { size, space, type } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { field } from './form.tsx';
import { id, set, type At, type Obj, type Step } from './formwrite.ts';
import { row } from './roomedit.tsx';
import { act } from './sheet.tsx';

export const WORDS = { later: 'later rules' };
const LATER = {
  marginTop: space.sm, // mutate-skip: layout
  paddingTop: space.sm, // mutate-skip: layout
  borderTopWidth: size.rule, // mutate-skip: layout
  borderStyle: 'dashed', // mutate-skip: layout
  borderColor: ink('dim'), // mutate-skip: layout
} as const;

/** A union's branch picker (titled as the panel's), then the picked branch's own fields. */
export function rules(at: At, path: Step[], branches: Obj[], value: unknown) {
  if (constraintOnly(branches)) return null; // the compiler reports a missing or second subject
  const i = branchOf(branches, value);
  const names = titles(branches, at.defs as never);
  const kind = (at.kind ?? '').replace(/s$/, ''); // the file's dir is its node kind plural (`reactions`)
  const later = (value as Obj | undefined)?.op === 'wait';
  return [
    later ? (
      <View key={`later ${id(at, path)}`} style={LATER}>
        <Text style={{ ...type.label, color: ink('dim') }}>{WORDS.later}</Text>
      </View>
    ) : null,
    <View key={`pick ${id(at, path)}`} style={row}>
      {names.map((n, j) =>
        j === i || offered(branches[j] as never, kind)
          ? act(
              n,
              () => set(at, path, picked(branches, j, value, at.defs)),
              undefined,
              `branch ${j}`,
              j === i,
            )
          : null,
      )}
    </View>,
    i >= 0 ? field(at, path, branches[i], value) : null,
  ];
}
