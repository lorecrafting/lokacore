// The NPC and Item cards (docs/rnd/gui-editor-design-2026-11-04.md §6, E6b): the words open in the
// Book, the placement takes a room picker, the mechanics are added and removed; the combat numbers,
// schedule and offer table are the form's (pickers by kind, rows added, removed and moved). Every
// write is the generic card's (useCard: POST /change, Undo, Hold, refusals at the field).
import { useState } from 'react';
import {
  addable,
  added,
  allowed,
  choices,
  placed,
  refusePick,
} from '../../../../../kernel/ts/play/card.ts';
import type { useDiagnostics } from '../../author.ts';
import { Input } from '../../components/ui/input.tsx';
import type { Context } from '../fields.tsx';
import { Header, useCard } from '../Generic.tsx';
import { Refusal } from '../templates.tsx';
import registry from '../registry.json';
import { Mechanics, RoomForm, useCapabilities, Words } from './Room.tsx';

const WORDS = ['name', 'room_line', 'description'];
const DEF: Record<string, string> = {
  npcs: 'source.NpcDefinition',
  items: 'source.ItemDefinition',
};

type Props = { rel: string; context: Context; diag: ReturnType<typeof useDiagnostics> };
type Card = ReturnType<typeof useCard>;
type Doc = Record<string, unknown> & {
  location?: { in?: string; room?: unknown; npc?: unknown; item?: unknown };
};

export function Entity({ rel, context, diag }: Props) {
  const card = useCard(rel, diag);
  const { saved } = card;
  const draft = (card.draft ?? {}) as Doc;
  const defs = (saved?.schema as { $defs?: Record<string, never> } | undefined)?.$defs ?? {};
  const caps = useCapabilities(diag);
  if (!saved) return <p className="px-3 text-xs text-muted-foreground">Loading {rel}</p>;
  const def = DEF[saved.dir];
  const at = saved.dir === 'npcs' ? 'room' : 'location';
  const menu = caps
    ? allowed(saved.dir, addable(saved.dir, registry, draft, card.revealed), caps)
    : [];
  const add = (f: string) => {
    const next = added(draft, f, defs, def);
    card.reveal(f);
    if (next) (card.change(next), card.commit());
  };
  const required = ((defs[def] as { required?: string[] } | undefined)?.required ?? []) as string[];
  return (
    <div
      className="grid min-w-0 grid-cols-1 gap-2 px-3 text-xs"
      aria-label={`${context.kind} card`}
    >
      <Header rel={rel} diag={diag} undo={card.undo ? card.back : undefined} />
      {card.refused ? <Refusal boxed>{card.refused}</Refusal> : null}
      <Words draft={draft} context={context} fields={WORDS} />
      <Placement card={card} dir={saved.dir} rooms={choices('room', context.nodes)} />
      <Mechanics card={card} menu={menu} add={add} fixed={[...WORDS, at, ...required]} />
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

/** Where the definition starts: a room picker (an unknown room is refused, never written); an item
 * held by an NPC or another item names its holder and moves to the room picked. */
function Placement({ card, dir, rooms }: { card: Card; dir: string; rooms: string[] }) {
  const [bad, setBad] = useState<string>(); // a refused room: shown, never sent
  const draft = card.draft as Doc;
  const loc = draft.location;
  if (draft.spawn_template !== undefined || loc?.in === 'template') return null;
  const room = dir === 'npcs' ? draft.room : loc?.in === 'room' ? loc.room : undefined;
  const holder =
    loc && loc.in !== 'room' ? `${loc.in} ${JSON.stringify(loc[loc.in as 'npc'])}` : '';
  const refused = bad && refusePick({ kind: 'room', keys: rooms }, bad);
  return (
    <section aria-label="Placement" className="grid gap-1">
      <h3 className="font-medium">Placement</h3>
      {holder ? <p className="truncate text-muted-foreground">held by {holder}</p> : null}
      <Input
        aria-label="room"
        aria-invalid={!!refused}
        list="placement-rooms"
        className="h-7 text-xs"
        value={bad ?? (typeof room === 'string' ? room : room ? JSON.stringify(room) : '')}
        onChange={(e) => {
          const v = e.target.value;
          const no = refusePick({ kind: 'room', keys: rooms }, v);
          setBad(no || !v ? v : undefined);
          if (v && !no) card.change(placed(draft, dir, v));
        }}
        onBlur={card.commit}
      />
      <datalist id="placement-rooms">
        {rooms.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      {refused ? <Refusal>{refused}</Refusal> : null}
    </section>
  );
}
