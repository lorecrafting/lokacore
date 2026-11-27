// A modal scene's trigger in Build (slice 5.2, scene-structure-rulings §4; scene_trigger.ts, the
// panel's ModalScene): its kinds, values and outcomes as picks, each writing the whole new on, a
// quest's typed outcome, and the quest a switch left. Labels are placeholders.
import { Text, TextInput, View } from 'react-native';
import {
  kindOf,
  leftover,
  offers,
  outcomeRefused,
  outcomesOf,
  type Kind,
  type On,
} from '../../../../kernel/ts/play/scene_trigger.ts';
import { space, type } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { INPUT } from './form.tsx';
import { BUSY, drafts, id, keep, ops, send, type At, type Step } from './formwrite.ts';
import { known } from './room.tsx';
import { row, tell } from './roomedit.tsx';
import { act } from './sheet.tsx';

export const WORDS = {
  on: 'on',
  outcome: 'outcome',
  badOutcome: 'not a key, or another scene starts on it',
};
const KINDS: Kind[] = ['start', 'story_point', 'quest', 'action'];
const LABEL = { ...type.label, color: ink('dim') };

/** A row of trigger picks, `now` lit; a pick puts `next(v)`. */
const picks = (
  put: (o: On | undefined) => unknown,
  what: string,
  vs: unknown[],
  next: (v: never) => On | undefined,
  now: unknown,
) => (
  <View style={{ ...row, flexWrap: 'wrap' }}>
    {vs.map((v) =>
      act(
        String(v),
        () => v === now || put(next(v as never)),
        undefined,
        `${what} ${String(v)}`,
        v === now,
      ),
    )}
  </View>
);

/** The trigger: its kinds with an offer, then its value's, then a point's outcomes or a quest's
 * typed one, then the quest a switch left (`~ q`). A pick writes the whole on at `path`. */
export function trigger(at: At, path: Step[], on: On = {}) {
  const t = known.story!.triggers;
  const key = at.file.replace(/^.*\//, '').replace(/\.json$/, '');
  const all = offers(t, key, known.nodes);
  const kind = kindOf(on);
  const put = (next: On | undefined) => next && send(at, ops(path, next));
  const named = (o: On) => String(o[kind]);
  const gone = leftover(t, key, on);
  return (
    <View key={id(at, path)} style={{ paddingLeft: space.md }}>
      <Text style={LABEL}>{WORDS.on}</Text>
      {picks(
        put,
        'kind',
        KINDS.filter((k) => all[k].length || k === kind),
        (k: Kind) => (k === kind ? undefined : all[k][0]),
        kind,
      )}
      {kind !== 'start' &&
        picks(
          put,
          'value',
          [...new Set(all[kind].map(named))],
          (v: string) => all[kind].find((o) => named(o) === v),
          String(on[kind]),
        )}
      {kind === 'story_point' &&
        picks(
          put,
          'outcome',
          outcomesOf(all.story_point, on),
          (o: string) => ({ story_point: on.story_point, outcome: o }),
          on.outcome,
        )}
      {kind === 'quest' && questOutcome(at, path, t, key, on)}
      {gone && <Text style={LABEL}>{`~ ${gone}`}</Text>}
    </View>
  );
}

/** A quest trigger's outcome, typed; written on blur unless outcomeRefused refuses it. */
function questOutcome(
  at: At,
  path: Step[],
  t: Parameters<typeof leftover>[0], // mutate-skip: a type
  key: string,
  on: On,
) {
  const k = `outcome ${id(at, path)} ${on.quest} ${on.outcome}`;
  const write = () => {
    const o = drafts.get(k)?.trim();
    drafts.delete(k);
    if (o === undefined || o === on.outcome) return; // untyped or unchanged
    if (outcomeRefused(t, key, on, o)) tell(WORDS.badOutcome);
    else
      void send(at, ops(path, { quest: on.quest, outcome: o }), undefined, BUSY).then(
        (ok) => ok || keep(k, o), // not written: leaving again writes it
      );
  };
  return (
    <TextInput
      key={k}
      accessibilityLabel={WORDS.outcome}
      defaultValue={drafts.get(k) ?? String(on.outcome ?? '')}
      style={INPUT}
      onChangeText={(v) => void drafts.set(k, v)}
      onBlur={write}
    />
  );
}
