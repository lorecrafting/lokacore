// The Dialogue card (docs/rnd/gui-editor-design-2026-11-04.md §4.4, E6d): the name and prompt open
// in the Book, each choice's links (then, then_failed) pick a dialogue or `end` as the compiler links
// them, the mechanics are added and removed; the policy is the Rules block's, the choices' labels,
// narration and effects the form's. Every write is the generic card's (useCard).
import { useState } from 'react';
import { addable, allowed, choices } from '../../../../../kernel/ts/play/card.ts';
import { refuseLink } from '../../../../../kernel/ts/play/link.ts';
import type { useDiagnostics } from '../../author.ts';
import { Input } from '../../components/ui/input.tsx';
import type { Context } from '../fields.tsx';
import { Header, useCard } from '../Generic.tsx';
import { Refusal } from '../templates.tsx';
import registry from '../registry.json';
import { adder, Mechanics, RoomForm, useCartridge, Words } from './Room.tsx';

const WORDS = ['name', 'prompt'];
const DEF = 'source.DialogueDefinition';
const LINKS = ['then', 'then_failed'] as const;

type Props = { rel: string; context: Context; diag: ReturnType<typeof useDiagnostics> };
type Card = ReturnType<typeof useCard>;
type Doc = Record<string, unknown>;

export function Dialogue({ rel, context, diag }: Props) {
  const card = useCard(rel, diag);
  const { saved } = card;
  const draft = (card.draft ?? {}) as Doc;
  const defs = (saved?.schema as { $defs?: Record<string, never> } | undefined)?.$defs ?? {};
  const cart = useCartridge(diag);
  if (!saved) return <p className="px-3 text-xs text-muted-foreground">Loading {rel}</p>;
  const caps = cart && (cart.requires?.capabilities ?? {});
  const offered = addable(saved.dir, registry, draft, card.revealed);
  const menu = caps ? allowed(saved.dir, offered, caps, draft, cart?.world) : [];
  const required = ((defs[DEF] as { required?: string[] } | undefined)?.required ?? []) as string[];
  const words = WORDS.filter((f) => draft[f] !== undefined);
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 px-3 text-xs" aria-label="dialogue card">
      <Header rel={rel} diag={diag} undo={card.undo ? card.back : undefined} />
      {card.refused ? <Refusal boxed>{card.refused}</Refusal> : null}
      <Words draft={draft} context={context} fields={words} />
      <Links card={card} keys={choices('dialogue', context.nodes)} />
      <Mechanics
        card={card}
        menu={menu}
        add={adder(card, defs, DEF)}
        fixed={required} // a name is removable
      />
      <RoomForm
        rel={rel}
        card={card}
        context={context}
        diag={diag}
        defs={defs}
        own={words}
        nested={{ choices: [...LINKS] }}
      />
    </div>
  );
}

/** Each choice's `then` and, with a check (or one already written), `then_failed`. */
function Links({ card, keys }: { card: Card; keys: string[] }) {
  const draft = card.draft as Doc;
  const all = (draft.choices ?? {}) as Record<string, Doc>;
  const rows = Object.entries(all).flatMap(([k, c]) =>
    LINKS.filter((f) => f === 'then' || c.check !== undefined || c[f] !== undefined).map(
      (f) => [k, f] as const,
    ),
  );
  if (!rows.length) return null;
  return (
    <section aria-label="links" className="grid gap-1">
      <h3 className="text-muted-foreground">Links</h3>
      {rows.map(([k, f]) => (
        <Link key={`${k}.${f}`} card={card} choice={k} field={f} keys={keys} />
      ))}
      <datalist id="dialogue-keys">
        {[...keys, 'end'].map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
    </section>
  );
}

type LinkProps = { card: Card; choice: string; field: (typeof LINKS)[number]; keys: string[] };

/** One link: a refused target is shown, never sent; a cleared one removes the field. */
function Link({ card, choice, field, keys }: LinkProps) {
  const [bad, setBad] = useState<string>();
  const draft = card.draft as Doc;
  const all = (draft.choices ?? {}) as Record<string, Doc>;
  const value = bad ?? all[choice]?.[field] ?? '';
  const refused = bad && refuseLink(field, bad, all[choice], draft, keys);
  const write = (v: string) => {
    const { [field]: _, ...rest } = all[choice];
    return { ...draft, choices: { ...all, [choice]: v ? { ...rest, [field]: v } : rest } };
  };
  return (
    <label className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2">
      <span className="text-muted-foreground">
        {choice} {field}
      </span>
      <Input
        aria-label={`${choice} ${field}`}
        aria-invalid={!!refused}
        list="dialogue-keys"
        className="h-7 text-xs"
        value={String(value)}
        onChange={(e) => {
          const v = e.target.value;
          const no = refuseLink(field, v, all[choice], draft, keys);
          setBad(no ? v : undefined);
          if (!no) card.change(write(v)); // a refused keystroke leaves the draft as it was
        }}
        onBlur={() => (setBad(undefined), card.commit())}
      />
      {refused ? <Refusal>{refused}</Refusal> : null}
    </label>
  );
}
