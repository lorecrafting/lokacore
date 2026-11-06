// The generic inspector card (docs/rnd/gui-editor-design-2026-11-04.md §6, §11): rjsf draws the
// definition's own file from its served schema; each blur posts the changed fields to
// POST /change (kernel/ts/play/write.ts), Undo posts /undo, the compiler's refusals show at their field.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Form from '@rjsf/core';
import type { RegistryFieldsType, RJSFSchema, UiSchema } from '@rjsf/utils';
import type { Op } from '../../../../kernel/ts/play/edit_model.ts';
import { customizeValidator } from '@rjsf/validator-ajv8';
import { Ajv2020 } from 'ajv/dist/2020.js';
import {
  FORM_DEFAULTS,
  added,
  apart,
  awaits,
  applied,
  cardMenu,
  definitionOf,
  diff,
  fieldErrors,
  hidden,
  rebase,
  status,
} from '../../../../kernel/ts/play/card.ts';
import { uiSchema } from '../../../../kernel/ts/play/ui_schema.ts';
import { capabilityRow } from '../../../../kernel/ts/play/allowed.ts';
import { ask, type useDiagnostics } from '../author.ts';
import { Button } from '../components/ui/button.tsx';
import { fields, type Context } from './fields.tsx';
import { Refusal, templates } from './templates.tsx';
import registry from './registry.json';

const validator = customizeValidator({ AjvClass: Ajv2020 });
type Saved = { doc: unknown; sha256: string; dir: string; schema: RJSFSchema };
type Sent = { ops?: Op[]; [k: string]: unknown }; // the /change or /undo body

type Diag = ReturnType<typeof useDiagnostics>;

// The last write's undo id per file: reselecting a card keeps it (the server refuses a stale one).
const undos = new Map<string, string>();
function useUndo(rel: string) {
  const [, tick] = useState({}); // a fresh object re-renders
  const set = (id?: string) =>
    void (id ? undos.set(rel, id) : undos.delete(rel), tick({}));
  return [undos.get(rel), set] as const;
}

/** The schema's errors in `doc` the saved file does not already have: only those hold (PR 675). */
function fresh(saved: Saved, doc: unknown) {
  // rjsf's own live errors would name its `{}` fills; the schema's first error shows on top instead
  const errors = (d: unknown) => validator.validateFormData(d, saved.schema).errors;
  const was = errors(saved.doc).map((e) => e.stack);
  return errors(doc).filter((e) => !was.includes(e.stack));
}

async function source(rel: string): Promise<Saved> {
  const s = await fetch(`/__author/source?file=${encodeURIComponent(rel)}`).then((r) => r.json());
  const schema = await fetch(`/__author/schema/${s.kind}`).then((r) => r.json());
  return { doc: JSON.parse(s.bytes), sha256: s.sha256, dir: s.kind, schema };
}

/** The card's file: loaded, and reloaded on a write from outside (the Book's in-place edit too). */
function useFile(rel: string, diag: Diag) {
  const [saved, setSaved] = useState<Saved>();
  const [draft, setDraft] = useState<unknown>();
  const [refused, setRefused] = useState<string>(); // the server's: stays until the next write
  const latest = useRef<unknown>(undefined);
  const load = useCallback(
    async (base?: unknown, sent: Op[] = []) => {
      const s = await source(rel).catch((e: Error) => void setRefused(`${rel} not loaded: ${e.message}`));
      if (s) (setSaved(s), setDraft((latest.current = rebase(base, latest.current, s.doc, sent)))); // keeps edits not yet sent
    },
    [rel],
  );
  useEffect(() => void load(), [load]);
  const outside = diag.changes.find((c) => c.file === rel);
  useEffect(() => {
    if (saved && outside?.file === rel && outside.sha256 !== saved.sha256) void load(saved.doc);
  }, [outside]); // eslint-disable-line react-hooks/exhaustive-deps
  return { saved, draft, setDraft, refused, setRefused, latest, load };
}

/** The card's file, changed by a blur and undone. */
export function useCard(rel: string, diag: Diag) {
  const { saved, draft, setDraft, refused, setRefused, latest, load } = useFile(rel, diag);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [undo, setUndo] = useUndo(rel);
  const [held, setHeld] = useState<string>(); // the schema's first new error: the draft not sent
  useEffect(() => void (setRevealed([]), setHeld(undefined)), [rel]); // a new file starts with nothing revealed
  const post = async (path: string, sent: Sent, otherwise: string) => {
    const { ok, told } = await ask(path, sent);
    setRefused(ok ? undefined : typeof told === 'string' ? told : otherwise);
    // a refused change wrote nothing, so the last write's Undo still stands
    if (ok || path === 'undo')
      setUndo(ok && path === 'change' ? (told as { id: string }).id : undefined);
    await load(saved!.doc, sent.ops);
  };
  const commit = () => {
    if (!saved) return;
    const errors = fresh(saved, latest.current);
    setHeld(errors[0] && `${errors[0].property} ${errors[0].message}`);
    const ops = apart(diff(saved.doc, latest.current), errors);
    if (ops.length)
      void post('change', { file: rel, was: saved.sha256, ops }, 'Changed outside: reloaded.');
  };
  const change = (doc: unknown) => setDraft((latest.current = applied(saved!.doc, doc)));
  // Undo drops the held draft too: rebasing it onto the undone file would put the refusal straight back
  const back = () =>
    void (setHeld(undefined),
    (latest.current = saved!.doc),
    post('undo', { id: undo }, 'Changed since: not undone.'));
  const reveal = (f: string) => setRevealed([...revealed, f]);
  const unreveal = (f: string) => setRevealed(revealed.filter((r) => r !== f)); // back in the add menu
  const card = { saved, draft, revealed, undo, change, commit, back, reveal, unreveal };
  return { ...card, refused: held ?? refused };
}

