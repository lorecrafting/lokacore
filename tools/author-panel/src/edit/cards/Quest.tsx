// The Quest card (docs/rnd/gui-editor-design-2026-11-04.md §4.4, E6d): the name opens in the Book,
// the mechanics (deadline, exchange, expedition, patrol, journal, offer) are added and removed as the
// capabilities allow; the objective is the Rules block's, the rest the form's (pickers by kind).
import { addable, allowed } from '../../../../../kernel/ts/play/card.ts';
import type { useDiagnostics } from '../../author.ts';
import type { Context } from '../fields.tsx';
import { Header, useCard } from '../Generic.tsx';
import { Refusal } from '../templates.tsx';
import registry from '../registry.json';
import { adder, Mechanics, RoomForm, useCartridge, Words } from './Room.tsx';

const WORDS = ['name'];
const DEF = 'source.QuestDefinition';

type Props = { rel: string; context: Context; diag: ReturnType<typeof useDiagnostics> };

export function Quest({ rel, context, diag }: Props) {
  const card = useCard(rel, diag);
  const { saved } = card;
  const draft = (card.draft ?? {}) as Record<string, unknown>;
  const defs = (saved?.schema as { $defs?: Record<string, never> } | undefined)?.$defs ?? {};
  const cart = useCartridge(diag);
  if (!saved) return <p className="px-3 text-xs text-muted-foreground">Loading {rel}</p>;
  const caps = cart && (cart.requires?.capabilities ?? {});
  const offered = addable(saved.dir, registry, draft, card.revealed);
  const menu = caps ? allowed(saved.dir, offered, caps, draft, cart?.world) : [];
  const required = ((defs[DEF] as { required?: string[] } | undefined)?.required ?? []) as string[];
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 px-3 text-xs" aria-label="quest card">
      <Header rel={rel} diag={diag} undo={card.undo ? card.back : undefined} />
      {card.refused ? <Refusal boxed>{card.refused}</Refusal> : null}
      <Words draft={draft} context={context} fields={WORDS} />
      <Mechanics
        card={card}
        menu={menu}
        add={adder(card, defs, DEF)}
        fixed={required}
      />
      <RoomForm rel={rel} card={card} context={context} diag={diag} defs={defs} own={WORDS} />
    </div>
  );
}
