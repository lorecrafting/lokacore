// The Room card (docs/rnd/gui-editor-design-2026-11-04.md §6, E6a): the room's words open in the
// Book, its exits take the map's edits, its mechanics are added (here or from the Book) and removed;
// every write is the generic card's (useCard: POST /change, Undo, Hold, refusals at the field).
import { Fragment, type ReactNode, useEffect, useState } from 'react';
import type { FieldProps } from '@rjsf/utils';
import {
  addable,
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
import { fields, type Context } from '../fields.tsx';
import { AddMenu, CardForm, Header, adder, useCard } from '../Generic.tsx';
import { Refusal } from '../templates.tsx';
import registry from '../registry.json';

const OWN = ['name', 'description', 'exits']; // drawn above the form
export const HIDE = { 'ui:field': 'Hidden', 'ui:widget': 'hidden' };
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
  const cart = useCartridge(diag);
  const menu =
    saved && cart
      ? allowed(
          saved.dir,
          addable(saved.dir, registry, draft, card.revealed),
          cart.requires?.capabilities ?? {},
        )
      : [];
  const add = adder(card, defs, 'source.RoomDefinition');
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
      <Words draft={draft} context={context} fields={['name', 'description']} />
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

/** The present mechanics, each removable (but the `fixed` ones), and the registry's add menu. */
export function Mechanics({
  card,
  menu,
  add,
  fixed = OWN,
}: {
  card: Card;
  menu: string[];
  add: (f: string) => void;
  fixed?: string[];
}) {
  const draft = card.draft as Doc;
  const remove = (f: string) => (card.unreveal(f), card.change(removed(draft, f)), card.commit());
  return (
    <section aria-label="Mechanics" className="grid gap-1">
      <h3 className="font-medium">Mechanics</h3>
      {Object.keys(draft)
        .filter((f) => !fixed.includes(f))
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

export { adder } from '../Generic.tsx';

/** The other fields: the generic form, with the card's `own` fields (drawn above) hidden. */
export function RoomForm({
  rel,
  card,
  context,
  diag,
  defs,
  own = OWN,
  blocks = {},
  extra = {},
}: Omit<Props, 'offer'> & {
  card: Card;
  defs: Record<string, never>;
  own?: string[];
  blocks?: Record<string, string>; // a field drawn by its block (fields.tsx), when present or added
  extra?: Record<string, (p: FieldProps) => ReactNode>; // a field the card draws itself, by its name
}) {
  const saved = card.saved!;
  const walked = uiSchema(saved.dir, saved.schema as never, defs, {});
  for (const [f, block] of Object.entries(blocks)) walked[f] = { ...walked[f], 'ui:field': block };
  const ui = hidden(walked, saved.dir, registry, card.draft, card.revealed);
  // a union-rooted kind (a scene) draws its branch's uiSchema, not the root's (rjsf MultiSchemaField)
  for (const at of [ui, ...(ui.anyOf ?? [])]) for (const f of own) at[f] = HIDE;
  for (const f of Object.keys(extra)) ui[f] = { ...ui[f], 'ui:field': f }; // its items' widgets kept
  return (
    <CardForm
      rel={rel}
      card={card}
      context={context}
      diag={diag}
      ui={ui}
      fields={{ ...fields, ...extra }}
    />
  );
}

/** cartridge.json (its `requires.capabilities` and `world`), read again when it changes. */
export function useCartridge(diag: Props['diag']) {
  return useSource(diag, 'cartridge.json') as
    | { requires?: { capabilities?: object }; world?: Doc; calendar?: { hours_per_day?: number } }
    | undefined;
}

/** A `.json` source `file`'s document, read again on each write to it (undefined: none). */
export function useSource(diag: Props['diag'], file?: string) {
  const [got, setGot] = useState<[string, Doc]>(); // the file read: a slower earlier read shows under no other
  const sha = diag.changes.find((c) => c.file === file)?.sha256;
  useEffect(() => {
    if (file?.endsWith('.json'))
      void fetch(`/__author/source?file=${encodeURIComponent(file)}`)
        .then((r) => r.json())
        .then((s) => setGot([file, JSON.parse(s.bytes)]));
  }, [file, sha]);
  return got && got[0] === file ? got[1] : undefined;
}

/** The definition's words as text keys; Edit opens each line in the Book (agents write no words). */
export function Words({
  draft,
  context,
  fields,
}: {
  draft: Doc;
  context: Context;
  fields: string[];
}) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
      {fields.map((f) => {
        const key = proseKey(draft[f], context.kind, context.key, [f]);
        return (
          <Fragment key={f}>
            <dt className="text-muted-foreground">{f}</dt>
            <dd className="truncate font-mono">{key}</dd>
            <dd>
              <Button type="button" size="xs" variant="outline" onClick={() => context.edit(key)}>
                Edit in Book
              </Button>
            </dd>
          </Fragment>
        );
      })}
    </dl>
  );
}
