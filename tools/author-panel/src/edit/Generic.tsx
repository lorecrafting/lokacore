// The generic inspector card (docs/rnd/gui-editor-design-2026-11-04.md §6, §11): rjsf draws the
// definition's own file from its served schema; each blur posts the changed fields to
// POST /change (kernel/ts/play/write.ts), Undo posts /undo, the compiler's refusals show at their field.
import { useCallback, useEffect, useRef, useState } from 'react';
import Form from '@rjsf/core';
import type { RJSFSchema } from '@rjsf/utils';
import type { Op } from '../../../../kernel/ts/play/edit_model.ts';
import { customizeValidator } from '@rjsf/validator-ajv8';
import { Ajv2020 } from 'ajv/dist/2020.js';
import {
  FORM_DEFAULTS,
  addable,
  apart,
  applied,
  diff,
  fieldErrors,
  hidden,
  rebase,
  status,
} from '../../../../kernel/ts/play/card.ts';
import { uiSchema } from '../../../../kernel/ts/play/ui_schema.ts';
import { ask, type useDiagnostics } from '../author.ts';
import { Button } from '../components/ui/button.tsx';
import { fields, type Context } from './fields.tsx';
import registry from './registry.json';

const validator = customizeValidator({ AjvClass: Ajv2020 });
type Saved = { doc: unknown; sha256: string; dir: string; schema: RJSFSchema };
type Sent = { ops?: Op[]; [k: string]: unknown }; // the /change or /undo body

type Diag = ReturnType<typeof useDiagnostics>;

async function source(rel: string): Promise<Saved> {
  const s = await fetch(`/__author/source?file=${encodeURIComponent(rel)}`).then((r) => r.json());
  const schema = await fetch(`/__author/schema/${s.kind}`).then((r) => r.json());
  return { doc: JSON.parse(s.bytes), sha256: s.sha256, dir: s.kind, schema };
}

/** The card's file: loaded, reloaded on a write from outside, changed by a blur and undone. */
export function useCard(rel: string, diag: Diag) {
  const [saved, setSaved] = useState<Saved>();
  const [draft, setDraft] = useState<unknown>();
  const [revealed, setRevealed] = useState<string[]>([]);
  const [undo, setUndo] = useState<string>();
  const [refused, setRefused] = useState<string>();
  const latest = useRef<unknown>(undefined);
  const load = useCallback(
    async (base?: unknown, sent: Op[] = []) => {
      const s = await source(rel);
      setSaved(s);
      setDraft((latest.current = rebase(base, latest.current, s.doc, sent))); // keeps edits not yet sent
    },
    [rel],
  );
  useEffect(() => void (setRevealed([]), load()), [load]); // a new file starts with nothing revealed
  // a write from outside (or the Book's in-place edit) reloads the card
  const outside = diag.changes.find((c) => c.file === rel);
  useEffect(() => {
    if (saved && outside?.file === rel && outside.sha256 !== saved.sha256) void load(saved.doc);
  }, [outside]); // eslint-disable-line react-hooks/exhaustive-deps
  const post = async (path: string, sent: Sent, otherwise: string, held?: string) => {
    const { ok, told } = await ask(path, sent);
    setRefused(ok ? held : typeof told === 'string' ? told : otherwise);
    setUndo(ok && path === 'change' ? (told as { id: string }).id : undefined);
    await load(saved!.doc, sent.ops);
  };
  const commit = () => {
    // rjsf's own live errors would name its `{}` fills; the schema's first error shows on top instead
    const errors = saved ? validator.validateFormData(latest.current, saved.schema).errors : [];
    const held = errors[0] && `${errors[0].property} ${errors[0].message}`;
    const ops = saved ? apart(diff(saved.doc, latest.current), errors) : [];
    if (!ops.length) return void (held && setRefused(held)); // a refusal stays until the next write
    void post('change', { file: rel, was: saved!.sha256, ops }, 'Changed outside: reloaded.', held);
  };
  const change = (doc: unknown) => setDraft((latest.current = applied(saved!.doc, doc)));
  const back = () => void post('undo', { id: undo }, 'Changed since: not undone.');
  const reveal = (f: string) => setRevealed([...revealed, f]);
  return { saved, draft, revealed, undo, refused, change, commit, back, reveal };
}

/** The registry's fields this definition lacks: choosing one reveals its empty field. */
export function AddMenu({ fields: menu, reveal }: { fields: string[]; reveal: (f: string) => void }) {
  if (!menu.length) return null;
  return (
    <select
      aria-label="Add a field"
      className="rounded-md border bg-background px-1"
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

export function Generic({ rel, context, diag }: { rel: string; context: Context; diag: Diag }) {
  const card = useCard(rel, diag);
  const { saved, draft } = card;
  if (!saved) return <p className="px-3 text-xs text-muted-foreground">Loading {rel}</p>;
  const defs = (saved.schema as { $defs: never }).$defs;
  const ui = hidden(
    uiSchema(saved.dir, saved.schema as never, defs, registry),
    saved.dir,
    registry,
    draft,
    card.revealed,
  );
  return (
    <div className="grid gap-2 px-3 text-xs" aria-label="Card">
      <Header rel={rel} diag={diag} undo={card.undo ? card.back : undefined} />
      {card.refused ? <p className="text-destructive">{card.refused}</p> : null}
      <div onBlur={card.commit}>
        <Form
          schema={saved.schema}
          uiSchema={ui}
          formData={draft}
          validator={validator}
          fields={fields}
          formContext={context}
          experimental_defaultFormStateBehavior={FORM_DEFAULTS}
          extraErrors={fieldErrors((diag.diagnostics ?? []) as never, rel) as never}
          onChange={(e) => card.change(e.formData)}
          onSubmit={card.commit}
        >
          <span />
        </Form>
      </div>
      <AddMenu fields={addable(saved.dir, registry, draft, card.revealed)} reveal={card.reveal} />
    </div>
  );
}
