// The NPC and Item cards (docs/rnd/gui-editor-design-2026-11-04.md §6, E6b): the words open in the
// Book, the placement takes a room, NPC or container picker, the mechanics are added and removed; the combat numbers,
// schedule and offer table are the form's (pickers by kind, rows added, removed and moved). Every
// write is the generic card's (useCard: POST /change, Undo, Hold, refusals at the field).
import { useState } from 'react';
import {
  addable,
  allowed,
  choices,
  placed,
  placement,
  refusePick,
} from '../../../../../kernel/ts/play/card.ts';
import type { useDiagnostics } from '../../author.ts';
import { Input } from '../../components/ui/input.tsx';
import type { Context } from '../fields.tsx';
import { Header, useCard } from '../Generic.tsx';
import { Refusal } from '../templates.tsx';
import registry from '../registry.json';
import { adder, Mechanics, RoomForm, useCartridge, Words } from './Room.tsx';

const WORDS = ['name', 'room_line', 'description'];
const DEF: Record<string, string> = {
  npcs: 'source.NpcDefinition',
  items: 'source.ItemDefinition',
};

type Props = { rel: string; context: Context; diag: ReturnType<typeof useDiagnostics> };
type Card = ReturnType<typeof useCard>;
type Doc = Record<string, unknown>;

export function Entity({ rel, context, diag }: Props) {
  const card = useCard(rel, diag);
  const { saved } = card;
  const draft = (card.draft ?? {}) as Doc;
  const defs = (saved?.schema as { $defs?: Record<string, never> } | undefined)?.$defs ?? {};
  const cart = useCartridge(diag);
  if (!saved) return <p className="px-3 text-xs text-muted-foreground">Loading {rel}</p>;
  const def = DEF[saved.dir];
  const at = saved.dir === 'npcs' ? 'room' : 'location';
  const caps = cart && (cart.requires?.capabilities ?? {});
  const offered = addable(saved.dir, registry, draft, card.revealed);
  const menu = caps ? allowed(saved.dir, offered, caps, draft, cart?.world) : [];
  const required = ((defs[def] as { required?: string[] } | undefined)?.required ?? []) as string[];
  return (
    <div
      className="grid min-w-0 grid-cols-1 gap-2 px-3 text-xs"
      aria-label={`${context.kind} card`}
    >
      <Header rel={rel} diag={diag} undo={card.undo ? card.back : undefined} />
      {card.refused ? <Refusal boxed>{card.refused}</Refusal> : null}
      <Words draft={draft} context={context} fields={WORDS} />
      <Placement card={card} dir={saved.dir} nodes={context.nodes} />
      <Mechanics
        card={card}
        menu={menu}
        add={adder(card, defs, def)}
        fixed={[...WORDS, at, ...required]}
      />
      <RoomForm
        rel={rel}
        card={card}
        context={context}
        diag={diag}
        defs={defs}
        own={[...WORDS, at]}
      />
    </div>
  );
}

/** Where the definition starts, as the file says: an NPC's room; an item's room, NPC or container,
 * each with its kind's picker. A template shows no picker. */
function Placement({ card, dir, nodes }: { card: Card; dir: string; nodes: Context['nodes'] }) {
  const draft = card.draft as Doc;
  const now = placement(draft, dir);
  const [chosen, choose] = useState<string>(); // a kind picked, until its key is entered
  if (draft.spawn_template !== undefined) return null;
  const kind = chosen ?? now.kind;
  return (
    <section aria-label="Placement" className="grid gap-1">
      <h3 className="font-medium">Placement</h3>
      {now.kind === 'template' ? (
        <p className="text-muted-foreground">template</p>
      ) : (
        <div className="flex gap-1">
          {dir === 'items' ? <Kinds value={kind} pick={choose} /> : null}
          <Holder
            key={kind}
            card={card}
            dir={dir}
            pick={{ kind, keys: choices(kind, nodes) }}
            value={kind === now.kind ? now.key : ''}
            done={() => choose(undefined)}
          />
        </div>
      )}
    </section>
  );
}

type Pick = { kind: string; keys: string[] };
type HolderProps = { card: Card; dir: string; pick: Pick; value: unknown; done: () => void };

/** The holder's key, offered from the story's nodes of its kind: an unknown key is refused at the
 * field, never written; leaving the field shows the file's placement again. */
function Holder({ card, dir, pick, value, done }: HolderProps) {
  const [bad, setBad] = useState<string>(); // a refused key: shown, never sent
  const draft = card.draft as Doc;
  const [kept, keep] = useState(draft); // the draft at focus: a refused keystroke puts it back
  const shown = bad ?? value;
  const refused = bad && refusePick(pick, bad);
  return (
    <div className="grid min-w-0 flex-1 gap-1">
      <Input
        aria-label={pick.kind}
        aria-invalid={!!refused}
        list="placement-keys"
        className="h-7 text-xs"
        value={typeof shown === 'string' ? shown : shown ? JSON.stringify(shown) : ''}
        onChange={(e) => {
          const v = e.target.value;
          const no = refusePick(pick, v);
          setBad(no || !v ? v : undefined);
          card.change(v && !no ? placed(draft, dir, pick.kind, v) : kept);
        }}
        onFocus={() => keep(draft)}
        onBlur={() => (setBad(undefined), done(), card.commit())}
      />
      <datalist id="placement-keys">
        {pick.keys.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      {refused ? <Refusal>{refused}</Refusal> : null}
    </div>
  );
}

/** An item's holder kind: a room, an NPC, a container (ItemLocation). */
function Kinds({ value, pick }: { value: string; pick: (kind: string) => void }) {
  return (
    <select
      aria-label="placed in"
      className="form-control"
      value={value}
      onChange={(e) => pick(e.target.value)}
    >
      {['room', 'npc', 'item'].map((k) => (
        <option key={k} value={k}>
          {k}
        </option>
      ))}
    </select>
  );
}
