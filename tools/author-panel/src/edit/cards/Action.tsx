// The Action card (docs/rnd/gui-editor-design-2026-11-04.md §4.5, G4): a scripted action's name
// opens in the Book, its mechanics are added and removed as the compiler allows, and its check
// and failure outcome come and go together; target, policy, check and outcome steps are the Rules
// blocks in the form. A built-in command action stays the generic card.
import { paired, scriptedMenu } from '../../../../../kernel/ts/play/action.ts';
import { addable, allowed } from '../../../../../kernel/ts/play/card.ts';
import type { useDiagnostics } from '../../author.ts';
import type { Context } from '../fields.tsx';
import { Generic, Header, useCard } from '../Generic.tsx';
import { Refusal } from '../templates.tsx';
import registry from '../registry.json';
import { adder, Mechanics, RoomForm, useCartridge, Words } from './Room.tsx';

const DEF = 'source.ScriptedAction';
// an action with `command` (source_schema.ex:212)
const COMMAND = 'source.ActionDefinition';

type Props = { rel: string; context: Context; diag: ReturnType<typeof useDiagnostics> };
type Doc = Record<string, unknown>;

export function Action({ rel, context, diag }: Props) {
  const raw = useCard(rel, diag);
  const draft = (raw.draft ?? {}) as Doc;
  const defs = (raw.saved?.schema as { $defs?: Record<string, never> } | undefined)?.$defs ?? {};
  const cart = useCartridge(diag);
  if (!raw.saved) return <p className="px-3 text-xs text-muted-foreground">Loading {rel}</p>;
  if (Object.hasOwn(draft, 'command')) return <Generic rel={rel} context={context} diag={diag} only={(m, d) => scriptedMenu(m, d, COMMAND)} />;
  const card = { ...raw, change: (d: unknown) => raw.change(paired(d as Doc, defs)) };
  const caps = cart && (cart.requires?.capabilities ?? {});
  const offered = scriptedMenu(addable('actions', registry, draft, card.revealed), defs);
  // the whole cartridge.json: a duration's need is its top-level time_policy (card.ts NEEDS)
  const menu = caps ? allowed('actions', offered, caps, draft, cart) : [];
  const required = ((defs[DEF] as { required?: string[] } | undefined)?.required ?? []) as string[];
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 px-3 text-xs" aria-label="action card">
      <Header rel={rel} diag={diag} undo={card.undo ? card.back : undefined} />
      {card.refused ? <Refusal boxed>{card.refused}</Refusal> : null}
      <Words draft={draft} context={context} fields={['name']} />
      <Mechanics card={card} menu={menu} add={adder(card, defs, DEF)} fixed={required} />
      <RoomForm rel={rel} card={card} context={context} diag={diag} defs={defs} own={['name']} />
    </div>
  );
}
