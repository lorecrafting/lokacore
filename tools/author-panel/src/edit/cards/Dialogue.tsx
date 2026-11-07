// The Dialogue card (docs/rnd/gui-editor-design-2026-11-04.md §4.4, E6d): the name and prompt open
// in the Book, each choice's links (then, then_failed) pick a dialogue or `end` as the compiler links
// them, the mechanics are added and removed; the choices are a tree of folded blocks (Choices), the
// policy the Rules block's. Every write is the generic card's (useCard), each first held to what the
// compiler accepts of a dialogue's choices (kernel/ts/play/choice.ts).
import { useState } from 'react';
import { addable, allowed, choices } from '../../../../../kernel/ts/play/card.ts';
import { refuseNew } from '../../../../../kernel/ts/play/choice.ts';
import { refuseLink } from '../../../../../kernel/ts/play/link.ts';
import type { useDiagnostics } from '../../author.ts';
import { Input } from '../../components/ui/input.tsx';
import type { Context } from '../fields.tsx';
import { adding, Header, useCard, useCartridge } from '../Generic.tsx';
import { Refusal } from '../templates.tsx';
import registry from '../registry.json';
import { Choices, LINKS, Tree } from './Choices.tsx';
import { Mechanics, RoomForm, Words } from './Room.tsx';

const WORDS = ['name', 'prompt'];
const DEF = 'source.DialogueDefinition';

type Props = { rel: string; context: Context; diag: ReturnType<typeof useDiagnostics> };
type Card = ReturnType<typeof useCard>;
type Doc = Record<string, unknown>;
type Cart = ReturnType<typeof useCartridge>;

/** The card whose change is refused when it makes a dialogue's choices not compile anew. */
function useGated(base: Card, hidden: string[]) {
  const [no, setNo] = useState<string>();
  const [resets, setResets] = useState(0); // a refused form edit remounts the form on the draft
  const card: Card = {
    ...base,
    change: (doc) => {
      const why = refuseNew((base.draft ?? {}) as Doc, doc as Doc, hidden);
      setNo(why);
      if (why) setResets((n) => n + 1);
      else base.change(doc);
    },
  };
  return { card, no, resets };
}

/** The fields the Mechanics menu offers: allowed, and none that a choice refuses (a quest beside a
 * choice's accept). */
function mechanics(dir: string, cart: Cart, caps: object | undefined, draft: Doc, revealed: string[], hidden: string[]) {
  const offered = addable(dir, registry, draft, revealed);
  return (caps ? allowed(dir, offered, caps, draft, cart?.world, hidden) : []).filter(
    (f) => !refuseNew(draft, { ...draft, [f]: true }, hidden),
  );
}

export function Dialogue({ rel, context, diag }: Props) {
  const hidden = context.hidden ?? [];
  const { card, no, resets } = useGated(useCard(rel, diag), hidden);
  const { saved } = card;
  const draft = (card.draft ?? {}) as Doc;
  const defs = (saved?.schema as { $defs?: Record<string, never> } | undefined)?.$defs ?? {};
  const cart = useCartridge(diag);
  const caps = cart && (cart.requires?.capabilities ?? {});
  if (!saved) return <p className="px-3 text-xs text-muted-foreground">Loading {rel}</p>;
  const menu = mechanics(saved.dir, cart, caps, draft, card.revealed, hidden);
  const required = ((defs[DEF] as { required?: string[] } | undefined)?.required ?? []) as string[];
  const words = WORDS.filter((f) => draft[f] !== undefined);
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 px-3 text-xs" aria-label="dialogue card">
      <Header rel={rel} diag={diag} undo={card.undo ? card.back : undefined} />
      {card.refused ? <Refusal boxed>{card.refused}</Refusal> : null}
      {no ? <Refusal boxed>{no}</Refusal> : null}
      <Words draft={draft} context={context} fields={words} />
      <Links card={card} keys={choices('dialogue', context.nodes)} into={context.unlinkable} />
      <Mechanics
        card={card}
        menu={menu}
        {...adding(card, defs, DEF)}
        fixed={required} // a name is removable
      />
      <Tree.Provider value={{ card, defs, hidden, caps, context, diag }}>
        <RoomForm
          key={resets}
          rel={rel}
          card={card}
          context={context}
          diag={diag}
          defs={defs}
          own={words}
          extra={{ choices: Choices }}
        />
      </Tree.Provider>
    </div>
  );
}

/** Each choice's `then` and, with a check (or one already written), `then_failed`. */
function Links({
  card,
  keys,
  into = {},
}: {
  card: Card;
  keys: string[];
  into?: Record<string, string>;
}) {
  const draft = card.draft as Doc;
  const all = (draft.choices ?? {}) as Record<string, Doc>;
  const rows = Object.entries(all).flatMap(([k, c]) =>
    LINKS.filter((f) => f === 'then' || c.check !== undefined || c[f] !== undefined).map(
      (f) => [k, f] as const,
    ),
  );
  return (
    <section aria-label="links" className="grid gap-1">
      <h3 className="text-muted-foreground">Links</h3>
      {rows.map(([k, f]) => (
        <Link key={`${k}.${f}`} card={card} choice={k} field={f} keys={keys} into={into} />
      ))}
      <datalist id="dialogue-keys">
        {[...keys.filter((k) => !Object.hasOwn(into, k)), 'end'].map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
    </section>
  );
}

type LinkProps = {
  card: Card;
  choice: string;
  field: (typeof LINKS)[number];
  keys: string[];
  into: Record<string, string>;
};

/** One link: a refused target is shown, never sent; a cleared one removes the field. */
function Link({ card, choice, field, keys, into }: LinkProps) {
  const [bad, setBad] = useState<string>();
  const draft = card.draft as Doc;
  const all = (draft.choices ?? {}) as Record<string, Doc>;
  const value = bad ?? all[choice]?.[field] ?? '';
  const refused = bad && refuseLink(field, bad, all[choice], draft, keys, into);
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
          const no = refuseLink(field, v, all[choice], draft, keys, into);
          setBad(no ? v : undefined);
          if (!no) card.change(write(v)); // a refused keystroke leaves the draft as it was
        }}
        onBlur={() => (setBad(undefined), card.commit())}
      />
      {refused ? <Refusal>{refused}</Refusal> : null}
    </label>
  );
}
