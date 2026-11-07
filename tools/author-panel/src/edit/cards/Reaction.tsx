// The Reaction card (docs/rnd/gui-editor-design-2026-11-04.md §4.5, G4): its trigger, conditions
// and steps are the Rules blocks in the form; its delay, silence and zone are added and removed
// as the compiler allows (a zone never beside a trigger's room).
import { addable, allowed } from '../../../../../kernel/ts/play/card.ts';
import type { useDiagnostics } from '../../author.ts';
import type { Context } from '../fields.tsx';
import { adding, Header, useCard, useCartridge } from '../Generic.tsx';
import { Refusal } from '../templates.tsx';
import registry from '../registry.json';
import { Mechanics, RoomForm } from './Room.tsx';

type Props = { rel: string; context: Context; diag: ReturnType<typeof useDiagnostics> };
type Doc = Record<string, unknown>;

export function Reaction({ rel, context, diag }: Props) {
  const card = useCard(rel, diag);
  const draft = (card.draft ?? {}) as Doc;
  const defs = (card.saved?.schema as { $defs?: Record<string, never> } | undefined)?.$defs ?? {};
  const cart = useCartridge(diag);
  if (!card.saved) return <p className="px-3 text-xs text-muted-foreground">Loading {rel}</p>;
  const caps = cart && (cart.requires?.capabilities ?? {});
  const offered = addable('reactions', registry, draft, card.revealed);
  const menu = caps ? allowed('reactions', offered, caps, draft, cart?.world) : [];
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 px-3 text-xs" aria-label="reaction card">
      <Header rel={rel} diag={diag} undo={card.undo ? card.back : undefined} />
      {card.refused ? <Refusal boxed>{card.refused}</Refusal> : null}
      <Mechanics
        card={card}
        menu={menu}
        {...adding(card, defs, 'source.ReactionRule')}
        fixed={(defs['source.ReactionRule'] as { required?: string[] } | undefined)?.required ?? []}
      />
      <RoomForm rel={rel} card={card} context={context} diag={diag} defs={defs} own={[]} />
    </div>
  );
}
