// A modal scene's trigger (Scene.tsx's ModalScene): what starts it, offered only as the compile takes
// it (kernel/ts/play/scene_trigger.ts, lib/loka/content/scenes.ex).
import { useEffect, useState } from 'react';
import {
  kindOf,
  leftover,
  offers,
  refused,
  type Kind,
  type On,
} from '../../../../../kernel/ts/play/scene_trigger.ts';
import { Input } from '../../components/ui/input.tsx';
import { type Context } from '../fields.tsx';
import { Refusal } from '../templates.tsx';

/** What starts a modal scene: one kind, then its key and outcome, each only as the compile takes it
 * (scene_trigger.ts); a switch writes the whole new `on`, never the old one's leftover fields. */
export function Trigger({ on, context, put }: { on: On; context: Context; put: (on: On) => void }) {
  const t = context.triggers;
  if (!t) return null;
  const all = offers(t, context.key, context.nodes);
  const kind = kindOf(on);
  const quest = leftover(t, context.key, on);
  return (
    <div className="grid gap-1">
      <label className="flex items-center gap-2">
        <span className="text-muted-foreground">on</span>
        <Pick
          label="on"
          value={kind}
          of={(Object.keys(all) as Kind[]).filter((k) => all[k].length)}
          pick={(k) => put(all[k as Kind][0])}
        />
        {kind === 'start' ? null : (
          <Pick
            label={`on ${kind}`}
            value={on[kind]}
            of={all[kind].map((o) => o[kind])}
            pick={(k) => put(all[kind].find((o) => o[kind] === k)!)}
          />
        )}
        {kind === 'story_point' ? (
          <Pick
            label="outcome"
            value={on.outcome}
            of={all[kind].filter((o) => o[kind] === on[kind]).map((o) => o.outcome)}
            pick={(o) => put({ story_point: on.story_point, outcome: o })}
          />
        ) : null}
        {kind === 'quest' ? (
          <QuestOutcome on={on} taken={(o) => refused(t, context.key, o)} put={put} />
        ) : null}
      </label>
      {quest ? <p className="text-muted-foreground">~ {quest}</p> : null}
    </div>
  );
}

/** A select of `value` and the offers `of` (each once). */
function Pick({
  label,
  value,
  of,
  pick,
}: {
  label: string;
  value: unknown;
  of: unknown[];
  pick: (v: string) => void;
}) {
  return (
    <select
      aria-label={label}
      className="form-control"
      value={String(value)}
      onChange={(e) => pick(e.target.value)}
    >
      {[...new Set([value, ...of])].map((v) => (
        <option key={String(v)} value={String(v)}>
          {String(v)}
        </option>
      ))}
    </select>
  );
}

/** A quest's outcome, free text (scenes.ex never checks it); another scene's quest and outcome refused. */
function QuestOutcome({
  on,
  taken,
  put,
}: {
  on: On;
  taken: (on: On) => boolean;
  put: (on: On) => void;
}) {
  const [outcome, setOutcome] = useState(String(on.outcome ?? ''));
  useEffect(() => setOutcome(String(on.outcome ?? '')), [on.outcome]);
  const typed = { quest: on.quest, outcome };
  const refused = outcome !== on.outcome && taken(typed);
  return (
    <>
      <Input
        aria-label="outcome"
        className="h-7 text-xs"
        value={outcome}
        aria-invalid={refused}
        onChange={(e) => setOutcome(e.target.value)}
        onBlur={() => outcome && outcome !== on.outcome && !refused && put(typed)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      {refused ? <Refusal>~</Refusal> : null}
    </>
  );
}
