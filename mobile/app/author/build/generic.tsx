// The generic sheet (design §6.4, slice 2.3): any source file's fields, drawn from its kind's schema
// by form.tsx (`def:<file>`). The file and its `/schema/<dir>` are read as the panel's Generic card
// reads them; the server validates each write.
import { cardMenuWith, turnOn } from '../../../../kernel/ts/play/allowed.ts';
import { added, addable, definitionOf } from '../../../../kernel/ts/play/card.ts';
import type { Defs } from '../../../../kernel/ts/play/generic.ts';
import REGISTRY from '../../../../kernel/ts/play/registry.json' with { type: 'json' };
import { combat } from './combat.tsx';
import { field } from './form.tsx';
import type { Block, Mechanics } from './formwrite.ts';
import { known } from './room.tsx';
import { io, refusal } from './roomedit.tsx';
import { schedule } from './schedule.tsx';
import { sheets } from './sheet.tsx';

type Got = { doc: unknown; was: string; kind: string; defs: Defs; root: Record<string, unknown> };
const got = new Map<string, Got>(); // each file with its schema, as last read
const fresh = new Set<string>(); // the files read under the latest /story
let of: unknown; // that /story: a new one reads each file again, showing the old until then
type Cart = Parameters<typeof turnOn>[2] & { calendar?: { hours_per_day?: number } }; // mutate-skip: a type, erased at run time
let cart: { doc: Cart; was: string } | undefined; // cartridge.json as last read: its capabilities gate Add mechanic…

/** `file` and its kind's schema as last read; read again under a new /story, then the Book redraws. */
function load(file: string) {
  if (of !== known.files) (fresh.clear(), (of = known.files), cartridge());
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

function cartridge() {
  io.source('cartridge.json')
    .then((s) => ((cart = { doc: JSON.parse(s.bytes), was: s.sha256 }), known.redraw()))
    .catch(() => ((cart = undefined), known.redraw())); // gone or half-written: no menu until the next /story reads it
}

/** Add mechanic…'s menu for `doc`, once cartridge.json is read: each refused field's turn-on write. */
function mechanics(kind: string, doc: Record<string, unknown>): Mechanics | undefined {
  if (!cart || Array.isArray(doc)) return undefined;
  const c = cart;
  const { allowed, blocked } = cardMenuWith(kind, addable(kind, REGISTRY, doc, []), c.doc, doc);
  const on = (f: string) => turnOn(kind, f, c.doc, doc);
  return {
    allowed,
    blocked: blocked.map((b) => ({
      ...b,
      on: on(b.field) && ['cartridge.json', c.was, on(b.field)!],
    })),
  };
}

type Row = { book?: { edit?: string } };
/** The root fields a block draws instead of the form: the registry row's Book edit file. */
function claims(kind: string, doc: Record<string, unknown>) {
  const by: Record<string, Block> = {
    'combat.tsx': combat,
    'schedule.tsx': schedule(doc.room, cart?.doc.calendar?.hours_per_day),
  };
  return (f: string) => by[(REGISTRY as Record<string, Row>)[`${kind}.${f}`]?.book?.edit ?? ''];
}

/** A source file's sheet: its definition's fields, each written as it is entered. */
function body(file: string) {
  const g = load(file);
  if (!g) return refusal();
  const def = definitionOf(g.defs, g.kind, g.doc);
  const doc = g.doc as Record<string, unknown>;
  const seed = (f: string) => (Array.isArray(doc) ? undefined : added(doc, f, g.defs, def)?.[f]);
  const mech = mechanics(g.kind, doc);
  const at = { file, was: g.was, defs: g.defs, seen: [], seed, mech, claim: claims(g.kind, doc) };
  return [refusal(), field(at, [], g.root, g.doc)];
}

sheets.def = { title: (file) => file, body };
