// The generic sheet (design §6.4, slice 2.3): any source file's fields, drawn from its kind's schema
// by form.tsx (`def:<file>`). The file and its `/schema/<dir>` are read as the panel's Generic card
// reads them; the server validates each write.
import { added, definitionOf } from '../../../../kernel/ts/play/card.ts';
import type { Defs } from '../../../../kernel/ts/play/generic.ts';
import { field } from './form.tsx';
import { known } from './room.tsx';
import { io, refusal } from './roomedit.tsx';
import { sheets } from './sheet.tsx';

type Got = { doc: unknown; was: string; kind: string; defs: Defs; root: Record<string, unknown> };
const got = new Map<string, Got>(); // each file with its schema, as last read
const fresh = new Set<string>(); // the files read under the latest /story
let of = known.files; // that /story: a new one reads each file again, showing the old until then

/** `file` and its kind's schema as last read; read again under a new /story, then the Book redraws. */
function load(file: string) {
  if (of !== known.files) (fresh.clear(), (of = known.files));
  if (!fresh.has(file)) {
    fresh.add(file);
    void (async () => {
      const s = await io.source(file);
      const [status, schema] = await known.api!(`/schema/${s.kind}`);
      got.set(file, {
        doc: JSON.parse(s.bytes),
        was: s.sha256,
        kind: s.kind!,
        defs: schema.$defs,
        root: { $ref: schema.$ref },
      });
      known.redraw();
    })().catch(() => {}); // gone or half-written since the /story, or no /schema for its kind: the next /story reads it again
  }
  return got.get(file);
}

/** A source file's sheet: its definition's fields, each written as it is entered. */
function body(file: string) {
  const g = load(file);
  if (!g) return refusal();
  const def = definitionOf(g.defs, g.kind, g.doc);
  const doc = g.doc as Record<string, unknown>;
  const seed = (f: string) => (Array.isArray(doc) ? undefined : added(doc, f, g.defs, def)?.[f]);
  return [refusal(), field({ file, was: g.was, defs: g.defs, seen: [], seed }, [], g.root, g.doc)];
}

sheets.def = { title: (file) => file, body };
