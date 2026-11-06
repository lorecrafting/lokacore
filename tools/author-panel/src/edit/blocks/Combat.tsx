// The NPC and Item cards' Combat block (docs/rnd/gui-editor-design-2026-11-04.md §4.2): hp,
// attack and weapon as numbers, an NPC's attack beside its fight rows in GET /numbers; the logic
// is kernel/ts/play/blocks.ts.
import { useState } from 'react';
import type { FieldProps } from '@rjsf/utils';
import { fightOf } from '../../../../../kernel/ts/play/blocks.ts';
import { numbers } from '../../author.ts';
import { Fight } from '../../numbers.tsx';
import { Button } from '../../components/ui/button.tsx';
import type { Context } from '../fields.tsx';

type Shown = ReturnType<typeof fightOf> | Error;
const RUNNING = 'running the fights…';

/** The NPC's fight rows, measured on asking (the report runs the fights: seconds, not keystrokes). */
function Fights({ npc }: { npc: string }) {
  const [shown, show] = useState<Shown | null>(null);
  return (
    <div className="grid gap-1">
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="justify-self-start"
        disabled={shown === RUNNING} // one run at a time: each runs every fight
        onClick={() => {
          show(RUNNING); // the last answer goes while the next runs (loka-wfrgk.79)
          numbers()
            .then((r) => show(fightOf(r.fights, npc)))
            .catch((e: Error) => show(e));
        }}
      >
        Run fights
      </Button>
      {shown === null ? null : shown instanceof Error ? (
        <p className="text-destructive">{shown.message}</p>
      ) : typeof shown === 'string' ? (
        <p className="text-muted-foreground">{shown}</p>
      ) : shown ? (
        <Fight target={shown} />
      ) : (
        <p className="text-muted-foreground">not a fight target (an NPC with an attack, alive at start)</p>
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
      {field === 'attack' && kind === 'npc' ? <Fights npc={key} /> : null}
    </section>
  );
}
