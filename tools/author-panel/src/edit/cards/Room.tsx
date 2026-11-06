// The Room card (docs/rnd/gui-editor-design-2026-11-04.md §6, E6a): the room's words open in the
// Book, its exits take the map's edits, its mechanics are added (here or from the Book) and removed;
// every write is the generic card's (useCard: POST /change, Undo, Hold, refusals at the field).
import { Fragment, useEffect, useState } from 'react';
import {
  addable,
  added,
  addedHere,
  allowed,
  hidden,
  proseKey,
  removed,
} from '../../../../../kernel/ts/play/card.ts';
import { uiSchema } from '../../../../../kernel/ts/play/ui_schema.ts';
import type { useDiagnostics } from '../../author.ts';
import { addHere } from '../../book.ts';
import { Button } from '../../components/ui/button.tsx';
import { mapCommand } from '../../mapwire.ts';
import type { Context } from '../fields.tsx';
import { AddMenu, CardForm, Header, useCard } from '../Generic.tsx';
import { Refusal } from '../templates.tsx';
import registry from '../registry.json';

const OWN = ['name', 'description', 'exits']; // drawn above the form
const HIDE = { 'ui:field': 'Hidden', 'ui:widget': 'hidden' };
const EXIT_EDITS = [
  ['map-unlink', 'Unlink'],
  ['map-one-way', 'One-way'],
  ['map-door', 'Door'],
  ['map-lock', 'Lock'],
] as const;

type Props = {
  rel: string;
  context: Context;
  diag: ReturnType<typeof useDiagnostics>;
  offer: (add: string[]) => void;
};
type Card = ReturnType<typeof useCard>;
type Doc = Record<string, unknown> & {
  exits?: Record<string, { to?: string | { key: string }; barrier?: string }>; // `to` may come from extends
};

export function Room({ rel, context, diag, offer }: Props) {
  const card = useCard(rel, diag);
  const { saved } = card;
  const draft = (card.draft ?? {}) as Doc;
  const defs = (saved?.schema as { $defs?: Record<string, never> } | undefined)?.$defs ?? {};
  const caps = useCapabilities(diag);
  const menu = saved && caps ? allowed(saved.dir, addable(saved.dir, registry, draft, card.revealed), caps) : [];
  /** Writes the field's least value (its words `~`); one the author must choose is only revealed. */
  const add = (f: string) => {
    const next = added(draft, f, defs, 'source.RoomDefinition');
    card.reveal(f);
    if (next) (card.change(next), card.commit());
  };
  useEffect(() => void (saved && offer(menu)), [rel, !!saved, menu.join()]);
  useEffect(() => () => offer([]), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    addHere.run = (a) => {
      const f = addedHere(a, context.key, menu);
      if (f) add(f);
    };
    return () => void (addHere.run = () => {});
  });
  if (!saved) return <p className="px-3 text-xs text-muted-foreground">Loading {rel}</p>;
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 px-3 text-xs" aria-label="Room card">
      <Header rel={rel} diag={diag} undo={card.undo ? card.back : undefined} />
      {card.refused ? <Refusal boxed>{card.refused}</Refusal> : null}
      <Words draft={draft} context={context} />
      <Exits room={context.key} exits={draft.exits ?? {}} />
      <Mechanics card={card} menu={menu} add={add} />
      <RoomForm rel={rel} card={card} context={context} diag={diag} defs={defs} />
    </div>
  );
}

/** Each exit with the map's edits for it (mapwire's commands, the direction given). */
function Exits({ room, exits }: { room: string; exits: NonNullable<Doc['exits']> }) {
  return (
    <section aria-label="Exits" className="grid gap-1">
      <h3 className="font-medium">Exits</h3>
      {Object.entries(exits).map(([dir, exit]) => (
        <div key={dir} className="flex flex-wrap items-center gap-1">
          <span className="min-w-0 flex-1 truncate">
            {dir} → {typeof exit.to === 'string' ? exit.to : exit.to?.key}
            {exit.barrier ? ` (${exit.barrier})` : ''}
          </span>
          {EXIT_EDITS.map(([id, label]) => (
            <Button
              key={id}
              type="button"
              size="xs"
              variant="outline"
              onClick={() => mapCommand(id, room, dir)}
            >
              {label}
            </Button>
          ))}
        </div>
      ))}
    </section>
  );
}

/** The present mechanics, each removable, and the registry's add menu. */
function Mechanics({ card, menu, add }: { card: Card; menu: string[]; add: (f: string) => void }) {
  const draft = card.draft as Doc;
  const remove = (f: string) => (card.unreveal(f), card.change(removed(draft, f)), card.commit());
  return (
    <section aria-label="Mechanics" className="grid gap-1">
      <h3 className="font-medium">Mechanics</h3>
      {Object.keys(draft)
        .filter((f) => !OWN.includes(f))
        .map((f) => (
          <div key={f} className="flex items-center gap-1">
            <span className="flex-1">{f}</span>
            <Button type="button" size="xs" variant="outline" onClick={() => remove(f)}>
              Remove
            </Button>
          </div>
        ))}
      <AddMenu fields={menu} reveal={add} />
    </section>
  );
}

/** The other fields: the generic form, with the room's own fields drawn above hidden. */
function RoomForm({
  rel,
  card,
  context,
  diag,
  defs,
}: Omit<Props, 'offer'> & { card: Card; defs: Record<string, never> }) {
  const saved = card.saved!;
  const ui = hidden(
    uiSchema(saved.dir, saved.schema as never, defs, {}),
    saved.dir,
    registry,
    card.draft,
    card.revealed,
  );
  for (const f of OWN) ui[f] = HIDE;
  // a field's grid track sizes to a long text key; minmax(0,1fr) lets it truncate inside the inspector
  return (
    <div className="min-w-0 [&_.grid]:grid-cols-[minmax(0,1fr)]">
      <CardForm rel={rel} card={card} context={context} diag={diag} ui={ui} />
    </div>
  );
}

/** The cartridge's `requires.capabilities`, read again when cartridge.json changes. */
function useCapabilities(diag: Props['diag']) {
  const [caps, setCaps] = useState<object>();
  const sha = diag.changes.find((c) => c.file === 'cartridge.json')?.sha256;
  useEffect(() => {
    void fetch('/__author/source?file=cartridge.json')
      .then((r) => r.json())
      .then((s) => setCaps(JSON.parse(s.bytes).requires?.capabilities ?? {}));
  }, [sha]);
  return caps;
}

/** The room's words as text keys; Edit opens each line in the Book (agents write no words). */
function Words({ draft, context }: { draft: Doc; context: Context }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
      {['name', 'description'].map((f) => {
        const key = proseKey(draft[f], context.kind, context.key, [f]);
        return (
          <Fragment key={f}>
            <dt className="text-muted-foreground">{f}</dt>
            <dd className="truncate font-mono">{key}</dd>
            <Button type="button" size="xs" variant="outline" onClick={() => context.edit(key)}>
              Edit in Book
            </Button>
          </Fragment>
        );
      })}
    </dl>
  );
}
