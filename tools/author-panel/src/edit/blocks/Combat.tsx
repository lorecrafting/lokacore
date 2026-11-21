// The NPC and Item cards' Combat block (docs/rnd/gui-editor-design-2026-11-04.md §4.2): hp,
// attack and weapon as numbers beside the fight rows in GET /numbers; the logic is
// kernel/ts/play/blocks.ts. An NPC's attack answers for itself; a weapon answers for every target,
// since it is the player's hand in each fight rather than a target of one.
import { useState } from 'react';
import type { FieldProps } from '@rjsf/utils';
import { fightsShown } from '../../../../../kernel/ts/play/blocks.ts';
import { fights } from '../../author.ts';
import { Fight } from '../../numbers.tsx';
import { Button } from '../../components/ui/button.tsx';
import type { Context } from '../fields.tsx';

type Shown = ReturnType<typeof fightsShown> | Error;
const RUNNING = 'running the fights…';

/** The fight rows, measured on asking: the report runs every fight, so this is seconds, not
 * keystrokes (loka-wfrgk.79). `wield` is a weapon's item key; without it the NPC's own rows. */
function Fights({ who, wield }: { who: string; wield?: string }) {
  const [shown, show] = useState<Shown | null>(null);
  const run = () => {
    show(RUNNING); // the last answer goes while the next runs
    fights(wield)
      .then((r) => show(fightsShown(r.fights, who, !!wield)))
      .catch((e: Error) => show(e));
  };
  return (
    <div className="grid gap-1">
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="justify-self-start"
        disabled={shown === RUNNING} // one run at a time: each runs every fight
        onClick={run}
      >
        Run fights
      </Button>
      {shown === null ? null : shown instanceof Error ? (
        <p className="text-destructive">{shown.message}</p>
      ) : typeof shown === 'string' ? (
        <p className="text-muted-foreground">{shown}</p>
      ) : Array.isArray(shown) ? (
        shown.map((s) => <Fight key={s.target} target={s} />)
      ) : (
        <Fight target={shown} />
      )}
    </div>
  );
}

export function Combat(p: FieldProps) {
  const { kind, key } = p.registry.formContext as Context;
  const { 'ui:field': _block, ...ui } = p.uiSchema ?? {};
  const field = p.fieldPathId.path[0];
  return (
    <section aria-label={`Combat ${field}`} className="grid gap-1 rounded border p-2 text-xs">
      <p.registry.fields.SchemaField {...p} uiSchema={ui} />
      {field === 'attack' && kind === 'npc' ? <Fights who={key} /> : null}
      {field === 'weapon' && kind === 'item' ? <Fights who={key} wield={key} /> : null}
    </section>
  );
}