/** The registry's fields this definition lacks: choosing one reveals its empty field. */
export function AddMenu({
  fields: menu,
  reveal,
}: {
  fields: string[];
  reveal: (f: string) => void;
}) {
  if (!menu.length) return null;
  return (
    <select
      aria-label="Add a field"
      className="form-control"
      value=""
      onChange={(e) => reveal(e.target.value)}
    >
      <option value="">Add…</option>
      {menu.map((f) => (
        <option key={f} value={f}>
          {f}
        </option>
      ))}
    </select>
  );
}

/** The file, the compile state (held, compiling, stale) and Undo of the last change. */
export function Header({ rel, diag, undo }: { rel: string; diag: Diag; undo?: () => void }) {
  const label = status(!!diag.held, !!diag.pending, diag.compiled);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate text-muted-foreground">{rel}</code>
      {label ? (
        <span className={label === 'held' ? 'text-warning' : 'text-muted-foreground'}>{label}</span>
      ) : null}
      <Button type="button" size="xs" variant="outline" disabled={!undo} onClick={undo}>
        Undo
      </Button>
    </div>
  );
}

type Card = ReturnType<typeof useCard>;
type FormProps = {
  rel: string;
  card: Card;
  context: Context;
  diag: Diag;
  ui: UiSchema;
  fields?: RegistryFieldsType;
};

/** The card's form: rjsf draws the file under `ui`, each blur commits, refusals at their field. */
export function CardForm({ rel, card, context, diag, ui, fields: picks = fields }: FormProps) {
  // rjsf keeps an added row's key in its own state: a renamed row redraws
  const [rows, remount] = useReducer((n: number) => n + 1, 0); // mutate-skip: a redraw key; any start or step redraws
  const change = (doc: unknown, row = capabilityRow(doc as never)) =>
    void (row !== doc && remount(), card.change(row));
  return (
    // after the blur's own change lands: rjsf sends a map key's rename after its setState, past the blur
    <div onBlur={() => setTimeout(card.commit)}>
      <Form
        key={rows}
        schema={card.saved!.schema}
        uiSchema={ui}
        formData={card.draft}
        validator={validator}
        fields={picks}
        templates={templates}
        showErrorList={false}
        formContext={{ ...context, stale: !diag.compiled }}
        experimental_defaultFormStateBehavior={FORM_DEFAULTS}
        extraErrors={fieldErrors((diag.diagnostics ?? []) as never, rel) as never}
        onChange={(e) => change(e.formData)}
        onSubmit={card.commit}
      >
        <span />
      </Form>
    </div>
  );
}

type GenericProps = { rel: string; context: Context; diag: Diag; only?: (fields: string[], defs: never) => string[] };
/** A definition's card from its schema; `only` filters its add menu (a command action's, Action.tsx). */
export function Generic({ rel, context, diag, only = (f) => f }: GenericProps) {
  const card = useCard(rel, diag);
  const cart = useCartridge(diag);
  const { saved, draft } = card;
  const defs = (saved?.schema as { $defs: never } | undefined)?.$defs as never;
  const drawn = useMemo(() => saved && uiSchema(saved.dir, saved.schema as never, defs, registry), [saved]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!drawn) return <p className="px-3 text-xs text-muted-foreground">{card.refused ?? `Loading ${rel}`}</p>;
  const { dir } = saved!; // drawn exactly when saved
  const def = definitionOf(defs, dir, draft); // a prose field added writes its key `~`
  const ui = hidden(drawn, dir, registry, draft, card.revealed);
  const menu = cardMenu(dir, registry, draft, card.revealed, cart, (m) => only(m, defs));
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 px-3 text-xs" aria-label="Card">
      <Header rel={rel} diag={diag} undo={card.undo ? card.back : undefined} />
      {card.refused ? <Refusal boxed>{card.refused}</Refusal> : null}
      <CardForm rel={rel} card={card} context={context} diag={diag} ui={ui} />
      <AddMenu fields={menu} reveal={adder(card, defs, def)} />
    </div>
  );
}

/** Writes the field's least value (its words `~`); one the author must choose is only revealed. */
export const adder = (card: Card, defs: Record<string, never>, def: string) => (f: string) => {
  const next = added((card.draft ?? {}) as Record<string, unknown>, f, defs, def);
  card.reveal(f);
  if (next) (card.change(next), awaits(def, f) || card.commit());
};

/** cartridge.json (its `requires.capabilities` and `world`), read again when it changes. */
export function useCartridge(diag: Diag) {
  return useSource(diag, 'cartridge.json') as
    | { requires?: { capabilities?: object }; world?: Record<string, unknown>; calendar?: { hours_per_day?: number } }
    | undefined;
}

/** A `.json` source `file`'s document, read again on each write to it (undefined: none). */
export function useSource(diag: Diag, file?: string) {
  const [got, setGot] = useState<[string, Record<string, unknown>]>(); // the file read: a slower earlier read shows under no other
  const sha = diag.changes.find((c) => c.file === file)?.sha256;
  useEffect(() => {
    if (file?.endsWith('.json'))
      void fetch(`/__author/source?file=${encodeURIComponent(file)}`)
        .then((r) => r.json())
        .then((s) => setGot([file, JSON.parse(s.bytes)]));
  }, [file, sha]);
  return got && got[0] === file ? got[1] : undefined;
}
